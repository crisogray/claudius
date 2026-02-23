import z from "zod"
import { sortBy } from "remeda"
import { NamedError } from "@opencode-ai/util/error"
import { SDKModels } from "../sdk/models"

/**
 * Provider namespace - manages model metadata for UI display
 *
 * The Claude Agent SDK handles all actual model loading internally.
 * This module only provides model listing for UI selection.
 */
export namespace Provider {
  export const Model = z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      family: z.string().optional(),
      reasoning: z.boolean(),
      cost: z.object({
        input: z.number(),
        output: z.number(),
        cache: z.object({
          read: z.number(),
          write: z.number(),
        }),
      }),
      context: z.number(),
    })
    .meta({ ref: "Model" })
  export type Model = z.infer<typeof Model>

  /**
   * Get all available models from SDK
   */
  export function list(): Model[] {
    return Object.entries(SDKModels.CLAUDE_MODELS).map(([id, m]) => ({
      id,
      name: m.name,
      description: m.description,
      family: id.includes("opus") ? "opus" : id.includes("haiku") ? "haiku" : "sonnet",
      reasoning: m.features.includes("thinking"),
      cost: {
        input: m.cost.input,
        output: m.cost.output,
        cache: m.cost.cache ?? { read: 0, write: 0 },
      },
      context: m.context,
    }))
  }

  /**
   * Get models from SDK dynamically (async)
   * @deprecated Use list() instead - models are now lazily cached from real queries
   */
  export async function listAsync(): Promise<Model[]> {
    // Just return the sync list - models are updated lazily from real queries
    return list()
  }

  /**
   * Get a specific model by ID
   */
  export function getModel(modelID: string): Model | undefined {
    const models = list()
    return models.find((m) => m.id === modelID)
  }

  /**
   * Get the default model
   */
  export function getDefaultModel(): string {
    return SDKModels.getDefaultModel()
  }

  /**
   * Get a small/fast model (haiku)
   */
  export function getSmallModel(): string | undefined {
    const models = list()
    const haiku = models.find((m) => m.family === "haiku")
    return haiku?.id
  }

  // Claude models priority for sorting
  const priority = ["claude-opus-4-5", "claude-sonnet-4-5", "claude-sonnet-4", "claude-haiku-4-5"]

  /**
   * Sort models by priority (opus > sonnet 4.5 > sonnet 4 > haiku)
   * Works with any model type that has an `id` field
   */
  export function sort<T extends { id: string }>(models: T[]): T[] {
    return sortBy(
      models,
      [(model) => priority.findIndex((filter) => model.id.includes(filter)), "desc"],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  /**
   * Parse model string (format: "anthropic/model-id" or just "model-id")
   */
  export function parseModel(model: string): { providerID: string; modelID: string } {
    if (model.includes("/")) {
      const [providerID, modelID] = model.split("/")
      return { providerID, modelID }
    }
    // Default to anthropic for SDK-only operation
    return { providerID: "anthropic", modelID: model }
  }

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      modelID: z.string(),
      suggestions: z.array(z.string()).optional(),
    }),
  )
}
