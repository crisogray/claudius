import { createEffect, createMemo, createSignal, For, on, Show, type JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { useGit, type GitFileStatus } from "@/context/git"
import { useSDK } from "@/context/sdk"
import { useFile } from "@/context/file"
import { useLayout } from "@/context/layout"
import { Icon } from "@opencode-ai/ui/icon"
import { Button } from "@opencode-ai/ui/button"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { FileIcon } from "@opencode-ai/ui/file-icon"

// Small action button for git operations
function ActionButton(props: {
  icon: "plus" | "close" | "pencil-line"
  onClick: (e: MouseEvent) => void
  title: string
}) {
  return (
    <button
      class="size-4 flex items-center justify-center rounded hover:bg-background-element text-text-muted cursor-pointer"
      onClick={props.onClick}
      title={props.title}
    >
      <Icon name={props.icon} size="small" />
    </button>
  )
}

function GitStatusBadge(props: { status: GitFileStatus }) {
  const statusConfig = {
    modified: { letter: "M", class: "text-icon-warning-base" },
    added: { letter: "A", class: "text-text-diff-add-base" },
    deleted: { letter: "D", class: "text-text-diff-delete-base" },
    untracked: { letter: "U", class: "text-text-diff-add-base" },
    renamed: { letter: "R", class: "text-text-interactive-base" },
    copied: { letter: "C", class: "text-text-interactive-base" },
  }

  const config = () => statusConfig[props.status.status] ?? { letter: "?", class: "text-text-weak" }

  return <span class={`text-[10px] font-mono font-medium ${config().class}`}>{config().letter}</span>
}

function DiffStats(props: { added: number; removed: number }) {
  return (
    <Show when={props.added > 0 || props.removed > 0}>
      <span class="!text-[10px] font-mono flex gap-1" data-component="diff-changes">
        <Show when={props.added > 0}>
          <span class="!text-[10px]" data-slot="diff-changes-additions">
            +{props.added}
          </span>
        </Show>
        <Show when={props.removed > 0}>
          <span class="!text-[10px]" data-slot="diff-changes-deletions">
            -{props.removed}
          </span>
        </Show>
      </span>
    </Show>
  )
}

function GitFileSection(props: {
  title: string
  files: GitFileStatus[]
  onFileClick?: (file: GitFileStatus) => void
  actions?: (file: GitFileStatus) => JSX.Element
  headerActions?: JSX.Element
}) {
  return (
    <Show when={props.files.length > 0}>
      <Collapsible defaultOpen={true} variant="ghost" class="w-full">
        <Collapsible.Trigger class="w-full">
          <div class="w-full px-2 py-1.5 flex items-center gap-2 bg-background-element">
            <Collapsible.Arrow class="text-text-muted/60" />
            <span class="text-xs font-medium">{props.title}</span>
            <span class="text-xs text-text-muted">({props.files.length})</span>
            <div class="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {props.headerActions}
            </div>
          </div>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <For each={props.files}>
            {(file) => (
              <div
                class="px-3 py-1 flex items-center gap-2 hover:bg-background-element cursor-pointer group"
                onClick={() => props.onFileClick?.(file)}
              >
                <GitStatusBadge status={file} />
                <FileIcon node={{ path: file.path, type: "file" }} class="w-4 h-4" />
                <span class="flex-1 text-xs flex items-baseline min-w-0 overflow-hidden">
                  <span class="text-text-strong shrink-0">{file.path.replace(/\/$/, "").split("/").pop()}</span>
                  <span class="text-[10px] text-text-weak ml-1 truncate">
                    {file.path.replace(/\/$/, "").split("/").slice(0, -1).join("/")}
                  </span>
                </span>
                <DiffStats added={file.added} removed={file.removed} />
                <div class="hidden group-hover:flex items-center gap-1">{props.actions?.(file)}</div>
              </div>
            )}
          </For>
        </Collapsible.Content>
      </Collapsible>
    </Show>
  )
}

function formatRelative(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp * 1000
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

export function GitTab() {
  const params = useParams<{ dir: string; id?: string }>()
  const sdk = useSDK()
  const git = useGit()
  const file = useFile()
  const layout = useLayout()
  const [commitMessage, setCommitMessage] = createSignal("")
  const [amend, setAmend] = createSignal(false)
  const [committing, setCommitting] = createSignal(false)

  // Clear commit form state on directory change
  createEffect(
    on(
      () => sdk.directory,
      () => {
        setCommitMessage("")
        setAmend(false)
      },
      { defer: true },
    ),
  )

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)

  const handleOpenFile = (filePath: string, staged = false) => {
    file.load(filePath)
    const tab = file.diffTab(filePath, staged)
    layout.tabs(sessionKey()).open(tab)
  }

  const hasStaged = createMemo(() => (git.status?.staged.length ?? 0) > 0)
  const hasUnstaged = createMemo(() => (git.status?.unstaged.length ?? 0) + (git.status?.untracked.length ?? 0) > 0)
  const hasChanges = createMemo(
    () =>
      (git.status?.staged.length ?? 0) + (git.status?.unstaged.length ?? 0) + (git.status?.untracked.length ?? 0) > 0,
  )

  const handleCommit = async () => {
    if (!commitMessage().trim()) return
    // Need either staged changes, or unstaged changes to stage first
    if (!hasStaged() && !hasUnstaged()) return

    setCommitting(true)
    try {
      // If nothing staged but there are unstaged changes, stage all first
      if (!hasStaged() && hasUnstaged()) {
        await git.stageAll()
      }
      await git.commit(commitMessage(), { amend: amend() })
      setCommitMessage("")
      setAmend(false)
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div class="h-full flex flex-col text-sm">
      {/* Loading state */}
      <Show when={git.loading && !git.status}>
        <div class="flex-1 flex items-center justify-center">
          <span class="text-xs text-text-muted">Loading...</span>
        </div>
      </Show>

      {/* Error state */}
      <Show when={git.error}>
        <div class="p-2 text-xs text-red-500">{git.error}</div>
      </Show>

      {/* File sections */}
      <Show when={git.status}>
        <div class="flex-1 overflow-y-auto no-scrollbar">
          <Show
            when={hasChanges()}
            fallback={
              <div class="h-full flex items-center justify-center p-4">
                <span class="text-xs text-text-muted text-center">No changes</span>
              </div>
            }
          >
            {/* Staged */}
            <GitFileSection
              title="Staged Changes"
              files={git.status?.staged ?? []}
              onFileClick={(f) => handleOpenFile(f.path, true)}
              actions={(f) => (
                <>
                  <ActionButton
                    icon="pencil-line"
                    onClick={(e) => {
                      e.stopPropagation()
                      file.load(f.path)
                      layout.tabs(sessionKey()).open(file.tab(f.path))
                    }}
                    title="Open file"
                  />
                  <ActionButton
                    icon="close"
                    onClick={(e) => {
                      e.stopPropagation()
                      git.unstage([f.path])
                    }}
                    title="Unstage"
                  />
                </>
              )}
              headerActions={
                <Show when={(git.status?.staged.length ?? 0) > 0}>
                  <ActionButton icon="close" onClick={() => git.unstageAll()} title="Unstage all" />
                </Show>
              }
            />

            {/* Changes (unstaged + untracked) */}
            <GitFileSection
              title="Changes"
              files={[...(git.status?.unstaged ?? []), ...(git.status?.untracked ?? [])]}
              onFileClick={(f) => handleOpenFile(f.path, false)}
              actions={(f) => (
                <>
                  <ActionButton
                    icon="pencil-line"
                    onClick={(e) => {
                      e.stopPropagation()
                      file.load(f.path)
                      layout.tabs(sessionKey()).open(file.tab(f.path))
                    }}
                    title="Open file"
                  />
                  <ActionButton
                    icon="plus"
                    onClick={(e) => {
                      e.stopPropagation()
                      git.stage([f.path])
                    }}
                    title="Stage"
                  />
                  <ActionButton
                    icon="close"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (f.status === "untracked") {
                        git.deleteUntracked([f.path])
                      } else {
                        git.discard([f.path])
                      }
                    }}
                    title={f.status === "untracked" ? "Delete" : "Discard"}
                  />
                </>
              )}
              headerActions={
                <Show when={(git.status?.unstaged.length ?? 0) + (git.status?.untracked.length ?? 0) > 0}>
                  <ActionButton icon="plus" onClick={() => git.stageAll()} title="Stage all" />
                </Show>
              }
            />
          </Show>
        </div>

        {/* Commit form */}
        <div class="p-2 border-t border-border-weak-base">
          <textarea
            placeholder="Commit message..."
            class="w-full px-2 py-1.5 text-xs bg-background-element rounded-md border border-border-base resize-none focus:border-primary focus:outline-none"
            rows={2}
            value={commitMessage()}
            onInput={(e) => setCommitMessage(e.currentTarget.value)}
          />
          <div class="flex items-center gap-2 mt-2">
            <label class="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={amend()}
                onChange={(e) => setAmend(e.currentTarget.checked)}
                class="w-3 h-3"
              />
              Amend
            </label>
            <Button
              size="small"
              class="ml-auto"
              disabled={(!hasStaged() && !hasUnstaged()) || !commitMessage().trim() || committing()}
              onClick={handleCommit}
            >
              {committing() ? "Committing..." : "Commit"}
            </Button>
          </div>
        </div>

        {/* Branch header */}
        <div class="p-2 border-t border-border-weak-base flex items-center gap-2">
          <Icon name="branch" size="small" class="text-text-muted" />
          <span class="font-medium text-xs">{git.status?.branch ?? "detached"}</span>
          <Show when={git.status?.ahead || git.status?.behind}>
            <span class="text-[10px] text-text-muted">
              {git.status?.ahead ? `\u2191${git.status.ahead}` : ""}
              {git.status?.behind ? `\u2193${git.status.behind}` : ""}
            </span>
          </Show>
          <button
            class="ml-auto p-1 rounded hover:bg-background-element text-text-muted hover:text-text"
            onClick={() => git.refresh()}
            title="Refresh"
          >
            <Icon name="chevron-grabber-vertical" size="small" />
          </button>
        </div>

        {/* History */}
        <Show when={git.log.length > 0}>
          <Collapsible
            defaultOpen={false}
            variant="ghost"
            class="w-full border-t border-border-weak-base rounded-none bg-background-strong"
          >
            <Collapsible.Trigger class="w-full">
              <div class="w-full p-2 flex items-center gap-2 border-b border-border-weak-base">
                <Collapsible.Arrow class="text-text-muted/60" />
                <span class="text-xs font-medium">History</span>
              </div>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div class="max-h-48 overflow-y-auto no-scrollbar">
                <For each={git.log}>
                  {(commit) => (
                    <div class="px-2 py-1.5 hover:bg-background-element border-b border-border-weak-base last:border-b-0">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-[10px] text-primary">{commit.hashShort}</span>
                        <span class="text-xs truncate flex-1">{commit.messageShort}</span>
                      </div>
                      <div class="text-[10px] text-text-muted">
                        {commit.author} &bull; {formatRelative(commit.date)}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Collapsible.Content>
          </Collapsible>
        </Show>
      </Show>
    </div>
  )
}
