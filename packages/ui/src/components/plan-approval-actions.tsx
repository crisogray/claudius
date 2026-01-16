import { createSignal } from "solid-js"
import { Button } from "./button"
import { TextField } from "./text-field"

export interface PlanApprovalActionsProps {
  onApprove: () => void
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
        <Button variant="primary" size="small" onClick={props.onApprove}>
          Approve
        </Button>
      </div>
    </>
  )
}
