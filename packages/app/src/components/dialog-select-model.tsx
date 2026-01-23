import { Popover as Kobalte } from "@kobalte/core/popover"
import { Component, createMemo, createSignal, JSX, Show } from "solid-js"
import { useLocal } from "@/context/local"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { Button } from "@opencode-ai/ui/button"
import { useProviders } from "@/hooks/use-providers"
import { DialogConnectProvider } from "./dialog-connect-provider"

// Model priority: opus > sonnet 4.5 > sonnet 4 > haiku
const MODEL_PRIORITY = ["claude-opus-4-5", "claude-sonnet-4-5", "claude-sonnet-4", "claude-haiku-4-5"]

function getModelPriority(id: string): number {
  const index = MODEL_PRIORITY.findIndex((p) => id.includes(p))
  return index === -1 ? MODEL_PRIORITY.length : index
}

const ModelList: Component<{
  class?: string
  onSelect: () => void
}> = (props) => {
  const local = useLocal()
  const providers = useProviders()
  const dialog = useDialog()

  const showConnectPrompt = createMemo(() => local.model.list().length === 0 && providers.connected().length === 0)

  return (
    <Show
      when={!showConnectPrompt()}
      fallback={
        <div class="flex-1 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <div class="text-13-regular text-text-base">Connect a provider to access models</div>
          <Button variant="primary" onClick={() => dialog.show(() => <DialogConnectProvider provider="anthropic" />)}>
            Connect Anthropic
          </Button>
        </div>
      }
    >
      <List
        class={`flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0 ${props.class ?? ""}`}
        search={{ placeholder: "Search models", autofocus: true }}
        emptyMessage="No model results"
        key={(x) => `${x.provider.id}:${x.id}`}
        items={local.model.list()}
        current={local.model.current()}
        filterKeys={["name", "id"]}
        sortBy={(a, b) => getModelPriority(a.id) - getModelPriority(b.id)}
        onSelect={(x) => {
          local.model.set(x ? { modelID: x.id, providerID: x.provider.id } : undefined, {
            recent: true,
          })
          props.onSelect()
        }}
      >
        {(i) => (
          <div class="w-full flex items-center gap-x-2 text-13-regular">
            <span class="truncate">{i.name}</span>
          </div>
        )}
      </List>
    </Show>
  )
}

export const ModelSelectorPopover: Component<{
  children: JSX.Element
}> = (props) => {
  const [open, setOpen] = createSignal(false)

  return (
    <Kobalte open={open()} onOpenChange={setOpen} placement="top-start" gutter={8}>
      <Kobalte.Trigger as="div">{props.children}</Kobalte.Trigger>
      <Kobalte.Portal>
        <Kobalte.Content class="w-72 h-80 flex flex-col rounded-md border border-border-base bg-surface-raised-stronger-non-alpha shadow-md z-50 outline-none overflow-hidden">
          <Kobalte.Title class="sr-only">Select model</Kobalte.Title>
          <ModelList onSelect={() => setOpen(false)} class="p-1" />
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}

export const DialogSelectModel: Component = () => {
  const dialog = useDialog()

  return (
    <Dialog title="Select model">
      <ModelList onSelect={() => dialog.close()} />
    </Dialog>
  )
}
