import z from "zod"
import fuzzysort from "fuzzysort"
import { Config } from "../config/config"
import { mapValues, sortBy } from "remeda"
import { Log } from "../util/log"
import { ModelsDev } from "./models"
import { NamedError } from "@opencode-ai/util/error"
import { Auth } from "../auth"
import { Env } from "../env"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { SDKModels } from "../sdk/models"

/**
 * Provider namespace - manages model metadata for UI display
 *
 * Note: The Claude Agent SDK handles all actual provider/model loading internally.
 * This module now only provides:
 * - Model listing for UI selection
 * - Pricing/capability information from models.dev
 * - Provider availability checks (for showing/hiding providers)
 */
export namespace Provider {
  const log = Log.create({ service: "provider" })

  // Claude Agent SDK only supports Anthropic
  const SUPPORTED_PROVIDER = "anthropic"

  export const Model = z
    .object({
      id: z.string(),
      providerID: z.string(),
      name: z.string(),
      family: z.string().optional(),
      capabilities: z.object({
        temperature: z.boolean(),
        reasoning: z.boolean(),
        attachment: z.boolean(),
        toolcall: z.boolean(),
        input: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
        output: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
        interleaved: z.union([
          z.boolean(),
          z.object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          }),
        ]),
      }),
      cost: z.object({
        input: z.number(),
        output: z.number(),
        cache: z.object({
          read: z.number(),
          write: z.number(),
        }),
        experimentalOver200K: z
          .object({
            input: z.number(),
            output: z.number(),
            cache: z.object({
              read: z.number(),
              write: z.number(),
            }),
          })
          .optional(),
      }),
      limit: z.object({
        context: z.number(),
        output: z.number(),
      }),
      status: z.enum(["alpha", "beta", "deprecated", "active"]),
      options: z.record(z.string(), z.any()),
      headers: z.record(z.string(), z.string()),
      release_date: z.string(),
      variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    .meta({
      ref: "Model",
    })
  export type Model = z.infer<typeof Model>

  export const Info = z
    .object({
      id: z.string(),
      name: z.string(),
      source: z.enum(["env", "config", "custom", "api"]),
      env: z.string().array(),
      key: z.string().optional(),
      options: z.record(z.string(), z.any()),
      models: z.record(z.string(), Model),
    })
    .meta({
      ref: "Provider",
    })
  export type Info = z.infer<typeof Info>

  function fromModelsDevModel(provider: ModelsDev.Provider, model: ModelsDev.Model): Model {
    const m: Model = {
      id: model.id,
      providerID: provider.id,
      name: model.name,
      family: model.family,
      status: model.status ?? "active",
      headers: model.headers ?? {},
      options: model.options ?? {},
      cost: {
        input: model.cost?.input ?? 0,
        output: model.cost?.output ?? 0,
        cache: {
          read: model.cost?.cache_read ?? 0,
          write: model.cost?.cache_write ?? 0,
        },
        experimentalOver200K: model.cost?.context_over_200k
          ? {
              cache: {
                read: model.cost.context_over_200k.cache_read ?? 0,
                write: model.cost.context_over_200k.cache_write ?? 0,
              },
              input: model.cost.context_over_200k.input,
              output: model.cost.context_over_200k.output,
            }
          : undefined,
      },
      limit: {
        context: model.limit.context,
        output: model.limit.output,
      },
      capabilities: {
        temperature: model.temperature,
        reasoning: model.reasoning,
        attachment: model.attachment,
        toolcall: model.tool_call,
        input: {
          text: model.modalities?.input?.includes("text") ?? false,
          audio: model.modalities?.input?.includes("audio") ?? false,
          image: model.modalities?.input?.includes("image") ?? false,
          video: model.modalities?.input?.includes("video") ?? false,
          pdf: model.modalities?.input?.includes("pdf") ?? false,
        },
        output: {
          text: model.modalities?.output?.includes("text") ?? false,
          audio: model.modalities?.output?.includes("audio") ?? false,
          image: model.modalities?.output?.includes("image") ?? false,
          video: model.modalities?.output?.includes("video") ?? false,
          pdf: model.modalities?.output?.includes("pdf") ?? false,
        },
        interleaved: model.interleaved ?? false,
      },
      release_date: model.release_date,
      variants: {},
    }

    // Add default variants for reasoning models
    if (m.capabilities.reasoning) {
      if (provider.id === "anthropic") {
        m.variants = {
          high: { thinking: { type: "enabled", budgetTokens: 16000 } },
          max: { thinking: { type: "enabled", budgetTokens: 31999 } },
        }
      } else {
        // Non-Anthropic reasoning models get standard reasoning effort variants
        m.variants = {
          low: { reasoningEffort: "low" },
          medium: { reasoningEffort: "medium" },
          high: { reasoningEffort: "high" },
        }
      }
    }

    return m
  }

  export function fromModelsDevProvider(provider: ModelsDev.Provider): Info {
    return {
      id: provider.id,
      source: "custom",
      name: provider.name,
      env: provider.env ?? [],
      options: {},
      models: mapValues(provider.models, (model) => fromModelsDevModel(provider, model)),
    }
  }

  /**
   * Get Anthropic provider using SDK's model list directly
   * This ensures the UI only shows models the SDK actually supports
   */
  export function getAnthropicProvider(): Info {
    const sdkModels = SDKModels.CLAUDE_MODELS
    const models: Record<string, Model> = {}

    for (const [id, sdkModel] of Object.entries(sdkModels)) {
      models[id] = {
        id,
        providerID: SUPPORTED_PROVIDER,
        name: sdkModel.name,
        status: "active",
        capabilities: {
          temperature: true,
          reasoning: sdkModel.features.includes("thinking"),
          attachment: true,
          toolcall: true,
          input: {
            text: true,
            audio: false,
            image: sdkModel.features.includes("vision"),
            video: false,
            pdf: true,
          },
          output: {
            text: true,
            audio: false,
            image: false,
            video: false,
            pdf: false,
          },
          interleaved: false,
        },
        cost: {
          input: sdkModel.cost.input,
          output: sdkModel.cost.output,
          cache: sdkModel.cost.cache ?? { read: 0, write: 0 },
        },
        limit: {
          context: sdkModel.context,
          output: 8192,
        },
        options: {},
        headers: {},
        family: id.includes("opus") ? "opus" : id.includes("haiku") ? "haiku" : "sonnet",
        release_date: "",
        variants: id.includes("opus") || id.includes("sonnet")
          ? {
              high: { thinking: { type: "enabled", budgetTokens: 16000 } },
              max: { thinking: { type: "enabled", budgetTokens: 31999 } },
            }
          : {},
      }
    }

    return {
      id: SUPPORTED_PROVIDER,
      source: "custom",
      name: "Anthropic",
      env: ["ANTHROPIC_API_KEY"],
      options: {},
      models,
    }
  }

  /**
   * Get Anthropic provider using SDK's dynamic model list
   * Fetches models from SDK's supportedModels() on first call, then caches
   */
  export async function getAnthropicProviderAsync(): Promise<Info> {
    const sdkModels = await SDKModels.getSupportedModels()
    const models: Record<string, Model> = {}

    for (const sdkModel of sdkModels) {
      const id = sdkModel.value
      const isOpus = id.includes("opus")
      const isHaiku = id.includes("haiku")
      const isSonnet = id.includes("sonnet")

      // Get cost info from fallback if available
      const fallback = SDKModels.CLAUDE_MODELS[id]

      models[id] = {
        id,
        providerID: SUPPORTED_PROVIDER,
        name: sdkModel.displayName,
        status: "active",
        capabilities: {
          temperature: true,
          reasoning: isOpus || isSonnet, // Opus and Sonnet support thinking
          attachment: true,
          toolcall: true,
          input: {
            text: true,
            audio: false,
            image: true, // All Claude 4+ models support vision
            video: false,
            pdf: true,
          },
          output: {
            text: true,
            audio: false,
            image: false,
            video: false,
            pdf: false,
          },
          interleaved: false,
        },
        cost: {
          input: fallback?.cost.input ?? 0,
          output: fallback?.cost.output ?? 0,
          cache: fallback?.cost.cache ?? { read: 0, write: 0 },
        },
        limit: {
          context: fallback?.context ?? 200000,
          output: 8192,
        },
        options: {},
        headers: {},
        family: isOpus ? "opus" : isHaiku ? "haiku" : "sonnet",
        release_date: "",
        variants:
          isOpus || isSonnet
            ? {
                high: { thinking: { type: "enabled", budgetTokens: 16000 } },
                max: { thinking: { type: "enabled", budgetTokens: 31999 } },
              }
            : {},
      }
    }

    return {
      id: SUPPORTED_PROVIDER,
      source: "custom",
      name: "Anthropic",
      env: ["ANTHROPIC_API_KEY"],
      options: {},
      models,
    }
  }

  const state = Instance.state(async () => {
    using _ = log.time("state")
    const modelsDev = await ModelsDev.get()

    // Only load Anthropic provider - Claude Agent SDK only supports Anthropic
    const anthropic = modelsDev[SUPPORTED_PROVIDER]
    if (!anthropic) {
      log.warn("Anthropic provider not found in models.dev")
      return { providers: {} }
    }

    const provider = fromModelsDevProvider(anthropic)

    // Check for API key
    const env = Env.all()
    const apiKey = provider.env.map((item) => env[item]).find(Boolean)
    if (apiKey) {
      provider.source = "env"
      if (provider.env.length === 1) provider.key = apiKey
    }

    // Check for stored auth
    const auth = await Auth.get(SUPPORTED_PROVIDER)
    if (auth?.type === "api") {
      provider.source = "api"
      provider.key = auth.key
    }

    // Filter out alpha models unless experimental flag is set
    if (!Flag.OPENCODE_ENABLE_EXPERIMENTAL_MODELS) {
      for (const [modelID, model] of Object.entries(provider.models)) {
        if (model.status === "alpha") {
          delete provider.models[modelID]
        }
      }
    }

    log.info("found", { providerID: SUPPORTED_PROVIDER })

    return {
      providers: { [SUPPORTED_PROVIDER]: provider } as Record<string, Info>,
    }
  })

  export async function list() {
    return state().then((state) => state.providers)
  }

  export async function getProvider(providerID: string) {
    return state().then((s) => s.providers[providerID])
  }

  export async function getModel(providerID: string, modelID: string) {
    const s = await state()
    const provider = s.providers[providerID]
    if (!provider) {
      const availableProviders = Object.keys(s.providers)
      const matches = fuzzysort.go(providerID, availableProviders, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }

    const info = provider.models[modelID]
    if (!info) {
      const availableModels = Object.keys(provider.models)
      const matches = fuzzysort.go(modelID, availableModels, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }
    return info
  }

  export async function closest(providerID: string, query: string[]) {
    const s = await state()
    const provider = s.providers[providerID]
    if (!provider) return undefined
    for (const item of query) {
      for (const modelID of Object.keys(provider.models)) {
        if (modelID.includes(item))
          return {
            providerID,
            modelID,
          }
      }
    }
  }

  export async function getSmallModel(providerID: string) {
    const cfg = await Config.get()

    if (cfg.small_model) {
      const parsed = parseModel(cfg.small_model)
      return getModel(parsed.providerID, parsed.modelID)
    }

    // Claude Agent SDK only supports Anthropic - use haiku as small model
    const provider = await state().then((state) => state.providers[SUPPORTED_PROVIDER])
    if (provider) {
      const haikuPriority = ["claude-haiku-4-5", "claude-haiku-4.5", "3-5-haiku", "3.5-haiku"]
      for (const item of haikuPriority) {
        for (const model of Object.keys(provider.models)) {
          if (model.includes(item)) return getModel(SUPPORTED_PROVIDER, model)
        }
      }
    }

    return undefined
  }

  // Claude models priority for sorting
  const priority = ["claude-opus-4-5", "claude-sonnet-4-5", "claude-sonnet-4", "claude-haiku-4-5"]
  export function sort(models: Model[]) {
    return sortBy(
      models,
      [(model) => priority.findIndex((filter) => model.id.includes(filter)), "desc"],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  export async function defaultModel() {
    const cfg = await Config.get()
    if (cfg.model) return parseModel(cfg.model)

    const provider = await list()
      .then((val) => Object.values(val))
      .then((x) => x.find((p) => !cfg.provider || Object.keys(cfg.provider).includes(p.id)))
    if (!provider) throw new Error("no providers found")
    const [model] = sort(Object.values(provider.models))
    if (!model) throw new Error("no models found")
    return {
      providerID: provider.id,
      modelID: model.id,
    }
  }

  export function parseModel(model: string) {
    const [providerID, ...rest] = model.split("/")
    return {
      providerID: providerID,
      modelID: rest.join("/"),
    }
  }

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: z.string(),
      modelID: z.string(),
      suggestions: z.array(z.string()).optional(),
    }),
  )

  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: z.string(),
    }),
  )
}
