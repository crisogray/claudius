import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { IconButton } from "@opencode-ai/ui/icon-button"
import type { IconName } from "@opencode-ai/ui/icons/provider"
import { List, type ListRef } from "@opencode-ai/ui/list"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { iife } from "@opencode-ai/util/iife"
import { createMemo, Match, onCleanup, onMount, Switch } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Link } from "@/components/link"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { DialogSelectProvider } from "./dialog-select-provider"

export function DialogConnectProvider(props: { provider: string }) {
  const dialog = useDialog()
  const globalSync = useGlobalSync()
  const globalSDK = useGlobalSDK()
  const provider = createMemo(() => globalSync.data.provider.all.find((x) => x.id === props.provider)!)
  const methods = createMemo(() => {
    const authMethods = globalSync.data.provider_auth[props.provider]
    // Filter to only API key methods since OAuth is not implemented
    const apiMethods = authMethods?.filter((m) => m.type === "api")
    return apiMethods?.length
      ? apiMethods
      : [
          {
            type: "api" as const,
            label: "API key",
          },
        ]
  })
  const [store, setStore] = createStore({
    methodIndex: undefined as undefined | number,
  })

  const method = createMemo(() => (store.methodIndex !== undefined ? methods().at(store.methodIndex!) : undefined))

  function selectMethod(index: number) {
    setStore(
      produce((draft) => {
        draft.methodIndex = index
      }),
    )
  }

  let listRef: ListRef | undefined
  function handleKey(e: KeyboardEvent) {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
      return
    }
    if (e.key === "Escape") return
    listRef?.onKeyDown(e)
  }

  onMount(() => {
    if (methods().length === 1) {
      selectMethod(0)
    }
    document.addEventListener("keydown", handleKey)
    onCleanup(() => {
      document.removeEventListener("keydown", handleKey)
    })
  })

  async function complete() {
    await globalSDK.client.global.dispose()
    dialog.close()
    showToast({
      variant: "success",
      icon: "circle-check",
      title: `${provider().name} connected`,
      description: `${provider().name} models are now available to use.`,
    })
  }

  function goBack() {
    if (methods().length === 1) {
      dialog.show(() => <DialogSelectProvider />)
      return
    }
    if (store.methodIndex) {
      setStore("methodIndex", undefined)
      return
    }
    dialog.show(() => <DialogSelectProvider />)
  }

  return (
    <Dialog title={<IconButton tabIndex={-1} icon="arrow-left" variant="ghost" onClick={goBack} />}>
      <div class="flex flex-col gap-6 px-2.5 pb-3">
        <div class="px-2.5 flex gap-4 items-center">
          <ProviderIcon id={props.provider as IconName} class="size-5 shrink-0 icon-strong-base" />
          <div class="text-16-medium text-text-strong">Connect {provider().name}</div>
        </div>
        <div class="px-2.5 pb-10 flex flex-col gap-6">
          <Switch>
            <Match when={store.methodIndex === undefined}>
              <div class="text-14-regular text-text-base">Select login method for {provider().name}.</div>
              <div class="">
                <List
                  ref={(ref) => {
                    listRef = ref
                  }}
                  items={methods}
                  key={(m) => m?.label}
                  onSelect={async (method, index) => {
                    if (!method) return
                    selectMethod(index)
                  }}
                >
                  {(i) => (
                    <div class="w-full flex items-center gap-x-2">
                      <div class="w-4 h-2 rounded-[1px] bg-input-base shadow-xs-border-base flex items-center justify-center">
                        <div class="w-2.5 h-0.5 bg-icon-strong-base hidden" data-slot="list-item-extra-icon" />
                      </div>
                      <span>{i.label}</span>
                    </div>
                  )}
                </List>
              </div>
            </Match>
            <Match when={method()?.type === "api"}>
              {iife(() => {
                const [formStore, setFormStore] = createStore({
                  value: "",
                  error: undefined as string | undefined,
                })

                async function handleSubmit(e: SubmitEvent) {
                  e.preventDefault()

                  const form = e.currentTarget as HTMLFormElement
                  const formData = new FormData(form)
                  const apiKey = formData.get("apiKey") as string

                  if (!apiKey?.trim()) {
                    setFormStore("error", "API key is required")
                    return
                  }

                  setFormStore("error", undefined)
                  await globalSDK.client.auth.set({
                    providerID: props.provider,
                    auth: {
                      type: "api",
                      key: apiKey,
                    },
                  })
                  await complete()
                }

                return (
                  <div class="flex flex-col gap-6">
                    <Switch>
                      <Match when={provider().id === "opencode"}>
                        <div class="flex flex-col gap-4">
                          <div class="text-14-regular text-text-base">
                            OpenCode Zen gives you access to a curated set of reliable optimized models for coding
                            agents.
                          </div>
                          <div class="text-14-regular text-text-base">
                            With a single API key you'll get access to models such as Claude, GPT, Gemini, GLM and more.
                          </div>
                          <div class="text-14-regular text-text-base">
                            Visit{" "}
                            <Link href="https://opencode.ai/zen" tabIndex={-1}>
                              opencode.ai/zen
                            </Link>{" "}
                            to collect your API key.
                          </div>
                        </div>
                      </Match>
                      <Match when={true}>
                        <div class="text-14-regular text-text-base">
                          Enter your {provider().name} API key to connect your account and use {provider().name} models
                          in OpenCode.
                        </div>
                      </Match>
                    </Switch>
                    <form onSubmit={handleSubmit} class="flex flex-col items-start gap-4">
                      <TextField
                        autofocus
                        type="text"
                        label={`${provider().name} API key`}
                        placeholder="API key"
                        name="apiKey"
                        value={formStore.value}
                        onChange={setFormStore.bind(null, "value")}
                        validationState={formStore.error ? "invalid" : undefined}
                        error={formStore.error}
                      />
                      <Button class="w-auto" type="submit" size="large" variant="primary">
                        Submit
                      </Button>
                    </form>
                  </div>
                )
              })}
            </Match>
          </Switch>
        </div>
      </div>
    </Dialog>
  )
}
