import { useMarked } from "../context/marked"
import DOMPurify from "dompurify"
import { checksum } from "@opencode-ai/util/encode"
import { ComponentProps, createResource, Show, splitProps } from "solid-js"
import { isServer } from "solid-js/web"
import { useDialog } from "../context/dialog"
import { Dialog } from "./dialog"
import { IconButton } from "./icon-button"
import { PlanApprovalActions } from "./plan-approval-actions"

type Entry = {
  hash: string
  html: string
}

const max = 200
const cache = new Map<string, Entry>()

if (typeof window !== "undefined" && DOMPurify.isSupported) {
  DOMPurify.addHook("afterSanitizeAttributes", (node: Element) => {
    if (!(node instanceof HTMLAnchorElement)) return
    if (node.target !== "_blank") return

    const rel = node.getAttribute("rel") ?? ""
    const set = new Set(rel.split(/\s+/).filter(Boolean))
    set.add("noopener")
    set.add("noreferrer")
    node.setAttribute("rel", Array.from(set).join(" "))
  })
}

const config = {
  USE_PROFILES: { html: true, mathMl: true },
  SANITIZE_NAMED_PROPS: true,
  FORBID_TAGS: ["style"],
  FORBID_CONTENTS: ["style", "script"],
}

function sanitize(html: string) {
  if (!DOMPurify.isSupported) return ""
  return DOMPurify.sanitize(html, config)
}

function touch(key: string, value: Entry) {
  cache.delete(key)
  cache.set(key, value)

  if (cache.size <= max) return

  const first = cache.keys().next().value
  if (!first) return
  cache.delete(first)
}

export function Markdown(
  props: ComponentProps<"div"> & {
    text: string
    cacheKey?: string
    class?: string
    classList?: Record<string, boolean>
    fullscreen?: boolean
    onApprove?: () => void
    onReject?: (message?: string) => void
  },
) {
  const [local, others] = splitProps(props, ["text", "cacheKey", "class", "classList", "fullscreen", "onApprove", "onReject"])
  const marked = useMarked()
  const dialog = useDialog()
  const [html] = createResource(
    () => local.text,
    async (markdown) => {
      if (isServer) return ""

      const hash = checksum(markdown)
      const key = local.cacheKey ?? hash

      if (key && hash) {
        const cached = cache.get(key)
        if (cached && cached.hash === hash) {
          touch(key, cached)
          return cached.html
        }
      }

      const next = await marked.parse(markdown)
      const safe = sanitize(next)
      if (key && hash) touch(key, { hash, html: safe })
      return safe
    },
    { initialValue: "" },
  )

  const openFullscreen = () => {
    dialog.show(() => (
      <Dialog title="Plan" class="markdown-fullscreen">
        <div data-slot="markdown-fullscreen-content">
          <div data-component="markdown" innerHTML={html.latest} />
        </div>

        <Show when={local.onApprove && local.onReject}>
          <PlanApprovalActions
            variant="fullscreen"
            onApprove={() => {
              local.onApprove?.()
              dialog.close()
            }}
            onReject={(message) => {
              local.onReject?.(message)
              dialog.close()
            }}
          />
        </Show>
      </Dialog>
    ))
  }

  const markdownEl = (
    <div
      data-component="markdown"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
      innerHTML={html.latest}
      {...others}
    />
  )

  return (
    <Show when={local.fullscreen} fallback={markdownEl}>
      <div data-component="markdown-container">
        <IconButton
          data-slot="markdown-fullscreen-button"
          icon="expand"
          variant="ghost"
          size="normal"
          onClick={openFullscreen}
        />
        {markdownEl}
      </div>
    </Show>
  )
}
