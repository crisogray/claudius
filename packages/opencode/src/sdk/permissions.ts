import { Agent } from "@/agent/agent"
import { Bus } from "@/bus"
import { PermissionNext } from "@/permission/next"
import { Session } from "@/session"
import { Log } from "@/util/log"

export namespace SDKPermissions {
  const log = Log.create({ service: "sdk.permissions" })

  // SDK canUseTool callback result
  export type CanUseToolResult =
    | { behavior: "allow" }
    | { behavior: "deny"; message?: string }
    | { behavior: "ask" }

  // SDK canUseTool callback type
  export type CanUseTool = (
    toolName: string,
    toolInput: unknown,
    options: { signal: AbortSignal },
  ) => Promise<CanUseToolResult>

  /**
   * Create a permission handler for SDK's canUseTool callback
   *
   * Bridges opencode's permission ruleset to SDK's canUseTool callback
   */
  export function createPermissionHandler(sessionID: string): CanUseTool {
    return async (toolName: string, toolInput: unknown, options: { signal: AbortSignal }) => {
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
        return { behavior: "allow" }
      }

      if (result.action === "deny") {
        return { behavior: "deny", message: `Denied by permission rule for ${toolName}` }
      }

      // "ask" - publish event for UI to handle and wait for response
      return new Promise<CanUseToolResult>((resolve) => {
        const requestID = `perm-${Date.now()}`

        // Listen for reply
        const unsub = Bus.subscribe(PermissionNext.Event.Replied, (event) => {
          if (event.properties.requestID === requestID) {
            unsub()
            if (event.properties.reply === "reject") {
              resolve({ behavior: "deny", message: "User rejected" })
            } else {
              resolve({ behavior: "allow" })
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
