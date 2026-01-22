import { createEffect, createMemo, createSignal, on, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import { useFile } from "@/context/file"
import { useGit } from "@/context/git"
import { useLayout } from "@/context/layout"
import { IconButton } from "@opencode-ai/ui/icon-button"
import FileTree from "@/components/file-tree"
import { FileContextMenu, useFileContextMenu } from "@/components/panel/file-context-menu"
import type { LocalFile } from "@/context/local"

export function FilesTab() {
  const params = useParams<{ dir: string; id?: string }>()
  const sdk = useSDK()
  const file = useFile()
  const git = useGit()
  const layout = useLayout()
  const [filter, setFilter] = createSignal("")
  const contextMenu = useFileContextMenu()

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)

  // Clear filter on directory change
  createEffect(
    on(
      () => sdk.directory,
      () => {
        setFilter("")
      },
      { defer: true },
    ),
  )

  const handleFileClick = (node: LocalFile) => {
    file.load(node.path)
    const tab = file.tab(node.path)
    layout.tabs(sessionKey()).open(tab)
  }

  return (
    <>
      <div class="p-2 border-b border-border-weak-base">
        <div class="flex items-center gap-2 px-2 h-8 bg-background-element rounded-md border border-border-base focus-within:border-primary">
          <input
            type="text"
            placeholder="Filter files..."
            class="flex-1 text-sm bg-transparent outline-none"
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          <Show when={filter()}>
            <IconButton icon="circle-x" variant="ghost" class="-mr-1" onClick={() => setFilter("")} />
          </Show>
        </div>
      </div>
      <div class="flex-1 overflow-auto no-scrollbar py-2">
        <FileTree
          path="."
          filter={filter()}
          gitStatuses={git.fileStatuses()}
          folderStatuses={git.folderStatuses()}
          onFileClick={handleFileClick}
          onContextMenu={contextMenu.open}
        />
      </div>
      <FileContextMenu state={contextMenu.state()} onClose={contextMenu.close} />
    </>
  )
}
