import { Hono } from "hono"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import { PlanApproval } from "../plan"
import z from "zod"
import { errors } from "./error"

export const PlanRoute = new Hono()
  .get(
    "/",
    describeRoute({
      summary: "List pending plan approvals",
      description: "Get all pending plan approval requests across all sessions.",
      operationId: "plan.list",
      responses: {
        200: {
          description: "List of pending plan approvals",
          content: {
            "application/json": {
              schema: resolver(PlanApproval.Request.array()),
            },
          },
        },
      },
    }),
    async (c) => {
      const plans = await PlanApproval.list()
      return c.json(plans)
    },
  )
  .post(
    "/:requestID/approve",
    describeRoute({
      summary: "Approve plan",
      description: "Approve a plan from the AI assistant.",
      operationId: "plan.approve",
      responses: {
        200: {
          description: "Plan approved successfully",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        requestID: z.string(),
      }),
    ),
    async (c) => {
      const params = c.req.valid("param")
      await PlanApproval.reply({
        requestID: params.requestID,
        approved: true,
      })
      return c.json(true)
    },
  )
  .post(
    "/:requestID/reject",
    describeRoute({
      summary: "Reject plan",
      description: "Reject a plan from the AI assistant.",
      operationId: "plan.reject",
      responses: {
        200: {
          description: "Plan rejected successfully",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        ...errors(400, 404),
      },
    }),
    validator(
      "param",
      z.object({
        requestID: z.string(),
      }),
    ),
    validator(
      "json",
      z.object({
        message: z.string().optional(),
      }),
    ),
    async (c) => {
      const params = c.req.valid("param")
      const body = c.req.valid("json")
      await PlanApproval.reply({
        requestID: params.requestID,
        approved: false,
        message: body.message,
      })
      return c.json(true)
    },
  )
