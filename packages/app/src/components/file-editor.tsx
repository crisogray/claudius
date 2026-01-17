import { createMemo, createEffect, onMount, onCleanup, Show } from "solid-js"
import { CodeMirrorEditor, EditorView, EditorSelection } from "@opencode-ai/ui/codemirror-editor"
import { lspExtension, type LspOptions } from "@opencode-ai/ui/codemirror-lsp"
import { useFile } from "@/context/file"
import { useLsp } from "@/context/lsp"
import { useMarked } from "@opencode-ai/ui/context/marked"

export interface FileEditorProps {
  /** File path (relative to project root) */
  path: string
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Whether to enable LSP features */
  enableLsp?: boolean
  /** Additional CSS class */
  class?: string
}

export function FileEditor(props: FileEditorProps) {
  const file = useFile()
  const marked = useMarked()
  let lsp: ReturnType<typeof useLsp> | undefined = undefined

  try {
    lsp = useLsp()
  } catch {
    // LSP context not available
  }

  // Load the file if not already loaded
  createEffect(() => {
    file.load(props.path)
  })

  // Open document in LSP when file loads
  onMount(() => {
    if (lsp && props.enableLsp !== false) {
      lsp.openDocument(props.path)
    }
  })

  // Close document in LSP when component unmounts
  onCleanup(() => {
    if (lsp && props.enableLsp !== false) {
      lsp.closeDocument(props.path)
    }
  })

  const state = createMemo(() => file.get(props.path))
  const currentContent = createMemo(() => file.getContent(props.path))
  const isDirty = createMemo(() => file.isDirty(props.path))
  const isSaving = createMemo(() => state()?.saving ?? false)

  const handleChange = (value: string) => {
    file.edit(props.path, value)
  }

  const handleSave = async () => {
    await file.save(props.path)
    // Notify LSP about the save
    if (lsp && props.enableLsp !== false) {
      lsp.saveDocument(props.path, file.getContent(props.path))
    }
  }

  // Get diagnostics accessor for this file
  const getDiagnostics = () => {
    if (!lsp || props.enableLsp === false) return () => []
    return lsp.getDiagnosticsForFile(props.path)
  }

  // Create LSP extension options
  const lspOptions = createMemo((): LspOptions | undefined => {
    if (!lsp || props.enableLsp === false) return undefined

    return {
      completion: async (params: { line: number; character: number; triggerKind?: number; triggerCharacter?: string }) => {
        return lsp!.completion({
          path: props.path,
          line: params.line,
          character: params.character,
          triggerKind: params.triggerKind,
          triggerCharacter: params.triggerCharacter,
        })
      },
      hover: async (params: { line: number; character: number }) => {
        return lsp!.hover({
          path: props.path,
          line: params.line,
          character: params.character,
        })
      },
      definition: async (params: { line: number; character: number }) => {
        return lsp!.definition({
          path: props.path,
          line: params.line,
          character: params.character,
        })
      },
      onDocumentChange: (text: string) => {
        lsp!.changeDocument(props.path, text)
      },
      diagnostics: getDiagnostics(),
      parseMarkdown: async (md) => marked.parse(md),
    }
  })

  const lspExtensions = createMemo(() => {
    const opts = lspOptions()
    return opts ? lspExtension(opts) : []
  })

  const handleViewReady = (view: EditorView) => {
    const line = file.focusLine(props.path)
    if (line && line > 0) {
      try {
        const pos = view.state.doc.line(line).from
        view.dispatch({
          selection: EditorSelection.cursor(pos),
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        })
      } catch {
        // Line number out of range
      }
      file.clearFocusLine(props.path)
    }
  }

  return (
    <div class={`relative h-full flex flex-col ${props.class ?? ""}`}>
      <Show when={state()?.loading}>
        <div class="flex items-center justify-center h-full text-text-weak">Loading...</div>
      </Show>
      <Show when={state()?.error}>
        {(err) => (
          <div class="flex items-center justify-center h-full text-text-weak">{err()}</div>
        )}
      </Show>
      <Show when={state()?.loaded}>
        <div class="flex-1 min-h-0 overflow-hidden">
          <CodeMirrorEditor
            value={currentContent()}
            path={props.path}
            readOnly={props.readOnly || isSaving()}
            onChange={handleChange}
            onSave={handleSave}
            onViewReady={handleViewReady}
            extensions={lspExtensions()}
          />
        </div>
        <Show when={isDirty()}>
          <div class="absolute top-2 right-2 px-2 py-1 rounded-md bg-surface-base text-12-regular text-text-weak">
            {isSaving() ? "Saving..." : "Unsaved"}
          </div>
        </Show>
      </Show>
    </div>
  )
}
