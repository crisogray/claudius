import { createSignal } from "solid-js"
import { Button } from "./button"
import { TextField } from "./text-field"

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions"

export interface PlanApprovalActionsProps {
  onApprove: (permissionMode?: PermissionMode) => void
  onReject: (message?: string) => void
  variant?: "inline" | "fullscreen"
}

export function PlanApprovalActions(props: PlanApprovalActionsProps) {
  const [message, setMessage] = createSignal("")
  const prefix = props.variant === "fullscreen" ? "markdown-fullscreen-" : "plan-"

  const handleReject = () => {
    const msg = message().trim()
    props.onReject(msg || undefined)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleReject()
    }
  }

  return (
    <>
      <div data-slot={`${prefix}rejection-input`}>
        <TextField
          value={message()}
          onChange={setMessage}
          placeholder="Optional feedback if rejecting..."
          size="small"
          onKeyDown={handleKeyDown}
        />
      </div>
      <div data-slot={`${prefix}actions`}>
        <Button variant="ghost" size="small" onClick={handleReject}>
          Reject
        </Button>
        <Button variant="secondary" size="small" onClick={() => props.onApprove("default")}>
          Approve
        </Button>
        <Button variant="primary" size="small" onClick={() => props.onApprove("acceptEdits")}>
          Auto-Accept
        </Button>
        <Button variant="ghost" size="small" onClick={() => props.onApprove("bypassPermissions")}>
          Bypass
        </Button>
      </div>
    </>
  )
}
