import { createSignal, Show, onCleanup, createEffect } from "solid-js"
import { Portal } from "solid-js/web"
import type { LocalFile } from "@/context/local"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"

export type FileContextMenuState = {
  file: LocalFile
  x: number
  y: number
} | null

export function useFileContextMenu() {
  const [state, setState] = createSignal<FileContextMenuState>(null)

  const open = (file: LocalFile, e: MouseEvent) => {
    setState({ file, x: e.clientX, y: e.clientY })
  }

  const close = () => setState(null)

  return { state, open, close }
}

export function FileContextMenu(props: { state: FileContextMenuState; onClose: () => void }) {
  let menuRef: HTMLDivElement | undefined

  // Close on click outside
  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose()
    }
  }

  // Close on escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose()
    }
  }

  createEffect(() => {
    if (props.state) {
      document.addEventListener("click", handleClickOutside)
      document.addEventListener("keydown", handleKeyDown)
    }
    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    })
  })

  const copyPath = async () => {
    if (!props.state) return
    await navigator.clipboard.writeText(props.state.file.path)
    showToast({ title: "Copied path to clipboard" })
    props.onClose()
  }

  const copyAbsolutePath = async () => {
    if (!props.state) return
    await navigator.clipboard.writeText(props.state.file.absolute)
    showToast({ title: "Copied absolute path to clipboard" })
    props.onClose()
  }

  const copyFileName = async () => {
    if (!props.state) return
    await navigator.clipboard.writeText(props.state.file.name)
    showToast({ title: "Copied file name to clipboard" })
    props.onClose()
  }

  return (
    <Show when={props.state}>
      {(state) => (
        <Portal>
          <div
            ref={menuRef}
            class="fixed z-50 min-w-[180px] bg-background-base border border-border-base rounded-md shadow-lg py-1"
            style={{
              left: `${state().x}px`,
              top: `${state().y}px`,
            }}
          >
            <MenuItem icon="copy" label="Copy File Name" onClick={copyFileName} />
            <MenuItem icon="copy" label="Copy Path" onClick={copyPath} />
            <MenuItem icon="copy" label="Copy Absolute Path" onClick={copyAbsolutePath} />
          </div>
        </Portal>
      )}
    </Show>
  )
}

function MenuItem(props: { icon: "copy"; label: string; onClick: () => void }) {
  return (
    <button
      class="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-background-element text-left"
      onClick={props.onClick}
    >
      <Icon name={props.icon} size="small" class="text-text-muted" />
      {props.label}
    </button>
  )
}
