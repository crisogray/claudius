import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { Spinner } from "@opencode-ai/ui/spinner"

const idle = { type: "idle" as const }

export function SessionStatusHeader() {
  const params = useParams()
  const sync = useSync()

  const session = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))
  const status = createMemo(() => sync.data.session_status[params.id ?? ""] ?? idle)

  const statusType = createMemo(() => status().type)
  const isWorking = createMemo(() => statusType() === "busy" || statusType() === "retry")

  return (
    <div class="flex flex-col gap-2 p-4 border-b border-border-weak-base">
      {/* Session title */}
      <div class="flex items-center gap-2 min-w-0">
        <h2 class="text-14-medium text-text-strong truncate flex-1">
          {session()?.title ?? "New Session"}
        </h2>
      </div>

      {/* Status badge */}
      <div class="flex items-center gap-2">
        <Show when={isWorking()}>
          <div class="flex items-center gap-1.5 text-12-regular text-text-weak">
            <Spinner class="size-3" />
            <span>Working...</span>
          </div>
        </Show>
        <Show when={statusType() === "idle" && session()}>
          <div class="flex items-center gap-1.5 text-12-regular text-text-weak">
            <div class="size-1.5 rounded-full bg-surface-success-strong" />
            <span>Ready</span>
          </div>
        </Show>
        <Show when={statusType() === "error"}>
          <div class="flex items-center gap-1.5 text-12-regular text-text-danger-base">
            <div class="size-1.5 rounded-full bg-surface-danger-strong" />
            <span>Error</span>
          </div>
        </Show>
      </div>
    </div>
  )
}
