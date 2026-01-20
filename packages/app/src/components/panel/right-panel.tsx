import { createMemo, createSignal, For, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useLayout, type RightPanelTab } from "@/context/layout"
import { useFile } from "@/context/file"
import { useGit } from "@/context/git"
import { useSync } from "@/context/sync"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon } from "@opencode-ai/ui/icon"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import FileTree from "@/components/file-tree"
import { GitTab } from "@/components/panel/git-tab"
import { SearchTab } from "@/components/panel/search-tab"
import { FileContextMenu, useFileContextMenu } from "@/components/panel/file-context-menu"
import type { LocalFile } from "@/context/local"
import type { Todo } from "@opencode-ai/sdk/v2/client"

export function RightPanel() {
  const params = useParams<{ dir: string; id?: string }>()
  const layout = useLayout()
  const file = useFile()
  const git = useGit()
  const sync = useSync()
  const [filter, setFilter] = createSignal("")
  const contextMenu = useFileContextMenu()

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)

  const todos = createMemo(() => (params.id ? sync.data.todo[params.id] ?? [] : []))
  const hasTodos = createMemo(() => todos().length > 0)
  const completedCount = createMemo(() => todos().filter((t) => t.status === "completed").length)

  const hasGitChanges = createMemo(() => {
    const status = git.status
    if (!status) return false
    return status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0
  })

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
            <Show when={hasTodos()}>
              <Tabs.Trigger value="todos" title="To-dos" classes={{ button: "gap-1.5" }}>
                <Icon name="checklist" size="small" />
                <span class="text-xs text-secondary">
                  {completedCount()}/{todos().length}
                </span>
              </Tabs.Trigger>
            </Show>
            <Tabs.Trigger value="files" title="Files">
              <Icon name="folder" size="small" />
            </Tabs.Trigger>
            <Tabs.Trigger value="git" title="Git" class="relative">
              <Icon name="branch" size="small" />
              <Show when={hasGitChanges()}>
                <div class="absolute top-1/2 -translate-y-1/2 right-4 size-1.5 rounded-full bg-surface-warning-strong" />
              </Show>
            </Tabs.Trigger>
            <Tabs.Trigger value="search" title="Search">
              <Icon name="magnifying-glass" size="small" />
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="todos" class="flex-1 min-h-0 overflow-auto py-2 px-3">
            <div data-component="todos" data-panel>
              <For each={todos()}>
                {(todo: Todo) => (
                  <Checkbox readOnly checked={todo.status === "completed"}>
                    <div data-slot="message-part-todo-content" data-completed={todo.status === "completed"}>
                      {todo.content}
                    </div>
                  </Checkbox>
                )}
              </For>
            </div>
          </Tabs.Content>

          <Tabs.Content value="files" class="flex-1 min-h-0 flex flex-col">
            <div class="p-2 border-b border-border-weak-base">
              <input
                type="text"
                placeholder="Filter files..."
                class="w-full px-2 py-1 text-sm bg-background-element rounded-md border border-border-base focus:border-primary focus:outline-none"
                value={filter()}
                onInput={(e) => setFilter(e.currentTarget.value)}
              />
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
          </Tabs.Content>

          <Tabs.Content value="git" class="flex-1 min-h-0">
            <GitTab />
          </Tabs.Content>

          <Tabs.Content value="search" class="flex-1 min-h-0">
            <SearchTab />
          </Tabs.Content>
        </Tabs>

        <FileContextMenu state={contextMenu.state()} onClose={contextMenu.close} />
      </div>
    </Show>
  )
}
