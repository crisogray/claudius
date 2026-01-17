import { createEffect, onCleanup, onMount } from "solid-js"
import { EditorState, EditorSelection, Compartment, type Extension } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from "@codemirror/view"

// Re-export for consumers
export { EditorView, EditorSelection }
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { indentOnInput, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language"
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import { getLanguageExtension } from "./codemirror-languages"
import { opencodeDark } from "./codemirror-theme"

export interface CodeMirrorEditorProps {
  /** Current document content */
  value: string
  /** File path for language detection */
  path?: string
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Called when document content changes */
  onChange?: (value: string) => void
  /** Called when user presses Cmd/Ctrl+S */
  onSave?: () => void
  /** Additional CSS class */
  class?: string
  /** Called when the editor view is ready */
  onViewReady?: (view: EditorView) => void
  /** Additional extensions */
  extensions?: Extension[]
}

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  let containerRef: HTMLDivElement | undefined
  let view: EditorView | undefined
  let isUpdating = false

  // Compartments for dynamic configuration
  const languageCompartment = new Compartment()
  const readOnlyCompartment = new Compartment()

  onMount(() => {
    if (!containerRef) return

    // Save keymap
    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          props.onSave?.()
          return true
        },
      },
    ])

    // Update listener
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isUpdating) {
        props.onChange?.(update.state.doc.toString())
      }
    })

    // Build extensions
    const extensions: Extension[] = [
      // Core
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),

      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
      ]),
      saveKeymap,
      updateListener,

      // Theme
      ...opencodeDark,

      // Language (dynamic via compartment)
      languageCompartment.of(getLanguageExtension(props.path)),

      // Read-only state (dynamic via compartment)
      readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly ?? false)),

      // User-provided extensions
      ...(props.extensions ?? []),
    ]

    // Create initial state
    const state = EditorState.create({
      doc: props.value,
      extensions,
    })

    // Create editor view
    view = new EditorView({
      state,
      parent: containerRef,
    })

    props.onViewReady?.(view)
  })

  // Sync external value changes
  createEffect(() => {
    const newValue = props.value
    if (view && newValue !== view.state.doc.toString()) {
      isUpdating = true
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newValue },
      })
      isUpdating = false
    }
  })

  // Update language when path changes
  createEffect(() => {
    const path = props.path
    if (view) {
      view.dispatch({
        effects: languageCompartment.reconfigure(getLanguageExtension(path)),
      })
    }
  })

  // Update read-only state
  createEffect(() => {
    const readOnly = props.readOnly ?? false
    if (view) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
      })
    }
  })

  onCleanup(() => {
    view?.destroy()
  })

  return (
    <div
      ref={containerRef}
      class={`h-full w-full overflow-auto ${props.class ?? ""}`}
      data-component="codemirror-editor"
    />
  )
}
