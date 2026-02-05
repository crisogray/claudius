import path from "path"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { SessionStatus } from "@/session/status"
import { Log } from "@/util/log"
import z from "zod"
import { SDKCommands } from "./commands"
import { SDKConvert } from "./convert"
import { SDKMCP } from "./mcp"
import { SDKModels } from "./models"
import { SDKPermissions } from "./permissions"
import { SDKStream } from "./stream"
import { Identifier } from "@/id/id"
import { PermissionNext } from "@/permission"
import { PlanApproval } from "@/plan"
import { Question } from "@/question"
import { SessionRevert } from "@/session/revert"
import { Snapshot } from "@/snapshot"
// Real Claude Agent SDK
import { query, type Query } from "@anthropic-ai/claude-agent-sdk"
import type { HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk"

import fs from "fs"
import { execSync } from "child_process"

// Cache the resolved claude path
let cachedClaudePath: string | undefined | null = null

/**
 * Get path to Claude Code executable.
 * Prefers system-installed claude (has Keychain access for auth) over bundled cli.js.
 */
function getClaudeCodeExecutablePath(): string | undefined {
  if (cachedClaudePath !== null) {
    return cachedClaudePath
  }

  // Try system-installed claude first - it has Keychain access for OAuth
  try {
    const cmd = process.platform === "win32" ? "where claude" : "which claude"
    const claudePath = execSync(cmd, { encoding: "utf-8" }).trim().split("\n")[0]
    if (claudePath && fs.existsSync(claudePath)) {
      cachedClaudePath = claudePath
      return claudePath
    }
  } catch {
    // Not in PATH
  }

  // Fallback to bundled cli.js (may not have Keychain access in notarized app)
  const execDir = path.dirname(process.execPath)

  const localCliJs = path.join(execDir, "cli.js")
  if (fs.existsSync(localCliJs)) {
    cachedClaudePath = localCliJs
    return localCliJs
  }

  const resourcesCliJs = path.join(execDir, "..", "Resources", "sidecars", "cli.js")
  if (fs.existsSync(resourcesCliJs)) {
    cachedClaudePath = resourcesCliJs
    return resourcesCliJs
  }

  const sidecarsFolderCliJs = path.join(execDir, "..", "..", "sidecars", "cli.js")
  if (fs.existsSync(sidecarsFolderCliJs)) {
    cachedClaudePath = sidecarsFolderCliJs
    return sidecarsFolderCliJs
  }

  // Let SDK try its default resolution
  cachedClaudePath = undefined
  return undefined
}

/**
 * SDK Permission modes - maps to SDK's permissionMode option
 */
export type PermissionMode = "default" | "plan" | "acceptEdits" | "bypassPermissions"

/**
 * Permission mode display info for UI
 */
export const PERMISSION_MODES = [
  { id: "default" as const, name: "Default", description: "Normal mode with permission prompts", color: "#3B82F6" },
  { id: "plan" as const, name: "Plan", description: "Read-only planning mode", color: "#8B5CF6" },
  { id: "acceptEdits" as const, name: "Auto-Accept", description: "Auto-accept file edits", color: "#22C55E" },
  { id: "bypassPermissions" as const, name: "Bypass", description: "Skip all permission checks", color: "#F59E0B" },
] as const

export namespace SDK {
  const log = Log.create({ service: "sdk" })

  // SDK Events
  export const Event = {
    Started: BusEvent.define(
      "sdk.started",
      z.object({
        sessionID: z.string(),
        prompt: z.string(),
      }),
    ),
    Completed: BusEvent.define(
      "sdk.completed",
      z.object({
        sessionID: z.string(),
        messageID: z.string().optional(),
      }),
    ),
    Error: BusEvent.define(
      "sdk.error",
      z.object({
        sessionID: z.string(),
        error: z.string(),
      }),
    ),
  }

  // Active query state per session
  const activeQueries = new Map<string, Query>()

  // Track current message ID per session for interrupt cleanup
  const currentMessages = new Map<string, string>()

  /**
   * Input format matching SessionPrompt.PromptInput
   */
  export const PromptInput = z.object({
    sessionID: z.string(),
    messageID: z.string().optional(),
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    permissionMode: z.enum(["default", "plan", "acceptEdits", "bypassPermissions"]).optional(),
    variant: z.string().optional(),
    parts: z.array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("text"), text: z.string() }).passthrough(),
        z.object({ type: z.literal("file"), path: z.string(), mime: z.string().optional() }).passthrough(),
        z.object({ type: z.literal("agent") }).passthrough(),
        z.object({ type: z.literal("subtask") }).passthrough(),
      ]),
    ),
  })
  export type PromptInput = z.infer<typeof PromptInput>

  /**
   * Start SDK processing for a prompt
   *
   * This is the main entry point that:
   * 1. Creates user message
   * 2. Expands commands
   * 3. Builds SDK options
   * 4. Starts SDK query
   * 5. Processes stream via conversion layer
   */
  export async function start(input: PromptInput): Promise<MessageV2.WithParts> {
    log.info("starting SDK", { sessionID: input.sessionID, variant: input.variant })

    const session = await Session.get(input.sessionID)

    // Capture revert context BEFORE cleanup clears it
    const revertSdkUuid = session.revert?.sdkUuid

    await SessionRevert.cleanup(session)

    const config = await Config.get()

    // Extract text from parts
    const textParts = input.parts.filter((p) => p.type === "text") as Array<{ type: "text"; text: string }>
    const rawPrompt = textParts.map((p) => p.text).join("\n")

    // Expand commands
    const { prompt, command } = await SDKCommands.expandCommand(rawPrompt)
    log.info("expanded command", { hasCommand: !!command })

    // Build content array for streaming input (includes images)
    type ImageSource = { type: "base64"; media_type: string; data: string }
    type ContentBlock = { type: "text"; text: string } | { type: "image"; source: ImageSource }
    const contentBlocks: ContentBlock[] = []
    let hasImages = false

    for (const part of input.parts) {
      if (part.type === "text") {
        // Only add text blocks if they have content (avoid empty string text blocks)
        if (part.text.trim()) {
          contentBlocks.push({ type: "text", text: part.text })
        }
      } else if (part.type === "file") {
        const filePath = (part as any).path as string
        if (filePath.startsWith("data:")) {
          // Parse data URL: data:image/png;base64,ABC123...
          const match = filePath.match(/^data:([^;]+);base64,(.+)$/)
          if (match) {
            const [, mediaType, data] = match
            contentBlocks.push({
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            })
            hasImages = true
          }
        }
      }
    }

    // If we have text content expanded (like /command), update content blocks
    if (prompt !== rawPrompt && contentBlocks.length > 0) {
      // Find and update text blocks with expanded prompt
      const textBlockIndex = contentBlocks.findIndex((b) => b.type === "text")
      if (textBlockIndex >= 0) {
        contentBlocks[textBlockIndex] = { type: "text", text: prompt }
      }
    }

    // Get permission mode - priority: input > default
    const permissionMode: PermissionMode = input.permissionMode ?? "default"

    // Get model - priority: command > input > config > default
    const modelID = command?.model
      ? parseModelID(command.model)
      : input.model?.modelID
        ? input.model.modelID
        : config.model
          ? parseModelID(config.model)
          : SDKModels.getDefaultModel()

    const providerID = input.model?.providerID ?? "anthropic"

    // Create user message
    const userMessageID = input.messageID ?? Identifier.ascending("message")
    const userMessage = SDKConvert.createUserMessage(input.sessionID, {
      id: userMessageID,
      permissionMode,
      modelID,
      providerID,
    })
    await Session.updateMessage(userMessage)
    await Session.touch(input.sessionID)

    // Persist permission mode to session for UI sync when returning to this session
    await Session.update(input.sessionID, (draft) => {
      draft.permissionMode = permissionMode
    })

    // Add parts to the user message
    for (const part of input.parts) {
      if (part.type === "text") {
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: input.sessionID,
          messageID: userMessageID,
          type: "text",
          text: part.text,
          time: { start: Date.now(), end: Date.now() },
        })
      } else if (part.type === "file") {
        const filePath = (part as any).path as string
        // Skip data URLs (images) - they're already added by the optimistic UI
        // and we don't want duplicate parts in the message
        if (filePath.startsWith("data:")) {
          continue
        }
        // Handle file paths
        const url = `file://${filePath}`
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: input.sessionID,
          messageID: userMessageID,
          type: "file",
          mime: (part as any).mime ?? "application/octet-stream",
          url,
          source: {
            type: "file",
            path: filePath,
            text: { value: "", start: 0, end: 0 },
          },
        })
      }
    }

    Bus.publish(MessageV2.Event.Updated, { info: userMessage })
    Bus.publish(Event.Started, { sessionID: input.sessionID, prompt })

    // Snapshot capture is deferred to stream.ts where we can check if write tools are enabled
    // This avoids expensive git operations for read-only queries
    const initialSnapshot = undefined

    // Set session status to busy
    SessionStatus.set(input.sessionID, { type: "busy" })

    // Build SDK options
    const options = await buildSDKOptions({
      config,
      session,
      permissionMode,
      modelID,
      variant: input.variant,
    })

    // Handle fork context - use SDK-native forking
    let forkOptions: { resume?: string; resumeSessionAt?: string; forkSession?: boolean } = {}
    if (session.fork) {
      const { originalSdkSessionId, sdkForkPoint } = session.fork
      if (originalSdkSessionId && sdkForkPoint) {
        forkOptions = {
          resume: originalSdkSessionId,
          resumeSessionAt: sdkForkPoint,
          forkSession: true,
        }
        log.info("SDK fork", { from: originalSdkSessionId, at: sdkForkPoint })
      }
      // Clear fork context after use
      await Session.update(input.sessionID, (draft) => {
        draft.fork = undefined
      })
    }

    // Handle revert context - resume same session at earlier point
    let revertOptions: { resumeSessionAt?: string } = {}
    if (revertSdkUuid && !session.fork) {
      revertOptions = { resumeSessionAt: revertSdkUuid }
      log.info("SDK revert resume", { sessionID: input.sessionID, at: revertSdkUuid })
    }

    // Create message generator for streaming input (required for images)
    // Type matches SDK's SDKUserMessage interface for streaming input
    async function* createMessageGenerator(): AsyncGenerator<SDKConvert.SDKUserMessage> {
      yield {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: contentBlocks as SDKConvert.ContentBlock[],
        },
      }
    }

    // Start real SDK query - use generator when we have images, string otherwise
    // Use undefined instead of empty string when there's no text content
    const activeQuery = query({
      prompt: hasImages ? (createMessageGenerator() as any) : prompt || undefined,
      options: {
        model: options.model,
        cwd: options.cwd,
        pathToClaudeCodeExecutable: getClaudeCodeExecutablePath(),
        tools: options.tools,
        mcpServers: options.mcpServers,
        maxThinkingTokens: options.maxThinkingTokens,
        permissionMode: options.permissionMode,
        allowDangerouslySkipPermissions: options.allowDangerouslySkipPermissions,
        hooks: options.hooks,
        canUseTool: options.canUseTool,
        resume: forkOptions.resume ?? options.resume,
        resumeSessionAt: forkOptions.resumeSessionAt ?? revertOptions.resumeSessionAt,
        forkSession: forkOptions.forkSession,
        systemPrompt: options.systemPrompt,
        settingSources: ["user", "project"],
        includePartialMessages: true,
      },
    })

    activeQueries.set(input.sessionID, activeQuery)

    try {
      // Process stream - SDK query is async iterable
      const result = await SDKStream.processSDKStream(
        activeQuery as AsyncIterable<SDKConvert.SDKMessage>,
        input.sessionID,
        {
          parentID: userMessageID,
          permissionMode,
          modelID,
          providerID,
          initialSnapshot,
        },
        // Callback to track current message ID for interrupt cleanup
        (messageID) => {
          if (messageID) {
            currentMessages.set(input.sessionID, messageID)
          }
        },
      )

      Bus.publish(Event.Completed, {
        sessionID: input.sessionID,
        messageID: result.messageID ?? undefined,
      })

      // Return the assistant message with parts
      if (result.messageID) {
        const msg = await MessageV2.get({ sessionID: input.sessionID, messageID: result.messageID })
        return msg
      }

      // Return user message if no assistant response
      return { info: userMessage, parts: [] }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error("SDK error", { error: errorMessage })
      Bus.publish(Event.Error, { sessionID: input.sessionID, error: errorMessage })
      throw error
    } finally {
      // Only delete if this is still our query (avoids race with new prompt after interrupt)
      if (activeQueries.get(input.sessionID) === activeQuery) {
        activeQueries.delete(input.sessionID)
        currentMessages.delete(input.sessionID)
        // Clean up any pending plan/question/permission requests for this session
        await PlanApproval.rejectBySession(input.sessionID)
        await Question.rejectBySession(input.sessionID)
        await PermissionNext.rejectBySession(input.sessionID)
        // Set session status back to idle
        SessionStatus.set(input.sessionID, { type: "idle" })
      }
    }
  }

  /**
   * Interrupt the active SDK query for a session
   *
   * This immediately:
   * 1. Signals the SDK to stop
   * 2. Sets session status to idle
   * 3. Completes the current message with "cancelled" finish reason
   */
  export async function interrupt(sessionID: string) {
    const activeQuery = activeQueries.get(sessionID)
    if (activeQuery) {
      log.info("interrupting SDK", { sessionID })
      activeQuery.interrupt()

      // Clean up any pending plan/question/permission requests for this session
      await PlanApproval.rejectBySession(sessionID)
      await Question.rejectBySession(sessionID)
      await PermissionNext.rejectBySession(sessionID)

      // Complete the current message
      const messageID = currentMessages.get(sessionID)
      if (messageID) {
        try {
          const msg = await MessageV2.get({ sessionID, messageID })
          if (msg.info.role === "assistant" && !msg.info.time.completed) {
            const assistantMsg = msg.info as MessageV2.Assistant
            assistantMsg.time.completed = Date.now()
            assistantMsg.finish = "cancelled"
            await Session.updateMessage(assistantMsg)
            Bus.publish(MessageV2.Event.Updated, { info: assistantMsg })
          }
        } catch (error) {
          log.warn("failed to complete message on interrupt", { sessionID, messageID, error })
        }
      }

      // Cleanup tracking
      currentMessages.delete(sessionID)
    }

    // Always set session status to idle (stops the spinner)
    // This must be outside the activeQuery check because child sessions
    // don't have their own active query - they're managed by the parent's stream
    SessionStatus.set(sessionID, { type: "idle" })

    // Also interrupt any child sessions (subagents)
    for (const child of await Session.children(sessionID)) {
      await interrupt(child.id)
    }
  }

  /**
   * Check if SDK is currently processing for a session
   */
  export function isActive(sessionID: string): boolean {
    return activeQueries.has(sessionID)
  }

  /**
   * Build hooks for plan mode that whitelist plan file writes
   */
  function buildPlanModeHooks() {
    const planFileHook: HookCallback = async (input, _toolUseId, _context) => {
      const preInput = input as PreToolUseHookInput
      const toolInput = preInput.tool_input as Record<string, unknown> | undefined
      const filePath = toolInput?.file_path as string | undefined

      // Allow writes to .claude/plans/*.md files
      if (filePath?.includes(".claude/plans/") && filePath.endsWith(".md")) {
        return {
          hookSpecificOutput: {
            hookEventName: "PreToolUse" as const,
            permissionDecision: "allow" as const,
            permissionDecisionReason: "Plan file write allowed",
          },
        }
      }

      // Continue to plan mode (will deny other writes)
      return {}
    }

    return {
      PreToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [planFileHook],
        },
      ],
    }
  }

  /**
   * Build SDK options from config and context
   */
  async function buildSDKOptions(input: {
    config: Config.Info
    session: Session.Info
    permissionMode: PermissionMode
    modelID: string
    variant?: string
  }) {
    const { config, session, permissionMode, modelID, variant } = input

    // Get MCP servers
    const mcpServers = await SDKMCP.getMcpServers()

    // Get custom instructions from config
    const customInstructions = await getCustomInstructions()

    // Plan mode needs hooks to whitelist plan file writes
    const isPlanMode = permissionMode === "plan"

    return {
      model: modelID,
      cwd: Instance.directory,
      env: {
        ...process.env,
        CLAUDE_CODE_ENABLE_TASKS: "true",
      },
      tools: { type: "preset" as const, preset: "claude_code" as const },
      mcpServers,
      maxThinkingTokens: variantToThinkingBudget(variant),
      enableFileCheckpointing: true,
      // Pass permission mode directly to SDK
      permissionMode,
      // Required when using bypassPermissions mode per SDK docs
      allowDangerouslySkipPermissions: permissionMode === "bypassPermissions",
      hooks: isPlanMode ? buildPlanModeHooks() : undefined,
      canUseTool: SDKPermissions.createPermissionHandler(session.id),
      // Resume using stored SDK session ID (if exists)
      resume: (session as any).sdk?.sessionId,
      // System prompt with custom instructions
      systemPrompt: customInstructions
        ? {
            type: "preset" as const,
            preset: "claude_code" as const,
            append: customInstructions,
          }
        : {
            type: "preset" as const,
            preset: "claude_code" as const,
          },
      settingSources: ["user" as const, "project" as const],
    }
  }

  /**
   * Get custom instructions to append to system prompt from config
   */
  async function getCustomInstructions(): Promise<string> {
    const parts: string[] = []

    // Add user's custom instructions from config
    const config = await Config.get()
    if (config.instructions?.length) {
      // Instructions is an array of file paths or inline content
      for (const instruction of config.instructions) {
        try {
          // Try to read as file
          const content = await Bun.file(instruction).text()
          parts.push(content)
        } catch {
          // If not a file, use as inline content
          parts.push(instruction)
        }
      }
    }

    return parts.join("\n\n")
  }

  /**
   * Map UI variant to SDK thinking budget
   */
  function variantToThinkingBudget(variant?: string): number {
    switch (variant) {
      case "low":
        return 5000
      case "medium":
        return 10000
      case "high":
        return 50000
      default:
        return 10000
    }
  }

  /**
   * Parse model ID from config format (provider/model or just model)
   */
  function parseModelID(model: string): string {
    if (model.includes("/")) {
      return model.split("/")[1]
    }
    return model
  }

  /**
   * Rewind files to a specific message checkpoint
   */
  export async function rewindFiles(sessionID: string, messageUuid: string) {
    const activeQuery = activeQueries.get(sessionID)
    if (activeQuery) {
      log.info("rewinding files", { sessionID, messageUuid })
      await activeQuery.rewindFiles(messageUuid)
    }
  }

  /**
   * Change model mid-session
   */
  export async function setModel(sessionID: string, model: string) {
    const activeQuery = activeQueries.get(sessionID)
    if (activeQuery) {
      log.info("setting model", { sessionID, model })
      await activeQuery.setModel(model)
    }
  }

  /**
   * Change permission mode mid-session
   */
  export async function setPermissionMode(sessionID: string, mode: PermissionMode) {
    const activeQuery = activeQueries.get(sessionID)
    if (activeQuery) {
      log.info("setting permission mode", { sessionID, mode })
      await activeQuery.setPermissionMode(mode)
    }
  }

  /**
   * Simple single-message query for tasks like title generation
   * Uses specified model (defaults to haiku for speed/cost) and no tools
   */
  export async function singleQuery(input: {
    prompt: string
    systemPrompt?: string
    model?: SDKModels.ModelAlias
  }): Promise<string> {
    const modelID = await SDKModels.fromSDKModelAlias(input.model ?? "haiku")
    log.info("single query start", { promptLength: input.prompt.length, model: modelID })

    let result = ""

    try {
      for await (const message of query({
        prompt: input.prompt,
        options: {
          model: modelID,
          cwd: Instance.directory,
          pathToClaudeCodeExecutable: getClaudeCodeExecutablePath(),
          tools: [], // Empty array disables all tools
          maxTurns: 1,
          systemPrompt: input.systemPrompt, // Can be a plain string
          maxThinkingTokens: 0,
        },
      })) {
        log.info("single query message", { type: message.type })
        // Extract text from assistant messages
        if (message.type === "assistant" && message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === "text") {
              result += block.text
            }
          }
        }
      }
    } catch (error) {
      // If we already have a result, don't throw - the SDK sometimes exits
      // with code 1 even after successful completion
      if (result) {
        log.warn("single query error after getting result, ignoring", { error, resultLength: result.length })
      } else {
        log.error("single query error", { error })
        throw error
      }
    }

    log.info("single query complete", { resultLength: result.length })
    return result.trim()
  }
}

// Re-export submodules
export { SDKCommands } from "./commands"
export { SDKConvert } from "./convert"
export { SDKCustomTools } from "./custom-tools"
export { SDKMCP } from "./mcp"
export { SDKModels } from "./models"
export { SDKPermissions } from "./permissions"
export { SDKRevert } from "./revert"
export { SDKStream } from "./stream"
