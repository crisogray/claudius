import { fn } from "@/util/fn"
import z from "zod"
import { Session } from "."

import { MessageV2 } from "./message-v2"
import { Identifier } from "@/id/id"
import { Snapshot } from "@/snapshot"

import path from "path"
import { Instance } from "@/project/instance"
import { Storage } from "@/storage/storage"
import { Bus } from "@/bus"

export namespace SessionSummary {
  export const summarize = fn(
    z.object({
      sessionID: z.string(),
      messageID: z.string(),
    }),
    async (input) => {
      const all = await Session.messages({ sessionID: input.sessionID })
      await Promise.all([
        summarizeSession({ sessionID: input.sessionID, messages: all }),
        summarizeMessage({ messageID: input.messageID, messages: all }),
      ])
    },
  )

  async function summarizeSession(input: { sessionID: string; messages: MessageV2.WithParts[] }) {
    const files = new Set(
      input.messages
        .flatMap((x) => x.parts)
        .filter((x) => x.type === "patch")
        .flatMap((x) => x.files)
        .map((x) => path.relative(Instance.worktree, x)),
    )

    // Try incremental update: only compute diffs for messages with pre-computed diffs
    // and merge with existing session diffs
    const existingDiffs = await Storage.read<Snapshot.FileDiff[]>(["session_diff", input.sessionID]).catch(
      () => [] as Snapshot.FileDiff[],
    )
    const existingDiffMap = new Map(existingDiffs.map((d) => [d.file, d]))

    // Find messages that have pre-computed diffs (new messages since last summary)
    let hasPrecomputedDiffs = false
    for (const msg of input.messages) {
      if (msg.info.role !== "assistant") continue
      for (const part of msg.parts) {
        if (part.type === "step-finish" && part.precomputedDiff) {
          hasPrecomputedDiffs = true
          // Merge pre-computed diffs into existing map
          for (const diff of part.precomputedDiff) {
            if (!files.has(diff.file)) continue
            const existing = existingDiffMap.get(diff.file)
            if (existing) {
              // Update with latest content but aggregate counts
              existing.before = diff.before
              existing.after = diff.after
              existing.additions = diff.additions
              existing.deletions = diff.deletions
            } else {
              existingDiffMap.set(diff.file, { ...diff })
            }
          }
        }
      }
    }

    // If all messages have pre-computed diffs, use the merged result
    // Otherwise fall back to full computation for backwards compatibility
    const diffs = hasPrecomputedDiffs
      ? Array.from(existingDiffMap.values()).filter((d) => files.has(d.file))
      : await computeDiff({ messages: input.messages }).then((x) => x.filter((x) => files.has(x.file)))

    await Session.update(input.sessionID, (draft) => {
      draft.summary = {
        additions: diffs.reduce((sum, x) => sum + x.additions, 0),
        deletions: diffs.reduce((sum, x) => sum + x.deletions, 0),
        files: diffs.length,
      }
    })
    await Storage.write(["session_diff", input.sessionID], diffs)
    Bus.publish(Session.Event.Diff, {
      sessionID: input.sessionID,
      diff: diffs,
    })
  }

  async function summarizeMessage(input: { messageID: string; messages: MessageV2.WithParts[] }) {
    const messages = input.messages.filter(
      (m) => m.info.id === input.messageID || (m.info.role === "assistant" && m.info.parentID === input.messageID),
    )
    const msgWithParts = messages.find((m) => m.info.id === input.messageID)
    if (!msgWithParts) {
      return
    }
    // Get files actually modified by this message turn (filters out changes from parallel agents)
    const files = new Set(
      messages
        .flatMap((x) => x.parts)
        .filter((x) => x.type === "patch")
        .flatMap((x) => x.files)
        .map((x) => path.relative(Instance.worktree, x)),
    )
    const userMsg = msgWithParts.info as MessageV2.User
    const diffs = await computeDiff({ messages }).then((x) => x.filter((d) => files.has(d.file)))
    userMsg.summary = {
      ...userMsg.summary,
      diffs,
    }
    await Session.updateMessage(userMsg)
  }

  export const diff = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
    }),
    async (input) => {
      return Storage.read<Snapshot.FileDiff[]>(["session_diff", input.sessionID]).catch(() => [])
    },
  )

  async function computeDiff(input: { messages: MessageV2.WithParts[] }) {
    const fileDiffMap = new Map<string, Snapshot.FileDiff>()

    // Process each assistant message's turn individually
    // This excludes external changes made while the conversation is idle
    for (const msg of input.messages) {
      if (msg.info.role !== "assistant") continue

      let turnFrom: string | undefined
      let turnTo: string | undefined
      let precomputedDiff: Snapshot.FileDiff[] | undefined

      for (const part of msg.parts) {
        if (part.type === "step-start" && part.snapshot && !turnFrom) {
          turnFrom = part.snapshot
        }
        if (part.type === "step-finish" && part.snapshot) {
          turnTo = part.snapshot
          // Use pre-computed diff if available (computed at step-finish time)
          precomputedDiff = part.precomputedDiff
        }
      }

      if (!turnFrom || !turnTo) continue

      // Use pre-computed diff if available, otherwise compute now
      // Pre-computed diffs are generated at step-finish time for better performance
      const turnDiffs = precomputedDiff ?? (await Snapshot.diffFull(turnFrom, turnTo))

      // Aggregate into map (sum additions/deletions per file)
      for (const diff of turnDiffs) {
        const existing = fileDiffMap.get(diff.file)
        if (existing) {
          existing.additions += diff.additions
          existing.deletions += diff.deletions
        } else {
          fileDiffMap.set(diff.file, { ...diff })
        }
      }
    }

    return Array.from(fileDiffMap.values())
  }
}
