import { Component } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useProviders } from "@/hooks/use-providers"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { IconName } from "@opencode-ai/ui/icons/provider"
import { DialogConnectProvider } from "./dialog-connect-provider"

export const DialogSelectProvider: Component = () => {
  const dialog = useDialog()
  const providers = useProviders()

  return (
    <Dialog title="Connect provider" transition>
      <List
        activeIcon="plus-small"
        key={(x) => x?.id}
        items={providers.all}
        onSelect={(x) => {
          if (!x) return
          dialog.show(() => <DialogConnectProvider provider={x.id} />)
        }}
      >
        {(i) => (
          <div class="px-1.25 w-full flex items-center gap-x-3">
            <ProviderIcon data-slot="list-item-extra-icon" id={i.id as IconName} />
            <span>{i.name}</span>
            <div class="text-14-regular text-text-weak">Connect with Claude Pro/Max or API key</div>
          </div>
        )}
      </List>
    </Dialog>
  )
}
