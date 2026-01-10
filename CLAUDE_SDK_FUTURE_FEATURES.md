# Claude Agent SDK - Future Features

These features were identified during SDK documentation review and should be considered for future phases after initial migration is complete.

---

## 1. V2 Interface (Preview) - Simplified Multi-Turn

The SDK offers a V2 preview with simpler multi-turn patterns. Consider for future adoption:

```typescript
// V2: Much simpler multi-turn conversations
import { unstable_v2_createSession, unstable_v2_resumeSession } from '@anthropic-ai/claude-agent-sdk'

await using session = unstable_v2_createSession({ model: 'claude-sonnet-4-5-20250929' })

// Turn 1
await session.send('Hello!')
for await (const msg of session.stream()) {
  // Process messages
}

// Turn 2 - session maintains context
await session.send('Follow up question')
for await (const msg of session.stream()) {
  // Process messages
}

// Automatic cleanup with `await using` (TypeScript 5.2+)
```

**Integration Strategy**:
- Initially use V1 API (more feature-complete)
- Add V2 adapter when it stabilizes
- V2's `send()`/`stream()` pattern maps well to opencode's Bus events

---

## 2. Additional Query Methods

These Query methods could be exposed to the UI in future:

| Method | Purpose | UI Integration |
|--------|---------|----------------|
| `setMaxThinkingTokens(n)` | Adjust thinking budget mid-conversation | Settings panel slider |
| `mcpServerStatus()` | Get connected MCP server status | MCP status panel |
| `accountInfo()` | Get account info (email, org, tier) | Account/settings display |

```typescript
// packages/opencode/src/sdk/query.ts

export async function getAccountInfo(query: Query): Promise<AccountInfo> {
  return await query.accountInfo()
}

// UI component
function AccountDisplay() {
  const { account } = useAccountInfo()
  return (
    <div className="account-info">
      <span>{account?.email}</span>
      {account?.organization && <Badge>{account.organization}</Badge>}
      <span className="tier">{account?.subscriptionType}</span>
    </div>
  )
}
```

---

## 3. Additional Options

| Option | Type | Purpose | opencode Integration |
|--------|------|---------|---------------------|
| `forkSession` | boolean | Fork to new session ID when resuming | Session branching feature |
| `maxBudgetUsd` | number | Maximum cost for query | Cost limits in config |
| `fallbackModel` | string | Model to use if primary fails | Reliability/graceful degradation |
| `resumeSessionAt` | string | Resume at specific message UUID | Enhanced revert/checkpoint |
| `settingSources` | array | Control which filesystem settings load | Config precedence control |
| `strictMcpConfig` | boolean | Enforce strict MCP validation | Debugging/validation mode |

```typescript
// packages/opencode/src/sdk/config.ts

interface SDKConfigExtended {
  // Cost management
  maxBudgetUsd?: number        // From config.limits.maxCostPerSession

  // Reliability
  fallbackModel?: string       // From config.model.fallback

  // Session management
  forkSession?: boolean        // When resuming, create branch
  resumeSessionAt?: string     // Resume at specific message UUID

  // Settings isolation
  settingSources?: ('user' | 'project' | 'local')[]  // Control what settings load
}

function buildSDKOptions(config: Config, session: Session.Info): Options {
  return {
    // ... existing options
    maxBudgetUsd: config.limits?.maxCostPerSession,
    fallbackModel: config.model?.fallback,
    forkSession: session.fork ?? false,
    settingSources: config.sdk?.settingSources ?? ['project'],
  }
}
```

---

## 4. Additional Hooks

These hooks could enhance the plugin system:

```typescript
// packages/opencode/src/sdk/hooks.ts

function buildHooks(): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  return {
    // Tool execution failure
    PostToolUseFailure: [{
      hooks: [async (input, toolUseID, options) => {
        const failInput = input as PostToolUseFailureHookInput
        await Plugin.trigger("tool.execute.error", {
          sessionID: input.session_id,
          tool: failInput.tool_name,
          error: failInput.error,
          isInterrupt: failInput.is_interrupt
        })

        Bus.publish(SDK.Event.ToolError, {
          sessionID: input.session_id,
          toolUseID,
          toolName: failInput.tool_name,
          error: failInput.error
        })
        return { continue: true }
      }]
    }],

    // User prompt submission (can add context)
    UserPromptSubmit: [{
      hooks: [async (input, toolUseID, options) => {
        const promptInput = input as UserPromptSubmitHookInput
        await Plugin.trigger("prompt.submit", {
          sessionID: input.session_id,
          prompt: promptInput.prompt
        })

        const context = await getAdditionalContext(input.session_id)
        if (context) {
          return {
            hookSpecificOutput: {
              hookEventName: 'UserPromptSubmit',
              additionalContext: context
            }
          }
        }
        return { continue: true }
      }]
    }],

    // Stop hook
    Stop: [{
      hooks: [async (input, toolUseID, options) => {
        const stopInput = input as StopHookInput
        await Plugin.trigger("session.stop", {
          sessionID: input.session_id,
          stopHookActive: stopInput.stop_hook_active
        })
        return { continue: true }
      }]
    }],

    // Pre-compaction (archive before summarize)
    PreCompact: [{
      hooks: [async (input, toolUseID, options) => {
        const compactInput = input as PreCompactHookInput

        if (compactInput.trigger === 'auto') {
          await archiveTranscript(input.session_id, input.transcript_path)
        }

        await Plugin.trigger("session.compact.before", {
          sessionID: input.session_id,
          trigger: compactInput.trigger,
          customInstructions: compactInput.custom_instructions
        })
        return { continue: true }
      }]
    }],

    // Permission request (custom handling)
    PermissionRequest: [{
      hooks: [async (input, toolUseID, options) => {
        const permInput = input as PermissionRequestHookInput

        Bus.publish(SDK.Event.PermissionRequest, {
          sessionID: input.session_id,
          toolUseID,
          toolName: permInput.tool_name,
          toolInput: permInput.tool_input,
          suggestions: permInput.permission_suggestions
        })

        return { continue: true }
      }]
    }],
  }
}
```

---

## 5. Plugin System Integration

The SDK supports loading plugins from local directories:

```typescript
// packages/opencode/src/sdk/plugins.ts

import { SdkPluginConfig } from "@anthropic-ai/claude-agent-sdk"

export async function getSDKPlugins(): Promise<SdkPluginConfig[]> {
  const opencodePlugins = await Plugin.list()

  return opencodePlugins
    .filter(p => p.sdk !== false)
    .map(p => ({
      type: 'local' as const,
      path: p.path
    }))
}

// Plugin structure mapping:
// .opencode/plugins/my-plugin/
// ├── .claude-plugin/
// │   └── plugin.json          # SDK manifest
// ├── commands/                 # Same as opencode commands
// ├── agents/                   # Same as opencode agents
// ├── skills/                   # Same as opencode skills
// ├── hooks/                    # hooks.json for SDK hooks
// └── .mcp.json                 # MCP server definitions
```

**Command Namespacing**: SDK plugins use `plugin-name:command-name` format.

---

## 6. MCP Server Types

Support all MCP server connection types:

```typescript
// packages/opencode/src/sdk/mcp.ts

type McpServerConfig =
  | McpStdioServerConfig      // Subprocess (current)
  | McpSSEServerConfig        // Server-Sent Events (NEW)
  | McpHttpServerConfig       // HTTP streaming (NEW)
  | McpSdkServerConfigWithInstance  // In-process (current)

// SSE-based server (e.g., remote MCP servers)
interface McpSSEServerConfig {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

// HTTP-based server
interface McpHttpServerConfig {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

// Config example
{
  "servers": {
    "local-tools": {
      "command": "npx",
      "args": ["-y", "@my-org/mcp-tools"]
    },
    "remote-api": {
      "type": "sse",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${MCP_API_KEY}"
      }
    }
  }
}
```

---

## 7. Permission Denial Tracking

Track all permission denials in result message:

```typescript
// packages/opencode/src/sdk/stream.ts

case 'result': {
  if (message.permission_denials?.length > 0) {
    await Session.update(sessionID, draft => {
      draft.permissionDenials = message.permission_denials.map(d => ({
        tool: d.tool_name,
        toolUseId: d.tool_use_id,
        input: d.tool_input
      }))
    })

    Bus.publish(SDK.Event.PermissionDenials, {
      sessionID,
      denials: message.permission_denials
    })
  }
  break
}

// UI: Show denied operations
function PermissionDenialsDisplay({ session }: { session: Session.Info }) {
  if (!session.permissionDenials?.length) return null

  return (
    <Alert variant="warning">
      <AlertTitle>Some operations were denied</AlertTitle>
      <ul>
        {session.permissionDenials.map((d, i) => (
          <li key={i}>{d.tool}: {summarizeInput(d.input)}</li>
        ))}
      </ul>
    </Alert>
  )
}
```

---

## 8. Model Usage Tracking (Extended)

Track additional model usage fields:

```typescript
// Extended ModelUsage (from SDK)
interface ModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number      // Track web search usage
  costUSD: number
  contextWindow: number          // Context window size used
}

// Track per-model usage in session
sdk?: {
  modelUsage: Record<string, ModelUsage>  // Per-model breakdown
}

// UI: Detailed usage breakdown
function UsageBreakdown({ session }: { session: Session.Info }) {
  const usage = session.sdk?.modelUsage
  if (!usage) return null

  return (
    <details>
      <summary>Usage by Model</summary>
      {Object.entries(usage).map(([model, stats]) => (
        <div key={model}>
          <strong>{model}</strong>
          <span>Input: {stats.inputTokens}</span>
          <span>Output: {stats.outputTokens}</span>
          <span>Cache: {stats.cacheReadInputTokens} read</span>
          {stats.webSearchRequests > 0 && (
            <span>Web searches: {stats.webSearchRequests}</span>
          )}
          <span>Cost: ${stats.costUSD.toFixed(4)}</span>
        </div>
      ))}
    </details>
  )
}
```

---

## 9. Sandbox Ignore Violations

Fine-grained control over sandbox violation handling:

```typescript
// packages/opencode/src/sdk/config.ts

interface SandboxIgnoreViolations {
  file?: string[]      // File paths to ignore violations for
  network?: string[]   // Network patterns to ignore
}

function buildSandboxConfig(config: Config): SandboxSettings {
  return {
    enabled: true,
    autoAllowBashIfSandboxed: true,

    ignoreViolations: {
      file: ['/tmp/*', '/var/tmp/*', config.paths?.temp ?? ''],
      network: config.sandbox?.allowedNetworkPatterns ?? []
    },

    enableWeakerNestedSandbox: config.sandbox?.weakerNested ?? false,

    network: {
      allowLocalBinding: true,
      allowUnixSockets: ['/var/run/docker.sock'],
      httpProxyPort: config.proxy?.http,
      socksProxyPort: config.proxy?.socks
    }
  }
}
```

---

## 10. Account Info Display

Display account information from SDK:

```typescript
// packages/opencode/src/sdk/account.ts

interface AccountInfo {
  email?: string
  organization?: string
  subscriptionType?: string    // e.g., "pro", "team", "enterprise"
  tokenSource?: string
  apiKeySource?: 'user' | 'project' | 'org' | 'temporary'
}

// Fetch on session init
Bus.subscribe(SDK.Event.Message, async (evt) => {
  if (evt.properties.message.type === 'system' &&
      evt.properties.message.subtype === 'init') {
    const query = getCurrentQuery(evt.properties.sessionID)
    const account = await query.accountInfo()

    await Session.update(evt.properties.sessionID, draft => {
      draft.account = account
    })
  }
})

// UI Component
function AccountIndicator({ session }: { session: Session.Info }) {
  const account = session.account
  if (!account) return null

  return (
    <div className="account-indicator">
      {account.organization && (
        <Badge variant="org">{account.organization}</Badge>
      )}
      <span className="tier">{account.subscriptionType}</span>
      {account.apiKeySource === 'temporary' && (
        <Badge variant="warning">Temp Key</Badge>
      )}
    </div>
  )
}
```

---

## 11. Runtime Configuration

Support different JavaScript runtimes:

```typescript
// packages/opencode/src/sdk/config.ts

interface RuntimeConfig {
  executable?: 'bun' | 'deno' | 'node'  // Default: auto-detected
  executableArgs?: string[]              // Arguments for runtime
}

function buildRuntimeConfig(config: Config): RuntimeConfig {
  return {
    executable: config.sdk?.runtime,
    executableArgs: config.sdk?.runtimeArgs ?? []
  }
}

const options: Options = {
  executable: runtimeConfig.executable,
  executableArgs: runtimeConfig.executableArgs,
}
```

---

## Priority Summary

| Feature | Category | Priority | Integration Effort |
|---------|----------|----------|-------------------|
| V2 Interface | Future | Low | Medium (when stable) |
| Query methods (account, MCP status) | UI | Medium | Low |
| `maxBudgetUsd` | Cost control | Medium | Low |
| `fallbackModel` | Reliability | Medium | Low |
| `forkSession` | Session branching | Medium | Medium |
| `resumeSessionAt` | Checkpoints | Medium | Low |
| Additional hooks (5 total) | Plugin system | Medium | Medium |
| Plugin system | Extensibility | Medium | Medium |
| SSE/HTTP MCP servers | MCP | Medium | Low |
| Permission denial tracking | UI/Audit | Medium | Low |
| Extended model usage | Analytics | Low | Low |
| Sandbox ignore violations | Security | Low | Low |
| Account info display | UI | Low | Low |
| Runtime configuration | Infrastructure | Low | Low |

**Total features**: 14 categories
**Recommended for Phase 2**: Query methods, budget limits, additional hooks, permission tracking

---

## 12. Remote Access via Tunneling

Enable remote access to local ADE instance via secure tunneling.

### Use Case
Access your local development environment from another device (phone, tablet, another laptop) while ADE runs on your main machine.

### Implementation Options

```typescript
// Option A: Built-in tunnel support
import { createTunnel } from "@/server/tunnel"

const tunnel = await createTunnel({
  provider: "cloudflare",  // or "ngrok", "tailscale"
  port: Server.url().port
})
console.log(`Remote access: ${tunnel.url}`)

// Option B: External tunnel (user configures)
// Just document how to use ngrok/cloudflare with ADE
// ngrok http 4096
```

### Architecture
```
Remote Device → Tunnel Service → Local Hono Server → SDK + Files
     ↑                                    ↓
   Web UI                          Local file system
```

### Security Considerations
- Authentication required for remote access
- API key management (don't expose in tunnel)
- Session tokens for UI auth
- Rate limiting
- Audit logging for remote sessions

### Priority: Low
This is a convenience feature. Users can already use external tunnel services manually.
