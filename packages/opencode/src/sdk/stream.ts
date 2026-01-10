import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { SessionSummary } from "@/session/summary"
import { Todo } from "@/session/todo"
import { Snapshot } from "@/snapshot"
import { Log } from "@/util/log"
import { SDKConvert } from "./convert"

export namespace SDKStream {
  const log = Log.create({ service: "sdk.stream" })

  // SDK stream event types (from Anthropic API)
  export interface ContentBlockDelta {
    type: "content_block_delta"
    index: number
    delta:
      | { type: "text_delta"; text: string }
      | { type: "thinking_delta"; thinking: string }
      | { type: "input_json_delta"; partial_json: string }
  }

  export type StreamEvent = ContentBlockDelta | { type: string; [key: string]: unknown }

  /**
   * Process SDK stream and convert to MessageV2/Parts
   *
   * This is the core conversion layer that:
   * 1. Receives SDK messages
   * 2. Converts to MessageV2/Parts
   * 3. Saves to storage
   * 4. Publishes Bus events for UI
   * 5. Handles snapshots for diff computation
   */
  export async function processSDKStream(
    stream: AsyncIterable<SDKConvert.SDKMessage>,
    sessionID: string,
    context: {
      parentID: string
      agent: string
      modelID: string
      providerID: string
    },
  ): Promise<{ messageID: string | null; error?: Error }> {
    let currentMessage: MessageV2.Assistant | null = null
    let currentMessageID: string | null = null
    let initialSnapshot: string | undefined
    const partsByIndex = new Map<number, MessageV2.Part>()

    log.info("starting stream processing", { sessionID })

    try {
      for await (const message of stream) {
        switch (message.type) {
          case "system": {
            if (message.subtype === "init") {
              // Capture initial snapshot for diff computation
              initialSnapshot = await Snapshot.track()
              log.info("captured initial snapshot", { hash: initialSnapshot })

              // Update session with SDK session ID for resume
              if (message.session_id) {
                await Session.update(sessionID, (draft) => {
                  ;(draft as any).sdk = {
                    sessionId: message.session_id,
                    model: message.model,
                    tools: message.tools,
                  }
                })
              }
            }
            break
          }

          case "assistant": {
            // Create new assistant message
            currentMessage = SDKConvert.createAssistantMessage(message, sessionID, {
              parentID: context.parentID,
              modelID: context.modelID,
              providerID: context.providerID,
              agent: context.agent,
              cwd: Instance.directory,
              root: Instance.worktree,
            })
            currentMessageID = currentMessage.id

            // Store SDK metadata
            ;(currentMessage as any).sdk = {
              uuid: message.uuid,
              sessionId: message.session_id,
              parentToolUseId: message.parent_tool_use_id ?? undefined,
            }

            // Save message
            await Session.updateMessage(currentMessage)

            // Add StepStartPart with initial snapshot
            if (initialSnapshot) {
              const stepStartPart: MessageV2.StepStartPart = {
                id: Identifier.ascending("part"),
                sessionID,
                messageID: currentMessage.id,
                type: "step-start",
                snapshot: initialSnapshot,
              }
              await Session.updatePart(stepStartPart)
            }

            // Convert content blocks to parts
            const timestamp = Date.now()
            for (let i = 0; i < message.message.content.length; i++) {
              const block = message.message.content[i]
              const part = SDKConvert.sdkBlockToPart(block, timestamp, {
                sessionID,
                messageID: currentMessage.id,
              })

              if (part) {
                partsByIndex.set(i, part)
                await Session.updatePart(part)

                // Handle TodoWrite tool calls
                if (block.type === "tool_use") {
                  await handleTodoWrite(sessionID, block)
                }
              }
            }

            Bus.publish(MessageV2.Event.Updated, { info: currentMessage })
            break
          }

          case "user": {
            // Tool results come as user messages with tool_result content
            for (const block of message.message.content) {
              if (block.type === "tool_result") {
                await updateToolPartResult(sessionID, block)
              }
            }
            break
          }

          case "result": {
            if (currentMessage && currentMessageID) {
              // Update message with final tokens and cost
              const tokens = SDKConvert.sdkResultToTokens(message)
              currentMessage.tokens = tokens
              currentMessage.cost = message.total_cost_usd ?? 0
              currentMessage.time.completed = Date.now()
              currentMessage.finish = message.subtype === "success" ? "stop" : "error"

              await Session.updateMessage(currentMessage)

              // Compute diffs using existing snapshot system
              if (initialSnapshot) {
                await finalizeDiffs(sessionID, currentMessageID, initialSnapshot, tokens, currentMessage.cost)
              }

              Bus.publish(MessageV2.Event.Updated, { info: currentMessage })
              log.info("stream complete", {
                messageID: currentMessageID,
                tokens,
                cost: currentMessage.cost,
              })
            }
            break
          }
        }
      }
    } catch (error) {
      log.error("stream processing error", { error })
      if (currentMessage) {
        currentMessage.error = MessageV2.fromError(error, { providerID: context.providerID })
        currentMessage.time.completed = Date.now()
        await Session.updateMessage(currentMessage)
        Bus.publish(MessageV2.Event.Updated, { info: currentMessage })
      }
      return { messageID: currentMessageID, error: error as Error }
    }

    return { messageID: currentMessageID }
  }

  /**
   * Handle stream deltas for incremental updates
   */
  export function handleStreamDelta(
    event: StreamEvent,
    messageID: string | null,
    parts: Map<number, MessageV2.Part>,
  ): void {
    if (!messageID) return
    if (event.type !== "content_block_delta") return

    const { index, delta } = event as ContentBlockDelta

    if (delta.type === "text_delta") {
      // Publish delta for TextPart
      Bus.publish(MessageV2.Event.PartUpdated, {
        part: parts.get(index)!,
        delta: delta.text,
      })
    }

    if (delta.type === "thinking_delta") {
      // Publish delta for ReasoningPart
      Bus.publish(MessageV2.Event.PartUpdated, {
        part: parts.get(index)!,
        delta: delta.thinking,
      })
    }

    if (delta.type === "input_json_delta") {
      // Tool input streaming - update raw field
      const part = parts.get(index)
      if (part?.type === "tool") {
        ;(part.state as MessageV2.ToolStatePending).raw += delta.partial_json
      }
    }
  }

  /**
   * Handle TodoWrite tool calls - convert SDK format to opencode format
   */
  async function handleTodoWrite(sessionID: string, block: SDKConvert.ToolUseBlock) {
    if (block.name !== "TodoWrite") return

    const sdkTodos = (block.input as { todos?: Array<{
      content: string
      status: "pending" | "in_progress" | "completed"
      activeForm?: string
    }> }).todos

    if (!sdkTodos) return

    // Convert SDK format to opencode format
    const todos: Todo.Info[] = sdkTodos.map((t, i) => ({
      id: `todo-${i}`,
      content: t.content,
      status: t.status,
      priority: "medium", // SDK doesn't have priority
    }))

    log.info("updating todos from SDK", { count: todos.length })

    // Persist and publish event (existing system)
    await Todo.update({ sessionID, todos })
  }

  /**
   * Update ToolPart when tool completes
   */
  async function updateToolPartResult(sessionID: string, block: SDKConvert.ToolResultBlock) {
    // Find the ToolPart by tool_use_id in recent messages
    const messages = await Session.messages({ sessionID, limit: 5 })

    for (const msg of messages) {
      const part = msg.parts.find(
        (p): p is MessageV2.ToolPart => p.type === "tool" && p.callID === block.tool_use_id,
      )

      if (part) {
        const input = (part.state as MessageV2.ToolStatePending).input
        const output =
          typeof block.content === "string" ? block.content : JSON.stringify(block.content)

        // Extract metadata from output based on tool type
        const metadata = extractToolMetadata(part.tool, output)

        const completedState: MessageV2.ToolStateCompleted | MessageV2.ToolStateError = block.is_error
          ? {
              status: "error",
              input,
              error: output,
              time: {
                start: Date.now() - 1000, // Approximate
                end: Date.now(),
              },
            }
          : {
              status: "completed",
              input,
              output,
              title: part.tool,
              metadata,
              time: {
                start: Date.now() - 1000, // Approximate
                end: Date.now(),
              },
            }

        part.state = completedState
        await Session.updatePart(part)
        Bus.publish(MessageV2.Event.PartUpdated, { part })
        log.info("updated tool part result", { callID: block.tool_use_id, status: completedState.status })
        return
      }
    }

    log.warn("tool part not found for result", { tool_use_id: block.tool_use_id })
  }

  /**
   * Finalize diffs using existing snapshot system
   *
   * Reuses opencode's Snapshot + SessionSummary infrastructure
   */
  async function finalizeDiffs(
    sessionID: string,
    messageID: string,
    initialSnapshot: string,
    tokens: MessageV2.Assistant["tokens"],
    cost: number,
  ) {
    // Take final snapshot
    const finalSnapshot = await Snapshot.track()
    if (!finalSnapshot) return

    // Add StepFinishPart
    const stepFinishPart: MessageV2.StepFinishPart = {
      id: Identifier.ascending("part"),
      sessionID,
      messageID,
      type: "step-finish",
      reason: "stop",
      snapshot: finalSnapshot,
      cost,
      tokens,
    }
    await Session.updatePart(stepFinishPart)

    // Get changed files
    const patch = await Snapshot.patch(initialSnapshot)
    if (patch.files.length) {
      const patchPart: MessageV2.PatchPart = {
        id: Identifier.ascending("part"),
        sessionID,
        messageID,
        type: "patch",
        hash: patch.hash,
        files: patch.files,
      }
      await Session.updatePart(patchPart)
      log.info("created patch part", { files: patch.files.length })
    }

    // Trigger diff computation, storage, and Bus event - all existing code
    SessionSummary.summarize({ sessionID, messageID })
  }

  /**
   * Extract metadata from tool output based on tool type
   * This populates fields like count, matches, etc. for UI display
   *
   * SDK tools return structured JSON output, so we parse it to extract metadata.
   */
  function extractToolMetadata(tool: string, output: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {}

    // Try to parse as JSON first (SDK returns structured output)
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(output)
    } catch {
      // Not JSON, use text-based extraction
    }

    switch (tool) {
      case "glob": {
        // SDK returns { matches: string[], count: number, search_path: string }
        if (parsed && typeof parsed.count === "number") {
          metadata.count = parsed.count
        } else {
          // Fallback: count lines
          const lines = output.trim().split("\n").filter(Boolean)
          metadata.count = lines.length
        }
        break
      }

      case "grep": {
        // SDK returns { matches: [...], total_matches: number } or similar
        if (parsed && typeof parsed.total_matches === "number") {
          metadata.matches = parsed.total_matches
        } else if (parsed && typeof parsed.total === "number") {
          metadata.matches = parsed.total
        } else if (parsed && Array.isArray(parsed.matches)) {
          metadata.matches = parsed.matches.length
        } else if (parsed && Array.isArray(parsed.files)) {
          metadata.matches = parsed.files.length
        } else {
          // Fallback: count lines
          const lines = output.trim().split("\n").filter(Boolean)
          metadata.matches = lines.length
        }
        break
      }

      case "task": {
        // SDK returns { result: string, usage?: {...}, total_cost_usd?: number }
        // Session ID might be in result text
        const sessionIdMatch = output.match(/session_id:\s*(\S+)/)
        if (sessionIdMatch) {
          metadata.sessionId = sessionIdMatch[1]
        }
        break
      }

      case "websearch": {
        // SDK returns { results: [...], total_results: number, query: string }
        if (parsed && typeof parsed.total_results === "number") {
          metadata.numResults = parsed.total_results
        } else if (parsed && Array.isArray(parsed.results)) {
          metadata.numResults = parsed.results.length
        }
        break
      }
    }

    return metadata
  }

}
