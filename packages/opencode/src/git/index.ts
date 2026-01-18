import { z } from "zod"
import { $ } from "bun"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { BusEvent } from "../bus/bus-event"
import { Log } from "../util/log"

export namespace Git {
  const logger = Log.create({ service: "git" })

  // ═══════════════════════════════════════════════════════════════
  // TYPES
  // ═══════════════════════════════════════════════════════════════

  export const FileStatus = z
    .object({
      path: z.string(),
      status: z.enum(["modified", "added", "deleted", "untracked", "renamed", "copied"]),
      staged: z.boolean(),
      added: z.number(), // Lines added
      removed: z.number(), // Lines removed
      oldPath: z.string().optional(), // For renames
    })
    .meta({ ref: "GitFileStatus" })
  export type FileStatus = z.infer<typeof FileStatus>

  export const Status = z
    .object({
      branch: z.string().optional(),
      upstream: z.string().optional(),
      ahead: z.number(),
      behind: z.number(),
      staged: FileStatus.array(),
      unstaged: FileStatus.array(),
      untracked: FileStatus.array(),
      conflicted: FileStatus.array(),
    })
    .meta({ ref: "GitStatus" })
  export type Status = z.infer<typeof Status>

  export const Commit = z
    .object({
      hash: z.string(),
      hashShort: z.string(),
      author: z.string(),
      email: z.string(),
      date: z.number(), // Unix timestamp
      message: z.string(),
      messageShort: z.string(),
    })
    .meta({ ref: "GitCommit" })
  export type Commit = z.infer<typeof Commit>

  export const CommitResult = z
    .object({
      hash: z.string(),
      message: z.string(),
    })
    .meta({ ref: "GitCommitResult" })
  export type CommitResult = z.infer<typeof CommitResult>

  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════

  export const Event = {
    StatusUpdated: BusEvent.define("git.status.updated", Status),
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  function parseStatusChar(char: string): FileStatus["status"] {
    switch (char) {
      case "M":
        return "modified"
      case "A":
        return "added"
      case "D":
        return "deleted"
      case "R":
        return "renamed"
      case "C":
        return "copied"
      default:
        return "modified"
    }
  }

  /**
   * Get full git status including staged, unstaged, untracked files
   * Uses `git status --porcelain=v2` for accurate parsing
   */
  export async function status(): Promise<Status> {
    const cwd = Instance.directory

    // Get branch info
    const branchOutput = await $`git rev-parse --abbrev-ref HEAD`.cwd(cwd).quiet().nothrow().text()
    const branch = branchOutput.trim() || undefined

    // Get ahead/behind
    let ahead = 0,
      behind = 0
    const abOutput = await $`git rev-list --left-right --count HEAD...@{upstream}`
      .cwd(cwd)
      .quiet()
      .nothrow()
      .text()
    if (abOutput.trim()) {
      const [a, b] = abOutput.trim().split(/\s+/)
      ahead = parseInt(a) || 0
      behind = parseInt(b) || 0
    }

    // Get status with porcelain v2 format
    const statusOutput = await $`git status --porcelain=v2`.cwd(cwd).quiet().nothrow().text()

    const staged: FileStatus[] = []
    const unstaged: FileStatus[] = []
    const untracked: FileStatus[] = []
    const conflicted: FileStatus[] = []

    for (const line of statusOutput.split("\n")) {
      if (!line) continue

      if (line.startsWith("?")) {
        // Untracked: ? path
        const path = line.slice(2)
        untracked.push({ path, status: "untracked", staged: false, added: 0, removed: 0 })
      } else if (line.startsWith("1") || line.startsWith("2")) {
        // Changed entry: 1 XY ... path OR 2 XY ... path oldpath
        const parts = line.split(" ")
        const xy = parts[1]
        const path = parts.slice(8).join(" ").split("\t")[0]

        const indexStatus = xy[0] // X = index status
        const workStatus = xy[1] // Y = worktree status

        // Parse staged changes (index)
        if (indexStatus !== ".") {
          staged.push({
            path,
            status: parseStatusChar(indexStatus),
            staged: true,
            added: 0, // Will be filled by numstat
            removed: 0,
          })
        }

        // Parse unstaged changes (worktree)
        if (workStatus !== ".") {
          unstaged.push({
            path,
            status: parseStatusChar(workStatus),
            staged: false,
            added: 0,
            removed: 0,
          })
        }
      } else if (line.startsWith("u")) {
        // Unmerged entry (conflict)
        const parts = line.split(" ")
        const path = parts.slice(10).join(" ")
        conflicted.push({ path, status: "modified", staged: false, added: 0, removed: 0 })
      }
    }

    // Get line counts for staged files
    const stagedNumstat = await $`git diff --cached --numstat`.cwd(cwd).quiet().nothrow().text()
    for (const line of stagedNumstat.split("\n")) {
      if (!line) continue
      const [added, removed, path] = line.split("\t")
      const file = staged.find((f) => f.path === path)
      if (file) {
        file.added = added === "-" ? 0 : parseInt(added)
        file.removed = removed === "-" ? 0 : parseInt(removed)
      }
    }

    // Get line counts for unstaged files
    const unstagedNumstat = await $`git diff --numstat`.cwd(cwd).quiet().nothrow().text()
    for (const line of unstagedNumstat.split("\n")) {
      if (!line) continue
      const [added, removed, path] = line.split("\t")
      const file = unstaged.find((f) => f.path === path)
      if (file) {
        file.added = added === "-" ? 0 : parseInt(added)
        file.removed = removed === "-" ? 0 : parseInt(removed)
      }
    }

    logger.info("git status", {
      branch,
      ahead,
      behind,
      staged: staged.length,
      unstaged: unstaged.length,
      untracked: untracked.length,
    })

    return { branch, ahead, behind, staged, unstaged, untracked, conflicted }
  }

  /**
   * Get commit history
   */
  export async function log(limit = 20): Promise<Commit[]> {
    const cwd = Instance.directory
    const format = "%H|%h|%an|%ae|%at|%s"
    const output = await $`git log --format=${format} -n ${limit}`.cwd(cwd).quiet().nothrow().text()

    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, hashShort, author, email, date, ...messageParts] = line.split("|")
        const message = messageParts.join("|")
        return {
          hash,
          hashShort,
          author,
          email,
          date: parseInt(date),
          message,
          messageShort: message.slice(0, 72),
        }
      })
  }

  /**
   * Stage files
   */
  export async function stage(files: string[]): Promise<void> {
    if (files.length === 0) return
    await $`git add ${files}`.cwd(Instance.directory).quiet()
    Bus.publish(Event.StatusUpdated, await status())
  }

  /**
   * Unstage files
   */
  export async function unstage(files: string[]): Promise<void> {
    if (files.length === 0) return
    await $`git reset HEAD -- ${files}`.cwd(Instance.directory).quiet().nothrow()
    Bus.publish(Event.StatusUpdated, await status())
  }

  /**
   * Stage all changes
   */
  export async function stageAll(): Promise<void> {
    await $`git add -A`.cwd(Instance.directory).quiet()
    Bus.publish(Event.StatusUpdated, await status())
  }

  /**
   * Unstage all changes
   */
  export async function unstageAll(): Promise<void> {
    await $`git reset HEAD`.cwd(Instance.directory).quiet().nothrow()
    Bus.publish(Event.StatusUpdated, await status())
  }

  /**
   * Discard unstaged changes to a file (revert to index)
   */
  export async function discard(files: string[]): Promise<void> {
    if (files.length === 0) return
    await $`git checkout -- ${files}`.cwd(Instance.directory).quiet()
    Bus.publish(Event.StatusUpdated, await status())
  }

  /**
   * Delete untracked files from the working directory
   */
  export async function deleteUntracked(files: string[]): Promise<void> {
    if (files.length === 0) return
    await $`rm -f -- ${files}`.cwd(Instance.directory).quiet()
    Bus.publish(Event.StatusUpdated, await status())
  }

  /**
   * Create a commit
   */
  export async function commit(message: string, options?: { amend?: boolean }): Promise<CommitResult> {
    const args = options?.amend ? ["--amend"] : []
    await $`git commit -m ${message} ${args}`.cwd(Instance.directory).quiet()

    const hash = await $`git rev-parse HEAD`.cwd(Instance.directory).quiet().text()
    Bus.publish(Event.StatusUpdated, await status())

    return { hash: hash.trim(), message }
  }

  /**
   * Get diff for a specific file
   */
  export async function diff(file: string, staged = false): Promise<string> {
    const args = staged ? ["--cached"] : []
    return await $`git diff ${args} -- ${file}`.cwd(Instance.directory).quiet().text()
  }

  /**
   * Get file content from a git ref (HEAD, index, or specific commit)
   * @param file - Path to the file
   * @param ref - Git ref: "HEAD" for committed, ":" for staged/index, or a commit hash
   */
  export async function show(file: string, ref = "HEAD"): Promise<string> {
    // For staged content, use `:path` (colon prefix means staged/index)
    const refPath = ref === ":" ? `:${file}` : `${ref}:${file}`
    return await $`git show ${refPath}`.cwd(Instance.directory).quiet().nothrow().text()
  }

  /**
   * Get a map of file paths to their git status (for file tree badges)
   */
  export async function fileStatuses(): Promise<Map<string, FileStatus>> {
    const s = await status()
    const map = new Map<string, FileStatus>()

    for (const file of s.staged) {
      map.set(file.path, file)
    }
    for (const file of s.unstaged) {
      // Unstaged takes precedence if file is in both
      map.set(file.path, file)
    }
    for (const file of s.untracked) {
      map.set(file.path, file)
    }

    return map
  }
}
