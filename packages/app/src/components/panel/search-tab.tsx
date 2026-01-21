import { createSignal, createMemo, For, Show, onCleanup, type JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import { useFile } from "@/context/file"
import { useLayout } from "@/context/layout"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import type { FindTextResponse } from "@opencode-ai/sdk/v2/client"

type SearchMatch = FindTextResponse[number]

function highlightMatches(text: string, submatches: SearchMatch["submatches"]): JSX.Element {
  // Calculate leading whitespace offset
  const trimmedStart = text.length - text.trimStart().length
  const trimmed = text.trim()

  if (!submatches.length) return <>{trimmed}</>

  const parts: JSX.Element[] = []
  let lastEnd = 0

  for (const sub of submatches) {
    // Adjust positions for trimmed leading whitespace
    const start = Math.max(0, sub.start - trimmedStart)
    const end = Math.max(0, sub.end - trimmedStart)

    if (start >= trimmed.length || end <= 0) continue

    if (start > lastEnd) {
      parts.push(<>{trimmed.slice(lastEnd, start)}</>)
    }
    parts.push(<span class="bg-surface-warning-base">{trimmed.slice(start, Math.min(end, trimmed.length))}</span>)
    lastEnd = Math.min(end, trimmed.length)
  }

  if (lastEnd < trimmed.length) {
    parts.push(<>{trimmed.slice(lastEnd)}</>)
  }

  return <>{parts}</>
}

export function SearchTab() {
  const params = useParams<{ dir: string; id?: string }>()
  const sdk = useSDK()
  const file = useFile()
  const layout = useLayout()

  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<SearchMatch[]>([])
  const [loading, setLoading] = createSignal(false)

  let timer: ReturnType<typeof setTimeout>
  let abortController: AbortController | null = null

  onCleanup(() => {
    clearTimeout(timer)
    abortController?.abort()
  })

  const search = (q: string) => {
    clearTimeout(timer)
    abortController?.abort()
    setResults([])

    if (!q.trim()) {
      setLoading(false)
      return
    }

    setLoading(true)
    timer = setTimeout(async () => {
      abortController = new AbortController()
      try {
        const res = await sdk.client.find.text({ pattern: q }, { signal: abortController.signal })
        setResults(res.data ?? [])
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        throw e
      } finally {
        setLoading(false)
      }
    }, 150)
  }

  const sessionKey = () => `${params.dir}${params.id ? "/" + params.id : ""}`

  // Group by file
  const grouped = createMemo(() => {
    const map = new Map<string, SearchMatch[]>()
    for (const m of results()) {
      const p = m.path.text
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(m)
    }
    return [...map.entries()]
  })

  const totalCount = createMemo(() => results().length)

  const openFile = (path: string, lineNumber?: number) => {
    file.load(path)
    if (lineNumber) file.setFocusLine(path, lineNumber)
    layout.tabs(sessionKey()).open(file.tab(path))
  }

  return (
    <div class="h-full flex flex-col text-sm">
      <div class="p-2 border-b border-border-weak-base">
        <div class="flex items-center gap-2 px-2 h-8 bg-background-element rounded-md border border-border-base focus-within:border-primary">
          <input
            type="text"
            placeholder="Search in files..."
            class="flex-1 text-sm bg-transparent outline-none"
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value)
              search(e.currentTarget.value)
            }}
          />
          <Show when={query()}>
            <IconButton icon="circle-x" variant="ghost" class="-mr-1" onClick={() => setQuery("")} />
          </Show>
        </div>
      </div>
      <Show when={!loading() && results().length > 0}>
        <div class="px-2 py-1 bg-background-strong text-xs text-text-muted">
          {totalCount()} {totalCount() === 1 ? "result" : "results"} in {grouped().length}{" "}
          {grouped().length === 1 ? "file" : "files"}
        </div>
      </Show>
      <div class="flex-1 overflow-y-auto">
        <Show when={loading()}>
          <div class="p-4 text-xs text-text-muted text-center">Searching...</div>
        </Show>
        <Show when={!loading() && query() && results().length === 0}>
          <div class="p-4 text-xs text-text-muted text-center">No results</div>
        </Show>
        <Show when={!loading() && !query()}>
          <div class="p-4 text-xs text-text-muted text-center">Enter a search term</div>
        </Show>
        <For each={grouped()}>
          {([path, matches]) => (
            <Collapsible defaultOpen variant="ghost" class="w-full">
              <Collapsible.Trigger class="w-full">
                <div class="w-full px-2 py-1 flex items-center gap-1.5 bg-background-strong">
                  <Collapsible.Arrow class="text-text-muted/60" />
                  <FileIcon node={{ path, type: "file" }} class="w-3.5 h-3.5 shrink-0" />
                  <span class="flex-1 flex items-baseline gap-1 min-w-0 overflow-hidden">
                    <span class="text-xs text-text-muted shrink-0">{path.split("/").pop()}</span>
                    <span class="text-[10px] text-text-weak truncate">{path.split("/").slice(0, -1).join("/")}</span>
                  </span>
                  <span class="text-[10px] text-text-muted shrink-0">{matches.length}</span>
                </div>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <For each={matches}>
                  {(m) => (
                    <div
                      class="px-3 flex gap-2 hover:bg-background-element cursor-pointer text-[10px] font-mono text-text-weaker"
                      onClick={() => openFile(path, m.line_number)}
                    >
                      <span class="text-text-muted w-6 text-right shrink-0">{m.line_number}</span>
                      <span class="truncate">{highlightMatches(m.lines.text, m.submatches)}</span>
                    </div>
                  )}
                </For>
              </Collapsible.Content>
            </Collapsible>
          )}
        </For>
      </div>
    </div>
  )
}
