import { createMemo, Show } from "solid-js"
import { useSync } from "@/context/sync"
import { Icon } from "@opencode-ai/ui/icon"

export function GitStatus() {
  const sync = useSync()

  const branch = createMemo(() => sync.data.vcs?.branch)
  const hasBranch = createMemo(() => !!branch())

  return (
    <Show when={hasBranch()}>
      <div class="flex flex-col border-t border-border-weak-base">
        <div class="flex items-center gap-2 px-4 py-3">
          <Icon name="branch" class="size-4 text-icon-weak-base" />
          <span class="text-12-regular text-text-weak truncate">
            {branch()}
          </span>
        </div>
      </div>
    </Show>
  )
}
