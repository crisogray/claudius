import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useLayout, type RightPanelTab } from "@/context/layout"
import { useGit } from "@/context/git"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon } from "@opencode-ai/ui/icon"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { GitTab } from "@/components/panel/git-tab"
import { SearchTab } from "@/components/panel/search-tab"
import { FilesTab } from "@/components/panel/files-tab"
import { TodosTab, useTodosState } from "@/components/panel/todos-tab"

export function RightPanel() {
  const params = useParams<{ dir: string; id?: string }>()
  const layout = useLayout()
  const git = useGit()

  // Todos badge state
  const todosState = useTodosState(params.id)

  // Git badge state
  const hasGitChanges = createMemo(() => {
    const staged = git.status?.staged ?? []
    const unstaged = git.status?.unstaged ?? []
    const untracked = git.status?.untracked ?? []
    return staged.length > 0 || unstaged.length > 0 || untracked.length > 0
  })

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
        <Tabs
          value={layout.rightPanel.activeTab()}
          onChange={(tab) => layout.rightPanel.setActiveTab(tab as RightPanelTab)}
        >
          <Tabs.List class="shrink-0">
            <Show when={todosState.hasTodos()}>
              <Tabs.Trigger value="todos" title="To-dos" classes={{ button: "gap-1.5" }}>
                <Icon name="checklist" size="small" />
                <span class="text-xs text-secondary">
                  {todosState.completedCount()}/{todosState.totalCount()}
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
            <TodosTab sessionID={params.id} />
          </Tabs.Content>

          <Tabs.Content value="files" class="flex-1 min-h-0 flex flex-col">
            <FilesTab />
          </Tabs.Content>

          <Tabs.Content value="git" class="flex-1 min-h-0">
            <GitTab />
          </Tabs.Content>

          <Tabs.Content value="search" class="flex-1 min-h-0">
            <SearchTab />
          </Tabs.Content>
        </Tabs>
      </div>
    </Show>
  )
}
