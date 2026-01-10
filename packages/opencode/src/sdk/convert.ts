import { Identifier } from "@/id/id"
import { MessageV2 } from "@/session/message-v2"
import { Log } from "@/util/log"

export namespace SDKConvert {
  const log = Log.create({ service: "sdk.convert" })

  // SDK content block types (from @anthropic-ai/claude-agent-sdk)
  export interface TextBlock {
    type: "text"
    text: string
  }

  export interface ThinkingBlock {
    type: "thinking"
    thinking: string
    signature?: string
  }

  export interface RedactedThinkingBlock {
    type: "redacted_thinking"
    data: string
  }

  export interface ToolUseBlock {
    type: "tool_use"
    id: string
    name: string
    input: Record<string, unknown>
  }

  export interface ToolResultBlock {
    type: "tool_result"
    tool_use_id: string
    content: string | Array<{ type: string; [key: string]: unknown }>
    is_error?: boolean
  }

  export type ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | ToolResultBlock

  // SDK message types
  export interface SDKAssistantMessage {
    type: "assistant"
    uuid: string
    session_id: string
    parent_tool_use_id?: string
    message: {
      content: ContentBlock[]
    }
  }

  export interface SDKUserMessage {
    type: "user"
    message: {
      content: ContentBlock[]
    }
  }

  export interface SDKResultMessage {
    type: "result"
    subtype: "success" | "error"
    usage: {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    total_cost_usd?: number
    duration_ms?: number
    duration_api_ms?: number
  }

  export interface SDKSystemMessage {
    type: "system"
    subtype: "init" | "compact" | "error"
    session_id?: string
    model?: string
    tools?: string[]
  }

  export type SDKMessage = SDKAssistantMessage | SDKUserMessage | SDKResultMessage | SDKSystemMessage

  /**
   * Convert SDK content block to opencode Part
   */
  export function sdkBlockToPart(
    block: ContentBlock,
    timestamp: number,
    context: { sessionID: string; messageID: string },
  ): MessageV2.Part | null {
    const partID = Identifier.ascending("part")

    switch (block.type) {
      case "text":
        return {
          id: partID,
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "text",
          text: block.text,
          time: { start: timestamp, end: Date.now() },
        }

      case "thinking":
        return {
          id: partID,
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "reasoning",
          text: block.thinking,
          // Store signature in metadata for now
          // Will add signature field to ReasoningPart in Phase 2
          metadata: block.signature ? { signature: block.signature } : undefined,
          time: { start: timestamp, end: Date.now() },
        }

      case "redacted_thinking":
        // Will add RedactedReasoningPart type in Phase 2
        // For now, store as reasoning with special marker
        return {
          id: partID,
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "reasoning",
          text: "[Thinking redacted for safety]",
          metadata: { redacted: true, data: block.data },
          time: { start: timestamp, end: Date.now() },
        }

      case "tool_use":
        return {
          id: partID,
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "tool",
          callID: block.id,
          tool: block.name.toLowerCase(),
          state: {
            status: "pending",
            input: normalizeToolInput(block.input),
            raw: JSON.stringify(block.input),
          },
        }

      case "tool_result":
        // Tool results update existing ToolPart - handled separately
        return null

      default:
        log.warn("unknown block type", { block })
        return null
    }
  }

  /**
   * Normalize tool input for consistent storage
   * Converts SDK snake_case params to camelCase for UI compatibility
   */
  function normalizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(input)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      result[camelKey] = value

      // Also keep original key for tools that expect snake_case
      if (camelKey !== key) {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Convert SDK result message to token counts
   */
  export function sdkResultToTokens(result: SDKResultMessage): MessageV2.Assistant["tokens"] {
    return {
      input: result.usage.input_tokens,
      output: result.usage.output_tokens,
      reasoning: 0, // Calculated from thinking parts if needed
      cache: {
        read: result.usage.cache_read_input_tokens ?? 0,
        write: result.usage.cache_creation_input_tokens ?? 0,
      },
    }
  }

  /**
   * Create a new MessageV2.Assistant from SDK message
   */
  export function createAssistantMessage(
    sdk: SDKAssistantMessage,
    sessionID: string,
    context: {
      parentID: string
      modelID: string
      providerID: string
      agent: string
      cwd: string
      root: string
    },
  ): MessageV2.Assistant {
    const timestamp = Date.now()
    const messageID = Identifier.ascending("message")

    return {
      id: messageID,
      sessionID,
      role: "assistant",
      parentID: context.parentID,
      modelID: context.modelID,
      providerID: context.providerID,
      mode: "default",
      agent: context.agent,
      path: {
        cwd: context.cwd,
        root: context.root,
      },
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      time: {
        created: timestamp,
      },
    }
  }

  /**
   * Create a new MessageV2.User for optimistic display
   */
  export function createUserMessage(
    sessionID: string,
    context: {
      id?: string
      agent: string
      modelID: string
      providerID: string
    },
  ): MessageV2.User {
    return {
      id: context.id ?? Identifier.ascending("message"),
      sessionID,
      role: "user",
      agent: context.agent,
      model: {
        modelID: context.modelID,
        providerID: context.providerID,
      },
      time: {
        created: Date.now(),
      },
    }
  }
}
