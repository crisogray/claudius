import { LSP } from "@/lsp"
import { Log } from "@/util/log"

export namespace SDKCustomTools {
  const log = Log.create({ service: "sdk.custom-tools" })

  // Custom tools that are NOT built into the SDK
  // These need to be provided via MCP server or custom tool definitions

  /**
   * LSP tool definition for SDK
   *
   * Provides language server protocol operations like:
   * - definition: Go to definition
   * - references: Find references
   * - hover: Get hover information
   * - symbols: Get document symbols
   */
  export const lspTool = {
    name: "lsp",
    description: "Language server protocol operations for code intelligence",
    inputSchema: {
      type: "object" as const,
      properties: {
        operation: {
          type: "string",
          enum: ["definition", "references", "hover", "symbols"],
          description: "The LSP operation to perform",
        },
        file: {
          type: "string",
          description: "The file path to operate on",
        },
        line: {
          type: "number",
          description: "Line number (0-indexed)",
        },
        character: {
          type: "number",
          description: "Character position (0-indexed)",
        },
      },
      required: ["operation", "file"],
    },
    execute: async (input: {
      operation: "definition" | "references" | "hover" | "symbols"
      file: string
      line?: number
      character?: number
    }) => {
      log.info("executing lsp operation", { operation: input.operation, file: input.file })

      try {
        switch (input.operation) {
          case "definition": {
            if (input.line === undefined || input.character === undefined) {
              return { error: "line and character required for definition" }
            }
            const result = await LSP.definition({
              file: input.file,
              line: input.line,
              character: input.character,
            })
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
          }

          case "references": {
            if (input.line === undefined || input.character === undefined) {
              return { error: "line and character required for references" }
            }
            const result = await LSP.references({
              file: input.file,
              line: input.line,
              character: input.character,
            })
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
          }

          case "hover": {
            if (input.line === undefined || input.character === undefined) {
              return { error: "line and character required for hover" }
            }
            const result = await LSP.hover({
              file: input.file,
              line: input.line,
              character: input.character,
            })
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
          }

          case "symbols": {
            const result = await LSP.documentSymbol(`file://${input.file}`)
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
          }

          default:
            return { error: `Unknown operation: ${input.operation}` }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error("lsp operation failed", { operation: input.operation, error: message })
        return { error: message }
      }
    },
  }

  /**
   * Get all custom tool definitions
   */
  export function getCustomTools() {
    return [lspTool]
  }
}
