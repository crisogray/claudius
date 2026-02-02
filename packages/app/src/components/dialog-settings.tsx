import { Component } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon } from "@opencode-ai/ui/icon"
import { SettingsGeneral } from "./settings-general"
import { SettingsKeybinds } from "./settings-keybinds"

export const DialogSettings: Component = () => {
  return (
    <Dialog size="x-large">
      <Tabs orientation="vertical" variant="settings" defaultValue="general" class="h-full">
        <Tabs.List>
          <div class="flex flex-col gap-3 w-full pt-3">
            <div class="flex flex-col gap-1.5">
              <Tabs.SectionTitle>Desktop</Tabs.SectionTitle>
              <div class="flex flex-col gap-1.5 w-full">
                <Tabs.Trigger value="general">
                  <Icon name="settings-gear" />
                  General
                </Tabs.Trigger>
                <Tabs.Trigger value="shortcuts">
                  <Icon name="console" />
                  Shortcuts
                </Tabs.Trigger>
              </div>
            </div>
          </div>
        </Tabs.List>
        <Tabs.Content value="general" class="no-scrollbar">
          <SettingsGeneral />
        </Tabs.Content>
        <Tabs.Content value="shortcuts" class="no-scrollbar">
          <SettingsKeybinds />
        </Tabs.Content>
      </Tabs>
    </Dialog>
  )
}
