import { createMemo, For, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { DiffChanges } from "@opencode-ai/ui/diff-changes"
import { getFilename } from "@opencode-ai/util/path"

interface FileListProps {
  onFileClick?: (path: string) => void
}

export function FileList(props: FileListProps) {
  const params = useParams()
  const sync = useSync()

  const diffs = createMemo(() => (params.id ? (sync.data.session_diff[params.id] ?? []) : []))
  const hasFiles = createMemo(() => diffs().length > 0)

  return (
    <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 border-b border-border-weak-base">
        <span class="text-12-medium text-text-weak">
          Changed Files
        </span>
        <Show when={hasFiles()}>
          <span class="text-12-regular text-text-weak">
            {diffs().length}
          </span>
        </Show>
      </div>

      <Show
        when={hasFiles()}
        fallback={
          <div class="px-4 py-6 text-12-regular text-text-weak text-center">
            No files changed
          </div>
        }
      >
        <div class="flex-1 overflow-y-auto">
          <For each={diffs()}>
            {(file) => (
              <button
                class="w-full flex items-center gap-2 px-4 py-2 hover:bg-surface-raised-base-hover transition-colors text-left"
                onClick={() => props.onFileClick?.(file.file)}
              >
                <FileIcon
                  node={{ path: file.file, type: "file" }}
                  class="shrink-0 size-4"
                />
                <span class="flex-1 text-14-regular text-text-base truncate">
                  {getFilename(file.file)}
                </span>
                <DiffChanges changes={file} />
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
