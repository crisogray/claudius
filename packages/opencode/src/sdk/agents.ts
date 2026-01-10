import { Agent } from "@/agent/agent"
import { PermissionNext } from "@/permission/next"
import { SDKModels } from "./models"
import { Log } from "@/util/log"

export namespace SDKAgents {
  const log = Log.create({ service: "sdk.agents" })

  // SDK agent definition format
  export interface AgentDefinition {
    description: string
    prompt: string
    tools?: string[]
    model?: "sonnet" | "opus" | "haiku"
  }

  /**
   * Convert opencode agents to SDK agent definitions
   *
   * Only includes subagents (not primary/hidden agents)
   */
  export async function getSDKAgents(): Promise<Record<string, AgentDefinition>> {
    const agents = await Agent.list()
    const result: Record<string, AgentDefinition> = {}

    for (const agent of agents) {
      // Only include subagents (not primary/hidden)
      if (agent.mode === "primary" || agent.hidden) continue

      result[agent.name] = {
        description: agent.description ?? `${agent.name} agent`,
        prompt: agent.prompt ?? "",
        tools: extractAllowedTools(agent.permission),
        model: SDKModels.toSDKModelAlias(agent.model?.modelID),
      }

      log.info("mapped agent", { name: agent.name, tools: result[agent.name].tools?.length })
    }

    return result
  }

  /**
   * Extract tool names where action is "allow" from a permission ruleset
   *
   * Returns undefined if wildcard allow (inherit all tools from parent)
   */
  function extractAllowedTools(ruleset: PermissionNext.Ruleset): string[] | undefined {
    const allowed = new Set<string>()
    let hasWildcardAllow = false

    for (const rule of ruleset) {
      if (rule.permission === "*" && rule.action === "allow") {
        hasWildcardAllow = true
      }
      if (rule.action === "allow" && rule.permission !== "*") {
        // Capitalize first letter to match SDK tool names (grep → Grep)
        allowed.add(capitalize(rule.permission))
      }
    }

    // undefined = inherit all tools from parent
    if (hasWildcardAllow) return undefined
    return allowed.size > 0 ? [...allowed] : []
  }

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
