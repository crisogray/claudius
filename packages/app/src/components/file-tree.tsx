import { useLocal, type LocalFile } from "@/context/local"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { For, Match, Show, Switch, onMount, type ComponentProps, type ParentProps } from "solid-js"
import { Dynamic } from "solid-js/web"
import type { GitFileStatus } from "@/context/git"

// Git status badge component
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
}) {
  const local = useLocal()
  const level = props.level ?? 0

  // Load root directory on mount
  onMount(() => {
    if (level === 0) {
      local.file.expand(props.path)
    }
  })

  const filteredChildren = () => {
    const children = local.file.children(props.path)
    const filterText = props.filter?.toLowerCase()
    if (!filterText) return children

    return children.filter((node) => {
      // Always include directories if they might have matching children
      if (node.type === "directory") return true
      // Filter files by name
      return node.name.toLowerCase().includes(filterText)
    })
  }

  const Node = (p: ParentProps & ComponentProps<"div"> & { node: LocalFile; as?: "div" | "button" }) => {
    // Helper function to determine folder git status color
    const getFolderColor = () => {
      if (p.node.type !== "directory") return null
      const statuses = props.folderStatuses?.get(p.node.path)
      if (!statuses) return null

      // Priority: deleted > modified > added
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
          // "bg-background-element": local.file.active()?.path === p.node.path,
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

          // Create custom drag image without margins
          const dragImage = document.createElement("div")
          dragImage.className =
            "flex items-center gap-x-2 px-2 py-1 bg-background-element rounded-md border border-border-1"
          dragImage.style.position = "absolute"
          dragImage.style.top = "-1000px"

          // Copy only the icon and text content without padding
          const icon = e.currentTarget.querySelector("svg")
          const text = e.currentTarget.querySelector("span")
          if (icon && text) {
            dragImage.innerHTML = icon.outerHTML + text.outerHTML
          }

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
            // Folder git status colors
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
                  // open={local.file.node(node.path)?.expanded}
                  onOpenChange={(open) => (open ? local.file.expand(node.path) : local.file.collapse(node.path))}
                >
                  <Collapsible.Trigger class="!h-auto">
                    <Node node={node}>
                      <Collapsible.Arrow class="text-text-muted/60 ml-1" />
                      <FileIcon
                        node={node}
                        // expanded={local.file.node(node.path).expanded}
                        class="text-text-muted/60 -ml-1"
                      />
                    </Node>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <FileTree path={node.path} level={level + 1} filter={props.filter} gitStatuses={props.gitStatuses} folderStatuses={props.folderStatuses} onFileClick={props.onFileClick} onContextMenu={props.onContextMenu} />
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
