# Claude Agent SDK Migration Plan

## Executive Summary

Migrate from Vercel AI SDK to Claude Agent SDK using an **SDK-primary architecture**. The SDK becomes the core engine; opencode provides a thin conversion layer that feeds existing MessageV2/Parts.

**Philosophy**: Leverage existing infrastructure. SDK outputs convert to existing Part types - UI stays mostly unchanged.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         App (UI)                            │
│  - Renders MessageV2.Parts (unchanged)                      │
│  - Existing components work as-is                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              MessageV2 / Parts + Storage                    │
│         (existing types + storage, minimal extensions)      │
│         Source of truth for UI history display              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 SDK → Parts Conversion                      │
│          Transforms SDK stream → Parts, saves to storage    │
│                    (~80 lines)                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│     Claude SDK          │     │   Hono Server (thin)        │
│     (subprocess)        │     │                             │
│                         │     │   - PTY management          │
│  • query()              │     │   - LSP proxy               │
│  • Sessions             │     │   - File operations         │
│  • Tools (built-in)     │     │   - Config serving          │
│  • Streaming            │     │   - SDK event relay         │
│  • Internal transcripts │     │                             │
└─────────────────────────┘     └─────────────────────────────┘
```

**Key principle**: SDK feeds existing Parts system. UI unchanged. Conversion layer is the swappable boundary.

---

## Storage Model

### Why We Keep Our Storage

The SDK stores transcripts internally for Claude's context/resume, but **does not expose an API to read message history**. The SDK is designed for agents, not chat UIs.

| Storage | Purpose | Owner |
|---------|---------|-------|
| SDK transcripts | Claude's context, resume, caching | SDK (internal) |
| MessageV2/Parts | UI rendering, history display | Us (existing) |
| Session.sdk.sessionId | Link our session to SDK session for resume | Us (new field) |

This is not redundant - each serves a different purpose:
- **SDK**: "What does Claude remember?" (for LLM context)
- **Ours**: "What does the user see?" (for UI display)

### What This Means

1. When user sends a message → SDK processes → We convert stream → Save to our storage → UI renders
2. When user reopens session → Load from our storage → UI renders history
3. When user continues session → Pass `sdk.sessionId` to SDK → SDK loads its transcript → New messages convert to our storage

---

## Part 1: What We Keep

### 1.1 Keep Unchanged
| System | Location | Reason |
|--------|----------|--------|
| **MessageV2/Parts** | `src/session/message-v2.ts` | UI renders these - keep! |
| **UI Components** | `packages/app/src/components/` | Already render Parts |
| **Snapshot/Diffs** | `src/snapshot/`, `src/session/summary.ts` | Git-based diff system - reuse for UI diffs |
| ID Generation | `src/id/` | Perfect as-is |
| Config Loading | `src/config/` | Feeds SDK options |
| Project/Instance | `src/project/` | Directory scoping |
| PTY | `src/pty/` | Terminal management |
| LSP | `src/lsp/` | Language servers |
| File Operations | `src/file/` | Local file access |
| Bus Events | `src/bus/` | UI subscriptions work |
| Storage | `src/storage/` | Session persistence |

**Note on File Checkpointing vs Snapshots**: SDK has built-in file checkpointing (`enableFileCheckpointing`, `rewindFiles()`) that tracks Write/Edit/NotebookEdit. However, it doesn't track bash-made changes. We keep our git-based snapshot system for comprehensive diff display in UI, and use SDK checkpointing for file revert.

### 1.2 Extend Minimally
| Type | Extension | Purpose |
|------|-----------|---------|
| `ReasoningPart` | Add `signature?: string` | Claude thinking verification |
| `ToolPart.metadata` | Add `sandboxed?: boolean` | Track sandboxed bash |
| `MessageV2.Assistant` | Add `sdk?: { uuid, sessionId, duration }` | Link to SDK message |
| `Session.Info` | Add `sdk?: { sessionId, model, cacheStats }` | **sessionId for resume** |

### 1.3 Add New (SDK-specific)
| Type | Purpose |
|------|---------|
| `RedactedReasoningPart` | Claude's redacted thinking |

### 1.4 Remove
| System | Location | Reason |
|--------|----------|--------|
| LLM Layer | `src/session/llm.ts` | SDK replaces |
| Processor | `src/session/processor.ts` | SDK + conversion replaces |
| Transforms | `src/provider/transform.ts` | SDK handles |
| Provider SDKs | `src/provider/sdk/` | Not needed |
| Compaction | `src/session/compaction.ts` | SDK handles context management internally |

**Note on Compaction**: SDK manages context window and compaction internally. We can use the `PreCompact` hook if we need to know when compaction occurs.

---

## Part 2: SDK → Parts Conversion

### 2.1 Content Block Mapping

| SDK Block | Existing Part | Mapping |
|-----------|---------------|---------|
| `text` | `TextPart` | Direct |
| `thinking` | `ReasoningPart` | Direct + signature |
| `redacted_thinking` | `RedactedReasoningPart` | New type |
| `tool_use` | `ToolPart` (pending) | Direct |
| `tool_result` | `ToolPart` (completed) | Update existing |

### 2.2 Conversion Implementation

```typescript
// packages/opencode/src/sdk/convert.ts

import { MessageV2, Part } from "@/session/message-v2"
import type { SDKMessage, ContentBlock } from "@anthropic-ai/claude-agent-sdk"

export function sdkBlockToPart(block: ContentBlock, timestamp: number): Part {
  switch (block.type) {
    case "text":
      return {
        type: "text",
        text: block.text,
        time: { start: timestamp, end: Date.now() }
      }

    case "thinking":
      return {
        type: "reasoning",
        text: block.thinking,
        signature: block.signature,
        time: { start: timestamp, end: Date.now() }
      }

    case "redacted_thinking":
      return {
        type: "redacted-reasoning",
        data: block.data,
        time: { start: timestamp, end: Date.now() }
      }

    case "tool_use":
      return {
        type: "tool",
        callID: block.id,
        tool: block.name.toLowerCase(),
        state: {
          status: "pending",
          input: normalizeToolInput(block.input),
          raw: JSON.stringify(block.input)
        },
        time: { start: timestamp }
      }

    case "tool_result":
      // Tool results update existing ToolPart - handled separately
      return null
  }
}

export function sdkMessageToMessageV2(
  sdk: SDKAssistantMessage,
  sessionID: string
): MessageV2.Assistant {
  const timestamp = Date.now()

  return {
    id: Identifier.ascending("message"),
    sessionID,
    role: "assistant",
    parts: sdk.message.content
      .map(block => sdkBlockToPart(block, timestamp))
      .filter(Boolean),
    sdk: {
      uuid: sdk.uuid,
      sessionId: sdk.session_id,
      parentToolUseId: sdk.parent_tool_use_id
    }
  }
}

export function sdkResultToTokens(result: SDKResultMessage): MessageV2.Tokens {
  return {
    input: result.usage.input_tokens,
    output: result.usage.output_tokens,
    reasoning: 0,  // Calculated from thinking parts
    cache: {
      read: result.usage.cache_read_input_tokens ?? 0,
      write: result.usage.cache_creation_input_tokens ?? 0
    }
  }
}
```

### 2.3 Stream Processing

```typescript
// packages/opencode/src/sdk/stream.ts

export async function processSDKStream(
  stream: AsyncGenerator<SDKMessage>,
  sessionID: string
): Promise<void> {
  let currentMessageID: string | null = null
  let currentParts: Map<number, Part> = new Map()
  let initialSnapshot: string | undefined

  for await (const message of stream) {
    switch (message.type) {
      case "system": {
        if (message.subtype === "init") {
          // Capture initial snapshot for diff computation
          initialSnapshot = await Snapshot.track()

          await Session.update(sessionID, draft => {
            draft.sdk = {
              sessionId: message.session_id,
              model: message.model,
              tools: message.tools
            }
          })
        }
        break
      }

      case "assistant": {
        const msg = sdkMessageToMessageV2(message, sessionID)
        currentMessageID = msg.id

        // Add StepStartPart with initial snapshot
        if (initialSnapshot && msg.parts.length === 0) {
          await Session.updatePart({
            id: Identifier.ascending("part"),
            messageID: msg.id,
            sessionID,
            type: "step-start",
            snapshot: initialSnapshot,
          })
        }

        // Handle TodoWrite tool calls
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            await handleTodoWrite(sessionID, block)
          }
        }

        await MessageV2.save(msg)
        Bus.publish(MessageV2.Event.Updated, { message: msg })
        break
      }

      case "stream_event": {
        await handleStreamDelta(message.event, currentMessageID, currentParts)
        break
      }

      case "user": {
        // Tool results come as user messages with tool_result content
        for (const block of message.message.content) {
          if (block.type === "tool_result") {
            // Update the corresponding ToolPart
            await updateToolPartResult(sessionID, block)
          }
        }
        break
      }

      case "result": {
        if (currentMessageID) {
          // Finalize message
          await MessageV2.update(currentMessageID, draft => {
            draft.tokens = sdkResultToTokens(message)
            draft.cost = message.total_cost_usd
          })

          // Compute diffs using existing snapshot system
          if (initialSnapshot) {
            await finalizeDiffs(sessionID, currentMessageID, initialSnapshot)
          }

          Bus.publish(MessageV2.Event.Completed, { messageID: currentMessageID })
        }
        break
      }
    }
  }
}

// Handle TodoWrite tool calls - convert to opencode format
async function handleTodoWrite(sessionID: string, block: ToolUseBlock) {
  if (block.name !== "TodoWrite") return

  const sdkTodos = block.input.todos as Array<{
    content: string
    status: "pending" | "in_progress" | "completed"
    activeForm?: string
  }>

  // Convert SDK format to opencode format
  const todos: Todo.Info[] = sdkTodos.map((t, i) => ({
    id: `todo-${i}`,
    content: t.content,
    status: t.status,
    priority: "medium",  // SDK doesn't have priority
    activeForm: t.activeForm,
  }))

  // Persist and publish event (existing system)
  await Todo.update({ sessionID, todos })
}

// Update ToolPart when tool completes
async function updateToolPartResult(sessionID: string, block: ToolResultBlock) {
  // Find the ToolPart by tool_use_id
  const part = await findToolPartByCallID(sessionID, block.tool_use_id)
  if (!part) return

  part.state.status = block.is_error ? "error" : "completed"
  part.state.output = typeof block.content === "string"
    ? block.content
    : JSON.stringify(block.content)
  part.time.end = Date.now()

  await Session.updatePart(part)
  Bus.publish(Part.Event.Updated, { part })
}

// Reuses existing Snapshot + SessionSummary infrastructure
async function finalizeDiffs(sessionID: string, messageID: string, initialSnapshot: string) {
  const finalSnapshot = await Snapshot.track()

  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID,
    sessionID,
    type: "step-finish",
    snapshot: finalSnapshot,
  })

  const patch = await Snapshot.patch(initialSnapshot)
  if (patch.files.length) {
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID,
      sessionID,
      type: "patch",
      hash: patch.hash,
      files: patch.files,
    })
  }

  // Triggers diff computation, storage, and Bus event - all existing code
  SessionSummary.summarize({ sessionID, messageID })
}
```

async function handleStreamDelta(
  event: RawMessageStreamEvent,
  messageID: string | null,
  parts: Map<number, Part>
): Promise<void> {
  if (!messageID) return
  if (event.type !== "content_block_delta") return

  const { index, delta } = event

  if (delta.type === "text_delta") {
    // Update TextPart with delta
    Bus.publish(Part.Event.Delta, {
      messageID,
      index,
      delta: delta.text,
      type: "text"
    })
  }

  if (delta.type === "thinking_delta") {
    // Update ReasoningPart with delta
    Bus.publish(Part.Event.Delta, {
      messageID,
      index,
      delta: delta.thinking,
      type: "reasoning"
    })
  }

  if (delta.type === "input_json_delta") {
    // Update ToolPart.state.raw with delta
    Bus.publish(Part.Event.Delta, {
      messageID,
      index,
      delta: delta.partial_json,
      type: "tool-input"
    })
  }
}
```

---

## Part 3: Part Type Extensions

### 3.1 Update ReasoningPart

```typescript
// packages/opencode/src/session/message-v2.ts

export const ReasoningPart = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
  signature: z.string().optional(),  // NEW: Claude thinking signature
  time: TimeRange,
  metadata: z.record(z.any()).optional(),
})
```

### 3.2 Add RedactedReasoningPart

```typescript
// packages/opencode/src/session/message-v2.ts

export const RedactedReasoningPart = z.object({
  type: z.literal("redacted-reasoning"),
  data: z.string(),  // Encrypted thinking content
  time: TimeRange,
})

// Add to Part union
export const Part = z.discriminatedUnion("type", [
  TextPart,
  ReasoningPart,
  RedactedReasoningPart,  // NEW
  ToolPart,
  FilePart,
  // ... rest unchanged
])
```

### 3.3 Extend ToolPart Metadata

```typescript
// packages/opencode/src/session/message-v2.ts

export const ToolMetadata = z.object({
  // ... existing fields
  sandboxed: z.boolean().optional(),       // NEW: Was bash sandboxed?
  sandboxViolations: z.array(z.string()).optional(),  // NEW
}).passthrough()
```

### 3.4 Extend MessageV2.Assistant

```typescript
// packages/opencode/src/session/message-v2.ts

export const Assistant = z.object({
  // ... existing fields
  sdk: z.object({
    uuid: z.string(),
    sessionId: z.string(),
    parentToolUseId: z.string().optional(),
    duration: z.object({
      total: z.number(),
      api: z.number()
    }).optional()
  }).optional()  // NEW
})
```

### 3.5 Extend Todo.Info

```typescript
// packages/opencode/src/session/todo.ts

export const Info = z.object({
  content: z.string(),
  status: z.string(),
  priority: z.string(),
  id: z.string(),
  activeForm: z.string().optional(),  // NEW: SDK's "in progress" display text
})
```

SDK sends `activeForm` (e.g., "Running tests") shown when status is `in_progress`. We add this field for parity.

### 3.6 Extend Session.Info

```typescript
// packages/opencode/src/session/index.ts

export const Info = z.object({
  // ... existing fields
  sdk: z.object({
    sessionId: z.string(),        // CRITICAL: SDK session ID for resume
    model: z.string(),            // Current model
    tools: z.array(z.string()),   // Available tools
    cacheStats: z.object({
      read: z.number(),
      write: z.number()
    }).optional()
  }).optional()  // NEW
})
```

**Important**: `sdk.sessionId` is stored when we receive the `init` system message from SDK. This ID is passed back to SDK via `resume` option when continuing a session.

---

## Part 4: UI Updates (Minimal)

### 4.1 Add RedactedReasoningPart Renderer

```typescript
// packages/app/src/components/parts/redacted-reasoning.tsx

export function RedactedReasoningPart(props: { part: RedactedReasoningPart }) {
  return (
    <div class="redacted-reasoning">
      <Icon name="lock" />
      <span>Thinking redacted for safety</span>
      <Tooltip>
        Claude's reasoning was flagged by safety systems.
        The model can still use this reasoning internally.
      </Tooltip>
    </div>
  )
}
```

### 4.2 Update Part Renderer Switch

```typescript
// packages/app/src/components/parts/index.tsx

// Add one case to existing switch
case "redacted-reasoning":
  return <RedactedReasoningPart part={part} />
```

### 4.3 Update ReasoningPart Renderer (Optional Enhancement)

```typescript
// packages/app/src/components/parts/reasoning.tsx

export function ReasoningPart(props: { part: ReasoningPart }) {
  return (
    <div class="reasoning">
      <button onClick={toggleExpand}>
        <Icon name="brain" />
        Thinking
        {props.part.signature && <Icon name="verified" title="Verified" />}
      </button>
      <Show when={expanded()}>
        <Markdown>{props.part.text}</Markdown>
      </Show>
    </div>
  )
}
```

### 4.4 Add Cache Stats Display (Optional Enhancement)

```typescript
// packages/app/src/components/session/cache-stats.tsx

export function CacheStats(props: { session: Session.Info }) {
  const stats = props.session.sdk?.cacheStats
  if (!stats) return null

  const hitRate = stats.read / (stats.read + stats.write) * 100

  return (
    <div class="cache-stats">
      <span>Cache: {hitRate.toFixed(0)}% hit</span>
    </div>
  )
}
```

---

## Part 5: SDK Integration

### 5.1 Core SDK Module

```typescript
// packages/opencode/src/sdk/index.ts

import { query, type Query, type Options } from "@anthropic-ai/claude-agent-sdk"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { processSDKStream } from "./stream"

export namespace SDK {
  let activeQuery: Query | null = null

  export async function start(input: {
    prompt: string
    sessionID: string
  }): Promise<void> {
    const config = await Config.get()
    const session = await Session.get(input.sessionID)

    const options: Options = {
      model: config.model?.default ?? "claude-sonnet-4-5-20250929",
      cwd: Instance.directory,
      tools: { type: "preset", preset: "claude_code" },
      mcpServers: await getMcpServers(),
      agents: await getSDKAgents(),
      maxThinkingTokens: config.thinking?.budget ?? 10000,
      enableFileCheckpointing: true,
      permissionMode: config.permissions?.mode ?? "default",
      canUseTool: createPermissionHandler(input.sessionID),
      // Resume using stored SDK session ID (if exists)
      resume: session.sdk?.sessionId,
      // System prompt with custom instructions
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: await getCustomInstructions(input.sessionID),
      },
      settingSources: ["project"],  // Load CLAUDE.md
    }

    activeQuery = query({ prompt, options })

    // Process stream and convert to Parts
    // This will also capture sdk.sessionId on first init message
    await processSDKStream(activeQuery, input.sessionID)
  }

  export function interrupt() {
    activeQuery?.interrupt()
  }

  export async function rewind(messageUuid: string) {
    await activeQuery?.rewindFiles(messageUuid)
  }

  export async function setModel(model: string) {
    await activeQuery?.setModel(model)
  }
}

// Get custom instructions to append to system prompt
async function getCustomInstructions(sessionID: string): Promise<string> {
  const session = await Session.get(sessionID)
  const agent = await Agent.get(session.agent ?? "build")

  const parts: string[] = []
  if (agent?.prompt) parts.push(agent.prompt)

  // Add user's custom instructions from config if present
  const config = await Config.get()
  if (config.instructions) parts.push(config.instructions)

  return parts.join("\n\n")
}
```

### 5.2 Permission Handler

```typescript
// packages/opencode/src/sdk/permissions.ts

export function createPermissionHandler(sessionID: string): CanUseTool {
  return async (toolName, input, { signal }) => {
    // Use existing PermissionNext system
    const result = await PermissionNext.check({
      sessionID,
      tool: toolName,
      input
    })

    if (result.allowed) {
      return { behavior: "allow" }
    }

    if (result.denied) {
      return { behavior: "deny", message: result.reason }
    }

    // Ask user - use existing permission UI
    const userResult = await PermissionNext.ask({
      sessionID,
      tool: toolName,
      input,
      signal
    })

    return userResult.allowed
      ? { behavior: "allow" }
      : { behavior: "deny", message: "User denied" }
  }
}
```

### 5.3 Command Handling

Opencode commands (`/init`, `/review`, config-based) are expanded and sent as prompts. SDK built-in commands (`/compact`, `/clear`, `/help`) pass through to SDK.

```typescript
// packages/opencode/src/sdk/commands.ts

import { Command } from "@/command"
import { ConfigMarkdown } from "@/config/markdown"
import { $ } from "bun"

export async function expandCommand(input: string): Promise<{
  isOurs: boolean
  prompt: string
  command?: Command.Info
}> {
  if (!input.startsWith("/")) {
    return { isOurs: false, prompt: input }
  }

  const [name, ...rest] = input.slice(1).split(" ")
  const args = rest.join(" ")
  const command = await Command.get(name)

  if (!command) {
    // Not our command - pass through to SDK (could be /compact, /clear, etc.)
    return { isOurs: false, prompt: input }
  }

  // Expand template with arguments
  let template = await command.template
  const argsArray = args.match(/(?:\[Image\s+\d+\]|"[^"]*"|'[^']*'|[^\s"']+)/gi) ?? []

  // Replace $1, $2, etc.
  template = template.replace(/\$(\d+)/g, (_, index) => {
    const i = Number(index) - 1
    return i < argsArray.length ? argsArray[i] : ""
  })
  template = template.replace(/\$ARGUMENTS/g, args)

  // Execute bash commands in template (!`...`)
  const shell = ConfigMarkdown.shell(template)
  if (shell.length > 0) {
    const results = await Promise.all(
      shell.map(async ([, cmd]) => {
        try {
          return await $`${{ raw: cmd }}`.quiet().nothrow().text()
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      })
    )
    let i = 0
    template = template.replace(/!`([^`]+)`/g, () => results[i++])
  }

  return { isOurs: true, prompt: template.trim(), command }
}
```

Integration in `SDK.start()`:

```typescript
// packages/opencode/src/sdk/index.ts

export async function start(input: {
  prompt: string
  sessionID: string
  messageID?: string  // Optimistic message ID from UI
  variant?: string    // Thinking effort level
}) {
  const { isOurs, prompt, command } = await expandCommand(input.prompt)

  // Use command's agent/model if specified
  const agent = command?.agent
  const model = command?.model ?? config.model?.default

  // Create optimistic user message BEFORE SDK call
  if (input.messageID) {
    await MessageV2.save({
      id: input.messageID,
      role: "user",
      sessionID: input.sessionID,
      time: { created: Date.now() },
      // ... other user message fields
    })
    Bus.publish(MessageV2.Event.Updated, { messageID: input.messageID })
  }

  const options: Options = {
    model,
    // Map variant to SDK thinking budget
    maxThinkingTokens: variantToThinkingBudget(input.variant),
    // ... rest of options
  }

  activeQuery = query({ prompt, options })
  await processSDKStream(activeQuery, input.sessionID)
}

// Map UI variant to SDK thinking budget
function variantToThinkingBudget(variant?: string): number {
  switch (variant) {
    case "low": return 5000
    case "medium": return 10000
    case "high": return 50000
    default: return 10000
  }
}
```

| Command Type | Handling |
|--------------|----------|
| Opencode (`/init`, `/review`, config) | Expand template → send as prompt |
| SDK built-in (`/compact`, `/clear`) | Pass through to SDK |
| `.claude/commands/` files | SDK handles natively |

### 5.4 Agent/Subagent Mapping

Opencode has a full agent system (`src/agent/agent.ts`) with built-in agents like `general`, `explore`. These map to SDK's `agents` option.

```typescript
// packages/opencode/src/sdk/agents.ts

import { Agent } from "@/agent/agent"
import { PermissionNext } from "@/permission/next"
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk"

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
      model: mapModel(agent.model?.modelID)
    }
  }

  return result
}

// Extract tool names where action is "allow"
function extractAllowedTools(ruleset: PermissionNext.Ruleset): string[] | undefined {
  const allowed: Set<string> = new Set()
  let hasWildcardAllow = false

  for (const rule of ruleset) {
    if (rule.permission === "*" && rule.action === "allow") {
      hasWildcardAllow = true
    }
    if (rule.action === "allow" && rule.permission !== "*") {
      allowed.add(capitalize(rule.permission)) // "grep" → "Grep"
    }
  }

  // undefined = inherit all tools from parent
  if (hasWildcardAllow) return undefined
  return allowed.size > 0 ? [...allowed] : []
}

function mapModel(modelID?: string): "sonnet" | "opus" | "haiku" | undefined {
  if (!modelID) return undefined
  if (modelID.includes("opus")) return "opus"
  if (modelID.includes("haiku")) return "haiku"
  return "sonnet"
}
```

Integration in SDK options:

```typescript
const options: Options = {
  // ...
  agents: await getSDKAgents(),
  allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Task", /*...*/]
}
```

| Opencode Agent | SDK AgentDefinition |
|----------------|---------------------|
| `name` | Key in `agents` object |
| `description` | `description` |
| `prompt` | `prompt` |
| `permission` (ruleset) | `tools` (array of allowed) |
| `model` | `model` (`"sonnet"`, `"opus"`, `"haiku"`) |
| `mode: "subagent"` | Included in agents |

### 5.5 Permission Bridge

SDK permissions work differently from opencode's granular ruleset. We bridge them via `canUseTool` callback.

```typescript
// packages/opencode/src/sdk/permissions.ts (extended)

import { PermissionNext } from "@/permission/next"

// Bridge opencode permissions to SDK's canUseTool callback
export function createPermissionHandler(sessionID: string) {
  return async (toolName: string, toolInput: unknown): Promise<{ allowed: boolean }> => {
    const session = await Session.get(sessionID)
    const agent = await Agent.get(session.agent ?? "build")

    // Evaluate against opencode's permission ruleset
    const result = PermissionNext.evaluate(
      toolName.toLowerCase(),
      extractPattern(toolName, toolInput),
      agent.permission
    )

    if (result.action === "allow") return { allowed: true }
    if (result.action === "deny") return { allowed: false }

    // "ask" - publish event for UI to handle
    return new Promise((resolve) => {
      Bus.publish(Permission.Event.Request, {
        sessionID,
        toolName,
        toolInput,
        resolve: (allowed: boolean) => resolve({ allowed })
      })
    })
  }
}

// Extract pattern from tool input for pattern-based rules (e.g., "*.env")
function extractPattern(toolName: string, input: unknown): string {
  if (toolName === "Read" || toolName === "Edit" || toolName === "Write") {
    return (input as { file_path?: string })?.file_path ?? "*"
  }
  return "*"
}
```

| Opencode Permission | SDK Equivalent |
|--------------------|----------------|
| `action: "allow"` | Tool in `tools` array / `{ allowed: true }` |
| `action: "deny"` | Tool NOT in array / `{ allowed: false }` |
| `action: "ask"` | `canUseTool` callback prompts user |
| Pattern rules (`"*.env"`) | Handle in `canUseTool` via `extractPattern` |

### 5.6 Session Revert (Option A: Keep Both Systems)

Opencode has message-level revert (remove messages from history). SDK has file-level revert (`rewindFiles`). We keep both:

```typescript
// packages/opencode/src/sdk/revert.ts

import { SessionRevert } from "@/session/revert"
import { SDK } from "./index"

// Revert combines message removal (ours) + file rewind (SDK)
export async function revert(input: {
  sessionID: string
  messageID: string
  rewindFiles?: boolean  // Also revert file state
}) {
  // 1. Get SDK message UUID before removing
  const message = await MessageV2.get({
    sessionID: input.sessionID,
    messageID: input.messageID
  })
  const sdkUuid = message.info.sdk?.uuid

  // 2. Remove messages from OUR storage (hides from UI)
  await SessionRevert.revert({
    sessionID: input.sessionID,
    messageID: input.messageID
  })

  // 3. Optionally rewind files to that checkpoint
  if (input.rewindFiles && sdkUuid) {
    await SDK.rewindFiles(input.sessionID, sdkUuid)
  }

  // Note: SDK session still has full history internally
  // AI "remembers" but UI doesn't show reverted messages
}

// Unrevert restores messages to our storage
export async function unrevert(sessionID: string) {
  await SessionRevert.unrevert({ sessionID })
}
```

**Trade-off**: AI remembers reverted content, but UI hides it. This is acceptable because:
- User sees clean message history
- File state can be correctly reverted via SDK
- AI memory can actually be helpful for context
- Simpler than alternatives (new session, etc.)

| Operation | What Happens |
|-----------|--------------|
| Revert message | Removed from our storage, hidden from UI, SDK still has it |
| Revert files | SDK `rewindFiles()` restores file state to checkpoint |
| Continue after revert | SDK has full context, UI shows truncated history |
| Unrevert | Restores messages to our storage, visible in UI again |

### 5.7 MCP Server Configuration

```typescript
// packages/opencode/src/sdk/mcp.ts

import { Config } from "@/config/config"
import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk"

// Convert opencode MCP config to SDK format
export async function getMcpServers(): Promise<Record<string, McpServerConfig>> {
  const config = await Config.get()
  const mcpConfig = config.mcp ?? {}

  const result: Record<string, McpServerConfig> = {}

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
        env: mcp.environment
      }
    }

    if (mcp.type === "remote") {
      // opencode: { type: "remote", url: "...", headers: {} }
      // SDK: { type: "sse", url: "...", headers: {} }
      // Note: SDK doesn't support OAuth for MCP - tokens must be in headers
      result[name] = {
        type: "sse",
        url: mcp.url,
        headers: mcp.headers
      }
    }
  }

  return result
}
```

### 5.4 Custom Tools (SDK MCP Server)

```typescript
// packages/opencode/src/sdk/custom-tools.ts

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"

// Only tools NOT built into SDK
const lsp = tool("lsp", "Language server operations", {
  operation: z.enum(["definition", "references", "hover", "symbols"]),
  file: z.string(),
  line: z.number(),
  character: z.number()
}, async (args) => {
  const result = await LSP.execute(args)
  return { content: [{ type: "text", text: JSON.stringify(result) }] }
})

export const customTools = createSdkMcpServer({
  name: "ade-tools",
  version: "1.0.0",
  tools: [lsp]
})
```

---

## Part 6: Server Updates

### 6.1 Add SDK Routes

```typescript
// packages/opencode/src/server/server.ts

// Add to existing Hono app

app.post("/sdk/start", async (c) => {
  const { prompt, sessionID, resume } = await c.req.json()

  // Start in background, stream via existing Bus/SSE
  SDK.start({ prompt, sessionID, resume })
    .catch(err => Bus.publish(Session.Event.Error, { sessionID, error: err }))

  return c.json({ ok: true })
})

app.post("/sdk/interrupt", (c) => {
  SDK.interrupt()
  return c.json({ ok: true })
})

app.post("/sdk/rewind", async (c) => {
  const { messageUuid } = await c.req.json()
  await SDK.rewind(messageUuid)
  return c.json({ ok: true })
})

app.post("/sdk/model", async (c) => {
  const { model } = await c.req.json()
  await SDK.setModel(model)
  return c.json({ ok: true })
})
```

### 6.2 Existing Event Stream Works

The existing SSE event stream already publishes MessageV2 events. Since we're converting SDK → MessageV2, the UI subscriptions work unchanged:

```typescript
// Existing - works as-is
Bus.publish(MessageV2.Event.Updated, { message })
Bus.publish(Part.Event.Delta, { messageID, delta })
```

---

## Part 7: Model Selection

### 7.1 Static Model List

```typescript
// packages/opencode/src/sdk/models.ts

export const CLAUDE_MODELS = {
  "claude-sonnet-4-5-20250929": {
    name: "Claude Sonnet 4.5",
    cost: { input: 3.0, output: 15.0 },
    context: 200000,
    features: ["thinking", "1m-context", "vision"]
  },
  "claude-sonnet-4-20250514": {
    name: "Claude Sonnet 4",
    cost: { input: 3.0, output: 15.0 },
    context: 200000,
    features: ["thinking", "1m-context", "vision"]
  },
  "claude-opus-4-5-20251101": {
    name: "Claude Opus 4.5",
    cost: { input: 15.0, output: 75.0 },
    context: 200000,
    features: ["thinking", "vision"]
  },
  "claude-haiku-4-5-20251001": {
    name: "Claude Haiku 4.5",
    cost: { input: 0.80, output: 4.0 },
    context: 200000,
    features: ["thinking", "vision"]
  }
} as const
```

### 7.2 Provider Simplification

```typescript
// packages/opencode/src/provider/provider.ts (simplified)

export namespace Provider {
  export function list() {
    return [{
      id: "anthropic",
      name: "Anthropic",
      models: CLAUDE_MODELS
    }]
  }

  export function getModel(modelID: string) {
    return CLAUDE_MODELS[modelID]
  }
}
```

---

## Part 8: Migration Steps

### Phase 1: Foundation
- [x] Create `src/sdk/index.ts` - SDK wrapper + system prompt handling
- [x] Create `src/sdk/convert.ts` - SDK → Parts conversion
- [x] Create `src/sdk/stream.ts` - Stream processing + tool result + todo handling
- [x] Create `src/sdk/models.ts` - Static model list
- [x] Create `src/sdk/permissions.ts` - Permission bridge + canUseTool
- [x] Create `src/sdk/agents.ts` - Agent/subagent mapping to SDK format
- [x] Create `src/sdk/commands.ts` - Command expansion (opencode → SDK)
- [x] Create `src/sdk/revert.ts` - Session revert bridge (message + file)
- [x] Create `src/sdk/mcp.ts` - MCP config conversion
- [x] Create `src/sdk/custom-tools.ts` - Custom tools (LSP, etc.)
- [x] Create `src/server/sdk-routes.ts` - SDK REST API routes
- [x] Install `@anthropic-ai/claude-agent-sdk` package
- [x] Integrate real SDK `query()` call

### Phase 2: Type Extensions
- [x] Add `signature` to ReasoningPart
- [x] Add `RedactedReasoningPart` to Part union
- [ ] Add `sandboxed` to ToolPart.metadata (optional)
- [x] Add `sdk` fields to MessageV2.Assistant
- [x] Add `sdk` fields to Session.Info

### Phase 3: Server Updates
- [x] Add SDK routes to Hono server
- [x] Wire SDK events to existing Bus

### Phase 4: UI Updates (Minimal)
- [x] Add RedactedReasoningPart renderer
- [x] Add case to Part renderer switch
- [ ] Optional: Add signature badge to ReasoningPart
- [ ] Optional: Add cache stats display

### Phase 5: Cleanup - COMPLETED
- [x] Remove `src/session/llm.ts` - DELETED
- [x] Remove `src/session/processor.ts` - DELETED
- [x] Remove `src/session/compaction.ts` - DELETED
- [x] Remove `src/session/prompt.ts` - DELETED (SessionPrompt replaced by SDK)
- [x] Remove `src/provider/transform.ts` - DELETED
- [x] Remove `src/provider/sdk/` (21 providers) - DELETED
- [x] Simplify `src/provider/provider.ts` - removed sdk/ imports, inlined Claude variants
- [x] Update all routes to use SDK.start() instead of SessionPrompt.prompt()
- [x] Update tool/task.ts to use SDK
- [x] Update cli/cmd/github.ts to use SDK
- [x] Update session/revert.ts to use SDK.isActive()
- [x] Update session/summary.ts - removed LLM dependency (title generation disabled for now)

**All old code paths removed. SDK is now the single code path.**

---

## Part 9: Files Summary

### New Files (11)
```
packages/opencode/src/sdk/
├── index.ts          # SDK wrapper (~270 lines)
├── convert.ts        # SDK → Parts (~190 lines)
├── stream.ts         # Stream processing (~340 lines)
├── models.ts         # Model definitions (~90 lines)
├── permissions.ts    # Permission bridge (~110 lines)
├── agents.ts         # Agent/subagent mapping (~65 lines)
├── commands.ts       # Command expansion (~85 lines)
├── revert.ts         # Session revert bridge (~130 lines)
├── mcp.ts            # MCP config conversion (~65 lines)
├── custom-tools.ts   # Custom tools (~110 lines)
└── (server/sdk-routes.ts) # SDK REST API routes (~55 lines)
```

**Total new: ~1600 lines** (actual implementation more comprehensive than initial estimate)

### Modified Files
| File | Change |
|------|--------|
| `src/session/message-v2.ts` | Add RedactedReasoningPart + signature field |
| `src/session/index.ts` | Add sdk field to Session.Info |
| `src/server/server.ts` | Mount SDK routes |
| `src/provider/provider.ts` | Removed sdk/ import |
| `packages/ui/src/components/message-part.tsx` | Add RedactedReasoningPart renderer |

### Removed Files
| File | Lines Removed |
|------|---------------|
| `src/session/llm.ts` | ~300 |
| `src/session/processor.ts` | ~800 |
| `src/session/compaction.ts` | ~225 |
| `src/session/prompt.ts` | ~1500 |
| `src/provider/transform.ts` | ~650 |
| `src/provider/sdk/*` | ~2000+ (16 files) |
| Test files for removed modules | ~200 |

**Total removed: ~5675 lines**

### Net Change
**Add ~1600 lines, remove ~5675 lines = -4075 lines**

---

## Part 10: Benefits

### SDK Features Gained
| Feature | Benefit |
|---------|---------|
| Native prompt caching | 90% cost reduction on cache hits |
| 1-hour cache TTL | Longer session efficiency |
| Extended thinking | Built-in, configurable budget |
| Interleaved thinking | Think between tool calls |
| Sandboxed bash | Security without complexity |
| File checkpointing | Native undo via `rewindFiles()` |
| 1M context beta | 5x context for Sonnet 4/4.5 |

### Architecture Benefits
| Benefit | How |
|---------|-----|
| UI unchanged | Existing Part renderers work |
| Events unchanged | Bus publishes same events |
| Storage unchanged | MessageV2 still persisted |
| Swappable | Conversion layer is the boundary |
| Single code path | All old LLM/processor code removed |
| Much less code | -4075 lines net |

---

## Summary

**Status**: ✅ Migration Complete - SDK is now the single code path

**Approach**: SDK → Conversion → Existing Parts/Storage → Existing UI

**Key insight**: Most SDK outputs already map to existing Part types. We implemented:
1. A conversion layer (~190 lines in convert.ts)
2. A stream processor (~340 lines in stream.ts)
3. One new Part type (RedactedReasoningPart)
4. SDK fields on existing types (MessageV2.Assistant, Session.Info)
5. Store SDK session ID for resume

**Storage model**:
- SDK stores transcripts for Claude's context (internal, not accessible)
- We store MessageV2/Parts for UI rendering (existing system)
- We store `sdk.sessionId` to link sessions for resume
- Not redundant: SDK storage is for LLM, ours is for UI

**What stays the same**:
- MessageV2/Parts type system
- UI components that render Parts
- Bus event subscriptions
- Storage/persistence
- Permission UI flow

**What changed**:
- All routes now use SDK.start() instead of SessionPrompt.prompt()
- SDK replaces Vercel AI SDK as the LLM engine
- Conversion layer maps SDK stream → Parts and saves to storage
- Removed ~5675 lines of old code (llm.ts, processor.ts, prompt.ts, compaction.ts, transform.ts, provider/sdk/)
- Added ~1600 lines of new SDK integration code
- **Net reduction: ~4075 lines**

**Swappability**: The conversion layer (`src/sdk/convert.ts`) is the boundary. If we ever need to swap SDK, only this layer changes - UI and storage remain untouched.

**The result**: Full Claude SDK integration. Single code path, significantly less code.
