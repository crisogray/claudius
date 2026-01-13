import { BusEvent } from "./bus-event"
import z from "zod"

export const AppEvent = {
  ToastShow: BusEvent.define(
    "toast.show",
    z.object({
      title: z.string().optional(),
      message: z.string(),
      variant: z.enum(["info", "success", "warning", "error"]),
      duration: z.number().default(5000).optional().describe("Duration in milliseconds"),
    }),
  ),
}
