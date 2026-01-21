# SDK Features: What We Have vs What We're Missing

Based on thorough research of the Claude Agent SDK documentation (January 2026) and our codebase.

---

## FULLY IMPLEMENTED

| Feature                        | Our Implementation                              |
| ------------------------------ | ----------------------------------------------- |
| **Core SDK Integration**       | `query()` with streaming, session management    |
| **Permission Handling**        | `canUseTool` callback with approval flows       |
| **Streaming Input**            | Full `AsyncIterable<SDKUserMessage>` support    |
| **Session Resume**             | `resume: sessionId` working                     |
| **Resume at Specific Message** | `resumeSessionAt` via revert system             |
| **Session Forking**            | `forkSession: true` via fork dialog             |
| **Settings Sources Control**   | `settingSources: ["project"]` - loads CLAUDE.md |
| **MCP Servers**                | Both stdio and SSE transports                   |
| **Custom Tools**               | LSP tool via SDK MCP server pattern             |
| **Subagents**                  | Child sessions, parent tracking, tool summaries |
| **Cost Tracking**              | `total_cost_usd`, per-message tokens            |
| **Todo Lists**                 | `TodoWrite` tool handling                       |
| **File Checkpointing**         | `enableFileCheckpointing`, `rewindFiles()`      |
| **Hooks**                      | Plugin system with event triggers               |
| **Model Selection**            | Dynamic model switching mid-session             |

---

## PARTIALLY IMPLEMENTED / COULD IMPROVE

| Feature                | What We Have              | What SDK Offers                                                                                                               |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Structured Outputs** | Basic tool result parsing | Full JSON Schema validation with `outputFormat: { type: 'json_schema', schema }` - guarantees valid JSON matching your schema |
| **Per-Model Usage**    | `total_cost_usd` only     | `modelUsage` breakdown per model (useful when mixing Haiku subagents with Opus main)                                          |
| **Hook Types**         | Plugin events             | SDK has 12+ hook types including `PermissionRequest`, `SessionStart/End`, `Notification`, `PreCompact`                        |
| **System Prompts**     | Custom prompts            | SDK preset: `{ type: 'preset', preset: 'claude_code', append: '...' }` to extend Claude Code's prompt                         |

---

## NOT IMPLEMENTED - OPPORTUNITIES

### 1. Budget Limits (`maxBudgetUsd`)

```typescript
options: {
  maxBudgetUsd: 5.0 // Hard stop at $5
}
```

**Use case**: Prevent runaway costs, especially for hosted/multi-tenant scenarios.

### 2. Fallback Model (`fallbackModel`)

```typescript
options: {
  model: 'claude-opus-4-5-20251101',
  fallbackModel: 'claude-sonnet-4-5-20250929'
}
```

**Use case**: Graceful degradation if primary model unavailable.

### 3. Max Turns Limit (`maxTurns`)

```typescript
options: {
  maxTurns: 10 // Prevent infinite loops
}
```

**Use case**: Guardrail against agent getting stuck.

### 4. Sandbox Configuration (programmatic)

```typescript
options: {
  sandbox: {
    enabled: true,
    autoAllowBashIfSandboxed: true,
    network: { allowLocalBinding: true },
    excludedCommands: ['docker']
  }
}
```

**Use case**: Security hardening without external sandbox-runtime.

### 5. CLAUDE.md Loading

```typescript
options: {
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  settingSources: ['project']  // Required to load CLAUDE.md
}
```

**Use case**: We're not loading CLAUDE.md files from projects - this is likely missing.

### 6. SDK Plugins (`plugins`)

```typescript
options: {
  plugins: [{ type: "local", path: "./my-plugin" }]
}
```

**Use case**: Load Claude Code-style plugins with commands, agents, skills, hooks.

### 7. Context Beta Flag (`betas`)

```typescript
options: {
  betas: ["context-1m-2025-08-07"] // 1M token context
}
```

**Use case**: Enable extended context window for large codebases.

### 8. Query Helper Methods

```typescript
const q = query({ prompt, options })
await q.setMaxThinkingTokens(50000) // We have setModel, not this
await q.mcpServerStatus() // MCP health check
await q.accountInfo() // Account details
await q.supportedCommands() // Slash commands
```

### 9. Notification Hook (TypeScript SDK only)

```typescript
hooks: {
  Notification: [
    {
      hooks: [
        async (input) => {
          // Send to Slack/PagerDuty when agent needs attention
          await sendSlackMessage(input.message)
          return {}
        },
      ],
    },
  ]
}
```

**Use case**: External alerting when agent is idle/waiting.

---

## PRIORITY RECOMMENDATIONS

### High Value, Low Effort

1. **`maxTurns`** - Simple guardrail, prevents infinite loops
2. **`maxBudgetUsd`** - Cost protection
3. **Per-model usage tracking** - Better cost visibility

### High Value, Medium Effort

4. **Structured Outputs** - Reliable JSON for automation workflows

### Future Consideration

5. **Sandbox settings** - If we want programmatic sandbox control
6. **Plugins** - If we want Claude Code plugin compatibility
7. **1M context beta** - For large codebase support

---

## Key Documentation Insights

1. **Hooks have a 60-second timeout** - callbacks must return quickly
2. **`canUseTool` requires streaming input mode** in Python (we use TypeScript)
3. **Subagents cannot spawn their own subagents** - no Task tool in subagent tools
4. **File checkpointing only tracks Write/Edit/NotebookEdit** - not Bash file operations
5. **`AskUserQuestion` not available in subagents** - limitation to be aware of

---

## SDK Documentation Sources

- [TypeScript SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [File Checkpointing](https://platform.claude.com/docs/en/agent-sdk/file-checkpointing)
- [Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
- [Hosting the Agent SDK](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Secure Deployment](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)
- [MCP in the SDK](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Slash Commands](https://platform.claude.com/docs/en/agent-sdk/slash-commands)
- [Cost Tracking](https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
- [Plugins](https://platform.claude.com/docs/en/agent-sdk/plugins)
- [Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [User Input](https://platform.claude.com/docs/en/agent-sdk/user-input)
- [Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
