import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Button } from "@opencode-ai/ui/button"
import { Markdown } from "@opencode-ai/ui/markdown"
import type { PlanRequest } from "@opencode-ai/sdk/v2/client"
import { useSDK } from "@/context/sdk"

export function DialogPlanApproval(props: { request: PlanRequest }) {
  const dialog = useDialog()
  const sdk = useSDK()

  async function approve() {
    await fetch(`${sdk.url}/plan/${props.request.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    dialog.close()
  }

  async function reject() {
    await fetch(`${sdk.url}/plan/${props.request.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    dialog.close()
  }

  return (
    <Dialog title="Approve Plan">
      <div class="flex flex-col gap-4 min-w-[500px] max-w-[800px]">
        <p class="text-14-regular text-text-weak">
          Claude has created a plan and is waiting for your approval to proceed with implementation.
        </p>

        <div class="max-h-[60vh] overflow-y-auto rounded-md border border-border-base bg-surface-inset p-4">
          <Markdown text={props.request.plan} />
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-border-base">
          <Button variant="ghost" size="large" onClick={reject}>
            Reject
          </Button>
          <Button variant="primary" size="large" onClick={approve}>
            Approve
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
