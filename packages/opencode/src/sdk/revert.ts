import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { Snapshot } from "@/snapshot"
import { Storage } from "@/storage/storage"
import { Log } from "@/util/log"

export namespace SDKRevert {
  const log = Log.create({ service: "sdk.revert" })

  /**
   * Revert a session to a specific message
   *
   * Option A: Keep both our message revert AND SDK's file revert
   *
   * - Removes messages from our storage (hides from UI)
   * - Optionally rewinds files to that checkpoint using our snapshot system
   *
   * Note: SDK session still has full history internally.
   * AI "remembers" but UI doesn't show reverted messages.
   */
  export async function revert(input: {
    sessionID: string
    messageID: string
    rewindFiles?: boolean
  }) {
    log.info("reverting session", {
      sessionID: input.sessionID,
      messageID: input.messageID,
      rewindFiles: input.rewindFiles,
    })

    // 1. Get the message to find its snapshot
    const message = await MessageV2.get({
      sessionID: input.sessionID,
      messageID: input.messageID,
    })

    // 2. Find snapshot for file revert
    let snapshotHash: string | undefined
    if (input.rewindFiles) {
      // Look for StepStartPart with snapshot in this message
      const stepStartPart = message.parts.find(
        (p): p is MessageV2.StepStartPart => p.type === "step-start" && !!p.snapshot,
      )
      snapshotHash = stepStartPart?.snapshot
    }

    // 3. Remove messages from our storage (everything after messageID)
    const messages = await Session.messages({ sessionID: input.sessionID })
    const messageIndex = messages.findIndex((m) => m.info.id === input.messageID)

    if (messageIndex === -1) {
      log.error("message not found", { messageID: input.messageID })
      return
    }

    // Remove messages after this one
    const toRemove = messages.slice(messageIndex + 1)
    for (const msg of toRemove) {
      // Remove parts first
      for (const part of msg.parts) {
        await Storage.remove(["part", msg.info.id, part.id])
      }
      // Then remove message
      await Storage.remove(["message", input.sessionID, msg.info.id])
      log.info("removed message", { messageID: msg.info.id })
    }

    // 4. Optionally rewind files using our snapshot system
    if (input.rewindFiles && snapshotHash) {
      log.info("restoring snapshot", { hash: snapshotHash })
      await Snapshot.restore(snapshotHash)
    }

    // 5. Update session with revert info
    await Session.update(input.sessionID, (draft) => {
      draft.revert = {
        messageID: input.messageID,
        snapshot: snapshotHash,
      }
    })

    log.info("revert complete", {
      removedCount: toRemove.length,
      filesReverted: !!snapshotHash,
    })
  }

  /**
   * Undo a revert - restores the reverted messages
   *
   * Note: This only works if we haven't compacted/cleaned up the storage
   * In practice, we may need to keep reverted messages in a separate location
   */
  export async function unrevert(input: { sessionID: string }) {
    log.info("unreverting session", { sessionID: input.sessionID })

    // Clear revert state
    await Session.update(input.sessionID, (draft) => {
      draft.revert = undefined
    })

    // Note: Actually restoring messages would require keeping them somewhere
    // For now, this just clears the revert state
    // Future enhancement: Move reverted messages to a "reverted" storage area
    // instead of deleting them
  }

  /**
   * Get patches from messages after a specific point
   * Used to know what files changed for revert
   */
  export async function getPatches(input: {
    sessionID: string
    afterMessageID: string
  }): Promise<Snapshot.Patch[]> {
    const messages = await Session.messages({ sessionID: input.sessionID })
    const patches: Snapshot.Patch[] = []

    let foundStart = false
    for (const msg of messages) {
      if (msg.info.id === input.afterMessageID) {
        foundStart = true
        continue
      }
      if (!foundStart) continue

      // Find PatchParts in this message
      for (const part of msg.parts) {
        if (part.type === "patch") {
          patches.push({
            hash: part.hash,
            files: part.files,
          })
        }
      }
    }

    return patches
  }
}
