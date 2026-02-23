import z from "zod"
import path from "path"
import type { Query, ModelInfo } from "@anthropic-ai/claude-agent-sdk"
import { Log } from "@/util/log"
import { Global } from "@/global"
import { GlobalBus } from "@/bus/global"
import { AppEvent } from "@/bus/events"

const log = Log.create({ service: "sdk.models" })

const CACHE_FILE = path.join(Global.Path.state, "models.json")

export namespace SDKModels {
  /** Model alias for simplified model selection */
  export type ModelAlias = "sonnet" | "opus" | "haiku"

  export const Model = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
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

  // Hardcoded fallback models - last resort if no cache exists
  const FALLBACK_MODELS: Record<string, Model> = {
    "claude-sonnet-4-5-20250929": {
      id: "claude-sonnet-4-5-20250929",
      name: "Sonnet 4.5",
      cost: { input: 3.0, output: 15.0, cache: { read: 0.3, write: 3.75 } },
      context: 200000,
      features: ["thinking", "1m-context", "vision"],
    },
    "claude-sonnet-4-20250514": {
      id: "claude-sonnet-4-20250514",
      name: "Sonnet 4",
      cost: { input: 3.0, output: 15.0, cache: { read: 0.3, write: 3.75 } },
      context: 200000,
      features: ["thinking", "1m-context", "vision"],
    },
    "claude-opus-4-5-20251101": {
      id: "claude-opus-4-5-20251101",
      name: "Opus 4.5",
      cost: { input: 15.0, output: 75.0, cache: { read: 1.5, write: 18.75 } },
      context: 200000,
      features: ["thinking", "vision"],
    },
    "claude-haiku-4-5-20251001": {
      id: "claude-haiku-4-5-20251001",
      name: "Haiku 4.5",
      cost: { input: 0.8, output: 4.0, cache: { read: 0.08, write: 1.0 } },
      context: 200000,
      features: ["thinking", "vision"],
    },
  }

  // In-memory cache of models from disk
  let cachedModels: Record<string, Model> | null = null

  /**
   * Load cached models from disk (sync read on first access)
   */
  function loadCachedModels(): Record<string, Model> {
    if (cachedModels !== null) return cachedModels

    try {
      // Use sync read for initial load to avoid async in getter
      const text = require("fs").readFileSync(CACHE_FILE, "utf-8")
      const parsed = JSON.parse(text) as Record<string, Model>
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        cachedModels = parsed
        log.info("loaded cached models", { count: Object.keys(parsed).length })
        return parsed
      }
    } catch {
      // Cache doesn't exist or is invalid - use fallback
    }

    cachedModels = FALLBACK_MODELS
    return FALLBACK_MODELS
  }

  /**
   * Save models to disk cache (async, fire-and-forget)
   */
  async function saveCachedModels(models: Record<string, Model>): Promise<void> {
    try {
      await Bun.write(CACHE_FILE, JSON.stringify(models, null, 2))
      cachedModels = models
      log.info("saved cached models", { count: Object.keys(models).length })
    } catch (error) {
      log.warn("failed to save models cache", { error })
    }
  }

  /**
   * Update models cache from a real query (call after query starts)
   * This is fire-and-forget - doesn't block the query
   */
  export function updateModelsFromQuery(activeQuery: Query): void {
    // Run in background, don't await
    ;(async () => {
      try {
        const sdkModels = await activeQuery.supportedModels()
        if (!sdkModels || sdkModels.length === 0) return

        // Merge SDK models with existing data (keep cost/features from fallback if available)
        const updated: Record<string, Model> = {}
        for (const m of sdkModels) {
          // Skip unlabeled/internal models
          if (m.description === "Custom model") continue
          const existing = FALLBACK_MODELS[m.value] ?? cachedModels?.[m.value]
          // Use SDK displayName only if it's actually a formatted name (not just the ID)
          const hasFormattedName = m.displayName && m.displayName !== m.value
          updated[m.value] = {
            id: m.value,
            name: hasFormattedName ? m.displayName : (existing?.name ?? formatModelName(m.value)),
            description: m.description || existing?.description,
            cost: existing?.cost ?? { input: 0, output: 0 },
            context: existing?.context ?? 200000,
            features: existing?.features ?? inferFeatures(m.value),
          }
        }

        await saveCachedModels(updated)
        GlobalBus.emit("event", {
          directory: "global",
          payload: {
            type: AppEvent.ModelsUpdated.type,
            properties: { count: Object.keys(updated).length },
          },
        })
      } catch (error) {
        log.warn("failed to update models from query", { error })
      }
    })()
  }

  /**
   * Format a model ID into a human-readable name
   * e.g. "claude-opus-4-5-20251101" → "Opus 4.5"
   */
  function formatModelName(modelID: string): string {
    // Extract model family and version from ID
    const match = modelID.match(/claude-(\w+)-(\d+)-(\d+)?/)
    if (match) {
      const [, family, major, minor] = match
      const familyName = family.charAt(0).toUpperCase() + family.slice(1)
      const version = minor ? `${major}.${minor}` : major
      return `${familyName} ${version}`
    }
    // Fallback: just capitalize and clean up
    return modelID
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ")
  }

  /**
   * Infer features from model ID when no fallback data exists
   */
  function inferFeatures(modelID: string): string[] {
    const features: string[] = ["vision"]
    if (modelID.includes("opus") || modelID.includes("sonnet")) {
      features.push("thinking")
    }
    if (modelID.includes("sonnet-4-5") || modelID.includes("sonnet-4")) {
      features.push("1m-context")
    }
    return features
  }

  /**
   * Get all available models (cached → fallback)
   */
  export function getModels(): Record<string, Model> {
    return loadCachedModels()
  }

  /**
   * Alias for getModels() for backwards compatibility
   */
  export const CLAUDE_MODELS = new Proxy({} as Record<string, Model>, {
    get(_, prop: string) {
      return loadCachedModels()[prop]
    },
    ownKeys() {
      return Object.keys(loadCachedModels())
    },
    getOwnPropertyDescriptor(_, prop: string) {
      const models = loadCachedModels()
      if (prop in models) {
        return { enumerable: true, configurable: true, value: models[prop] }
      }
      return undefined
    },
    has(_, prop: string) {
      return prop in loadCachedModels()
    },
  })

  export function getModel(modelID: string): Model | undefined {
    return loadCachedModels()[modelID]
  }

  export function listModels(): Model[] {
    return Object.values(loadCachedModels())
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
  export function fromSDKModelAlias(alias: ModelAlias): string {
    const models = getModels()
    // Find model that matches the alias
    const match = Object.keys(models).find((id) => id.includes(alias))
    if (match) return match
    // Fallback to hardcoded models if cache didn't have a match
    const fallback = Object.keys(FALLBACK_MODELS).find((id) => id.includes(alias))
    return fallback ?? getDefaultModel()
  }
}
