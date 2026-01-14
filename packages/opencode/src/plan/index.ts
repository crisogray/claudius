import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import z from "zod"

export namespace PlanApproval {
  const log = Log.create({ service: "plan" })

  export const Request = z
    .object({
      id: Identifier.schema("plan"),
      sessionID: Identifier.schema("session"),
      callID: z.string().describe("The tool_use_id of the ExitPlanMode call"),
      plan: z.string().describe("The plan content for approval"),
    })
    .meta({
      ref: "PlanRequest",
    })
  export type Request = z.infer<typeof Request>

  export const Reply = z.object({
    approved: z.boolean().describe("Whether the user approved the plan"),
  })
  export type Reply = z.infer<typeof Reply>

  export const Event = {
    Asked: BusEvent.define("plan.asked", Request),
    Replied: BusEvent.define(
      "plan.replied",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        approved: z.boolean(),
        message: z.string().optional(),
      }),
    ),
    Rejected: BusEvent.define(
      "plan.rejected",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
      }),
    ),
  }

  export type AskResult = {
    approved: boolean
    message?: string
  }

  const state = Instance.state(async () => {
    const pending: Record<
      string,
      {
        info: Request
        resolve: (result: AskResult) => void
        reject: (e: any) => void
      }
    > = {}

    return {
      pending,
    }
  })

  export async function ask(input: { sessionID: string; callID: string; plan: string }): Promise<AskResult> {
    const s = await state()
    const id = Identifier.ascending("plan")

    log.info("asking for plan approval", { id })

    return new Promise<AskResult>((resolve, reject) => {
      const info: Request = {
        id,
        sessionID: input.sessionID,
        callID: input.callID,
        plan: input.plan,
      }
      s.pending[id] = {
        info,
        resolve,
        reject,
      }
      Bus.publish(Event.Asked, info)
    })
  }

  export async function reply(input: { requestID: string; approved: boolean; message?: string }): Promise<void> {
    const s = await state()
    const existing = s.pending[input.requestID]
    if (!existing) {
      log.warn("reply for unknown plan request", { requestID: input.requestID })
      return
    }
    delete s.pending[input.requestID]

    log.info("plan replied", { requestID: input.requestID, approved: input.approved, message: input.message })

    Bus.publish(Event.Replied, {
      sessionID: existing.info.sessionID,
      requestID: existing.info.id,
      approved: input.approved,
      message: input.message,
    })

    existing.resolve({ approved: input.approved, message: input.message })
  }

  export async function reject(requestID: string): Promise<void> {
    const s = await state()
    const existing = s.pending[requestID]
    if (!existing) {
      log.warn("reject for unknown plan request", { requestID })
      return
    }
    delete s.pending[requestID]

    log.info("plan rejected", { requestID })

    Bus.publish(Event.Rejected, {
      sessionID: existing.info.sessionID,
      requestID: existing.info.id,
    })

    existing.reject(new RejectedError("User dismissed the plan approval request"))
  }

  export async function rejectBySession(sessionID: string): Promise<void> {
    const s = await state()
    for (const [requestID, pending] of Object.entries(s.pending)) {
      if (pending.info.sessionID === sessionID) {
        delete s.pending[requestID]
        log.info("plan rejected by session interrupt", { requestID, sessionID })
        Bus.publish(Event.Rejected, {
          sessionID: pending.info.sessionID,
          requestID: pending.info.id,
        })
        pending.reject(new RejectedError("User stopped generation"))
      }
    }
  }

  export class RejectedError extends Error {
    constructor(message: string) {
      super(message)
    }
  }

  export async function list() {
    return state().then((x) => Object.values(x.pending).map((x) => x.info))
  }
}
