import { For, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import type { QuestionInfo } from "@opencode-ai/sdk/v2"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { TextField } from "./text-field"

export interface InlineQuestionProps {
  questions: QuestionInfo[]
  selectedAnswers?: string[][]  // If present, component is readonly
  onReply?: (answers: string[][]) => void
  onReject?: () => void
}

export function InlineQuestion(props: InlineQuestionProps) {
  const readonly = () => !!props.selectedAnswers
  const questions = createMemo(() => props.questions)
  const total = createMemo(() => questions().length)

  const [store, setStore] = createStore({
    tab: 0,
    answers: [] as string[][],
    custom: [] as string[],
  })

  const question = createMemo(() => questions()[store.tab])
  const multi = createMemo(() => question()?.multiple === true)
  const isLast = createMemo(() => store.tab === total() - 1)
  const optionLabels = createMemo(() => question()?.options?.map((o) => o.label) ?? [])

  function submit() {
    const answers = questions().map((_, i) => store.answers[i] ?? [])
    props.onReply?.(answers)
  }

  function isSelected(label: string) {
    if (readonly()) {
      return props.selectedAnswers?.[store.tab]?.includes(label) ?? false
    }
    return store.answers[store.tab]?.includes(label) ?? false
  }

  function selectOption(label: string) {
    if (multi()) {
      const existing = store.answers[store.tab] ?? []
      const index = existing.indexOf(label)
      if (index === -1) {
        setStore("answers", store.tab, [...existing, label])
      } else {
        setStore("answers", store.tab, existing.filter((x) => x !== label))
      }
    } else {
      setStore("answers", store.tab, [label])
      // Clear custom when selecting a predefined option
      setStore("custom", store.tab, "")
    }
  }

  // Custom answer helpers
  const customText = () => store.custom[store.tab] ?? ""
  const isCustomSelected = () => {
    const text = customText().trim()
    return text ? isSelected(text) : false
  }

  function handleCustomInput(value: string) {
    const oldText = customText().trim()
    setStore("custom", store.tab, value)

    const newText = value.trim()
    if (!newText) {
      // Cleared the input - remove old custom from answers
      if (oldText) {
        const existing = store.answers[store.tab] ?? []
        setStore("answers", store.tab, existing.filter((x) => x !== oldText))
      }
      return
    }

    // Update answers: remove old custom, add new
    const existing = store.answers[store.tab] ?? []
    const withoutOld = oldText ? existing.filter((x) => x !== oldText) : existing

    if (multi()) {
      setStore("answers", store.tab, [...withoutOld, newText])
    } else {
      // Single-select: just the custom value
      setStore("answers", store.tab, [newText])
    }
  }

  function toggleCustom() {
    const text = customText().trim()
    if (!text) return

    if (isCustomSelected()) {
      // Deselect
      const existing = store.answers[store.tab] ?? []
      setStore("answers", store.tab, existing.filter((x) => x !== text))
    } else {
      // Select
      if (multi()) {
        const existing = store.answers[store.tab] ?? []
        setStore("answers", store.tab, [...existing, text])
      } else {
        setStore("answers", store.tab, [text])
      }
    }
  }

  // Get custom answers for readonly mode
  const readonlyCustomAnswers = createMemo(() => {
    if (!readonly()) return []
    const answers = props.selectedAnswers?.[store.tab] ?? []
    return answers.filter((ans) => !optionLabels().includes(ans))
  })

  return (
    <div data-component="question-prompt">
      <Show when={total() > 1}>
        <div data-slot="question-progress">
          <span data-slot="question-progress-text">
            Question {store.tab + 1} of {total()}
          </span>
        </div>
      </Show>

      <div data-slot="question-text">
        {question()?.question}
        {multi() ? " (select all that apply)" : ""}
      </div>

      <div data-slot="question-options">
        {/* Predefined options */}
        <For each={question()?.options ?? []}>
          {(opt) => (
            <button
              type="button"
              data-slot="question-option"
              data-picked={isSelected(opt.label)}
              data-readonly={readonly()}
              onClick={readonly() ? undefined : () => selectOption(opt.label)}
            >
              <Show when={multi()}>
                <Checkbox checked={isSelected(opt.label)} />
              </Show>
              <Show when={!multi()}>
                <div data-slot="question-radio" data-picked={isSelected(opt.label)}>
                  <Show when={isSelected(opt.label)}>
                    <div data-slot="question-radio-dot" />
                  </Show>
                </div>
              </Show>
              <div data-slot="question-option-content">
                <span data-slot="question-option-label">{opt.label}</span>
                <Show when={opt.description}>
                  <span data-slot="question-option-description">{opt.description}</span>
                </Show>
              </div>
            </button>
          )}
        </For>

        {/* Custom answer option - inline text field */}
        <Show when={!readonly()}>
          <div
            data-slot="question-option"
            data-picked={isCustomSelected()}
            data-custom
          >
            <Show when={multi()}>
              <div onClick={toggleCustom} style={{ cursor: "pointer" }}>
                <Checkbox checked={isCustomSelected()} />
              </div>
            </Show>
            <Show when={!multi()}>
              <div
                data-slot="question-radio"
                data-picked={isCustomSelected()}
                onClick={toggleCustom}
                style={{ cursor: "pointer" }}
              >
                <Show when={isCustomSelected()}>
                  <div data-slot="question-radio-dot" />
                </Show>
              </div>
            </Show>
            <TextField
              placeholder="Other..."
              value={customText()}
              onChange={handleCustomInput}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (isLast()) {
                    submit()
                  } else {
                    setStore("tab", store.tab + 1)
                  }
                }
              }}
            />
          </div>
        </Show>

        {/* Show custom answers in readonly mode */}
        <For each={readonlyCustomAnswers()}>
          {(customAnswer) => (
            <div
              data-slot="question-option"
              data-picked="true"
              data-readonly="true"
            >
              <Show when={multi()}>
                <Checkbox checked />
              </Show>
              <Show when={!multi()}>
                <div data-slot="question-radio" data-picked="true">
                  <div data-slot="question-radio-dot" />
                </div>
              </Show>
              <span data-slot="question-option-label">{customAnswer}</span>
            </div>
          )}
        </For>
      </div>

      {/* Navigation for readonly multi-question */}
      <Show when={readonly() && total() > 1}>
        <div data-slot="question-actions">
          <Button
            variant="ghost"
            size="small"
            onClick={() => setStore("tab", store.tab - 1)}
            disabled={store.tab === 0}
          >
            Back
          </Button>
          <div data-slot="question-actions-spacer" />
          <Button
            variant="ghost"
            size="small"
            onClick={() => setStore("tab", store.tab + 1)}
            disabled={isLast()}
          >
            Next
          </Button>
        </div>
      </Show>

      {/* Actions for answering */}
      <Show when={!readonly()}>
        <div data-slot="question-actions">
          <Show when={total() > 1 && store.tab > 0}>
            <Button variant="ghost" size="small" onClick={() => setStore("tab", store.tab - 1)}>
              Back
            </Button>
          </Show>
          <div data-slot="question-actions-spacer" />
          <Button variant="ghost" size="small" onClick={props.onReject}>
            Dismiss
          </Button>
          <Button variant="primary" size="small" onClick={isLast() ? submit : () => setStore("tab", store.tab + 1)}>
            {isLast() ? "Submit" : "Next"}
          </Button>
        </div>
      </Show>
    </div>
  )
}
