import { createMemo, createEffect, on, onCleanup, For, Show } from "solid-js"
import type { JSX } from "solid-js"
import { useParams } from "@solidjs/router"
import { DateTime } from "luxon"
import { useSync } from "@/context/sync"
import { useLayout } from "@/context/layout"
import { checksum } from "@opencode-ai/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { Accordion } from "@opencode-ai/ui/accordion"
import { StickyAccordionHeader } from "@opencode-ai/ui/sticky-accordion-header"
import { Code } from "@opencode-ai/ui/code"
import { Markdown } from "@opencode-ai/ui/markdown"
import type { AssistantMessage, Message, Part, UserMessage } from "@opencode-ai/sdk/v2/client"

interface SessionContextTabProps {
  messages: () => Message[]
  visibleUserMessages: () => UserMessage[]
  view: () => ReturnType<ReturnType<typeof useLayout>["view"]>
  info: () => ReturnType<ReturnType<typeof useSync>["session"]["get"]>
}

export function SessionContextTab(props: SessionContextTabProps) {
  const params = useParams()
  const sync = useSync()

  const ctx = createMemo(() => {
    const last = props.messages().findLast((x) => x.role === "assistant") as AssistantMessage
    if (!last) return

    const provider = sync.data.provider.all.find((x) => x.id === last.providerID)
    const model = provider?.models[last.modelID]

    const sdkUsage = props.info()?.sdk?.modelUsage
    if (!sdkUsage || Object.keys(sdkUsage).length === 0) return

    const totals = Object.values(sdkUsage).reduce(
      (acc, m) => ({
        input: acc.input + m.inputTokens,
        output: acc.output + m.outputTokens,
        cacheRead: acc.cacheRead + m.cacheReadInputTokens,
        cacheWrite: acc.cacheWrite + m.cacheCreationInputTokens,
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    )
    const firstUsage = Object.values(sdkUsage)[0]
    const limit = firstUsage?.contextWindow || model?.limit.context
    const total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite
    const usage = limit ? Math.round((total / limit) * 100) : null

    return {
      message: last,
      provider,
      model,
      limit,
      input: totals.input,
      output: totals.output,
      cacheRead: totals.cacheRead,
      cacheWrite: totals.cacheWrite,
      total,
      usage,
    }
  })

  const cost = createMemo(() => {
    const sdkTotal = props.info()?.sdk?.totalCostUsd ?? 0
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(sdkTotal)
  })

  // Cache hit rate calculation
  const cacheHitRate = createMemo(() => {
    const c = ctx()
    if (!c) return null
    const total = c.cacheRead + c.cacheWrite
    if (total === 0) return null
    return Math.round((c.cacheRead / total) * 100)
  })

  // Web search count from SDK model usage
  const webSearchCount = createMemo(() => {
    const usage = props.info()?.sdk?.modelUsage
    if (!usage) return null
    const total = Object.values(usage).reduce((sum, m) => sum + (m.webSearchRequests ?? 0), 0)
    return total > 0 ? total : null
  })

  // Duration metrics
  const durationInfo = createMemo(() => {
    const sdk = props.info()?.sdk
    if (!sdk?.durationMs) return null
    return {
      total: sdk.durationMs,
      api: sdk.durationApiMs ?? 0,
    }
  })

  // Turn count from SDK
  const numTurns = createMemo(() => props.info()?.sdk?.numTurns ?? null)

  // Model usage breakdown
  const modelUsage = createMemo(() => props.info()?.sdk?.modelUsage ?? null)

  // Compaction events
  const compactionEvents = createMemo(() => props.info()?.sdk?.compactionEvents ?? [])

  const counts = createMemo(() => {
    const all = props.messages()
    const user = all.reduce((count, x) => count + (x.role === "user" ? 1 : 0), 0)
    const assistant = all.reduce((count, x) => count + (x.role === "assistant" ? 1 : 0), 0)
    return {
      all: all.length,
      user,
      assistant,
    }
  })

  const systemPrompt = createMemo(() => {
    const msg = props.visibleUserMessages().findLast((m) => !!m.system)
    const system = msg?.system
    if (!system) return
    const trimmed = system.trim()
    if (!trimmed) return
    return trimmed
  })

  const number = (value: number | null | undefined) => {
    if (value === undefined) return "—"
    if (value === null) return "—"
    return value.toLocaleString()
  }

  const percent = (value: number | null | undefined) => {
    if (value === undefined) return "—"
    if (value === null) return "—"
    return value.toString() + "%"
  }

  const time = (value: number | undefined) => {
    if (!value) return "—"
    return DateTime.fromMillis(value).toLocaleString(DateTime.DATETIME_MED)
  }

  const duration = (ms: number | undefined) => {
    if (!ms) return "—"
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.round((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const providerLabel = createMemo(() => {
    const c = ctx()
    if (!c) return "—"
    return c.provider?.name ?? c.message.providerID
  })

  const modelLabel = createMemo(() => {
    const c = ctx()
    if (!c) return "—"
    if (c.model?.name) return c.model.name
    return c.message.modelID
  })

  function Stat(statProps: { label: string; value: JSX.Element }) {
    return (
      <div class="flex flex-col gap-1">
        <div class="text-12-regular text-text-weak">{statProps.label}</div>
        <div class="text-12-medium text-text-strong">{statProps.value}</div>
      </div>
    )
  }

  const stats = createMemo(() => {
    const c = ctx()
    const count = counts()
    const dur = durationInfo()
    const hitRate = cacheHitRate()
    const searches = webSearchCount()
    const turns = numTurns()

    const items: { label: string; value: JSX.Element }[] = [
      { label: "Session", value: props.info()?.title ?? params.id ?? "—" },
      { label: "Messages", value: count.all.toLocaleString() },
      { label: "Provider", value: providerLabel() },
      { label: "Model", value: modelLabel() },
      { label: "Context Limit", value: number(c?.limit) },
      { label: "Total Tokens", value: number(c?.total) },
      { label: "Usage", value: percent(c?.usage) },
      { label: "Input Tokens", value: number(c?.input) },
      { label: "Output Tokens", value: number(c?.output) },
      { label: "Cache Tokens (read/write)", value: `${number(c?.cacheRead)} / ${number(c?.cacheWrite)}` },
    ]

    // Cache hit rate (only show if cache was used)
    if (hitRate !== null) {
      items.push({ label: "Cache Hit Rate", value: `${hitRate}%` })
    }

    // Web searches (only show if any occurred)
    if (searches !== null) {
      items.push({ label: "Web Searches", value: searches.toLocaleString() })
    }

    // Turn count
    if (turns !== null) {
      items.push({ label: "Turns", value: turns.toLocaleString() })
    }

    items.push(
      { label: "User Messages", value: count.user.toLocaleString() },
      { label: "Assistant Messages", value: count.assistant.toLocaleString() },
      { label: "Total Cost", value: cost() },
    )

    // Duration metrics
    if (dur) {
      items.push(
        { label: "Total Duration", value: duration(dur.total) },
        { label: "API Latency", value: duration(dur.api) },
      )
    }

    items.push(
      { label: "Session Created", value: time(props.info()?.time.created) },
      { label: "Last Activity", value: time(c?.message.time.created) },
    )

    return items
  })

  function RawMessageContent(msgProps: { message: Message }) {
    const file = createMemo(() => {
      const parts = (sync.data.part[msgProps.message.id] ?? []) as Part[]
      const contents = JSON.stringify({ message: msgProps.message, parts }, null, 2)
      return {
        name: `${msgProps.message.role}-${msgProps.message.id}.json`,
        contents,
        cacheKey: checksum(contents),
      }
    })

    return <Code file={file()} overflow="wrap" class="select-text" />
  }

  function RawMessage(msgProps: { message: Message }) {
    return (
      <Accordion.Item value={msgProps.message.id}>
        <StickyAccordionHeader>
          <Accordion.Trigger>
            <div class="flex items-center justify-between gap-2 w-full">
              <div class="min-w-0 truncate">
                {msgProps.message.role} <span class="text-text-base">• {msgProps.message.id}</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="shrink-0 text-12-regular text-text-weak">{time(msgProps.message.time.created)}</div>
                <Icon name="chevron-grabber-vertical" size="small" class="shrink-0 text-text-weak" />
              </div>
            </div>
          </Accordion.Trigger>
        </StickyAccordionHeader>
        <Accordion.Content class="bg-background-base">
          <div class="p-3">
            <RawMessageContent message={msgProps.message} />
          </div>
        </Accordion.Content>
      </Accordion.Item>
    )
  }

  let scroll: HTMLDivElement | undefined
  let frame: number | undefined
  let pending: { x: number; y: number } | undefined

  const restoreScroll = (retries = 0) => {
    const el = scroll
    if (!el) return

    const s = props.view()?.scroll("context")
    if (!s) return

    // Wait for content to be scrollable - content may not have rendered yet
    if (el.scrollHeight <= el.clientHeight && retries < 10) {
      requestAnimationFrame(() => restoreScroll(retries + 1))
      return
    }

    if (el.scrollTop !== s.y) el.scrollTop = s.y
    if (el.scrollLeft !== s.x) el.scrollLeft = s.x
  }

  const handleScroll = (event: Event & { currentTarget: HTMLDivElement }) => {
    pending = {
      x: event.currentTarget.scrollLeft,
      y: event.currentTarget.scrollTop,
    }
    if (frame !== undefined) return

    frame = requestAnimationFrame(() => {
      frame = undefined

      const next = pending
      pending = undefined
      if (!next) return

      props.view().setScroll("context", next)
    })
  }

  createEffect(
    on(
      () => props.messages().length,
      () => {
        requestAnimationFrame(restoreScroll)
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    if (frame === undefined) return
    cancelAnimationFrame(frame)
  })

  return (
    <div
      class="@container h-full overflow-y-auto no-scrollbar pb-10"
      ref={(el) => {
        scroll = el
        restoreScroll()
      }}
      onScroll={handleScroll}
    >
      <div class="px-6 pt-4 flex flex-col gap-10">
        <div class="grid grid-cols-1 @[32rem]:grid-cols-2 gap-4">
          <For each={stats()}>{(stat) => <Stat label={stat.label} value={stat.value} />}</For>
        </div>

        <Show when={modelUsage() && Object.keys(modelUsage()!).length > 0}>
          <div class="flex flex-col gap-2">
            <div class="text-12-regular text-text-weak">Model Usage</div>
            <div class="border border-border-base rounded-md overflow-hidden">
              <table class="w-full text-12-regular">
                <thead class="bg-surface-base">
                  <tr class="text-text-weak text-left">
                    <th class="px-3 py-2 font-medium">Model</th>
                    <th class="px-3 py-2 font-medium text-right">Input</th>
                    <th class="px-3 py-2 font-medium text-right">Output</th>
                    <th class="px-3 py-2 font-medium text-right">Cache</th>
                    <th class="px-3 py-2 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={Object.entries(modelUsage()!)}>
                    {([model, usage]) => (
                      <tr class="border-t border-border-base text-text-base">
                        <td class="px-3 py-2 truncate max-w-[150px]" title={model}>
                          {model.replace(/^claude-/, "").replace(/-\d{8}$/, "")}
                        </td>
                        <td class="px-3 py-2 text-right tabular-nums">{usage.inputTokens.toLocaleString()}</td>
                        <td class="px-3 py-2 text-right tabular-nums">{usage.outputTokens.toLocaleString()}</td>
                        <td class="px-3 py-2 text-right tabular-nums text-text-weak">
                          {usage.cacheReadInputTokens.toLocaleString()}
                        </td>
                        <td class="px-3 py-2 text-right tabular-nums text-text-strong">
                          ${usage.costUSD.toFixed(4)}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        <Show when={compactionEvents().length > 0}>
          <div class="flex flex-col gap-2">
            <div class="text-12-regular text-text-weak">Compaction Events</div>
            <div class="flex flex-col gap-1">
              <For each={compactionEvents()}>
                {(event) => (
                  <div class="flex items-center gap-2 text-11-regular text-text-base">
                    <span class="px-1.5 py-0.5 rounded bg-surface-base text-text-weak">
                      {event.trigger === "auto" ? "Auto" : "Manual"}
                    </span>
                    <span>
                      Compacted at {event.preTokens.toLocaleString()} tokens
                    </span>
                    <span class="text-text-weaker">
                      {DateTime.fromMillis(event.timestamp).toLocaleString(DateTime.TIME_WITH_SHORT_OFFSET)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={systemPrompt()}>
          {(prompt) => (
            <div class="flex flex-col gap-2">
              <div class="text-12-regular text-text-weak">System Prompt</div>
              <div class="border border-border-base rounded-md bg-surface-base px-3 py-2">
                <Markdown text={prompt()} class="text-12-regular" />
              </div>
            </div>
          )}
        </Show>

        <div class="flex flex-col gap-2">
          <div class="text-12-regular text-text-weak">Raw messages</div>
          <Accordion multiple>
            <For each={props.messages()}>{(message) => <RawMessage message={message} />}</For>
          </Accordion>
        </div>
      </div>
    </div>
  )
}
