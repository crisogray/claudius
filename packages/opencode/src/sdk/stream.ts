import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { SessionStatus } from "@/session/status"
import { SessionSummary } from "@/session/summary"
import { Todo } from "@/session/todo"
import { Snapshot } from "@/snapshot"
import { Log } from "@/util/log"
import { SDKConvert } from "./convert"

export namespace SDKStream {
  const log = Log.create({ service: "sdk.stream" })

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
    onMessageID?: (messageID: string | null) => void,
  ): Promise<{ messageID: string | null; error?: Error }> {
    let currentMessage: MessageV2.Assistant | null = null
    let currentMessageID: string | null = null
    let initialSnapshot: string | undefined
    const partsByIndex = new Map<number, MessageV2.Part>()

    // Streaming state for partial message handling
    const streamingParts = new Map<number, MessageV2.Part>()
    let streamingMessageID: string | null = null
    const streamedAnthropicMessageIDs = new Set<string>()  // Track by Anthropic API message ID

    // Track child sessions for subagents
    // Maps parent_tool_use_id -> { sessionID, userMessageID }
    const childSessions = new Map<string, { sessionID: string; userMessageID: string }>()

    // Track tool summaries for Task UI display
    // Maps parent_tool_use_id -> array of tool summaries
    const toolSummaries = new Map<
      string,
      Array<{ id: string; tool: string; state: { status: string; title?: string } }>
    >()
    // Maps tool callID -> parent_tool_use_id (for updating summary when tool completes)
    const toolToParent = new Map<string, string>()

    // Get or create child session for a subagent
    async function getOrCreateChildSession(parentToolUseId: string): Promise<{ sessionID: string; userMessageID: string }> {
      const existing = childSessions.get(parentToolUseId)
      if (existing) return existing

      // Find the parent Task tool to get description for title
      const messages = await Session.messages({ sessionID, limit: 10 })
      let title = "Subagent"
      for (const msg of messages) {
        const taskPart = msg.parts.find(
          (p): p is MessageV2.ToolPart => p.type === "tool" && p.callID === parentToolUseId,
        )
        if (taskPart && taskPart.state.status !== "completed") {
          const input = "input" in taskPart.state ? taskPart.state.input : {}
          title = (input as any).description || "Subagent"

          // Transition Task to running with sessionId (will be set after session created)
          if (taskPart.state.status === "pending") {
            const pendingState = taskPart.state as MessageV2.ToolStatePending
            taskPart.state = {
              status: "running",
              input: pendingState.input,
              metadata: {},
              time: { start: Date.now() },
            }
          }
          break
        }
      }

      // Create child session
      const childSession = await Session.create({
        parentID: sessionID,
        title: title,
      })

      // Create initial user message in child session with the task prompt
      // This is needed for the UI to display the conversation
      const taskPrompt = (messages
        .flatMap((m) => m.parts)
        .find((p): p is MessageV2.ToolPart => p.type === "tool" && p.callID === parentToolUseId)
        ?.state as MessageV2.ToolStatePending | MessageV2.ToolStateRunning)?.input?.prompt as string | undefined

      const userMessage: MessageV2.User = {
        id: Identifier.ascending("message"),
        sessionID: childSession.id,
        role: "user",
        time: { created: Date.now() },
        model: { modelID: context.modelID, providerID: context.providerID },
        agent: context.agent,
      }
      await Session.updateMessage(userMessage)

      // Create text part for the prompt
      const textPart: MessageV2.TextPart = {
        id: Identifier.ascending("part"),
        sessionID: childSession.id,
        messageID: userMessage.id,
        type: "text",
        text: taskPrompt || title,
      }
      await Session.updatePart(textPart)
      Bus.publish(MessageV2.Event.Updated, { info: userMessage })

      // Store both session ID and user message ID
      const childInfo = { sessionID: childSession.id, userMessageID: userMessage.id }
      childSessions.set(parentToolUseId, childInfo)

      // Update parent Task tool's metadata with child session ID
      for (const msg of messages) {
        const taskPart = msg.parts.find(
          (p): p is MessageV2.ToolPart => p.type === "tool" && p.callID === parentToolUseId,
        )
        if (taskPart && taskPart.state.status === "running") {
          const state = taskPart.state as MessageV2.ToolStateRunning
          state.metadata = { ...state.metadata, sessionId: childSession.id }
          await Session.updatePart(taskPart)
          Bus.publish(MessageV2.Event.PartUpdated, { part: taskPart })
          break
        }
      }

      // Set child session status to busy
      SessionStatus.set(childSession.id, { type: "busy" })

      return childInfo
    }

    // Update parent Task tool's metadata with current summary
    async function updateTaskSummary(parentToolUseId: string) {
      const summary = toolSummaries.get(parentToolUseId)
      if (!summary) return

      const messages = await Session.messages({ sessionID, limit: 10 })
      for (const msg of messages) {
        const taskPart = msg.parts.find(
          (p): p is MessageV2.ToolPart => p.type === "tool" && p.callID === parentToolUseId,
        )
        if (taskPart && (taskPart.state.status === "running" || taskPart.state.status === "pending")) {
          if (taskPart.state.status === "pending") {
            // Transition to running first
            const pendingState = taskPart.state as MessageV2.ToolStatePending
            taskPart.state = {
              status: "running",
              input: pendingState.input,
              metadata: { summary, sessionId: childSessions.get(parentToolUseId)?.sessionID },
              time: { start: Date.now() },
            }
          } else {
            const state = taskPart.state as MessageV2.ToolStateRunning
            state.metadata = { ...state.metadata, summary }
          }
          await Session.updatePart(taskPart)
          Bus.publish(MessageV2.Event.PartUpdated, { part: taskPart })
          return
        }
      }
    }

    try {
      for await (const message of stream) {
        switch (message.type) {
          case "system": {
            if (message.subtype === "init") {
              // Capture initial snapshot for diff computation
              initialSnapshot = await Snapshot.track()

              // Update session with SDK session ID for resume
              if (message.session_id) {
                await Session.update(sessionID, (draft) => {
                  ; (draft as any).sdk = {
                    sessionId: message.session_id,
                    model: message.model,
                    tools: message.tools,
                  }
                })
              }

              SessionSummary.summarize({ sessionID, messageID: context.parentID })
            }
            break
          }

          case "assistant": {
            // Skip if already handled via streaming (parts already created)
            // Use Anthropic API message ID for deduplication (stable across partial/complete messages)
            if (streamedAnthropicMessageIDs.has(message.message.id)) {
              break
            }

            // Determine target session - child session for subagents, parent for main agent
            const childInfo = message.parent_tool_use_id
              ? await getOrCreateChildSession(message.parent_tool_use_id)
              : null
            const targetSessionID = childInfo?.sessionID ?? sessionID
            // For child sessions, parentID is the user message in the child session
            // For main session, parentID is the original user message
            const parentID = childInfo?.userMessageID ?? context.parentID

            // Create new assistant message
            currentMessage = SDKConvert.createAssistantMessage(message, targetSessionID, {
              parentID,
              modelID: context.modelID,
              providerID: context.providerID,
              agent: context.agent,
              cwd: Instance.directory,
              root: Instance.worktree,
            })
            currentMessageID = currentMessage.id
            onMessageID?.(currentMessageID)

              // Store SDK metadata
              ; (currentMessage as any).sdk = {
                uuid: message.uuid,
                sessionId: message.session_id,
                parentToolUseId: message.parent_tool_use_id ?? undefined,
              }

            // Save message
            await Session.updateMessage(currentMessage)

            // Add StepStartPart with initial snapshot (only for main session)
            if (initialSnapshot && !message.parent_tool_use_id) {
              const stepStartPart: MessageV2.StepStartPart = {
                id: Identifier.ascending("part"),
                sessionID: targetSessionID,
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
                sessionID: targetSessionID,
                messageID: currentMessage.id,
              })

              if (part) {
                partsByIndex.set(i, part)
                await Session.updatePart(part)

                // Handle TodoWrite tool calls
                if (block.type === "tool_use") {
                  await handleTodoWrite(targetSessionID, block)
                }

                // Track tool summaries for subagent tools (for Task UI display)
                if (message.parent_tool_use_id && part.type === "tool") {
                  const parentId = message.parent_tool_use_id
                  if (!toolSummaries.has(parentId)) {
                    toolSummaries.set(parentId, [])
                  }
                  toolToParent.set(part.callID, parentId)
                  // Extract meaningful title from input
                  const input = (part.state as MessageV2.ToolStatePending).input
                  const title = getToolTitle(part.tool, input)
                  toolSummaries.get(parentId)!.push({
                    id: part.callID,
                    tool: part.tool,
                    state: { status: "pending", title },
                  })
                  await updateTaskSummary(parentId)
                }
              }
            }

            Bus.publish(MessageV2.Event.Updated, { info: currentMessage })
            break
          }

          case "user": {
            // Tool results come as user messages with tool_result content
            // Note: tool_result messages don't have parent_tool_use_id, but the tool_use_id
            // tells us which tool completed. We need to find the right session.
            for (const block of message.message.content) {
              if (block.type === "tool_result") {
                // Try to find which session this tool belongs to
                // First check main session, then child sessions
                let found = await updateToolPartResult(sessionID, block)
                if (!found) {
                  for (const childInfo of childSessions.values()) {
                    found = await updateToolPartResult(childInfo.sessionID, block)
                    if (found) break
                  }
                }

                // Update summary if this is a subagent tool
                const parentId = toolToParent.get(block.tool_use_id)
                if (parentId) {
                  const summary = toolSummaries.get(parentId)
                  const entry = summary?.find((t) => t.id === block.tool_use_id)
                  if (entry) {
                    entry.state.status = block.is_error ? "error" : "completed"
                    // Keep the existing title (set from input) - don't overwrite
                    await updateTaskSummary(parentId)
                  }
                }
              }
            }
            break
          }

          case "result": {
            log.info("result message received", { hasCurrentMessage: !!currentMessage, currentMessageID, hasInitialSnapshot: !!initialSnapshot })
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
                log.info("calling finalizeDiffs", { sessionID, currentMessageID, parentID: context.parentID })
                await finalizeDiffs(sessionID, currentMessageID, context.parentID, initialSnapshot, tokens, currentMessage.cost)
              }

              Bus.publish(MessageV2.Event.Updated, { info: currentMessage })
            }
            break
          }

          case "stream_event": {
            const msg = message as SDKConvert.SDKPartialAssistantMessage
            const event = msg.event

            // Determine target session (subagent support)
            const childInfo = msg.parent_tool_use_id
              ? await getOrCreateChildSession(msg.parent_tool_use_id)
              : null
            const targetSessionID = childInfo?.sessionID ?? sessionID
            const parentID = childInfo?.userMessageID ?? context.parentID

            switch (event.type) {
              case "message_start": {
                // Create assistant message shell
                const assistantMessage = SDKConvert.createAssistantMessage(
                  {
                    type: "assistant",
                    uuid: msg.uuid,
                    session_id: msg.session_id,
                    parent_tool_use_id: msg.parent_tool_use_id ?? undefined,
                    message: event.message,
                  },
                  targetSessionID,
                  {
                    parentID,
                    modelID: context.modelID,
                    providerID: context.providerID,
                    agent: context.agent,
                    cwd: Instance.directory,
                    root: Instance.worktree,
                  },
                )
                currentMessage = assistantMessage
                currentMessageID = assistantMessage.id
                streamingMessageID = assistantMessage.id
                onMessageID?.(currentMessageID)

                // Track by Anthropic API message ID (stable across partial/complete messages)
                const anthropicMessageId = (event as SDKConvert.MessageStartEvent).message.id
                streamedAnthropicMessageIDs.add(anthropicMessageId)

                  // Store SDK metadata
                  ; (currentMessage as any).sdk = {
                    uuid: msg.uuid,
                    sessionId: msg.session_id,
                    parentToolUseId: msg.parent_tool_use_id ?? undefined,
                  }

                await Session.updateMessage(assistantMessage)

                // Add StepStartPart with initial snapshot (only for main session)
                if (initialSnapshot && !msg.parent_tool_use_id) {
                  const stepStartPart: MessageV2.StepStartPart = {
                    id: Identifier.ascending("part"),
                    sessionID: targetSessionID,
                    messageID: assistantMessage.id,
                    type: "step-start",
                    snapshot: initialSnapshot,
                  }
                  await Session.updatePart(stepStartPart)
                }

                Bus.publish(MessageV2.Event.Updated, { info: assistantMessage })
                break
              }

              case "content_block_start": {
                if (!streamingMessageID) break
                const part = createPartFromBlockStart(event, targetSessionID, streamingMessageID)
                if (part) {
                  streamingParts.set(event.index, part)
                  await Session.updatePart(part)
                }
                break
              }

              case "content_block_delta": {
                const part = streamingParts.get(event.index)
                if (!part) break

                if (event.delta.type === "text_delta" && part.type === "text") {
                  part.text += event.delta.text
                  await Session.updatePart({ part, delta: event.delta.text })
                } else if (event.delta.type === "thinking_delta" && part.type === "reasoning") {
                  part.text += event.delta.thinking
                  await Session.updatePart({ part, delta: event.delta.thinking })
                } else if (event.delta.type === "input_json_delta" && part.type === "tool") {
                  const state = part.state as MessageV2.ToolStatePending
                  state.raw += event.delta.partial_json
                  // Don't publish deltas for tool JSON - wait for completion
                }
                break
              }

              case "content_block_stop": {
                const part = streamingParts.get(event.index)
                if (!part) break

                // Finalize part
                if (part.type === "text" || part.type === "reasoning") {
                  part.text = part.text.trimEnd()
                  part.time = { start: part.time?.start ?? Date.now(), end: Date.now() }
                } else if (part.type === "tool") {
                  // Parse accumulated JSON into input
                  const state = part.state as MessageV2.ToolStatePending
                  try {
                    state.input = JSON.parse(state.raw || "{}")
                  } catch {
                    state.input = {}
                  }

                  // Handle TodoWrite tool calls
                  if (part.tool === "todowrite") {
                    await handleTodoWrite(targetSessionID, {
                      type: "tool_use",
                      id: part.callID,
                      name: "TodoWrite",
                      input: state.input,
                    })
                  }

                  // Track tool summaries for subagent tools
                  if (msg.parent_tool_use_id) {
                    const parentId = msg.parent_tool_use_id
                    if (!toolSummaries.has(parentId)) {
                      toolSummaries.set(parentId, [])
                    }
                    toolToParent.set(part.callID, parentId)
                    const title = getToolTitle(part.tool, state.input)
                    toolSummaries.get(parentId)!.push({
                      id: part.callID,
                      tool: part.tool,
                      state: { status: "pending", title },
                    })
                    await updateTaskSummary(parentId)
                  }
                }

                partsByIndex.set(event.index, part)
                await Session.updatePart(part)
                streamingParts.delete(event.index)
                break
              }

              case "message_delta": {
                // Capture usage updates if provided - will be finalized in result message
                break
              }

              case "message_stop": {
                // Message complete - cleanup streaming state
                streamingParts.clear()
                streamingMessageID = null
                break
              }
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
   * Handle TodoWrite tool calls - convert SDK format to opencode format
   */
  async function handleTodoWrite(sessionID: string, block: SDKConvert.ToolUseBlock) {
    if (block.name !== "TodoWrite") return

    const sdkTodos = (block.input as {
      todos?: Array<{
        content: string
        status: "pending" | "in_progress" | "completed"
        activeForm?: string
      }>
    }).todos

    if (!sdkTodos) return

    // Convert SDK format to opencode format
    const todos: Todo.Info[] = sdkTodos.map((t, i) => ({
      id: `todo-${i}`,
      content: t.content,
      status: t.status,
      priority: "medium", // SDK doesn't have priority
      activeForm: t.activeForm, // Preserve present continuous form from SDK
    }))

    // Persist and publish event (existing system)
    await Todo.update({ sessionID, todos })
  }

  /**
   * Update ToolPart when tool completes
   * Returns true if the tool was found and updated
   */
  async function updateToolPartResult(sessionID: string, block: SDKConvert.ToolResultBlock): Promise<boolean> {
    // Find the ToolPart by tool_use_id in recent messages
    const messages = await Session.messages({ sessionID, limit: 5 })

    for (const msg of messages) {
      const part = msg.parts.find(
        (p): p is MessageV2.ToolPart => p.type === "tool" && p.callID === block.tool_use_id,
      )

      if (part) {
        const currentState = part.state
        const input = "input" in currentState ? currentState.input : {}
        const output = SDKConvert.extractTextFromToolResult(block.content)

        // Preserve existing metadata from running state (e.g., real-time task summary)
        const existingMetadata = "metadata" in currentState ? currentState.metadata : {}

        // Extract additional metadata from output based on tool type
        const extractedMetadata = extractToolMetadata(part.tool, output)

        // Special case: todowrite needs todos in metadata for UI rendering
        if (part.tool === "todowrite" && input.todos) {
          extractedMetadata.todos = input.todos
        }

        // Merge: existing metadata (real-time updates) + extracted metadata
        const metadata = { ...existingMetadata, ...extractedMetadata }

        const completedState: MessageV2.ToolStateCompleted | MessageV2.ToolStateError = block.is_error
          ? {
            status: "error",
            input,
            error: output,
            metadata,
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

        // If this is a Task tool completing, set the child session status to idle
        // and mark all assistant messages as completed (stops the timer)
        if (part.tool === "task" && metadata.sessionId) {
          const childSessionID = metadata.sessionId as string
          SessionStatus.set(childSessionID, { type: "idle" })

          // Complete all assistant messages in child session
          // No limit - child sessions with many messages need ALL assistants completed
          const childMessages = await Session.messages({ sessionID: childSessionID })
          const now = Date.now()

          // Find the last assistant message to add the result to
          const lastAssistant = childMessages.find(m => m.info.role === "assistant")

          // Add the subagent's result as parts in the child session
          // This shows the final output that gets returned to the parent
          if (lastAssistant && !block.is_error) {
            // Create parts from structured CallToolResult content (text, images, resources)
            const resultParts = SDKConvert.createPartsFromToolResult(block.content, {
              sessionID: childSessionID,
              messageID: lastAssistant.info.id,
            })
            for (const resultPart of resultParts) {
              await Session.updatePart(resultPart)
              Bus.publish(MessageV2.Event.PartUpdated, { part: resultPart })
            }
          }

          for (const msg of childMessages) {
            if (msg.info.role === "assistant" && !msg.info.time.completed) {
              msg.info.time.completed = now
              msg.info.finish = block.is_error ? "error" : "stop"
              await Session.updateMessage(msg.info)
              Bus.publish(MessageV2.Event.Updated, { info: msg.info })
            }
          }
        }

        return true
      }
    }

    return false
  }

  /**
   * Finalize diffs using existing snapshot system
   *
   * Reuses opencode's Snapshot + SessionSummary infrastructure
   */
  async function finalizeDiffs(
    sessionID: string,
    assistantMessageID: string,
    userMessageID: string,
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
      messageID: assistantMessageID,
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
        messageID: assistantMessageID,
        type: "patch",
        hash: patch.hash,
        files: patch.files,
      }
      await Session.updatePart(patchPart)
    }

    // Trigger diff computation, storage, and Bus event
    // Pass userMessageID since SessionSummary expects a user message
    log.info("triggering SessionSummary.summarize", { sessionID, userMessageID })
    SessionSummary.summarize({ sessionID, messageID: userMessageID })
  }

  /**
   * Extract metadata from tool output based on tool type
   * This populates fields like count, matches, etc. for UI display
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

      case "websearch": {
        // SDK returns { results: [...], total_results: number, query: string }
        if (parsed && typeof parsed.total_results === "number") {
          metadata.numResults = parsed.total_results
        } else if (parsed && Array.isArray(parsed.results)) {
          metadata.numResults = parsed.results.length
        }
        break
      }
      // Note: todowrite metadata.todos is set directly in updateToolPartResult
      // since it needs access to input.todos
    }

    return metadata
  }

  /**
   * Extract a display title from tool input
   * Used for showing meaningful info in subagent tool summaries
   */
  function getToolTitle(tool: string, input: Record<string, unknown>): string {
    switch (tool) {
      case "read":
      case "write":
      case "edit":
        return String(input.file_path || input.filePath || "")
      case "glob":
      case "grep":
        return String(input.pattern || "")
      case "bash": {
        if (input.description) return String(input.description)
        const cmd = String(input.command || "")
        return cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd
      }
      case "webfetch":
        return String(input.url || "")
      case "websearch":
        return String(input.query || "")
      case "task":
        return String(input.description || "")
      default:
        return String(input.file_path || input.filePath || input.pattern || input.query || input.description || "")
    }
  }

  /**
   * Create a Part from a content_block_start event
   * Used for streaming - creates the part shell with empty content
   */
  function createPartFromBlockStart(
    event: SDKConvert.ContentBlockStartEvent,
    sessionID: string,
    messageID: string,
  ): MessageV2.Part | null {
    const { content_block } = event
    const now = Date.now()

    switch (content_block.type) {
      case "text":
        return {
          id: Identifier.ascending("part"),
          sessionID,
          messageID,
          type: "text",
          text: "",
          time: { start: now },
        }
      case "thinking":
        return {
          id: Identifier.ascending("part"),
          sessionID,
          messageID,
          type: "reasoning",
          text: "",
          time: { start: now },
          metadata: content_block.signature ? { signature: content_block.signature } : undefined,
        }
      case "tool_use":
        return {
          id: Identifier.ascending("part"),
          sessionID,
          messageID,
          type: "tool",
          callID: content_block.id,
          tool: content_block.name.toLowerCase(),
          state: {
            status: "pending",
            input: {},
            raw: "",
          },
        }
    }
    return null
  }

}
