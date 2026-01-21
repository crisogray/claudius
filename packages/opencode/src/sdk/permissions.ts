import { Agent } from "@/agent/agent"
import { Bus } from "@/bus"
import { PermissionNext } from "@/permission/next"
import { PlanApproval } from "@/plan"
import { Question } from "@/question"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { Log } from "@/util/log"
import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk"

export namespace SDKPermissions {
  const log = Log.create({ service: "sdk.permissions" })

  // Tools that map to "edit" permission
  const EDIT_TOOLS = ["edit", "write", "patch", "multiedit"]

  /**
   * Map SDK tool name to opencode permission name
   */
  function toPermissionName(toolName: string): string {
    const name = toolName.toLowerCase()
    if (EDIT_TOOLS.includes(name)) return "edit"
    return name
  }

  /**
   * Build metadata for permission request based on tool type
   */
  function buildMetadata(toolName: string, toolInput: Record<string, unknown>): Record<string, unknown> {
    const name = toolName.toLowerCase()

    if (EDIT_TOOLS.includes(name)) {
      // For edit tools, include filepath and diff if available
      return {
        input: toolInput,
        filepath: toolInput.file_path ?? toolInput.path,
        diff: toolInput.diff,
      }
    }

    return { input: toolInput }
  }

  /**
   * Create a permission handler for SDK's canUseTool callback
   *
   * Bridges opencode's permission ruleset to SDK's canUseTool callback.
   * Uses PermissionNext.ask() to integrate with opencode's permission system,
   * which handles the UI events, "always" approvals, and state management.
   */
  export function createPermissionHandler(sessionID: string): CanUseTool {
    return async (toolName: string, toolInput: Record<string, unknown>, options) => {
      log.info("permission check start", { tool: toolName })

      // Handle AskUserQuestion specially - route to Question module
      if (toolName === "AskUserQuestion") {
        return handleAskUserQuestion(sessionID, toolInput, { ...options, toolUseID: options.toolUseID })
      }

      // Handle ExitPlanMode specially - route to PlanApproval module
      if (toolName === "ExitPlanMode") {
        return handleExitPlanMode(sessionID, toolInput, options)
      }

      const session = await Session.get(sessionID)
      const defaultRuleset = await Agent.getDefaultPermissionRuleset(session.permissionMode)

      // Get the permission ruleset for this session
      const ruleset = PermissionNext.merge(defaultRuleset, session.permission ?? [])

      // Extract pattern from tool input for pattern-based rules
      const pattern = extractPattern(toolName, toolInput)

      // Map tool name to permission name (e.g., Write -> edit)
      const permissionName = toPermissionName(toolName)

      log.info("permission check", {
        tool: toolName,
        permission: permissionName,
        pattern,
      })

      try {
        // Use PermissionNext.ask() which handles:
        // - Evaluating against ruleset
        // - Publishing Event.Asked for UI
        // - Storing in pending state for reply handling
        // - "Always" approval logic
        await PermissionNext.ask({
          sessionID,
          permission: permissionName,
          patterns: [pattern],
          metadata: buildMetadata(toolName, toolInput),
          always: [pattern],
          ruleset,
          tool: {
            messageID: "",
            callID: options.toolUseID,
          },
        })

        // Permission granted
        return { behavior: "allow", updatedInput: toolInput }
      } catch (error) {
        // Handle permission errors
        if (error instanceof PermissionNext.DeniedError) {
          return {
            behavior: "deny",
            message: `Denied by permission rule for ${toolName}`,
          }
        }

        if (error instanceof PermissionNext.RejectedError) {
          return {
            behavior: "deny",
            message: "User rejected the permission request",
          }
        }

        if (error instanceof PermissionNext.CorrectedError) {
          return {
            behavior: "deny",
            message: error.message,
          }
        }

        // Unknown error - rethrow
        throw error
      }
    }
  }

  /**
   * Handle AskUserQuestion tool - routes to Question module
   *
   * The SDK's AskUserQuestion tool is mapped to opencode's Question module.
   * Questions are published via bus events and answers are collected from UI.
   */
  async function handleAskUserQuestion(
    sessionID: string,
    input: Record<string, unknown>,
    options: { signal: AbortSignal; toolUseID: string },
  ): Promise<PermissionResult> {
    log.info("handling AskUserQuestion", { sessionID })

    const questions = input.questions as Array<{
      question: string
      header: string
      options: Array<{ label: string; description: string }>
      multiSelect?: boolean
    }>

    if (!questions || !Array.isArray(questions)) {
      return { behavior: "deny", message: "Invalid questions format" }
    }

    // Convert SDK question format to opencode Question format
    const opencodeQuestions: Question.Info[] = questions.map((q) => ({
      question: q.question,
      header: q.header,
      options: q.options,
      multiple: q.multiSelect,
    }))

    try {
      // Ask questions via Question module (publishes events for UI)
      const answers = await Question.ask({
        sessionID,
        questions: opencodeQuestions,
      })

      // Convert answers back to SDK format
      // SDK expects: { questions: [...], answers: { "question text": "selected labels as JSON array" } }
      const answersMap: Record<string, string> = {}
      questions.forEach((q, i) => {
        const answer = answers[i]
        if (answer && answer.length > 0) {
          // Store as JSON array to preserve answers containing ", "
          answersMap[q.question] = JSON.stringify(answer)
        }
      })

      log.info("AskUserQuestion answered", { answers: answersMap })

      // Update the tool part's input with the answers so they're available in view mode
      // The updatedInput goes to the SDK but isn't stored in our tool part, so we update it directly
      const messages = await Session.messages({ sessionID, limit: 5 })
      for (const msg of messages) {
        const toolPart = msg.parts.find(
          (p): p is MessageV2.ToolPart => p.type === "tool" && p.callID === options.toolUseID,
        )
        if (toolPart && (toolPart.state.status === "pending" || toolPart.state.status === "running")) {
          const state = toolPart.state as MessageV2.ToolStatePending | MessageV2.ToolStateRunning
          state.input = { ...state.input, answers: answersMap }
          await Session.updatePart(toolPart)
          Bus.publish(MessageV2.Event.PartUpdated, { part: toolPart })
          break
        }
      }

      return {
        behavior: "allow",
        updatedInput: {
          questions: input.questions,
          answers: answersMap,
        },
      }
    } catch (error) {
      // User dismissed the question
      if (error instanceof Question.RejectedError) {
        return { behavior: "deny", message: "User dismissed the question" }
      }
      // Check if aborted
      if (options.signal.aborted) {
        return { behavior: "deny", message: "Aborted" }
      }
      throw error
    }
  }

  /**
   * Handle ExitPlanMode tool - routes to PlanApproval module
   *
   * The SDK's ExitPlanMode tool is mapped to opencode's PlanApproval module.
   * Plan approval requests are published via bus events and responses are collected from UI.
   */
  async function handleExitPlanMode(
    sessionID: string,
    input: Record<string, unknown>,
    options: { signal: AbortSignal; toolUseID: string },
  ): Promise<PermissionResult> {
    log.info("handling ExitPlanMode", { sessionID })

    const plan = (input.plan as string) ?? ""

    try {
      // Ask for plan approval via PlanApproval module (publishes events for UI)
      const result = await PlanApproval.ask({
        sessionID,
        callID: options.toolUseID,
        plan,
      })

      log.info("ExitPlanMode answered", {
        approved: result.approved,
        message: result.message,
        permissionMode: result.permissionMode,
      })

      // If plan was approved, allow the tool to proceed
      if (result.approved) {
        // Always update permission mode on approval, default to "default"
        const newMode = result.permissionMode ?? "default"
        await Session.update(sessionID, (draft) => {
          draft.permissionMode = newMode
        })
        log.info("session permission mode updated", { sessionID, permissionMode: newMode })
        return { behavior: "allow", updatedInput: input }
      }

      // Plan was rejected - deny the tool call so the SDK knows
      // The rejection message is passed to the assistant
      const rejectionMessage = result.message
        ? `User rejected the plan: ${result.message}`
        : "User rejected the plan: Please revise based on their feedback."

      return { behavior: "deny", message: rejectionMessage }
    } catch (error) {
      // User dismissed the plan approval dialog
      if (error instanceof PlanApproval.RejectedError) {
        return { behavior: "deny", message: "User dismissed the plan approval request" }
      }
      // Check if aborted
      if (options.signal.aborted) {
        return { behavior: "deny", message: "Aborted" }
      }
      throw error
    }
  }

  /**
   * Extract pattern from tool input for pattern-based rules
   *
   * For file operations (Read, Edit, Write), extract the file path
   * For other tools, return wildcard
   */
  function extractPattern(toolName: string, input: unknown): string {
    const name = toolName.toLowerCase()
    const inputObj = input as Record<string, unknown>

    if (name === "read" || name === "edit" || name === "write") {
      return (inputObj?.file_path as string) ?? (inputObj?.path as string) ?? "*"
    }

    if (name === "bash") {
      return (inputObj?.command as string) ?? "*"
    }

    if (name === "glob" || name === "grep") {
      return (inputObj?.path as string) ?? (inputObj?.pattern as string) ?? "*"
    }

    return "*"
  }
}
