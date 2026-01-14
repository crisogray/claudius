import { createMemo, Show } from "solid-js"
import type { JSX } from "solid-js"
import { createSortable } from "@thisbeyond/solid-dnd"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Tabs } from "@opencode-ai/ui/tabs"
import { getFilename } from "@opencode-ai/util/path"
import { useFile } from "@/context/file"

export function FileVisual(props: { path: string; active?: boolean }): JSX.Element {
  return (
    <div class="flex items-center gap-x-1.5">
      <FileIcon
        node={{ path: props.path, type: "file" }}
        classList={{
          "grayscale-100 group-data-[selected]/tab:grayscale-0": !props.active,
          "grayscale-0": props.active,
        }}
      />
      <span class="text-14-medium">{getFilename(props.path)}</span>
    </div>
  )
}

export function SortableTab(props: { tab: string; onTabClose: (tab: string) => void }): JSX.Element {
  const file = useFile()
  const sortable = createSortable(props.tab)
  const path = createMemo(() => file.pathFromTab(props.tab))
  const isDirty = createMemo(() => {
    const p = path()
    return p ? file.isDirty(p) : false
  })
  return (
    // @ts-ignore
    <div use:sortable classList={{ "h-full": true, "opacity-0": sortable.isActiveDraggable }}>
      <div class="relative h-full">
        <Tabs.Trigger
          value={props.tab}
          closeButton={
            <Tooltip value="Close tab" placement="bottom">
              <IconButton icon="close" variant="ghost" onClick={() => props.onTabClose(props.tab)} />
            </Tooltip>
          }
          hideCloseButton
          onMiddleClick={() => props.onTabClose(props.tab)}
        >
          <div class="flex items-center gap-3">
            <Show when={path()}>{(p) => <FileVisual path={p()} />}</Show>
            <Show when={isDirty()}>
              <div class="w-2 h-2 rounded-full bg-surface-warning-strong" title="Unsaved changes" />
            </Show>
          </div>
        </Tabs.Trigger>
      </div>
    </div>
  )
}
