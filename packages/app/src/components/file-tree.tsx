import { useLocal, type LocalFile } from "@/context/local"
import { useSDK } from "@/context/sdk"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import {
  For,
  Match,
  Show,
  Switch,
  createSignal,
  createEffect,
  createMemo,
  on,
  onCleanup,
  splitProps,
  untrack,
  type ComponentProps,
  type ParentProps,
} from "solid-js"
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

  return <span class={`ml-auto mr-1 text-[10px] font-mono font-medium ${config().class}`}>{config().letter}</span>
}

export default function FileTree(props: {
  path: string
  class?: string
  nodeClass?: string
  active?: string
  level?: number
  filter?: string
  gitStatuses?: Map<string, GitFileStatus>
  folderStatuses?: Map<string, Set<string>>
  onFileClick?: (file: LocalFile) => void
  onContextMenu?: (file: LocalFile, e: MouseEvent) => void
  visiblePaths?: Set<string>
  collapsedPaths?: Set<string>
  onCollapseChange?: (path: string, collapsed: boolean) => void
  _deeps?: Map<string, number>
}) {
  const local = useLocal()
  const sdk = useSDK()
  const level = props.level ?? 0

  // Expand root on mount and when directory changes (for reactive project switching)
  createEffect(
    on(
      () => sdk.directory,
      () => {
        if (level === 0) local.file.expand(props.path)
      },
    ),
  )

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
          { signal: abortController.signal },
        )

        const visible = new Set<string>()

        for (const filePath of res.data ?? []) {
          visible.add(filePath)
          const fileName = filePath.split("/").pop() || filePath
          local.file.update(filePath, {
            path: filePath,
            name: fileName,
            type: "file",
            ignored: false,
            absolute: "",
          } as LocalFile)

          const parts = filePath.split("/")
          for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join("/")
            const parentName = parts[i - 1]
            visible.add(parentPath)
            local.file.update(parentPath, {
              path: parentPath,
              name: parentName,
              type: "directory",
              ignored: false,
              absolute: "",
              expanded: true,
              loaded: true,
            } as LocalFile)
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
    return visible ? children.filter((node) => visible.has(node.path)) : []
  }

  // Track deepest expanded level for nesting line opacity
  const deeps = createMemo(() => {
    if (props._deeps) return props._deeps

    const out = new Map<string, number>()

    const visit = (dir: string, lvl: number): number => {
      const file = local.file.state(dir)
      const expanded = file?.expanded ?? false
      if (!expanded) return -1

      const nodes = local.file.children(dir)
      const max = nodes.reduce((max, node) => {
        if (node.type !== "directory") return max
        const nodeFile = local.file.state(node.path)
        const open = nodeFile?.expanded ?? false
        if (!open) return max
        return Math.max(max, visit(node.path, lvl + 1))
      }, lvl)

      out.set(dir, max)
      return max
    }

    visit(props.path, level - 1)
    return out
  })

  const Node = (
    p: ParentProps &
      ComponentProps<"div"> &
      ComponentProps<"button"> & {
        node: LocalFile
        as?: "div" | "button"
      },
  ) => {
    const [local_, rest] = splitProps(p, ["node", "as", "children", "class", "classList"])

    const getFolderColor = () => {
      if (local_.node.type !== "directory") return null
      const statuses = props.folderStatuses?.get(local_.node.path)
      if (!statuses) return null
      if (statuses.has("deleted")) return "deleted"
      if (statuses.has("modified")) return "modified"
      if (statuses.has("added") || statuses.has("untracked")) return "added"
      return null
    }

    return (
      <Dynamic
        component={local_.as ?? "div"}
        classList={{
          "w-full min-w-0 h-6 flex items-center justify-start gap-x-1.5 rounded-md mx-1 px-1 py-0 text-left hover:bg-surface-raised-base-hover active:bg-surface-base-active transition-colors cursor-pointer": true,
          "bg-surface-base-active": local_.node.path === props.active,
          ...(local_.classList ?? {}),
          [local_.class ?? ""]: !!local_.class,
          [props.nodeClass ?? ""]: !!props.nodeClass,
        }}
        style={`padding-left: ${Math.max(0, 8 + level * 12 - (local_.node.type === "file" ? 24 : 4))}px`}
        draggable={true}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault()
          props.onContextMenu?.(local_.node, e)
        }}
        onDragStart={(e: DragEvent) => {
          e.dataTransfer?.setData("text/plain", `file:${local_.node.path}`)
          e.dataTransfer?.setData("text/uri-list", `file://${local_.node.path}`)
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy"

          const dragImage = document.createElement("div")
          dragImage.className =
            "flex items-center gap-x-2 px-2 py-1 bg-surface-raised-base rounded-md border border-border-base text-12-regular text-text-strong"
          dragImage.style.position = "absolute"
          dragImage.style.top = "-1000px"

          const icon =
            (e.currentTarget as HTMLElement).querySelector('[data-component="file-icon"]') ??
            (e.currentTarget as HTMLElement).querySelector("svg")
          const text = (e.currentTarget as HTMLElement).querySelector("span")
          if (icon && text) {
            dragImage.innerHTML = (icon as SVGElement).outerHTML + (text as HTMLSpanElement).outerHTML
          }

          document.body.appendChild(dragImage)
          e.dataTransfer?.setDragImage(dragImage, 0, 12)
          setTimeout(() => document.body.removeChild(dragImage), 0)
        }}
        {...rest}
      >
        {local_.children}
        <span
          classList={{
            "flex-1 min-w-0 text-12-medium whitespace-nowrap truncate": true,
            "text-text-weaker": local_.node.ignored,
            "text-text-weak": !local_.node.ignored && !getFolderColor(),
            "text-icon-warning-base": getFolderColor() === "modified",
            "text-text-diff-add-base": getFolderColor() === "added",
            "text-text-diff-delete-base": getFolderColor() === "deleted",
          }}
        >
          {local_.node.name}
        </span>
        <Show when={props.gitStatuses?.get(local_.node.path)}>{(status) => <GitBadge status={status()} />}</Show>
      </Dynamic>
    )
  }

  return (
    <div class={`flex flex-col ${props.class ?? ""}`}>
      <For each={filteredChildren()}>
        {(node) => {
          const expanded = () => local.file.state(node.path)?.expanded ?? false
          const deep = () => deeps().get(node.path) ?? -1

          return (
            <Tooltip forceMount={false} openDelay={2000} placement="bottom-start" class="w-full" value={node.path}>
              <Switch>
                <Match when={node.type === "directory"}>
                  <Collapsible
                    variant="ghost"
                    class="w-full"
                    forceMount={false}
                    open={filtering() ? !collapsed().has(node.path) : expanded()}
                    onOpenChange={(open) =>
                      filtering()
                        ? onCollapse(node.path, !open)
                        : open
                          ? local.file.expand(node.path)
                          : local.file.collapse(node.path)
                    }
                  >
                    <Collapsible.Trigger class="!h-auto">
                      <Node node={node}>
                        <div class="w-5 h-4 flex items-center justify-center text-icon-weak">
                          <Icon name={expanded() ? "chevron-down" : "chevron-right"} size="small" />
                        </div>
                        <FileIcon node={node} class="text-icon-weak size-4" />
                      </Node>
                    </Collapsible.Trigger>
                    <Collapsible.Content class="relative pt-0.5">
                      <div
                        class="absolute top-0 bottom-0 w-px pointer-events-none bg-border-weak-base"
                        style={`left: ${Math.max(0, 8 + level * 12 - 4) + 13.5}px`}
                      />
                      <FileTree
                        path={node.path}
                        level={level + 1}
                        active={props.active}
                        filter={props.filter}
                        gitStatuses={props.gitStatuses}
                        folderStatuses={props.folderStatuses}
                        onFileClick={props.onFileClick}
                        onContextMenu={props.onContextMenu}
                        visiblePaths={filtering() ?? undefined}
                        collapsedPaths={collapsed()}
                        onCollapseChange={onCollapse}
                        _deeps={deeps()}
                      />
                    </Collapsible.Content>
                  </Collapsible>
                </Match>
                <Match when={node.type === "file"}>
                  <Node node={node} as="button" type="button" onClick={() => props.onFileClick?.(node)}>
                    <div class="w-5 shrink-0" />
                    <FileIcon node={node} class="text-icon-weak size-4" />
                  </Node>
                </Match>
              </Switch>
            </Tooltip>
          )
        }}
      </For>
    </div>
  )
}
