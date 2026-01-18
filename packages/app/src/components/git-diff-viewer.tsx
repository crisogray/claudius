import { createSignal, createEffect, createMemo, Show, on, onCleanup } from "solid-js"
import { Diff } from "@opencode-ai/ui/diff"
import { useGit, type GitFileStatus } from "@/context/git"
import { useFile } from "@/context/file"
import { useSDK } from "@/context/sdk"

export interface GitDiffViewerProps {
  /** File path (relative to project root) */
  path: string
  /** Whether the file is staged */
  staged?: boolean
  /** Additional CSS class */
  class?: string
}

export function GitDiffViewer(props: GitDiffViewerProps) {
  const git = useGit()
  const file = useFile()
  const sdk = useSDK()

  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [beforeContent, setBeforeContent] = createSignal("")
  const [afterContent, setAfterContent] = createSignal("")

  // Get the git status for this file
  const gitStatus = createMemo((): GitFileStatus | undefined => {
    return git.fileStatuses().get(props.path)
  })

  // Check if file is new (untracked or added)
  const isNewFile = createMemo(() => {
    const status = gitStatus()
    return status?.status === "untracked" || status?.status === "added"
  })

  // Fetch the diff contents based on staged/unstaged mode
  const fetchDiff = async (opts?: { force?: boolean }) => {
    const path = props.path
    if (!path) return

    // Only show loading on initial/forced fetch
    if (opts?.force || !beforeContent()) {
      setLoading(true)
    }
    setError(null)

    try {
      let newBefore: string
      let newAfter: string

      // Check if file is no longer in git status (committed/discarded)
      const status = gitStatus()
      if (!status && !opts?.force) {
        // File has no changes - show identical before/after (empty diff)
        try {
          const headContent = await git.show(path, "HEAD")
          if (headContent !== beforeContent() || headContent !== afterContent()) {
            setBeforeContent(headContent)
            setAfterContent(headContent)
          }
        } catch {
          // File might not exist in HEAD (new file that was discarded)
          if ("" !== beforeContent() || "" !== afterContent()) {
            setBeforeContent("")
            setAfterContent("")
          }
        }
        setLoading(false)
        return
      }

      // Helper to fetch working tree content directly via API
      const fetchWorkingTreeContent = async (): Promise<string> => {
        const result = await sdk.client.file.read({ path })
        return result.data?.content ?? ""
      }

      if (isNewFile()) {
        // New file: before is empty, after is current content
        newBefore = ""
        newAfter = await fetchWorkingTreeContent()
      } else if (props.staged) {
        // Staged changes: compare HEAD vs staged (index)
        // Before: committed version (HEAD)
        // After: staged version (index, accessed with ":" prefix)
        const [headContent, stagedContent] = await Promise.all([
          git.show(path, "HEAD"),
          git.show(path, ":"),
        ])
        newBefore = headContent
        newAfter = stagedContent
      } else {
        // Unstaged changes: compare staged/HEAD vs working tree
        // Before: staged version if exists, otherwise HEAD
        // After: current working tree content (fetched directly via API)
        let baseContent: string
        try {
          // Try to get staged content first
          baseContent = await git.show(path, ":")
        } catch {
          // Fall back to HEAD if not staged
          baseContent = await git.show(path, "HEAD")
        }
        newBefore = baseContent
        newAfter = await fetchWorkingTreeContent()
      }

      // Only update signals if content actually changed (prevents unnecessary re-renders)
      if (newBefore !== beforeContent()) {
        setBeforeContent(newBefore)
      }
      if (newAfter !== afterContent()) {
        setAfterContent(newAfter)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diff")
    } finally {
      setLoading(false)
    }
  }

  // Initial load and react to path/staged changes
  createEffect(() => {
    const path = props.path
    const _staged = props.staged // Track staged prop for reactivity
    if (!path) return

    fetchDiff({ force: true })
  })

  // React to git status changes (e.g., staging/unstaging)
  // Track the specific file's status to ensure reactivity
  // We need to detect TRANSITIONS from "has status" to "no status" without continuous polling
  let prevHadStatus = false

  createEffect(
    on(
      () => {
        const status = gitStatus()
        const hadStatus = prevHadStatus
        prevHadStatus = !!status

        if (status) {
          // File has changes - track status properties
          return `${status.staged}:${status.status}`
        } else if (hadStatus) {
          // Just transitioned from "has status" to "no status" - trigger one fetch
          return `none:${git.refreshedAt}`
        } else {
          // Already had no status - return stable value (no fetch)
          return "none:stable"
        }
      },
      () => {
        fetchDiff()
      },
      { defer: true }
    )
  )

  // Listen for file watcher events to update unstaged diffs
  createEffect(() => {
    if (props.staged) return // Only watch for unstaged diffs

    const stop = sdk.event.listen((e) => {
      const event = e.details
      if (event.type !== "file.watcher.updated") return

      // Check if the changed file matches our path
      const changedPath = file.normalize(event.properties.file)
      if (changedPath !== props.path) return

      fetchDiff()
    })

    onCleanup(stop)
  })

  return (
    <div class={`relative h-full flex flex-col overflow-hidden ${props.class ?? ""}`}>
      <Show when={loading()}>
        <div class="flex items-center justify-center h-full text-text-weak">Loading diff...</div>
      </Show>
      <Show when={error()}>
        {(err) => (
          <div class="flex items-center justify-center h-full text-text-weak">{err()}</div>
        )}
      </Show>
      <Show when={!loading() && !error()}>
        <div class="flex-1 min-h-0 overflow-auto">
          <Diff
            before={{
              name: props.path,
              contents: beforeContent(),
            }}
            after={{
              name: props.path,
              contents: afterContent(),
            }}
            diffStyle="unified"
          />
        </div>
      </Show>
    </div>
  )
}
