import z from "zod"
import { query, type ModelInfo } from "@anthropic-ai/claude-agent-sdk"
import { Log } from "@/util/log"

const log = Log.create({ service: "sdk.models" })

export namespace SDKModels {
  /** Model alias for simplified model selection */
  export type ModelAlias = "sonnet" | "opus" | "haiku"

  export const Model = z.object({
    id: z.string(),
    name: z.string(),
    cost: z.object({
      input: z.number(),
      output: z.number(),
      cache: z
        .object({
          read: z.number(),
          write: z.number(),
        })
        .optional(),
    }),
    context: z.number(),
    features: z.array(z.string()),
  })
  export type Model = z.infer<typeof Model>

  // Fallback models in case SDK query fails
  const FALLBACK_MODELS: Record<string, Model> = {
    "claude-sonnet-4-5-20250929": {
      id: "claude-sonnet-4-5-20250929",
      name: "Claude Sonnet 4.5",
      cost: { input: 3.0, output: 15.0, cache: { read: 0.3, write: 3.75 } },
      context: 200000,
      features: ["thinking", "1m-context", "vision"],
    },
    "claude-sonnet-4-20250514": {
      id: "claude-sonnet-4-20250514",
      name: "Claude Sonnet 4",
      cost: { input: 3.0, output: 15.0, cache: { read: 0.3, write: 3.75 } },
      context: 200000,
      features: ["thinking", "1m-context", "vision"],
    },
    "claude-opus-4-5-20251101": {
      id: "claude-opus-4-5-20251101",
      name: "Claude Opus 4.5",
      cost: { input: 15.0, output: 75.0, cache: { read: 1.5, write: 18.75 } },
      context: 200000,
      features: ["thinking", "vision"],
    },
    "claude-haiku-4-5-20251001": {
      id: "claude-haiku-4-5-20251001",
      name: "Claude Haiku 4.5",
      cost: { input: 0.8, output: 4.0, cache: { read: 0.08, write: 1.0 } },
      context: 200000,
      features: ["thinking", "vision"],
    },
  }

  // Cached models from SDK
  let cachedModels: ModelInfo[] | null = null
  let fetchPromise: Promise<ModelInfo[]> | null = null

  /**
   * Fetch models from the SDK by creating a short-lived query
   */
  async function fetchModelsFromSDK(): Promise<ModelInfo[]> {
    if (cachedModels) return cachedModels
    if (fetchPromise) return fetchPromise

    fetchPromise = (async () => {
      try {
        log.info("fetching models from SDK")
        const q = query({
          prompt: "", // Empty prompt - we just want to call supportedModels()
          options: {
            maxTurns: 0, // Don't actually run
          },
        })

        const models = await q.supportedModels()
        cachedModels = models
        log.info("fetched models from SDK", { count: models.length })

        // Abort the query since we don't need it
        try {
          await q.return(undefined)
        } catch {
          // Ignore errors from aborting
        }

        return models
      } catch (error) {
        log.warn("failed to fetch models from SDK, using fallback", { error })
        return Object.values(FALLBACK_MODELS).map((m) => ({
          value: m.id,
          displayName: m.name,
          description: `Context: ${m.context} tokens`,
        }))
      } finally {
        fetchPromise = null
      }
    })()

    return fetchPromise
  }

  /**
   * Get supported models from SDK (cached after first fetch)
   */
  export async function getSupportedModels(): Promise<ModelInfo[]> {
    return fetchModelsFromSDK()
  }

  /**
   * Get model info synchronously (uses fallback if not cached)
   */
  export const CLAUDE_MODELS = FALLBACK_MODELS

  export function getModel(modelID: string): Model | undefined {
    return FALLBACK_MODELS[modelID]
  }

  export function listModels(): Model[] {
    return Object.values(FALLBACK_MODELS)
  }

  export function getDefaultModel(): string {
    return "claude-sonnet-4-5-20250929"
  }

  /** Map model ID to SDK model alias (sonnet, opus, haiku) */
  export function toSDKModelAlias(modelID?: string): ModelAlias | undefined {
    if (!modelID) return undefined
    if (modelID.includes("opus")) return "opus"
    if (modelID.includes("haiku")) return "haiku"
    return "sonnet"
  }

  /** Map SDK model alias to full model ID from available models */
  export async function fromSDKModelAlias(alias: ModelAlias): Promise<string> {
    const models = await getSupportedModels()
    // Find model that matches the alias
    const match = models.find((m) => m.value.includes(alias))
    if (match) return match.value
    // Fallback to hardcoded models if SDK didn't return a match
    const fallback = Object.keys(FALLBACK_MODELS).find((id) => id.includes(alias))
    return fallback ?? getDefaultModel()
  }
}
