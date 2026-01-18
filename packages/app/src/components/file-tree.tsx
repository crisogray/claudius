import { useLocal, type LocalFile } from "@/context/local"
import { useSDK } from "@/context/sdk"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { For, Match, Show, Switch, onMount, createSignal, createEffect, onCleanup, type ComponentProps, type ParentProps } from "solid-js"
import { Dynamic } from "solid-js/web"
import type { GitFileStatus } from "@/context/git"

function GitBadge(props: { status: GitFileStatus }) {
  const statusConfig: Record<string, { letter: string; class: string }> = {
    modified: { letter: "M", class: "text-icon-warning-base" },
    added: { letter: "A", class: "text-text-diff-add-base" },
    deleted: { letter: "D", class: "text-text-diff-delete-base" },
    untracked: { letter: "?", class: "text-text-weak" },
    renamed: { letter: "R", class: "text-text-interactive-base" },
    copied: { letter: "C", class: "text-text-interactive-base" },
  }
  const config = () => statusConfig[props.status.status] ?? { letter: "?", class: "text-text-weak" }

  return (
    <span class={`ml-auto mr-1 text-[10px] font-mono font-medium ${config().class}`}>
      {config().letter}
    </span>
  )
}

export default function FileTree(props: {
  path: string
  class?: string
  nodeClass?: string
  level?: number
  filter?: string
  gitStatuses?: Map<string, GitFileStatus>
  folderStatuses?: Map<string, Set<string>>
  onFileClick?: (file: LocalFile) => void
  onContextMenu?: (file: LocalFile, e: MouseEvent) => void
  visiblePaths?: Set<string>
  collapsedPaths?: Set<string>
  onCollapseChange?: (path: string, collapsed: boolean) => void
}) {
  const local = useLocal()
  const sdk = useSDK()
  const level = props.level ?? 0

  onMount(() => {
    if (level === 0) local.file.expand(props.path)
  })

  const [visiblePaths, setVisiblePaths] = createSignal<Set<string> | null>(null)
  const [collapsedPaths, setCollapsedPaths] = createSignal<Set<string>>(new Set())

  const filtering = () => props.visiblePaths ?? visiblePaths()
  const collapsed = () => props.collapsedPaths ?? collapsedPaths()
  const handleCollapseChange = (path: string, isCollapsed: boolean) => {
    const next = new Set(collapsedPaths())
    isCollapsed ? next.add(path) : next.delete(path)
    setCollapsedPaths(next)
  }
  const onCollapse = props.onCollapseChange ?? handleCollapseChange

  let searchTimer: ReturnType<typeof setTimeout>
  let abortController: AbortController | null = null

  createEffect(() => {
    if (level !== 0) return

    const filterText = props.filter?.trim()

    clearTimeout(searchTimer)
    abortController?.abort()

    if (!filterText) {
      setVisiblePaths(null)
      setCollapsedPaths(new Set<string>())
      return
    }

    searchTimer = setTimeout(async () => {
      abortController = new AbortController()

      try {
        const res = await sdk.client.find.files(
          { query: filterText, dirs: "false" },
          { signal: abortController.signal }
        )

        const visible = new Set<string>()

        for (const filePath of res.data ?? []) {
          visible.add(filePath)
          const fileName = filePath.split("/").pop() || filePath
          local.file.update(filePath, { path: filePath, name: fileName, type: "file", ignored: false, absolute: "" } as LocalFile)

          const parts = filePath.split("/")
          for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join("/")
            const parentName = parts[i - 1]
            visible.add(parentPath)
            local.file.update(parentPath, { path: parentPath, name: parentName, type: "directory", ignored: false, absolute: "", expanded: true, loaded: true } as LocalFile)
          }
        }

        setVisiblePaths(visible)
        setCollapsedPaths(new Set<string>())
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        setVisiblePaths(new Set<string>())
      }
    }, 150)
  })

  onCleanup(() => {
    clearTimeout(searchTimer)
    abortController?.abort()
  })

  const filteredChildren = () => {
    const children = local.file.children(props.path)
    if (!props.filter?.trim()) return children
    const visible = filtering()
    return visible ? children.filter(node => visible.has(node.path)) : []
  }

  const Node = (p: ParentProps & ComponentProps<"div"> & { node: LocalFile; as?: "div" | "button" }) => {
    const getFolderColor = () => {
      if (p.node.type !== "directory") return null
      const statuses = props.folderStatuses?.get(p.node.path)
      if (!statuses) return null
      if (statuses.has("deleted")) return "deleted"
      if (statuses.has("modified")) return "modified"
      if (statuses.has("added") || statuses.has("untracked")) return "added"
      return null
    }

    return (
      <Dynamic
        component={p.as ?? "div"}
        classList={{
          "h-6 w-full flex items-center justify-start gap-x-2 hover:bg-background-element text-left": true,
          [props.nodeClass ?? ""]: !!props.nodeClass,
        }}
        style={`padding-left: ${level * 10}px`}
        draggable={true}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault()
          props.onContextMenu?.(p.node, e)
        }}
        onDragStart={(e: any) => {
          const evt = e as globalThis.DragEvent
          evt.dataTransfer!.effectAllowed = "copy"
          evt.dataTransfer!.setData("text/plain", `file:${p.node.path}`)
          const dragImage = document.createElement("div")
          dragImage.className = "flex items-center gap-x-2 px-2 py-1 bg-background-element rounded-md border border-border-1"
          dragImage.style.position = "absolute"
          dragImage.style.top = "-1000px"
          const icon = e.currentTarget.querySelector("svg")
          const text = e.currentTarget.querySelector("span")
          if (icon && text) dragImage.innerHTML = icon.outerHTML + text.outerHTML
          document.body.appendChild(dragImage)
          evt.dataTransfer!.setDragImage(dragImage, 0, 12)
          setTimeout(() => document.body.removeChild(dragImage), 0)
        }}
        {...p}
      >
        {p.children}
        <span
          classList={{
            "text-xs whitespace-nowrap truncate flex-1": true,
            "text-text-muted/40": p.node.ignored,
            "text-text-muted/80": !p.node.ignored && !getFolderColor(),
            "text-icon-warning-base": getFolderColor() === "modified",
            "text-text-diff-add-base": getFolderColor() === "added",
            "text-text-diff-delete-base": getFolderColor() === "deleted",
          }}
        >
          {p.node.name}
        </span>
        <Show when={props.gitStatuses?.get(p.node.path)}>
          {(status) => <GitBadge status={status()} />}
        </Show>
      </Dynamic>
    )
  }

  return (
    <div class={`flex flex-col ${props.class}`}>
      <For each={filteredChildren()}>
        {(node) => (
          <Tooltip forceMount={false} openDelay={2000} value={node.path} placement="right">
            <Switch>
              <Match when={node.type === "directory"}>
                <Collapsible
                  variant="ghost"
                  class="w-full"
                  forceMount={false}
                  open={filtering() ? !collapsed().has(node.path) : undefined}
                  onOpenChange={(open) => filtering() ? onCollapse(node.path, !open) : open ? local.file.expand(node.path) : local.file.collapse(node.path)}
                >
                  <Collapsible.Trigger class="!h-auto">
                    <Node node={node}>
                      <Collapsible.Arrow class="text-text-muted/60 ml-1" />
                      <FileIcon node={node} class="text-text-muted/60 -ml-1" />
                    </Node>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <FileTree path={node.path} level={level + 1} filter={props.filter} gitStatuses={props.gitStatuses} folderStatuses={props.folderStatuses} onFileClick={props.onFileClick} onContextMenu={props.onContextMenu} visiblePaths={filtering() ?? undefined} collapsedPaths={collapsed()} onCollapseChange={onCollapse} />
                  </Collapsible.Content>
                </Collapsible>
              </Match>
              <Match when={node.type === "file"}>
                <Node node={node} as="button" onClick={() => props.onFileClick?.(node)}>
                  <div class="w-4 shrink-0" />
                  <FileIcon node={node} class="text-primary" />
                </Node>
              </Match>
            </Switch>
          </Tooltip>
        )}
      </For>
    </div>
  )
}
