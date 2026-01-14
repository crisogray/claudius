import { createMemo, createSignal, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useLayout, type RightPanelTab } from "@/context/layout"
import { useFile } from "@/context/file"
import { useGit } from "@/context/git"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon } from "@opencode-ai/ui/icon"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import FileTree from "@/components/file-tree"
import { GitTab } from "@/components/panel/git-tab"
import { FileContextMenu, useFileContextMenu } from "@/components/panel/file-context-menu"
import type { LocalFile } from "@/context/local"

export function RightPanel() {
  const params = useParams<{ dir: string; id?: string }>()
  const layout = useLayout()
  const file = useFile()
  const git = useGit()
  const [filter, setFilter] = createSignal("")
  const contextMenu = useFileContextMenu()

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)

  const handleFileClick = (node: LocalFile) => {
    file.load(node.path)
    const tab = file.tab(node.path)
    layout.tabs(sessionKey()).open(tab)
  }

  return (
    <Show when={layout.rightPanel.opened()}>
      <div
        class="relative h-full border-l border-border-weak-base flex flex-col bg-background-base shrink-0"
        style={{ width: `${layout.rightPanel.width()}px` }}
      >
        <ResizeHandle
          direction="horizontal"
          reverse
          size={layout.rightPanel.width()}
          min={150}
          max={500}
          collapseThreshold={100}
          onResize={layout.rightPanel.resize}
          onCollapse={layout.rightPanel.close}
        />
        <Tabs value={layout.rightPanel.activeTab()} onChange={(tab) => layout.rightPanel.setActiveTab(tab as RightPanelTab)}>
          <Tabs.List class="shrink-0">
            <Tabs.Trigger value="files" class="flex-1">
              <div class="flex items-center gap-1.5">
                <Icon name="folder" size="small" />
                <span>Files</span>
              </div>
            </Tabs.Trigger>
            <Tabs.Trigger value="git" class="flex-1">
              <div class="flex items-center gap-1.5">
                <Icon name="branch" size="small" />
                <span>Git</span>
              </div>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="files" class="flex-1 min-h-0 flex flex-col">
            <div class="p-2 border-b border-border-base">
              <input
                type="text"
                placeholder="Filter files..."
                class="w-full px-2 py-1 text-sm bg-background-element rounded-md border border-border-base focus:border-primary focus:outline-none"
                value={filter()}
                onInput={(e) => setFilter(e.currentTarget.value)}
              />
            </div>
            <div class="flex-1 overflow-auto py-2">
              <FileTree
                path="."
                filter={filter()}
                gitStatuses={git.fileStatuses()}
                folderStatuses={git.folderStatuses()}
                onFileClick={handleFileClick}
                onContextMenu={contextMenu.open}
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="git" class="flex-1 min-h-0">
            <GitTab />
          </Tabs.Content>
        </Tabs>

        <FileContextMenu state={contextMenu.state()} onClose={contextMenu.close} />
      </div>
    </Show>
  )
}
