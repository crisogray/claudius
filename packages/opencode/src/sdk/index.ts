import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Agent } from "@/agent/agent"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { SessionStatus } from "@/session/status"
import { Log } from "@/util/log"
import z from "zod"
import { SDKAgents } from "./agents"
import { SDKCommands } from "./commands"
import { SDKConvert } from "./convert"
import { SDKMCP } from "./mcp"
import { SDKModels } from "./models"
import { SDKPermissions } from "./permissions"
import { SDKStream } from "./stream"
import { Identifier } from "@/id/id"
import { SessionRevert } from "@/session/revert"
// Real Claude Agent SDK
import { query, type Query } from "@anthropic-ai/claude-agent-sdk"

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
    agent: z.string().optional(),
    variant: z.string().optional(),
    parts: z.array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("text"), text: z.string() }).passthrough(),
        z.object({ type: z.literal("file"), path: z.string() }).passthrough(),
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
    await SessionRevert.cleanup(session)

    const config = await Config.get()

    // Extract text from parts
    const textParts = input.parts.filter((p) => p.type === "text") as Array<{ type: "text"; text: string }>
    const rawPrompt = textParts.map((p) => p.text).join("\n")

    // Expand commands
    const { prompt, command } = await SDKCommands.expandCommand(rawPrompt)
    log.info("expanded command", { hasCommand: !!command })

    // Get agent - priority: command > input > config > default
    const agentName = command?.agent ?? input.agent ?? config.default_agent ?? "build"
    const agent = await Agent.get(agentName)
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`)
    }

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
      agent: agentName,
      modelID,
      providerID,
    })
    await Session.updateMessage(userMessage)
    await Session.touch(input.sessionID)

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
        // Handle both file paths and data URLs
        const isDataUrl = filePath.startsWith("data:")
        const url = isDataUrl ? filePath : `file://${filePath}`
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: input.sessionID,
          messageID: userMessageID,
          type: "file",
          mime: (part as any).mime ?? "application/octet-stream",
          url,
          source: isDataUrl
            ? undefined
            : {
                type: "file",
                path: filePath,
                text: { value: "", start: 0, end: 0 },
              },
        })
      }
    }

    Bus.publish(MessageV2.Event.Updated, { info: userMessage })
    Bus.publish(Event.Started, { sessionID: input.sessionID, prompt })

    // Set session status to busy
    SessionStatus.set(input.sessionID, { type: "busy" })

    // Build SDK options
    const options = await buildSDKOptions({
      config,
      session,
      agent,
      modelID,
      variant: input.variant,
    })

    try {
      // Start real SDK query
      const activeQuery = query({
        prompt,
        options: {
          model: options.model,
          cwd: options.cwd,
          tools: options.tools,
          mcpServers: options.mcpServers,
          maxThinkingTokens: options.maxThinkingTokens,
          permissionMode: options.permissionMode,
          canUseTool: options.canUseTool,
          resume: options.resume,
          systemPrompt: options.systemPrompt,
          includePartialMessages: true,
        },
      })

      activeQueries.set(input.sessionID, activeQuery)

      // Process stream - SDK query is async iterable
      const result = await SDKStream.processSDKStream(
        activeQuery as AsyncIterable<SDKConvert.SDKMessage>,
        input.sessionID,
        {
          parentID: userMessageID,
          agent: agentName,
          modelID,
          providerID,
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
      activeQueries.delete(input.sessionID)
      // Set session status back to idle
      SessionStatus.set(input.sessionID, { type: "idle" })
    }
  }

  /**
   * Interrupt the active SDK query for a session
   */
  export function interrupt(sessionID: string) {
    const activeQuery = activeQueries.get(sessionID)
    if (activeQuery) {
      log.info("interrupting SDK", { sessionID })
      activeQuery.interrupt()
    }
  }

  /**
   * Check if SDK is currently processing for a session
   */
  export function isActive(sessionID: string): boolean {
    return activeQueries.has(sessionID)
  }

  /**
   * Build SDK options from config and context
   */
  async function buildSDKOptions(input: {
    config: Config.Info
    session: Session.Info
    agent: Agent.Info
    modelID: string
    variant?: string
  }) {
    const { config, session, agent, modelID, variant } = input

    // Get MCP servers
    const mcpServers = await SDKMCP.getMcpServers()

    // Get agents for subagent support
    const agents = await SDKAgents.getSDKAgents()

    // Get custom instructions
    const customInstructions = await getCustomInstructions(agent)

    return {
      model: modelID,
      cwd: Instance.directory,
      tools: { type: "preset" as const, preset: "claude_code" as const },
      mcpServers,
      agents,
      maxThinkingTokens: variantToThinkingBudget(variant),
      enableFileCheckpointing: true,
      permissionMode: "default" as const,
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
      settingSources: ["project" as const],
    }
  }

  /**
   * Get custom instructions to append to system prompt
   */
  async function getCustomInstructions(agent: Agent.Info): Promise<string> {
    const parts: string[] = []

    // Add agent's prompt
    if (agent.prompt) {
      parts.push(agent.prompt)
    }

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
   * Simple single-message query for tasks like title generation
   * Uses haiku for speed/cost and no tools
   */
  export async function singleQuery(input: {
    prompt: string
    systemPrompt?: string
  }): Promise<string> {
    log.info("single query", { promptLength: input.prompt.length })

    let result = ""

    for await (const message of query({
      prompt: input.prompt,
      options: {
        model: "claude-haiku-4-20250514",
        cwd: Instance.directory,
        tools: [], // Empty array disables all tools
        maxTurns: 1,
        systemPrompt: input.systemPrompt, // Can be a plain string
      },
    })) {
      // Extract text from assistant messages
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "text") {
            result += block.text
          }
        }
      }
    }

    return result.trim()
  }
}

// Re-export submodules
export { SDKAgents } from "./agents"
export { SDKCommands } from "./commands"
export { SDKConvert } from "./convert"
export { SDKCustomTools } from "./custom-tools"
export { SDKMCP } from "./mcp"
export { SDKModels } from "./models"
export { SDKPermissions } from "./permissions"
export { SDKRevert } from "./revert"
export { SDKStream } from "./stream"
