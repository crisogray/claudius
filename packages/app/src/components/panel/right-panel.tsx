import { Show } from "solid-js"
import { useLayout, type RightPanelTab } from "@/context/layout"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon } from "@opencode-ai/ui/icon"

export function RightPanel() {
  const layout = useLayout()

  return (
    <Show when={layout.rightPanel.opened()}>
      <div class="w-[250px] h-full border-l border-border-weak-base flex flex-col bg-background-base shrink-0">
        <Tabs value={layout.rightPanel.activeTab()} onChange={(tab) => layout.rightPanel.setActiveTab(tab as RightPanelTab)}>
          <Tabs.List class="shrink-0 px-1">
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

          <Tabs.Content value="files" class="flex-1 min-h-0 overflow-auto">
            <div class="p-3 text-sm text-text-weak">
              Files tab placeholder - will contain file tree
            </div>
          </Tabs.Content>

          <Tabs.Content value="git" class="flex-1 min-h-0 overflow-auto">
            <div class="p-3 text-sm text-text-weak">
              Git tab placeholder - will contain source control
            </div>
          </Tabs.Content>
        </Tabs>
      </div>
    </Show>
  )
}
