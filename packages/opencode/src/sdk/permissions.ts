import { Agent } from "@/agent/agent"
import { Bus } from "@/bus"
import { PermissionNext } from "@/permission/next"
import { Question } from "@/question"
import { Session } from "@/session"
import { Log } from "@/util/log"
import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk"

export namespace SDKPermissions {
  const log = Log.create({ service: "sdk.permissions" })

  /**
   * Create a permission handler for SDK's canUseTool callback
   *
   * Bridges opencode's permission ruleset to SDK's canUseTool callback.
   * Handles AskUserQuestion specially by routing to Question module.
   */
  export function createPermissionHandler(sessionID: string): CanUseTool {
    return async (toolName: string, toolInput: Record<string, unknown>, options) => {
      log.info("permission check start", { tool: toolName })

      // Handle AskUserQuestion specially - route to Question module
      if (toolName === "AskUserQuestion") {
        return handleAskUserQuestion(sessionID, toolInput, options)
      }

      const session = await Session.get(sessionID)
      const agent = await Agent.get(session.permission ? "build" : "build")

      // Get the permission ruleset for this session
      const ruleset = session.permission ?? agent.permission

      // Extract pattern from tool input for pattern-based rules
      const pattern = extractPattern(toolName, toolInput)

      // Evaluate against opencode's permission ruleset
      const result = PermissionNext.evaluate(toolName.toLowerCase(), pattern, ruleset)

      log.info("permission check", {
        tool: toolName,
        pattern,
        action: result.action,
      })

      if (result.action === "allow") {
        return { behavior: "allow", updatedInput: toolInput }
      }

      if (result.action === "deny") {
        return { behavior: "deny", message: `Denied by permission rule for ${toolName}` }
      }

      // "ask" - publish event for UI to handle and wait for response
      return new Promise<PermissionResult>((resolve) => {
        const requestID = `perm-${Date.now()}`

        // Listen for reply
        const unsub = Bus.subscribe(PermissionNext.Event.Replied, (event) => {
          if (event.properties.requestID === requestID) {
            unsub()
            if (event.properties.reply === "reject") {
              resolve({ behavior: "deny", message: "User rejected" })
            } else {
              resolve({ behavior: "allow", updatedInput: toolInput })
            }
          }
        })

        // Also handle abort
        options.signal.addEventListener("abort", () => {
          unsub()
          resolve({ behavior: "deny", message: "Aborted" })
        })

        // Publish permission request
        Bus.publish(PermissionNext.Event.Asked, {
          id: requestID,
          sessionID,
          permission: toolName.toLowerCase(),
          patterns: [pattern],
          metadata: { input: toolInput },
          always: [pattern],
        })
      })
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
    options: { signal: AbortSignal },
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
      // SDK expects: { questions: [...], answers: { "question text": "selected label" } }
      const answersMap: Record<string, string> = {}
      questions.forEach((q, i) => {
        const answer = answers[i]
        if (answer && answer.length > 0) {
          answersMap[q.question] = answer.join(", ")
        }
      })

      log.info("AskUserQuestion answered", { answers: answersMap })

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
