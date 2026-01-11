import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "../context/sdk"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useTheme } from "../context/theme"
import { DialogModel } from "./dialog-model"

/**
 * Simplified provider dialog for Anthropic-only Claude Agent SDK
 * Just prompts for Anthropic API key
 */
export function createDialogProviderOptions() {
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const { theme } = useTheme()

  // Single option for Anthropic
  return () => [
    {
      title: "Anthropic",
      value: "anthropic",
      description: "(Recommended - Claude API key)",
      category: "Popular",
      async onSelect() {
        dialog.replace(() => <ApiKeyDialog providerID="anthropic" />)
      },
    },
  ]
}

export function DialogProvider() {
  // Skip selection since we only support Anthropic - go directly to API key input
  return <ApiKeyDialog providerID="anthropic" />
}

function ApiKeyDialog(props: { providerID: string }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const { theme } = useTheme()

  return (
    <DialogPrompt
      title="Add Anthropic API key"
      placeholder="sk-ant-..."
      description={
        <box gap={1}>
          <text fg={theme.text}>
            Get your API key at{" "}
            <span style={{ fg: theme.primary }}>https://console.anthropic.com/settings/keys</span>
          </text>
        </box>
      }
      onConfirm={async (value) => {
        if (!value) return
        sdk.client.auth.set({
          providerID: props.providerID,
          auth: {
            type: "api",
            key: value,
          },
        })
        await sdk.client.instance.dispose()
        await sync.bootstrap()
        dialog.replace(() => <DialogModel providerID={props.providerID} />)
      }}
    />
  )
}
