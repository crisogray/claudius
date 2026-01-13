import { Config } from "../config/config"
import z from "zod"
import { Instance } from "../project/instance"
import { Truncate } from "../util/truncation"
import { SDK } from "../sdk"

import PROMPT_COMPACTION from "./prompt/compaction.txt"
import PROMPT_GENERATE from "./generate.txt"
import PROMPT_SUMMARY from "./prompt/summary.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import { PermissionNext } from "@/permission/next"
import { pipe, sortBy, values } from "remeda"

export namespace Agent {
  /**
   * Hidden agent info schema - used for internal agents like title/summary/compaction
   */
  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      mode: z.enum(["subagent", "primary", "all"]),
      native: z.boolean().optional(),
      hidden: z.boolean().optional(),
      topP: z.number().optional(),
      temperature: z.number().optional(),
      color: z.string().optional(),
      permission: PermissionNext.Ruleset,
      model: z
        .object({
          modelID: z.string(),
          providerID: z.string(),
        })
        .optional(),
      prompt: z.string().optional(),
      options: z.record(z.string(), z.any()),
      steps: z.number().int().positive().optional(),
    })
    .meta({
      ref: "Agent",
    })
  export type Info = z.infer<typeof Info>

  /**
   * Default permission ruleset - base config for all permission modes
   */
  const defaultPermissionRuleset = () =>
    PermissionNext.fromConfig({
      "*": "allow",
      doom_loop: "ask",
      external_directory: {
        "*": "ask",
        [Truncate.DIR]: "allow",
      },
      question: "allow",
      // mirrors github.com/github/gitignore Node.gitignore pattern for .env files
      read: {
        "*": "allow",
        "*.env": "ask",
        "*.env.*": "ask",
        "*.env.example": "allow",
      },
    })

  /**
   * Get the default permission ruleset merged with user config
   */
  export async function getDefaultPermissionRuleset(): Promise<PermissionNext.Ruleset> {
    const cfg = await Config.get()
    const user = PermissionNext.fromConfig(cfg.permission ?? {})
    return PermissionNext.merge(defaultPermissionRuleset(), user)
  }

  const state = Instance.state(async () => {
    const cfg = await Config.get()
    const defaults = defaultPermissionRuleset()
    const user = PermissionNext.fromConfig(cfg.permission ?? {})

    // Only hidden agents remain - SDK handles primary agents (permission modes) and subagents
    const result: Record<string, Info> = {
      compaction: {
        name: "compaction",
        mode: "primary",
        native: true,
        hidden: true,
        prompt: PROMPT_COMPACTION,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        options: {},
      },
      title: {
        name: "title",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        temperature: 0.5,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_TITLE,
      },
      summary: {
        name: "summary",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_SUMMARY,
      },
    }

    // Ensure Truncate.DIR is allowed unless explicitly configured
    for (const name in result) {
      const agent = result[name]
      const explicit = agent.permission.some(
        (r) => r.permission === "external_directory" && r.pattern === Truncate.DIR && r.action === "deny",
      )
      if (explicit) continue

      result[name].permission = PermissionNext.merge(
        result[name].permission,
        PermissionNext.fromConfig({ external_directory: { [Truncate.DIR]: "allow" } }),
      )
    }

    return result
  })

  /**
   * Get a hidden agent by name (title, summary, compaction)
   */
  export async function get(agent: string) {
    return state().then((x) => x[agent])
  }

  /**
   * List all hidden agents
   */
  export async function list() {
    return pipe(await state(), values(), sortBy([(x) => x.name, "asc"]))
  }

  /**
   * Get default agent/permission mode
   * @deprecated Use permission modes directly - this exists for backward compatibility with ACP
   */
  export async function defaultAgent(): Promise<string> {
    return "default"
  }

  /**
   * Generate an agent/subagent configuration using LLM
   */
  export async function generate(input: {
    description: string
    model?: { providerID: string; modelID: string }
  }): Promise<{ identifier: string; whenToUse: string; systemPrompt: string }> {
    const existing = await list()
    const existingNames = existing.map((i) => i.name).join(", ")

    const result = await SDK.singleQuery({
      prompt: `Create an agent configuration based on this request: "${input.description}".

IMPORTANT: The following identifiers already exist and must NOT be used: ${existingNames}

Return ONLY the JSON object, no other text, do not wrap in backticks.`,
      systemPrompt: PROMPT_GENERATE,
    })

    // Parse JSON from response
    const parsed = JSON.parse(result.trim())
    return {
      identifier: parsed.identifier,
      whenToUse: parsed.whenToUse,
      systemPrompt: parsed.systemPrompt,
    }
  }
}
