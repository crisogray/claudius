import { Match, Show, Switch, createMemo } from "solid-js"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { ProgressCircle } from "@opencode-ai/ui/progress-circle"
import { Button } from "@opencode-ai/ui/button"
import { useParams } from "@solidjs/router"

import { useLayout } from "@/context/layout"
import { useSync } from "@/context/sync"

interface SessionContextUsageProps {
  variant?: "button" | "indicator"
}

export function SessionContextUsage(props: SessionContextUsageProps) {
  const sync = useSync()
  const params = useParams()
  const layout = useLayout()

  const variant = createMemo(() => props.variant ?? "button")
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey()))
  const sessionInfo = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))

  const cost = createMemo(() => {
    const sdkTotal = sessionInfo()?.sdk?.totalCostUsd ?? 0
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(sdkTotal)
  })

  // Cache hit rate from SDK modelUsage
  const cacheHitRate = createMemo(() => {
    const sdkUsage = sessionInfo()?.sdk?.modelUsage
    if (!sdkUsage || Object.keys(sdkUsage).length === 0) return null
    const totals = Object.values(sdkUsage).reduce(
      (acc, m) => ({
        read: acc.read + m.cacheReadInputTokens,
        write: acc.write + m.cacheCreationInputTokens,
      }),
      { read: 0, write: 0 },
    )
    const total = totals.read + totals.write
    if (total === 0) return null
    return Math.round((totals.read / total) * 100)
  })

  // Web search count from SDK
  const webSearchCount = createMemo(() => {
    const usage = sessionInfo()?.sdk?.modelUsage
    if (!usage) return null
    const total = Object.values(usage).reduce((sum, m) => sum + (m.webSearchRequests ?? 0), 0)
    return total > 0 ? total : null
  })

  // Context usage from SDK modelUsage
  const context = createMemo(() => {
    const sdkUsage = sessionInfo()?.sdk?.modelUsage
    if (!sdkUsage || Object.keys(sdkUsage).length === 0) return undefined
    const totals = Object.values(sdkUsage).reduce(
      (acc, m) => ({
        input: acc.input + m.inputTokens,
        output: acc.output + m.outputTokens,
        cacheRead: acc.cacheRead + m.cacheReadInputTokens,
        cacheWrite: acc.cacheWrite + m.cacheCreationInputTokens,
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    )
    const total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite
    const firstUsage = Object.values(sdkUsage)[0]
    const limit = firstUsage?.contextWindow
    return {
      tokens: total.toLocaleString(),
      percentage: limit ? Math.round((total / limit) * 100) : null,
    }
  })

  const openContext = () => {
    if (!params.id) return
    tabs().open("context")
    tabs().setActive("context")
  }

  const circle = () => (
    <div class="p-1">
      <ProgressCircle size={16} strokeWidth={2} percentage={context()?.percentage ?? 0} />
    </div>
  )

  const tooltipValue = () => (
    <div>
      <Show when={context()}>
        {(ctx) => (
          <>
            <div class="flex items-center gap-2">
              <span class="text-text-invert-strong">{ctx().tokens}</span>
              <span class="text-text-invert-base">Tokens</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-text-invert-strong">{ctx().percentage ?? 0}%</span>
              <span class="text-text-invert-base">Usage</span>
            </div>
          </>
        )}
      </Show>
      <div class="flex items-center gap-2">
        <span class="text-text-invert-strong">{cost()}</span>
        <span class="text-text-invert-base">Cost</span>
      </div>
      <Show when={cacheHitRate() !== null}>
        <div class="flex items-center gap-2">
          <span class="text-text-invert-strong">{cacheHitRate()}%</span>
          <span class="text-text-invert-base">Cache Hit</span>
        </div>
      </Show>
      <Show when={webSearchCount() !== null}>
        <div class="flex items-center gap-2">
          <span class="text-text-invert-strong">{webSearchCount()}</span>
          <span class="text-text-invert-base">Web Searches</span>
        </div>
      </Show>
      <Show when={variant() === "button"}>
        <div class="text-11-regular text-text-invert-base mt-1">Click to view context</div>
      </Show>
    </div>
  )

  return (
    <Show when={params.id}>
      <Tooltip value={tooltipValue()} placement="top">
        <Switch>
          <Match when={variant() === "indicator"}>{circle()}</Match>
          <Match when={true}>
            <Button type="button" variant="ghost" class="size-6" onClick={openContext}>
              {circle()}
            </Button>
          </Match>
        </Switch>
      </Tooltip>
    </Show>
  )
}
