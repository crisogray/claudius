import { Identifier } from "@/id/id"
import { MessageV2 } from "@/session/message-v2"
import { Log } from "@/util/log"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

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

  export type ToolResultContent = CallToolResult["content"][number]

  export interface ToolResultBlock extends CallToolResult {
    type: "tool_result"
    tool_use_id: string
    is_error?: boolean
  }

  export interface ImageBlock {
    type: "image"
    source: {
      type: "base64"
      media_type: string
      data: string
    }
  }

  /**
   * Extract text from CallToolResult content
   * Handles both string content and structured array format
   */
  export function extractTextFromToolResult(content: string | ToolResultContent[]): string {
    if (typeof content === "string") {
      return content
    }

    // Extract text from content blocks array
    const textParts: string[] = []
    for (const block of content) {
      if (block.type === "text") {
        textParts.push(block.text)
      } else if (block.type === "resource") {
        // EmbeddedResource - check for text in the resource
        if ("text" in block.resource) {
          textParts.push(block.resource.text)
        }
      }
      // Skip image, audio, and resource_link blocks for text extraction
    }
    return textParts.join("\n\n")
  }

  /**
   * Create MessageV2 parts from CallToolResult content
   * Handles text, image, audio, resource, and resource_link content types
   */
  export function createPartsFromToolResult(
    content: string | ToolResultContent[],
    context: { sessionID: string; messageID: string },
  ): MessageV2.Part[] {
    const now = Date.now()

    if (typeof content === "string") {
      if (!content) return []
      return [
        {
          id: Identifier.ascending("part"),
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "text",
          text: content,
          time: { start: now, end: now },
        },
      ]
    }

    const parts: MessageV2.Part[] = []
    for (const block of content) {
      switch (block.type) {
        case "text":
          if (block.text) {
            parts.push({
              id: Identifier.ascending("part"),
              sessionID: context.sessionID,
              messageID: context.messageID,
              type: "text",
              text: block.text,
              time: { start: now, end: now },
            })
          }
          break

        case "image":
          parts.push({
            id: Identifier.ascending("part"),
            sessionID: context.sessionID,
            messageID: context.messageID,
            type: "file",
            url: `data:${block.mimeType};base64,${block.data}`,
            mime: block.mimeType,
          })
          break

        case "audio":
          parts.push({
            id: Identifier.ascending("part"),
            sessionID: context.sessionID,
            messageID: context.messageID,
            type: "file",
            url: `data:${block.mimeType};base64,${block.data}`,
            mime: block.mimeType,
          })
          break

        case "resource":
          // EmbeddedResource - contains either text or blob
          if ("text" in block.resource) {
            parts.push({
              id: Identifier.ascending("part"),
              sessionID: context.sessionID,
              messageID: context.messageID,
              type: "text",
              text: block.resource.text,
              time: { start: now, end: now },
            })
          } else if ("blob" in block.resource) {
            parts.push({
              id: Identifier.ascending("part"),
              sessionID: context.sessionID,
              messageID: context.messageID,
              type: "file",
              url: `data:${block.resource.mimeType || "application/octet-stream"};base64,${block.resource.blob}`,
              mime: block.resource.mimeType || "application/octet-stream",
            })
          }
          break

        case "resource_link":
          // ResourceLink - just a reference to a resource, include as text with the URI
          parts.push({
            id: Identifier.ascending("part"),
            sessionID: context.sessionID,
            messageID: context.messageID,
            type: "text",
            text: `[${block.name}](${block.uri})${block.description ? `: ${block.description}` : ""}`,
            time: { start: now, end: now },
          })
          break
      }
    }
    return parts
  }

  export type ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | ToolResultBlock | ImageBlock

  // SDK message types
  export interface SDKAssistantMessage {
    type: "assistant"
    uuid: string
    session_id: string
    parent_tool_use_id?: string
    message: {
      id: string  // Anthropic API message ID
      content: ContentBlock[]
    }
  }

  export interface SDKUserMessage {
    type: "user"
    uuid?: string // Optional when sending, required when replayed
    session_id?: string // SDK session ID
    message: {
      role?: "user" // Required for streaming input mode
      content: ContentBlock[]
    }
  }

  /**
   * Per-model usage statistics from SDK result message
   */
  export interface ModelUsage {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheCreationInputTokens: number
    webSearchRequests: number
    costUSD: number
    contextWindow: number
  }

  /**
   * Permission denial info from SDK
   */
  export interface PermissionDenial {
    tool_name: string
    tool_use_id: string
    tool_input: unknown
  }

  export interface SDKResultMessage {
    type: "result"
    subtype: "success" | "error" | "error_max_turns" | "error_during_execution" | "error_max_budget_usd"
    usage: {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    total_cost_usd?: number
    duration_ms?: number
    duration_api_ms?: number
    num_turns?: number
    modelUsage?: Record<string, ModelUsage>
    permission_denials?: PermissionDenial[]
  }

  export interface SDKSystemMessage {
    type: "system"
    subtype: "init" | "compact" | "error"
    session_id?: string
    model?: string
    tools?: string[]
  }

  /**
   * Compaction boundary message from SDK
   * Indicates when conversation compaction occurred
   */
  export interface SDKCompactBoundaryMessage {
    type: "system"
    subtype: "compact_boundary"
    uuid: string
    session_id: string
    compact_metadata: {
      trigger: "manual" | "auto"
      pre_tokens: number
    }
  }

  export type SDKMessage = SDKAssistantMessage | SDKUserMessage | SDKResultMessage | SDKSystemMessage | SDKCompactBoundaryMessage | SDKPartialAssistantMessage

  // Partial message streaming types (from @anthropic-ai/claude-agent-sdk with includePartialMessages: true)
  export interface SDKPartialAssistantMessage {
    type: "stream_event"
    event: RawMessageStreamEvent
    parent_tool_use_id: string | null
    uuid: string
    session_id: string
  }

  // Raw message stream event types (from @anthropic-ai/sdk)
  export type RawMessageStreamEvent =
    | MessageStartEvent
    | ContentBlockStartEvent
    | ContentBlockDeltaEvent
    | ContentBlockStopEvent
    | MessageDeltaEvent
    | MessageStopEvent

  export interface MessageStartEvent {
    type: "message_start"
    message: {
      id: string
      type: "message"
      role: "assistant"
      content: ContentBlock[]
      model: string
      stop_reason: string | null
      stop_sequence: string | null
      usage: { input_tokens: number; output_tokens: number }
    }
  }

  export interface ContentBlockStartEvent {
    type: "content_block_start"
    index: number
    content_block:
    | { type: "text"; text: string }
    | { type: "thinking"; thinking: string; signature?: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  }

  export interface ContentBlockDeltaEvent {
    type: "content_block_delta"
    index: number
    delta:
    | { type: "text_delta"; text: string }
    | { type: "thinking_delta"; thinking: string }
    | { type: "input_json_delta"; partial_json: string }
  }

  export interface ContentBlockStopEvent {
    type: "content_block_stop"
    index: number
  }

  export interface MessageDeltaEvent {
    type: "message_delta"
    delta: { stop_reason: string | null; stop_sequence: string | null }
    usage: { output_tokens: number }
  }

  export interface MessageStopEvent {
    type: "message_stop"
  }

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
      permissionMode: "default" | "plan" | "acceptEdits" | "bypassPermissions"
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
      permissionMode: context.permissionMode,
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
      permissionMode: "default" | "plan" | "acceptEdits" | "bypassPermissions"
      modelID: string
      providerID: string
    },
  ): MessageV2.User {
    return {
      id: context.id ?? Identifier.ascending("message"),
      sessionID,
      role: "user",
      permissionMode: context.permissionMode,
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
