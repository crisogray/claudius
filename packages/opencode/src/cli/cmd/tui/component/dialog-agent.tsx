import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import type { PermissionMode } from "@/sdk"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()

  const options = createMemo(() =>
    local.permissionMode.list().map((item) => {
      return {
        value: item.id,
        title: item.name,
        description: item.description,
      }
    }),
  )

  return (
    <DialogSelect
      title="Select permission mode"
      current={local.permissionMode.current().id}
      options={options()}
      onSelect={(option) => {
        local.permissionMode.set(option.value as PermissionMode)
        dialog.clear()
      }}
    />
  )
}
