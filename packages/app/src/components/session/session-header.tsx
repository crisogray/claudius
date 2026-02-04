import { createMemo, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { useParams } from "@solidjs/router"
import { useLayout } from "@/context/layout"
import { useCommand } from "@/context/command"
import { useServer } from "@/context/server"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useSync } from "@/context/sync"
import { getFilename } from "@opencode-ai/util/path"
import { base64Decode } from "@opencode-ai/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { Button } from "@opencode-ai/ui/button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { Keybind } from "@opencode-ai/ui/keybind"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { SessionLspIndicator } from "@/components/session-lsp-indicator"
import { SessionMcpIndicator } from "@/components/session-mcp-indicator"

export function SessionHeader() {
  const layout = useLayout()
  const params = useParams()
  const command = useCommand()
  const server = useServer()
  const dialog = useDialog()
  const sync = useSync()

  const projectDirectory = createMemo(() => base64Decode(params.dir ?? ""))
  const project = createMemo(() => {
    const directory = projectDirectory()
    if (!directory) return
    return layout.projects.list().find((p) => p.worktree === directory || p.sandboxes?.includes(directory))
  })
  const name = createMemo(() => {
    const current = project()
    if (current) return current.name || getFilename(current.worktree)
    return getFilename(projectDirectory())
  })
  const hotkey = createMemo(() => command.keybind("file.open"))

  const currentSession = createMemo(() => sync.data.session.find((s) => s.id === params.id))
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const view = createMemo(() => layout.view(sessionKey()))

  const centerMount = createMemo(() => document.getElementById("opencode-titlebar-center"))
  const rightMount = createMemo(() => document.getElementById("opencode-titlebar-right"))

  return (
    <>
      {/* Portal: Search button → titlebar center */}
      <Show when={centerMount()}>
        {(mount) => (
          <Portal mount={mount()}>
            <button
              type="button"
              class="hidden md:flex w-[320px] p-1 pl-1.5 items-center gap-2 justify-between rounded-md border border-border-weak-base bg-surface-raised-base transition-colors cursor-default hover:bg-surface-raised-base-hover focus:bg-surface-raised-base-hover active:bg-surface-raised-base-active"
              onClick={() => command.trigger("file.open")}
            >
              <div class="flex items-center gap-2">
                <Icon name="magnifying-glass" size="normal" class="icon-base" />
                <span class="flex-1 min-w-0 text-14-regular text-text-weak truncate h-3.5 flex items-center overflow-visible">
                  Search {name()}
                </span>
              </div>
              <Show when={hotkey()}>{(keybind) => <Keybind>{keybind()}</Keybind>}</Show>
            </button>
          </Portal>
        )}
      </Show>

      {/* Portal: Status + toggles → titlebar right */}
      <Show when={rightMount()}>
        {(mount) => (
          <Portal mount={mount()}>
            <div class="flex items-center gap-3">
              <div class="hidden md:flex items-center gap-1">
                <Button
                  size="small"
                  variant="ghost"
                  onClick={() => {
                    dialog.show(() => <DialogSelectServer />)
                  }}
                >
                  <div
                    classList={{
                      "size-1.5 rounded-full": true,
                      "bg-icon-success-base": server.healthy() === true,
                      "bg-icon-critical-base": server.healthy() === false,
                      "bg-border-weak-base": server.healthy() === undefined,
                    }}
                  />
                  <Icon name="server" size="small" class="text-icon-weak" />
                  <span class="text-12-regular text-text-weak truncate max-w-[200px]">{server.name}</span>
                </Button>
                <SessionLspIndicator />
                <SessionMcpIndicator />
              </div>
              <div class="flex items-center gap-1">
                <Show when={currentSession()?.summary?.files}>
                  <TooltipKeybind
                    class="hidden md:block shrink-0"
                    title="Toggle review"
                    keybind={command.keybind("review.toggle")}
                  >
                    <Button
                      variant="ghost"
                      class="group/review-toggle size-6 p-0"
                      onClick={() => view().reviewPanel.toggle()}
                    >
                      <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
                        <Icon
                          name={view().reviewPanel.opened() ? "layout-right" : "layout-left"}
                          size="small"
                          class="group-hover/review-toggle:hidden"
                        />
                        <Icon
                          name={view().reviewPanel.opened() ? "layout-right-partial" : "layout-left-partial"}
                          size="small"
                          class="hidden group-hover/review-toggle:inline-block"
                        />
                        <Icon
                          name={view().reviewPanel.opened() ? "layout-right-full" : "layout-left-full"}
                          size="small"
                          class="hidden group-active/review-toggle:inline-block"
                        />
                      </div>
                    </Button>
                  </TooltipKeybind>
                </Show>
                <TooltipKeybind
                  class="hidden md:block shrink-0"
                  title="Toggle terminal"
                  keybind={command.keybind("terminal.toggle")}
                >
                  <Button
                    variant="ghost"
                    class="group/terminal-toggle size-6 p-0"
                    onClick={() => view().terminal.toggle()}
                  >
                    <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
                      <Icon
                        size="small"
                        name={view().terminal.opened() ? "layout-bottom-full" : "layout-bottom"}
                        class="group-hover/terminal-toggle:hidden"
                      />
                      <Icon
                        size="small"
                        name="layout-bottom-partial"
                        class="hidden group-hover/terminal-toggle:inline-block"
                      />
                      <Icon
                        size="small"
                        name={view().terminal.opened() ? "layout-bottom" : "layout-bottom-full"}
                        class="hidden group-active/terminal-toggle:inline-block"
                      />
                    </div>
                  </Button>
                </TooltipKeybind>
                <TooltipKeybind
                  class="hidden md:block shrink-0"
                  title="Toggle files panel"
                  keybind={command.keybind("rightPanel.toggle")}
                >
                  <Button
                    variant="ghost"
                    class="group/files-toggle size-6 p-0"
                    onClick={() => layout.rightPanel.toggle()}
                  >
                    <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
                      <Icon
                        size="small"
                        name={layout.rightPanel.opened() ? "layout-right-full" : "layout-right"}
                        class="group-hover/files-toggle:hidden"
                      />
                      <Icon
                        size="small"
                        name="layout-right-partial"
                        class="hidden group-hover/files-toggle:inline-block"
                      />
                      <Icon
                        size="small"
                        name={layout.rightPanel.opened() ? "layout-right" : "layout-right-full"}
                        class="hidden group-active/files-toggle:inline-block"
                      />
                    </div>
                  </Button>
                </TooltipKeybind>
              </div>
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
