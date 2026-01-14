import { autocompletion, type CompletionContext, type CompletionResult, type Completion } from "@codemirror/autocomplete"
import { hoverTooltip, type Tooltip } from "@codemirror/view"
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view"
import { linter, type Diagnostic as CMLintDiagnostic } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"
import DOMPurify from "dompurify"

// LSP CompletionItemKind to CodeMirror completion type mapping
const completionKindMap: Record<number, string> = {
  1: "text",
  2: "method",
  3: "function",
  4: "constructor",
  5: "field",
  6: "variable",
  7: "class",
  8: "interface",
  9: "module",
  10: "property",
  11: "unit",
  12: "value",
  13: "enum",
  14: "keyword",
  15: "snippet",
  16: "color",
  17: "file",
  18: "reference",
  19: "folder",
  20: "enum-member",
  21: "constant",
  22: "struct",
  23: "event",
  24: "operator",
  25: "type",
}

export type LspCompletionItem = {
  label: string
  kind?: number
  detail?: string
  documentation?: string | { kind: string; value: string }
  insertText?: string
  insertTextFormat?: number
  textEdit?: {
    range: { start: { line: number; character: number }; end: { line: number; character: number } }
    newText: string
  }
  sortText?: string
  filterText?: string
}

export type LspCompletionList = {
  isIncomplete: boolean
  items: LspCompletionItem[]
}

export type LspHoverResult = {
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>
  range?: { start: { line: number; character: number }; end: { line: number; character: number } }
} | null

export type LspLocation = {
  uri: string
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
}

export type LspCompletionHandler = (params: {
  line: number
  character: number
  triggerKind?: number
  triggerCharacter?: string
}) => Promise<LspCompletionList | null>

export type LspHoverHandler = (params: { line: number; character: number }) => Promise<LspHoverResult>

export type LspDefinitionHandler = (params: { line: number; character: number }) => Promise<LspLocation[]>

export type LspDocumentChangeHandler = (text: string) => void

export type LspDiagnostic = {
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  severity?: number
  code?: string | number
  source?: string
  message: string
}

export type LspDiagnosticsHandler = () => LspDiagnostic[]

export type LspOptions = {
  /** Handler for completion requests */
  completion?: LspCompletionHandler
  /** Handler for hover requests */
  hover?: LspHoverHandler
  /** Handler for go-to-definition requests */
  definition?: LspDefinitionHandler
  /** Handler for document change notifications */
  onDocumentChange?: LspDocumentChangeHandler
  /** Handler for getting current diagnostics */
  diagnostics?: LspDiagnosticsHandler
  /** Debounce delay for document changes (ms) */
  changeDebounceMs?: number
  /** Async markdown parser for hover content (e.g., marked.parse) */
  parseMarkdown?: (markdown: string) => Promise<string>
}

function getDocumentation(doc: string | { kind: string; value: string } | undefined): string | undefined {
  if (!doc) return undefined
  if (typeof doc === "string") return doc
  return doc.value
}

/**
 * Create CodeMirror extensions for LSP integration
 */
export function lspExtension(options: LspOptions): Extension[] {
  const extensions: Extension[] = []

  // Document change notifications
  if (options.onDocumentChange) {
    const debounceMs = options.changeDebounceMs ?? 300
    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    extensions.push(
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            options.onDocumentChange?.(update.state.doc.toString())
          }, debounceMs)
        }
      }),
    )
  }

  // Autocompletion
  if (options.completion) {
    const completionHandler = options.completion
    extensions.push(
      autocompletion({
        override: [
          async (context: CompletionContext): Promise<CompletionResult | null> => {
            const pos = context.pos
            const line = context.state.doc.lineAt(pos)
            const lineNumber = line.number - 1 // 0-indexed
            const character = pos - line.from

            const result = await completionHandler({
              line: lineNumber,
              character,
              triggerKind: context.explicit ? 1 : 2, // Invoked vs TriggerCharacter
            })

            if (!result || !result.items.length) return null

            const completions: Completion[] = result.items.map((item) => {
              const completion: Completion = {
                label: item.label,
                type: item.kind ? completionKindMap[item.kind] : undefined,
                detail: item.detail,
                info: getDocumentation(item.documentation),
              }

              // Handle text edits
              if (item.textEdit) {
                const startOffset =
                  context.state.doc.line(item.textEdit.range.start.line + 1).from + item.textEdit.range.start.character
                const endOffset =
                  context.state.doc.line(item.textEdit.range.end.line + 1).from + item.textEdit.range.end.character
                completion.apply = (view, _completion, from, to) => {
                  view.dispatch({
                    changes: { from: startOffset, to: endOffset, insert: item.textEdit!.newText },
                  })
                }
              } else if (item.insertText) {
                completion.apply = item.insertText
              }

              return completion
            })

            return {
              from: context.pos,
              options: completions,
              validFor: /^\w*$/,
            }
          },
        ],
        activateOnTyping: true,
      }),
    )
  }

  // Hover tooltips
  if (options.hover) {
    const hoverHandler = options.hover
    extensions.push(
      hoverTooltip(
        async (view, pos): Promise<Tooltip | null> => {
          const line = view.state.doc.lineAt(pos)
          const lineNumber = line.number - 1 // 0-indexed
          const character = pos - line.from

          const result = await hoverHandler({ line: lineNumber, character })
          if (!result) return null

          let content: string
          if (typeof result.contents === "string") {
            content = result.contents
          } else if (Array.isArray(result.contents)) {
            content = result.contents
              .map((c) => (typeof c === "string" ? c : c.value))
              .filter(Boolean)
              .join("\n\n")
          } else {
            content = result.contents.value
          }

          if (!content) return null

          return {
            pos,
            above: true,
            create: () => {
              const dom = document.createElement("div")
              dom.className = "cm-tooltip-hover"
              dom.style.cssText =
                "max-width: 500px; max-height: 300px; overflow: auto; padding: 8px 12px; font-family: var(--font-mono); font-size: 12px;"

              if (options.parseMarkdown) {
                dom.style.opacity = "0"
                dom.style.transition = "opacity 0.15s"
                options
                  .parseMarkdown(content)
                  .then((html) => {
                    if (!dom.isConnected) return // Tooltip was destroyed
                    dom.innerHTML = DOMPurify.sanitize(html, {
                      USE_PROFILES: { html: true },
                      FORBID_TAGS: ["style"],
                    })
                    dom.style.opacity = "1"
                  })
                  .catch(() => {
                    if (!dom.isConnected) return
                    dom.style.whiteSpace = "pre-wrap"
                    dom.textContent = content // Fallback to plain text
                    dom.style.opacity = "1"
                  })
              } else {
                dom.style.whiteSpace = "pre-wrap"
                dom.textContent = content
              }

              return { dom }
            },
          }
        },
        { hideOnChange: true },
      ),
    )
  }

  // Go to definition (Cmd/Ctrl + Click or F12)
  if (options.definition) {
    const definitionHandler = options.definition

    const gotoDefinition = async (view: EditorView): Promise<boolean> => {
      const pos = view.state.selection.main.head
      const line = view.state.doc.lineAt(pos)
      const lineNumber = line.number - 1 // 0-indexed
      const character = pos - line.from

      const locations = await definitionHandler({ line: lineNumber, character })
      if (!locations.length) return false

      // For now, emit a custom event that the editor wrapper can handle
      const event = new CustomEvent("lsp-goto-definition", {
        detail: locations[0],
        bubbles: true,
      })
      view.dom.dispatchEvent(event)

      return true
    }

    extensions.push(
      keymap.of([
        {
          key: "F12",
          run: (view) => {
            gotoDefinition(view)
            return true
          },
        },
        {
          key: "Mod-.",
          run: (view) => {
            gotoDefinition(view)
            return true
          },
        },
      ]),
    )
  }

  // Diagnostics linter
  if (options.diagnostics) {
    const diagnosticsHandler = options.diagnostics

    // Map LSP severity to CodeMirror severity
    const severityMap: Record<number, CMLintDiagnostic["severity"]> = {
      1: "error",
      2: "warning",
      3: "info",
      4: "hint",
    }

    extensions.push(
      linter(
        (view) => {
          const diagnostics = diagnosticsHandler()
          const cmDiagnostics: CMLintDiagnostic[] = []

          for (const diag of diagnostics) {
            try {
              const startLine = view.state.doc.line(diag.range.start.line + 1)
              const endLine = view.state.doc.line(diag.range.end.line + 1)
              const from = startLine.from + diag.range.start.character
              const to = endLine.from + diag.range.end.character

              cmDiagnostics.push({
                from,
                to,
                severity: severityMap[diag.severity ?? 1] ?? "error",
                message: diag.message,
                source: diag.source,
              })
            } catch {
              // Line might not exist, skip this diagnostic
            }
          }

          return cmDiagnostics
        },
        {
          delay: 500,
        },
      ),
    )
  }

  return extensions
}
