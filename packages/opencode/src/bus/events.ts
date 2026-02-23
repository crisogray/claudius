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
  ModelsUpdated: BusEvent.define(
    "models.updated",
    z.object({
      count: z.number().describe("Number of models in the updated list"),
    }),
  ),
}
