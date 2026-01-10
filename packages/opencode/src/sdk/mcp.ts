import { Config } from "@/config/config"
import { Log } from "@/util/log"

export namespace SDKMCP {
  const log = Log.create({ service: "sdk.mcp" })

  // SDK MCP server config types
  export interface StdioServerConfig {
    command: string
    args?: string[]
    env?: Record<string, string>
  }

  export interface SSEServerConfig {
    type: "sse"
    url: string
    headers?: Record<string, string>
  }

  export type ServerConfig = StdioServerConfig | SSEServerConfig

  /**
   * Convert opencode MCP config to SDK format
   *
   * opencode format:
   * - local: { type: "local", command: ["cmd", "arg1", "arg2"], environment: {} }
   * - remote: { type: "remote", url: "...", headers: {} }
   *
   * SDK format:
   * - stdio: { command: "cmd", args: ["arg1", "arg2"], env: {} }
   * - sse: { type: "sse", url: "...", headers: {} }
   */
  export async function getMcpServers(): Promise<Record<string, ServerConfig>> {
    const config = await Config.get()
    const mcpConfig = config.mcp ?? {}

    const result: Record<string, ServerConfig> = {}

    for (const [name, mcp] of Object.entries(mcpConfig)) {
      if (typeof mcp !== "object" || !("type" in mcp)) continue
      if (mcp.enabled === false) continue

      if (mcp.type === "local") {
        // opencode: { type: "local", command: ["cmd", "arg1", "arg2"] }
        // SDK: { command: "cmd", args: ["arg1", "arg2"], env: {} }
        const [cmd, ...args] = mcp.command
        result[name] = {
          command: cmd,
          args,
          env: mcp.environment,
        }
        log.info("configured local mcp server", { name, command: cmd })
      }

      if (mcp.type === "remote") {
        // opencode: { type: "remote", url: "...", headers: {} }
        // SDK: { type: "sse", url: "...", headers: {} }
        // Note: SDK doesn't support OAuth for MCP - tokens must be in headers
        result[name] = {
          type: "sse",
          url: mcp.url,
          headers: mcp.headers,
        }
        log.info("configured remote mcp server", { name, url: mcp.url })
      }
    }

    return result
  }
}
