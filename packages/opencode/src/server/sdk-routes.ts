import { Hono } from "hono"
import { SDK } from "@/sdk"
import { Session } from "@/session"

/**
 * SDK Routes - Claude Agent SDK integration
 *
 * These routes are separated to avoid TypeScript type instantiation depth issues
 * with the main Hono app chain.
 */
export const sdkRoutes = new Hono()
  .post("/session/:sessionID/sdk/prompt", async (c) => {
    const sessionID = c.req.param("sessionID")
    const body = await c.req.json<{
      prompt: string
      messageID?: string
      variant?: string
    }>()

    const result = await SDK.start({
      sessionID,
      messageID: body.messageID,
      variant: body.variant,
      parts: [{ type: "text", text: body.prompt }],
    })

    const error =
      result.info.role === "assistant" && result.info.error
        ? (result.info.error as any).data?.message ?? (result.info.error as any).name ?? "Unknown error"
        : undefined

    return c.json({
      messageID: result.info.id,
      error,
    })
  })
  .post("/session/:sessionID/sdk/abort", async (c) => {
    const sessionID = c.req.param("sessionID")
    await SDK.interrupt(sessionID)
    return c.json(true)
  })
  .get("/session/:sessionID/sdk/status", async (c) => {
    const sessionID = c.req.param("sessionID")
    return c.json({ active: SDK.isActive(sessionID) })
  })
  .post("/session/:sessionID/sdk/rewind", async (c) => {
    const sessionID = c.req.param("sessionID")
    const body = await c.req.json<{
      messageUuid: string
    }>()

    await SDK.rewindFiles(sessionID, body.messageUuid)
    return c.json({ ok: true })
  })
  .post("/session/:sessionID/sdk/model", async (c) => {
    const sessionID = c.req.param("sessionID")
    const body = await c.req.json<{
      model: string
    }>()

    await SDK.setModel(sessionID, body.model)
    return c.json({ ok: true })
  })
  .post("/session/:sessionID/sdk/permission-mode", async (c) => {
    const sessionID = c.req.param("sessionID")
    const body = await c.req.json<{
      permissionMode: "default" | "plan" | "acceptEdits" | "bypassPermissions"
    }>()

    // Update active SDK query
    await SDK.setPermissionMode(sessionID, body.permissionMode)

    // Persist to session for future prompts
    await Session.update(sessionID, (draft) => {
      draft.permissionMode = body.permissionMode
    })

    return c.json({ ok: true })
  })
