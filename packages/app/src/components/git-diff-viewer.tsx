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

  // Get current file content from file context (working tree)
  const currentContent = createMemo(() => file.getContent(props.path))

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
  const fetchDiff = async () => {
    const path = props.path
    if (!path) return

    setLoading(true)
    setError(null)

    try {
      if (isNewFile()) {
        // New file: before is empty, after is current content
        setBeforeContent("")
        setAfterContent(currentContent() ?? "")
      } else if (props.staged) {
        // Staged changes: compare HEAD vs staged (index)
        // Before: committed version (HEAD)
        // After: staged version (index, accessed with ":" prefix)
        const [headContent, stagedContent] = await Promise.all([
          git.show(path, "HEAD"),
          git.show(path, ":"),
        ])
        setBeforeContent(headContent)
        setAfterContent(stagedContent)
      } else {
        // Unstaged changes: compare staged/HEAD vs working tree
        // Before: staged version if exists, otherwise HEAD
        // After: current working tree content
        let baseContent: string
        try {
          // Try to get staged content first
          baseContent = await git.show(path, ":")
        } catch {
          // Fall back to HEAD if not staged
          baseContent = await git.show(path, "HEAD")
        }
        setBeforeContent(baseContent)
        setAfterContent(currentContent() ?? "")
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
    const staged = props.staged
    if (!path) return

    // Load the current file content for unstaged diffs
    if (!staged) {
      file.load(path)
    }

    fetchDiff()
  })

  // For unstaged diffs, react to file content changes
  createEffect(
    on(
      currentContent,
      (content) => {
        if (!props.staged && content !== undefined) {
          // Update after content directly for unstaged changes
          setAfterContent(content)
        }
      },
      { defer: true }
    )
  )

  // React to git status changes (e.g., staging/unstaging)
  createEffect(
    on(
      () => git.status,
      () => {
        // Refetch when git status changes
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

      // Reload the file content
      file.load(props.path, { force: true })
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
