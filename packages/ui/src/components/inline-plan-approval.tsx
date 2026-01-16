import { Markdown } from "./markdown"
import { PlanApprovalActions } from "./plan-approval-actions"

export interface InlinePlanApprovalProps {
  plan: string
  onApprove?: () => void
  onReject?: (message?: string) => void
}

export function InlinePlanApproval(props: InlinePlanApprovalProps) {
  return (
    <div data-component="plan-approval">
      <div data-slot="plan-content">
        <Markdown
          text={props.plan}
          fullscreen
          onApprove={props.onApprove}
          onReject={props.onReject}
        />
      </div>

      <PlanApprovalActions
        variant="inline"
        onApprove={() => props.onApprove?.()}
        onReject={(message) => props.onReject?.(message)}
      />
    </div>
  )
}
