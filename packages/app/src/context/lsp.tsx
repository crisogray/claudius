import { createSignal, onCleanup, type Accessor } from "solid-js"
import { createSimpleContext } from "@opencode-ai/ui/context"
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

export const { use: useLsp, provider: LspProvider } = createSimpleContext({
  name: "Lsp",
  init: () => {
    const sdk = useSDK()

    // Track open documents to avoid duplicate opens
    const openDocuments = new Set<string>()

    // Cached diagnostics by file path
    const [cachedDiagnostics, setCachedDiagnostics] = createSignal<Record<string, LspDiagnostic[]>>({})

    // Subscribe to diagnostics events via SSE
    const unsubscribe = sdk.event.on("lsp.client.diagnostics", (event) => {
      setCachedDiagnostics((prev) => ({
        ...prev,
        [event.properties.path]: event.properties.diagnostics as LspDiagnostic[],
      }))
    })

    onCleanup(() => {
      unsubscribe()
    })

    const openDocument = async (path: string) => {
      if (openDocuments.has(path)) return
      openDocuments.add(path)
      try {
        await sdk.client.lsp.document.open({ path })
      } catch (e) {
        console.error("Failed to open document in LSP:", e)
        openDocuments.delete(path)
      }
    }

    const changeDocument = async (path: string, text: string) => {
      // Ensure document is open first
      if (!openDocuments.has(path)) {
        await openDocument(path)
      }
      try {
        await sdk.client.lsp.document.change({ path, text })
      } catch (e) {
        console.error("Failed to change document in LSP:", e)
      }
    }

    const saveDocument = async (path: string, text?: string) => {
      try {
        await sdk.client.lsp.document.save({ path, text })
      } catch (e) {
        console.error("Failed to save document in LSP:", e)
      }
    }

    const closeDocument = async (path: string) => {
      if (!openDocuments.has(path)) return
      openDocuments.delete(path)
      try {
        await sdk.client.lsp.document.close({ path })
      } catch (e) {
        console.error("Failed to close document in LSP:", e)
      }
    }

    const completion = async (params: {
      path: string
      line: number
      character: number
      triggerKind?: number
      triggerCharacter?: string
    }): Promise<LspCompletionList | null> => {
      try {
        const response = await sdk.client.lsp.completion(params)
        return (response.data as LspCompletionList) ?? null
      } catch (e) {
        console.error("Failed to get completions:", e)
        return null
      }
    }

    const hover = async (params: { path: string; line: number; character: number }): Promise<LspHover | null> => {
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
    }

    const definition = async (params: { path: string; line: number; character: number }): Promise<LspLocation[]> => {
      try {
        const response = await sdk.client.lsp.definition(params)
        return (response.data as LspLocation[]) ?? []
      } catch (e) {
        console.error("Failed to get definition:", e)
        return []
      }
    }

    const diagnostics = async (): Promise<Record<string, LspDiagnostic[]>> => {
      try {
        const response = await sdk.client.lsp.diagnostics()
        const result = (response.data as Record<string, LspDiagnostic[]>) ?? {}
        setCachedDiagnostics(result)
        return result
      } catch (e) {
        console.error("Failed to get diagnostics:", e)
        return {}
      }
    }

    const getDiagnosticsForFile = (path: string): Accessor<LspDiagnostic[]> => {
      return () => cachedDiagnostics()[path] ?? []
    }

    return {
      openDocument,
      changeDocument,
      saveDocument,
      closeDocument,
      completion,
      hover,
      definition,
      diagnostics,
      getDiagnosticsForFile,
      cachedDiagnostics,
    }
  },
})
