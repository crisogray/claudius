import { createSignal } from "solid-js"
import { Button } from "./button"
import { Markdown } from "./markdown"
import { TextField } from "./text-field"

export interface InlinePlanApprovalProps {
  plan: string
  onApprove?: () => void
  onReject?: (message?: string) => void
}

export function InlinePlanApproval(props: InlinePlanApprovalProps) {
  const [message, setMessage] = createSignal("")

  const handleReject = () => {
    const msg = message().trim()
    props.onReject?.(msg || undefined)
  }

  const handleApprove = () => {
    props.onApprove?.()
  }

  return (
    <div data-component="plan-approval">
      <div data-slot="plan-content">
        <Markdown text={props.plan} />
      </div>

      <div data-slot="plan-rejection-input">
        <TextField
          value={message()}
          onChange={setMessage}
          placeholder="Optional feedback if rejecting..."
          size="small"
        />
      </div>
      <div data-slot="plan-actions">
        <Button variant="ghost" size="small" onClick={handleReject}>
          Reject
        </Button>
        <Button variant="primary" size="small" onClick={handleApprove}>
          Approve
        </Button>
      </div>
    </div>
  )
}
