import { createSignal, For, Show, createMemo, batch, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Button } from "@opencode-ai/ui/button"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { TextField } from "@opencode-ai/ui/text-field"
import type { QuestionRequest, QuestionInfo } from "@opencode-ai/sdk/v2/client"
import { useSDK } from "@/context/sdk"

export function DialogQuestion(props: { request: QuestionRequest }) {
  const dialog = useDialog()
  const sdk = useSDK()

  const questions = createMemo(() => props.request.questions)
  const single = createMemo(() => questions().length === 1 && questions()[0]?.multiple !== true)

  // Track state per question: answers and custom input
  const [store, setStore] = createStore({
    tab: 0,
    answers: [] as string[][],
    custom: [] as string[],
    showOther: [] as boolean[],
  })

  const question = createMemo(() => questions()[store.tab])
  const confirm = createMemo(() => !single() && store.tab === questions().length)
  const multi = createMemo(() => question()?.multiple === true)

  function submit() {
    const answers = questions().map((_, i) => store.answers[i] ?? [])
    sdk.client.question.reply({
      requestID: props.request.id,
      answers,
    })
    dialog.close()
  }

  function reject() {
    sdk.client.question.reject({
      requestID: props.request.id,
    })
    dialog.close()
  }

  function selectOption(label: string) {
    if (multi()) {
      // Toggle for multi-select
      const existing = store.answers[store.tab] ?? []
      const index = existing.indexOf(label)
      if (index === -1) {
        setStore("answers", store.tab, [...existing, label])
      } else {
        setStore("answers", store.tab, existing.filter((x) => x !== label))
      }
    } else {
      // Single select - set and advance
      setStore("answers", store.tab, [label])
      if (single()) {
        // For single question single select, submit immediately
        sdk.client.question.reply({
          requestID: props.request.id,
          answers: [[label]],
        })
        dialog.close()
      } else {
        // Advance to next tab
        setStore("tab", store.tab + 1)
      }
    }
  }

  function setCustomAnswer(value: string) {
    setStore("custom", store.tab, value)
    if (value) {
      // Add custom to answers if not already there
      const existing = store.answers[store.tab] ?? []
      const oldCustom = store.custom[store.tab]
      if (oldCustom && existing.includes(oldCustom)) {
        // Replace old custom with new
        setStore("answers", store.tab, existing.map((x) => x === oldCustom ? value : x))
      } else if (!existing.includes(value)) {
        if (multi()) {
          setStore("answers", store.tab, [...existing, value])
        } else {
          setStore("answers", store.tab, [value])
        }
      }
    }
  }

  function confirmCustom() {
    const value = store.custom[store.tab]?.trim()
    if (!value) {
      setStore("showOther", store.tab, false)
      return
    }
    if (!multi()) {
      if (single()) {
        sdk.client.question.reply({
          requestID: props.request.id,
          answers: [[value]],
        })
        dialog.close()
      } else {
        setStore("answers", store.tab, [value])
        setStore("tab", store.tab + 1)
        setStore("showOther", store.tab, false)
      }
    } else {
      setStore("showOther", store.tab, false)
    }
  }

  function isSelected(label: string) {
    return store.answers[store.tab]?.includes(label) ?? false
  }

  return (
    <Dialog title={single() ? question()?.header : "Questions"}>
      <div class="flex flex-col gap-4 min-w-[400px] max-w-[600px]">
        {/* Tabs for multi-question */}
        <Show when={!single()}>
          <div class="flex gap-2 flex-wrap border-b border-border-base pb-3">
            <For each={questions()}>
              {(q, index) => {
                const isActive = () => index() === store.tab
                const isAnswered = () => (store.answers[index()]?.length ?? 0) > 0
                return (
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded text-13-regular transition-colors"
                    classList={{
                      "bg-surface-accent text-text-on-accent": isActive(),
                      "bg-surface-inset text-text-base hover:bg-surface-raised": !isActive() && isAnswered(),
                      "bg-surface-inset text-text-weak hover:bg-surface-raised": !isActive() && !isAnswered(),
                    }}
                    onClick={() => setStore("tab", index())}
                  >
                    {q.header}
                  </button>
                )
              }}
            </For>
            <button
              type="button"
              class="px-3 py-1.5 rounded text-13-regular transition-colors"
              classList={{
                "bg-surface-accent text-text-on-accent": confirm(),
                "bg-surface-inset text-text-weak hover:bg-surface-raised": !confirm(),
              }}
              onClick={() => setStore("tab", questions().length)}
            >
              Confirm
            </button>
          </div>
        </Show>

        {/* Question content */}
        <Show when={!confirm()}>
          <div class="flex flex-col gap-3">
            <p class="text-14-regular text-text-base">
              {question()?.question}
              {multi() ? " (select all that apply)" : ""}
            </p>

            <div class="flex flex-col gap-2">
              <For each={question()?.options ?? []}>
                {(opt) => (
                  <button
                    type="button"
                    class="flex items-start gap-3 p-3 rounded-md border transition-colors text-left"
                    classList={{
                      "border-border-accent bg-surface-accent/10": isSelected(opt.label),
                      "border-border-base bg-surface-base hover:bg-surface-raised": !isSelected(opt.label),
                    }}
                    onClick={() => selectOption(opt.label)}
                  >
                    <Show when={multi()}>
                      <Checkbox checked={isSelected(opt.label)} />
                    </Show>
                    <Show when={!multi()}>
                      <div
                        class="size-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                        classList={{
                          "border-border-accent": isSelected(opt.label),
                          "border-border-base": !isSelected(opt.label),
                        }}
                      >
                        <Show when={isSelected(opt.label)}>
                          <div class="size-2 rounded-full bg-surface-accent" />
                        </Show>
                      </div>
                    </Show>
                    <div class="flex flex-col gap-0.5 min-w-0">
                      <span class="text-14-regular text-text-base">{opt.label}</span>
                      <span class="text-13-regular text-text-weak">{opt.description}</span>
                    </div>
                  </button>
                )}
              </For>

              {/* Other option */}
              <div class="flex flex-col gap-2">
                <button
                  type="button"
                  class="flex items-start gap-3 p-3 rounded-md border transition-colors text-left"
                  classList={{
                    "border-border-accent bg-surface-accent/10": store.showOther[store.tab],
                    "border-border-base bg-surface-base hover:bg-surface-raised": !store.showOther[store.tab],
                  }}
                  onClick={() => setStore("showOther", store.tab, true)}
                >
                  <Show when={multi()}>
                    <Checkbox checked={!!store.custom[store.tab]} />
                  </Show>
                  <Show when={!multi()}>
                    <div class="size-4 rounded-full border-2 border-border-base flex items-center justify-center shrink-0 mt-0.5" />
                  </Show>
                  <span class="text-14-regular text-text-base">Type your own answer</span>
                </button>

                <Show when={store.showOther[store.tab]}>
                  <div class="ml-7 flex gap-2">
                    <div class="flex-1">
                      <TextField
                        placeholder="Type your answer..."
                        value={store.custom[store.tab] ?? ""}
                        onChange={(v) => setCustomAnswer(v)}
                        onKeyDown={(e: KeyboardEvent) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            confirmCustom()
                          }
                          if (e.key === "Escape") {
                            setStore("showOther", store.tab, false)
                          }
                        }}
                        autofocus
                      />
                    </div>
                    <Button variant="secondary" size="large" onClick={confirmCustom}>
                      {multi() ? "Add" : "Submit"}
                    </Button>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* Confirm screen */}
        <Show when={confirm()}>
          <div class="flex flex-col gap-3">
            <p class="text-14-regular text-text-base">Review your answers:</p>
            <For each={questions()}>
              {(q, index) => {
                const value = () => store.answers[index()]?.join(", ") ?? ""
                const answered = () => Boolean(value())
                return (
                  <div class="flex gap-2 text-13-regular">
                    <span class="text-text-weak">{q.header}:</span>
                    <span classList={{ "text-text-base": answered(), "text-text-critical": !answered() }}>
                      {answered() ? value() : "(not answered)"}
                    </span>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>

        {/* Actions */}
        <div class="flex justify-between items-center pt-3 border-t border-border-base">
          <Show when={!single() && store.tab > 0}>
            <Button variant="ghost" size="large" onClick={() => setStore("tab", store.tab - 1)}>
              Back
            </Button>
          </Show>
          <div class="flex-1" />
          <div class="flex gap-2">
            <Button variant="ghost" size="large" onClick={reject}>
              Dismiss
            </Button>
            <Show when={confirm() || (multi() && !single())}>
              <Button
                variant="primary"
                size="large"
                onClick={() => {
                  if (confirm()) {
                    submit()
                  } else {
                    setStore("tab", store.tab + 1)
                  }
                }}
              >
                {confirm() ? "Submit" : "Next"}
              </Button>
            </Show>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
