import { createContext, useContext, createSignal, onCleanup, type ParentProps, type Accessor } from "solid-js"
import { useSDK } from "@/context/sdk"

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

export type LspHover = {
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>
  range?: { start: { line: number; character: number }; end: { line: number; character: number } }
}

export type LspLocation = {
  uri: string
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
}

export type LspDiagnostic = {
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  severity?: number
  code?: string | number
  source?: string
  message: string
}

type LspContextValue = {
  /** Open a document in the LSP */
  openDocument: (path: string) => Promise<void>
  /** Notify LSP of document changes */
  changeDocument: (path: string, text: string) => Promise<void>
  /** Notify LSP of document save */
  saveDocument: (path: string, text?: string) => Promise<void>
  /** Close a document in the LSP */
  closeDocument: (path: string) => Promise<void>
  /** Get completion suggestions */
  completion: (params: {
    path: string
    line: number
    character: number
    triggerKind?: number
    triggerCharacter?: string
  }) => Promise<LspCompletionList | null>
  /** Get hover information */
  hover: (params: { path: string; line: number; character: number }) => Promise<LspHover | null>
  /** Get definition locations */
  definition: (params: { path: string; line: number; character: number }) => Promise<LspLocation[]>
  /** Get diagnostics for all files */
  diagnostics: () => Promise<Record<string, LspDiagnostic[]>>
  /** Get diagnostics for a specific file (reactive) */
  getDiagnosticsForFile: (path: string) => Accessor<LspDiagnostic[]>
  /** Cached diagnostics for all files (reactive) */
  cachedDiagnostics: Accessor<Record<string, LspDiagnostic[]>>
}

const LspContext = createContext<LspContextValue>()

export function LspProvider(props: ParentProps) {
  const sdk = useSDK()

  // Track open documents to avoid duplicate opens
  const openDocuments = new Set<string>()

  // Cached diagnostics by file path
  const [cachedDiagnostics, setCachedDiagnostics] = createSignal<Record<string, LspDiagnostic[]>>({})

  // Subscribe to diagnostics events via SSE
  const unsubscribe = sdk.event.on("lsp.client.diagnostics", (event) => {
    // Update diagnostics directly from SSE event
    setCachedDiagnostics((prev) => ({
      ...prev,
      [event.properties.path]: event.properties.diagnostics as LspDiagnostic[],
    }))
  })

  onCleanup(() => {
    unsubscribe()
  })

  const value: LspContextValue = {
    async openDocument(path: string) {
      if (openDocuments.has(path)) return
      openDocuments.add(path)
      try {
        await sdk.client.lsp.document.open({ path })
      } catch (e) {
        console.error("Failed to open document in LSP:", e)
        openDocuments.delete(path)
      }
    },

    async changeDocument(path: string, text: string) {
      // Ensure document is open first
      if (!openDocuments.has(path)) {
        await value.openDocument(path)
      }
      try {
        await sdk.client.lsp.document.change({ path, text })
      } catch (e) {
        console.error("Failed to change document in LSP:", e)
      }
    },

    async saveDocument(path: string, text?: string) {
      try {
        await sdk.client.lsp.document.save({ path, text })
      } catch (e) {
        console.error("Failed to save document in LSP:", e)
      }
    },

    async closeDocument(path: string) {
      if (!openDocuments.has(path)) return
      openDocuments.delete(path)
      try {
        await sdk.client.lsp.document.close({ path })
      } catch (e) {
        console.error("Failed to close document in LSP:", e)
      }
    },

    async completion(params) {
      try {
        const response = await sdk.client.lsp.completion(params)
        return (response.data as LspCompletionList) ?? null
      } catch (e) {
        console.error("Failed to get completions:", e)
        return null
      }
    },

    async hover(params) {
      try {
        const response = await sdk.client.lsp.hover(params)
        // Backend returns array of results from multiple LSP servers
        const results = response.data as LspHover[] | LspHover | null
        if (!results) return null
        // If array, find first non-null result
        if (Array.isArray(results)) {
          return results.find((r) => r && r.contents) ?? null
        }
        return results
      } catch (e) {
        console.error("Failed to get hover:", e)
        return null
      }
    },

    async definition(params) {
      try {
        const response = await sdk.client.lsp.definition(params)
        return (response.data as LspLocation[]) ?? []
      } catch (e) {
        console.error("Failed to get definition:", e)
        return []
      }
    },

    async diagnostics() {
      try {
        const response = await sdk.client.lsp.diagnostics()
        const result = (response.data as Record<string, LspDiagnostic[]>) ?? {}
        setCachedDiagnostics(result)
        return result
      } catch (e) {
        console.error("Failed to get diagnostics:", e)
        return {}
      }
    },

    getDiagnosticsForFile(path: string): Accessor<LspDiagnostic[]> {
      return () => cachedDiagnostics()[path] ?? []
    },

    cachedDiagnostics,
  }

  return <LspContext.Provider value={value}>{props.children}</LspContext.Provider>
}

export function useLsp() {
  const context = useContext(LspContext)
  if (!context) {
    throw new Error("useLsp must be used within an LspProvider")
  }
  return context
}
