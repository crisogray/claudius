import { Config } from "@/config/config"
import { McpAuth } from "@/mcp/auth"
import { Log } from "@/util/log"

export namespace SDKMCP {
  const log = Log.create({ service: "sdk.mcp" })

  // SDK MCP server config types
  export interface StdioServerConfig {
    command: string
    args?: string[]
    env?: Record<string, string>
  }

  export interface HTTPServerConfig {
    type: "http"
    url: string
    headers?: Record<string, string>
  }

  export interface SSEServerConfig {
    type: "sse"
    url: string
    headers?: Record<string, string>
  }

  export type ServerConfig = StdioServerConfig | HTTPServerConfig | SSEServerConfig

  /**
   * Convert opencode MCP config to SDK format
   *
   * opencode format:
   * - local: { type: "local", command: ["cmd", "arg1", "arg2"], environment: {} }
   * - remote: { type: "remote", url: "...", headers: {}, transport: "http" | "sse" }
   *
   * SDK format:
   * - stdio: { command: "cmd", args: ["arg1", "arg2"], env: {} }
   * - http: { type: "http", url: "...", headers: {} }
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
        // Build headers, injecting OAuth token if available
        const headers: Record<string, string> = { ...mcp.headers }

        // Inject OAuth token from stored credentials if not already present
        const auth = await McpAuth.get(name)
        if (auth?.tokens?.accessToken && !headers.Authorization) {
          // Check if token is expired and warn
          const expired = await McpAuth.isTokenExpired(name)
          if (expired) {
            log.warn("oauth token expired for mcp server", { name })
          } else {
            headers.Authorization = `Bearer ${auth.tokens.accessToken}`
            log.info("injected oauth token for mcp server", { name })
          }
        }

        // Use configured transport type, defaulting to "sse" for backwards compatibility
        const transport = mcp.transport ?? "sse"

        result[name] = {
          type: transport,
          url: mcp.url,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        }
        log.info("configured remote mcp server", { name, url: mcp.url, transport })
      }
    }

    return result
  }
}
