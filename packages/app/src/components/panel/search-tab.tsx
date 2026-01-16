import { createSignal, createMemo, For, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import { useFile } from "@/context/file"
import { useLayout } from "@/context/layout"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import type { FindTextResponse } from "@opencode-ai/sdk/v2/client"

type SearchMatch = FindTextResponse[number]

export function SearchTab() {
  const params = useParams<{ dir: string; id?: string }>()
  const sdk = useSDK()
  const file = useFile()
  const layout = useLayout()

  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<SearchMatch[]>([])
  const [loading, setLoading] = createSignal(false)

  let timer: ReturnType<typeof setTimeout>
  const search = (q: string) => {
    clearTimeout(timer)
    if (!q.trim()) {
      setResults([])
      return
    }
    timer = setTimeout(async () => {
      setLoading(true)
      const res = await sdk.client.find.text({ pattern: q })
      setResults(res.data ?? [])
      setLoading(false)
    }, 300)
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

  const openFile = (path: string) => {
    file.load(path)
    layout.tabs(sessionKey()).open(file.tab(path))
  }

  return (
    <div class="h-full flex flex-col text-sm">
      <div class="p-2 border-b border-border-base">
        <input
          type="text"
          placeholder="Search in files..."
          class="w-full px-2 py-1 text-sm bg-background-element rounded-md border border-border-base focus:border-primary focus:outline-none"
          value={query()}
          onInput={(e) => {
            setQuery(e.currentTarget.value)
            search(e.currentTarget.value)
          }}
        />
      </div>
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
                <div class="w-full px-2 py-1.5 flex items-center gap-2 bg-background-element">
                  <Collapsible.Arrow class="text-text-muted/60" />
                  <FileIcon node={{ path, type: "file" }} class="w-4 h-4" />
                  <span class="text-xs truncate flex-1">{path}</span>
                  <span class="text-xs text-text-muted">{matches.length}</span>
                </div>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <For each={matches}>
                  {(m) => (
                    <div
                      class="px-3 py-1 flex gap-2 hover:bg-background-element cursor-pointer text-xs font-mono"
                      onClick={() => openFile(path)}
                    >
                      <span class="text-text-muted w-8 text-right shrink-0">{m.line_number}</span>
                      <span class="truncate">{m.lines.text.trim()}</span>
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
