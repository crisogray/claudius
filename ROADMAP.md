# Roadmap Difficulty Assessment

## Summary

| Feature                           | Status      | Difficulty  | Effort   |
| --------------------------------- | ----------- | ----------- | -------- |
| **Multi-repo support** | Not started | Medium-High | 4-6 days |
| Branch switcher                   | Not started | Medium      | 2-3 days |
| Push/Pull/Fetch/Merge             | Not started | Medium-High | 3-5 days |
| Replace tabs in-place             | Not started | Low         | 1 day    |
| New tasks format                  | Not started | High        | 4-6 days |
| Message reverts                   | **Done** (needs keybindings) | Low | ~0.5 day |
| Queue message                     | Not started | Medium      | 2-3 days |
| PRs                               | Not started | High        | 5-7 days |
| Skills settings                   | Partial     | Low         | 1 day    |
| Agents/Subagents settings         | Partial     | Medium      | 2-3 days |
| Custom Tools settings             | Not started | Medium      | 2-3 days |
| Hooks settings                    | Schema only | Medium      | 2-3 days |
| Drag and drop tabs (split panes)  | Not started | Medium-High | 3-4 days |

**Total estimated effort: ~32-45 days**

---

## Detailed Assessment

### Git Features

#### Multi-Repo Support - **Medium-High** (Not started)

**Current state:** Entire system assumes ONE repo per workspace. Detection stops at first `.git` found walking upward.

**Problem:** A folder containing 3 git repos (e.g., monorepo with nested repos, or multi-project workspace) only sees the root one.

**Two modes - mutually exclusive:**

| Mode | When | Sessions | Worktrees |
|------|------|----------|-----------|
| **Single repo** | One `.git` at/above workspace | Shared via worktree grouping | ✓ Detected & listed |
| **Multi-repo** | Multiple `.git` dirs in workspace | Per-workspace (top level) | ✗ Disabled |

**Detection algorithm:**

```typescript
// Find all .git directories in workspace
const gitDirs = await glob("**/.git", { onlyDirectories: true })
  .filter(p => !p.includes("node_modules"))

if (gitDirs.length === 0) {
  // No git - check parent dirs for repo (current behavior)
  const parentRepo = await findGitRepoAbove(workspace)
  if (parentRepo) return { mode: "single", repos: [parentRepo] }
  return { mode: "none" }
}

if (gitDirs.length === 1) {
  // Single repo mode - worktrees enabled
  const repo = dirname(gitDirs[0])
  const worktrees = await $`git -C ${repo} worktree list --porcelain`
  return { mode: "single", repos: [repo], worktrees: parseWorktrees(worktrees) }
}

// Multi-repo mode - no worktree detection
const repos = gitDirs.map(p => dirname(p))
return { mode: "multi", repos }
```

**Why disable worktrees in multi-repo:**
- Worktree session sharing creates circular dependency with project identity
- Multi-repo = multiple independent projects, sessions at workspace level
- Keeps architecture simple

**Example - Single repo mode:**
```
/workspace/myapp/          ← opened folder
  .git/                    ← single repo detected

Worktrees of myapp also detected, sessions shared
```

**Example - Multi-repo mode:**
```
/workspace/                ← opened folder
  /backend/.git/           ← repo 1
  /frontend/.git/          ← repo 2
  /shared/.git/            ← repo 3

No worktree detection, sessions belong to workspace
```

2. **Backend - Git Module** (`/packages/opencode/src/git/index.ts`)
   - All functions accept optional `repoPath` parameter
   - Default to first/primary repo for backward compatibility

3. **Backend - Server Routes** (`/packages/opencode/src/server/server.ts`)
   - All 11 git endpoints gain `?repo=path` query param
   - Example: `GET /git/status?repo=packages/backend`

4. **Backend - Vcs/Watcher**
   - Track branches for ALL repos: `Map<repoId, string>`
   - Watch all `.git/HEAD` files
   - Events include repo ID

5. **Frontend - Git Context** (`/packages/app/src/context/git.tsx`)
   - `repositories: Map<string, GitStatus>` instead of single status
   - `expandedRepos: Set<string>` for accordion state

6. **Frontend - Git Tab UI** (`/packages/app/src/components/panel/git-tab.tsx`)

   **Multi-repo mode** - full accordion with shared branch switcher & history:

     ```
     ▼ backend            main         [3]  ← branch indicator (text)
       [Commit message...                    ]
       [☐ Amend]                   [✓ Commit]
       ▼ Staged (1)
         src/api.ts
       ▼ Changes (2)
         src/utils.ts
         README.md

     ▶ frontend           main         [0]  ← collapsed (0 changes)

     ▼ shared             fix/bug      [1]
       [Commit message...                    ]
       [☐ Amend]                   [✓ Commit]
       ▼ Changes (1)
         lib/utils.ts

     ────────────────────────────────────────────────────
     ▶ History (backend)                                  ← shared, collapsed
       abc123  fix: api bug           2 hours ago
       def456  feat: add auth         1 day ago

     ┌─ backend ──────────────────────────────────────┐  ← shared footer
     │ [main ▼]  ↑0 ↓0          [⟳] [↑ Push] [↓ Pull] │
     └────────────────────────────────────────────────┘
     ```

   **Single-repo mode** - same UI but also shows worktrees (existing behavior):
     ```
     ▼ myapp              main         [3]
       ...
     ▼ myapp 🌳           feature/auth [0]  ← worktree (branch locked)
       ...
     ```

   **Per-repo (replicated in accordion):**
   | Element | Notes |
   |---------|-------|
   | Header row | Name + branch (text) + change count |
   | Commit message input | Per-repo textarea |
   | Amend checkbox | Per-repo |
   | Commit button | Per-repo |
   | Staged Changes list | Per-repo files |
   | Unstaged Changes list | Per-repo files |

   **Shared (once, operates on selected/focused repo):**
   | Element | Notes |
   |---------|-------|
   | Branch switcher dropdown | Shows "for: reponame", switches selected repo's branch |
   | Push/Pull/Fetch buttons | Actions for selected repo |
   | Refresh button | Can refresh all or selected |
   | History section | Shows commits for selected repo |

   **Behavior:**
   - Clicking/focusing a repo makes it "selected" for shared components
   - Branch switcher shows which repo it operates on
   - Repos with 0 changes can stay collapsed
   - Single-repo mode: worktrees shown with 🌳 icon, branch not switchable

**Files to modify:**

- `/packages/opencode/src/project/project.ts` - Multi-repo detection
- `/packages/opencode/src/project/instance.ts` - Repo context
- `/packages/opencode/src/git/index.ts` - Accept repo param
- `/packages/opencode/src/project/vcs.ts` - Track multiple branches
- `/packages/opencode/src/server/server.ts` - Add repo query param
- `/packages/app/src/context/git.tsx` - Multi-repo state
- `/packages/app/src/components/panel/git-tab.tsx` - Repo selector UI

**Why first:** This is foundational - branch switcher and push/pull should work with multi-repo from the start.

---

#### Branch Switcher - **Medium** (Not started)

**Current state:** Only branch name tracking via `Vcs.branch()` and file watching for HEAD changes.

**Missing:**

- `git branch --list` to list all branches
- `git switch <branch>` / `git checkout <branch>` API
- UI component for branch selection dropdown

**Files to modify:**

- `/packages/opencode/src/git/index.ts` - Add `listBranches()`, `switchBranch()`
- `/packages/opencode/src/server/server.ts` - Add routes
- `/packages/app/src/components/panel/git-tab.tsx` - Add branch dropdown UI

---

#### Push/Pull/Fetch/Merge - **Medium-High** (Not started)

**Current state:** No remote operations exist.

**Missing:**

- `git push`, `git pull`, `git fetch`, `git merge` APIs
- Conflict detection and resolution UI
- Remote tracking state
- Progress/status feedback for long operations

**Complexity factors:**

- Pull may have conflicts requiring resolution UI
- Merge operations are complex with potential conflicts
- Need authentication handling for private repos
- Progress feedback for network operations

**Files to modify:**

- `/packages/opencode/src/git/index.ts` - Add remote operations
- `/packages/opencode/src/server/server.ts` - Add routes
- `/packages/app/src/components/panel/git-tab.tsx` - Add push/pull buttons
- New: Conflict resolution component

---

### Tab Management

#### Replace Tabs In-Place (VS Code style) - **Low** (Not started)

**Current state:** Tabs system is fully implemented with drag-and-drop. Opening a file adds a new tab and makes it active.

**Missing:** "Preview tab" behavior where single-clicking opens a temporary tab that gets replaced by the next file until you edit or double-click.

**Implementation:**

- Add `preview: boolean` flag to tab state
- Modify `open()` in layout context to replace preview tabs
- Add visual indicator (italic title) for preview tabs
- Double-click or edit converts preview to permanent

**Files to modify:**

- `/packages/app/src/context/layout.tsx` - Add preview tab logic (~50 lines)
- `/packages/app/src/pages/session.tsx` - Add double-click handler for permanence

---

#### Drag and Drop Tabs (Split Panes) - **Medium-High** (Not started)

**Current state:** Tab reordering works via `@thisbeyond/solid-dnd`, but NO split pane support.

**What's needed:** VS Code-style dragging a tab to create a split view (max 2 panes side-by-side).

**Good news:** Terminal already has a sophisticated split pane system that can be adapted:

- Binary tree panel structure in `/packages/app/src/context/terminal.tsx`
- `Panel` type with `direction`, `children`, `sizes`
- ResizeHandle component exists at `/packages/ui/src/components/resize-handle.tsx`
- TerminalSplit component handles recursive rendering

**Implementation:**

1. **Data structure** - Add `EditorLayout` to layout context:

   ```typescript
   type EditorPane = {
     id: string
     direction?: "vertical" // Only side-by-side splits
     children?: [string, string]
     sizes?: [number, number]
     tabs: string[]
     active?: string
   }
   ```

2. **Layout methods** - Add to `useLayout()`:
   - `editor.split()` - Create split from active pane
   - `editor.close()` - Close a pane
   - `editor.moveTab()` - Move tab between panes
   - `editor.resizeSplit()` - Resize panes

3. **UI changes:**
   - Render multiple `<Tabs>` components (one per pane)
   - Add ResizeHandle between panes
   - Detect drag outside tab bar → show split zones
   - Drop in split zone creates new pane

4. **Persistence** - Save/restore split layout per session

**Files to modify:**

- `/packages/app/src/context/layout.tsx` - Add EditorLayout state & methods
- `/packages/app/src/pages/session.tsx` - Render split panes, enhance drag detection
- `/packages/app/src/components/session/session-sortable-tab.tsx` - Split zone detection

**Constraint:** Max 2 panes (simpler than terminal's unlimited nesting)

---

### Tasks & Messages

#### New Tasks Format - **High** (Not started)

**Current state:** Has basic Todos in `/packages/opencode/src/session/todo.ts` - but this is NOT the new Tasks system.

**New Tasks System (from Claude Code):**
This is a major new feature for coordinating work across sessions/subagents:

```typescript
// New Tasks features needed:
{
  // Existing fields
  content: string,
  status: string,
  priority: string,
  id: string,

  // NEW: Dependencies
  dependencies: string[],  // Task IDs this task depends on
  blockers: string[],      // What's blocking this task

  // NEW: Coordination metadata
  taskListId: string,      // Which Task List this belongs to
  sessionId?: string,      // Which session is working on it
  subagentId?: string,     // Which subagent owns it
}
```

**Key differences from current Todos:**

1. **Dependencies** - Tasks can depend on other tasks
2. **Filesystem storage** - Tasks stored in `~/.claude/tasks/` (not just session memory)
3. **Multi-session collaboration** - Multiple sessions/subagents can work on same Task List
4. **Broadcast updates** - Changes broadcast to all sessions working on same Task List
5. **Environment variable** - `CLAUDE_CODE_TASK_LIST_ID=<id>` to share task lists

**Implementation needed:**

- `/packages/opencode/src/tasks/` - New task management module
  - Task storage (filesystem-based in `~/.claude/tasks/`)
  - Task List management
  - Dependency graph resolution
  - Cross-session broadcasting (file watchers or pub/sub)
- `/packages/app/src/components/panel/tasks-tab.tsx` - New Tasks UI
  - Dependency visualization
  - Task assignment to sessions/subagents
  - Real-time updates from other sessions
- SDK integration for `CLAUDE_CODE_TASK_LIST_ID` env var
- Migration path from old Todos to new Tasks

---

#### Message Reverts - **Done** (polish needed)

**Current state:** Fully implemented - backend, server endpoints, and UI commands all working.

**What works:**
- `SessionRevert.revert()` / `unrevert()` / `cleanup()` in backend
- `/undo` and `/redo` slash commands in UI
- File snapshot rollback
- Reverted messages hidden from chat
- Prompt restoration on undo
- SDK context preservation via `sdkUuid`

**Polish needed (~0.5 day):**
- Add Cmd+Z / Cmd+Shift+Z keyboard shortcuts (currently slash commands only)
- Simplify redo UX (stepping through revert points is non-intuitive)

---

#### Queue Message - **Medium** (Not started)

**Current state:** Messages are sent immediately and processed sequentially.

**Needed:**

- Queue data structure for pending messages
- UI to show queued messages
- Ability to reorder/cancel queued messages
- Integration with session processing

**Files to create/modify:**

- `/packages/opencode/src/session/queue.ts` - New queue management
- `/packages/app/src/context/session.tsx` - Queue state integration
- `/packages/app/src/pages/session.tsx` - Queue UI

---

### Pull Requests

#### PRs - **High** (Not started)

**Current state:** No PR functionality. Has fork sessions and summary generation, but no GitHub API integration.

**Multi-repo/worktree PR handling:**

Each repo/worktree entry shows PR status per-branch with clickable icon:

```
▼ myapp           main        [3]      ← no PR (main branch)
  ...

▼ myapp 🌳        feature/auth [0]  🔗 PR #42 ✓   ← click opens PR tab
  ...

▶ backend         fix/bug     [1]  🔗 PR #17 ⏳   ← pending CI

▼ shared          main        [0]  [+ Create PR]  ← no PR, show create button
  ...
```

**PR status icons in accordion row:**
| Icon | Meaning |
|------|---------|
| `🔗 #42 ✓` | Open PR, CI passing |
| `🔗 #42 ⏳` | Open PR, CI pending |
| `🔗 #42 ✗` | Open PR, CI failing |
| `🔗 #42 📝` | Draft PR |
| `[+ Create PR]` | No PR for this branch |

**Clicking PR icon → opens PR tab:**
- Full PR details (title, description, reviewers)
- CI status with individual check results
- Review comments thread
- Diff view (or link to existing diff tab)
- Merge/close actions

**Provider detection (per-repo):**
```typescript
// Detect from remote URL
function detectProvider(remoteUrl: string): "github" | "gitlab" | null {
  if (remoteUrl.includes("github.com")) return "github"
  if (remoteUrl.includes("gitlab.com")) return "gitlab"
  // Check for self-hosted patterns...
  return null
}
```

**Implementation approach:** Direct API with Personal Access Token (PAT)

**Why PAT-only:**
- No backend/OAuth app needed (open source friendly)
- No shared rate limits across users
- Works with self-hosted GitHub Enterprise / GitLab
- User controls token scopes
- Simple UX - paste token once

**Auth UI:**
```
┌─ GitHub Authentication ─────────────────────┐
│                                             │
│ Personal Access Token                       │
│ [paste token here...                     ]  │
│                                             │
│ Scopes needed: repo, read:user              │
│ [Generate token on GitHub →]                │
│                                             │
└─────────────────────────────────────────────┘
```

**Token storage:**
- Store in `~/.opencode/auth.json`
- Key by remote host: `{ "github.com": "ghp_xxx", "gitlab.com": "glpat_xxx" }`
- Support multiple tokens for different hosts

**API endpoints:**
- GitHub: `https://api.github.com/repos/:owner/:repo/pulls`
- GitLab: `https://gitlab.com/api/v4/projects/:id/merge_requests`
- Self-hosted: detect from remote URL, use same API paths

**Needed:**

- GitHub/GitLab provider abstraction
- PR lookup by branch: `getPRForBranch(remote, branch)`
- PR status caching (don't hit API on every render)
- PR tab component with full details
- Create PR flow (title, description, base branch)
- Authentication per-repo (different tokens possible)

**Files to create:**

- `/packages/opencode/src/pr/` - PR provider abstraction
  - `provider.ts` - Interface for GitHub/GitLab
  - `github.ts` - GitHub implementation (gh CLI or API)
  - `gitlab.ts` - GitLab implementation (glab CLI or API)
- `/packages/app/src/components/panel/pr-tab.tsx` - PR detail tab
- `/packages/app/src/components/pr-status-badge.tsx` - Inline PR badge for accordion

---

### Settings

#### MCPs - **Done**

Fully implemented with:

- Local (stdio) and Remote (HTTP/SSE) server types
- OAuth support for remote servers
- Enable/disable toggle
- Timeout and environment configuration
- UI in settings panel

---

#### Skills Settings - **Low** (Partial)

**Current state:** Skills are markdown files with frontmatter, scanned from:

- Project: `.opencode/skill/`, `.claude/skills/`
- Global: `~/.opencode/skill/`, `~/.claude/skills/`

**Missing:** UI to view/edit/create skills in settings panel.

**Implementation:** Add a skills list view with create/edit modal.

---

#### Agents/Subagents Settings - **Medium** (Partial)

**Current state:** Agent schema exists in config with support for:

- `model`, `temperature`, `top_p`, `prompt`, `description`
- `mode: "subagent" | "primary" | "all"`
- `color`, `steps`, `permission`, `options`

Agents can be defined via:

- JSON in `opencode.jsonc`
- Markdown files in `agent/` directories

**SDK alignment:** SDK supports `agents: Record<string, AgentDefinition>` programmatically.

**Missing:** UI to manage agents in settings panel.

---

#### Custom Tools Settings - **Medium** (Not started)

**Current state:** Only LSP tool is built-in. Custom tools come via MCP servers.

**SDK approach:** Tools are defined via:

1. `tool()` function with Zod schema
2. `createSdkMcpServer()` to host tools
3. MCP server configuration

**For settings UI:** Would need to allow defining simple tools (name, description, schema, command) that get wrapped as MCP tools.

---

#### Hooks Settings - **Medium** (Schema exists, not implemented)

**Current state:** Schema defined in config for:

- `file_edited` - triggered by file extension
- `session_completed` - triggered at session end

**SDK hooks (from docs):** Much richer set available:

```typescript
type HookEvent =
  | "PreToolUse" // Before tool execution
  | "PostToolUse" // After successful tool execution
  | "PostToolUseFailure" // After tool failure
  | "Notification" // When notification sent
  | "UserPromptSubmit" // When user submits prompt
  | "SessionStart" // Session begins (startup/resume/clear/compact)
  | "SessionEnd" // Session ends
  | "Stop" // Stop requested
  | "SubagentStart" // Subagent launched
  | "SubagentStop" // Subagent finished
  | "PreCompact" // Before context compaction
  | "PermissionRequest" // Permission requested
```

**Gap:** Current implementation has 2 hook types vs SDK's 12.

**For settings UI:** Need hook management interface with:

- Hook type selection (align with SDK types above)
- Matcher patterns (e.g., tool name for PreToolUse)
- Command/script configuration
- Enable/disable toggle
- Store in `.claude/settings.json` for compatibility

---

### Settings Structure

**Directory Migration Plan:**
Per user preference, migrate Claude-compatible settings to `.claude` directory while keeping opencode-specific things in `.opencode`:

| Setting          | Location                               | Notes                    |
| ---------------- | -------------------------------------- | ------------------------ |
| **Skills**       | `~/.claude/skills/`, `.claude/skills/` | Align with Claude Code   |
| **Agents**       | `~/.claude/agents/`, `.claude/agents/` | Align with Claude Code   |
| **Tasks**        | `~/.claude/tasks/`                     | New - filesystem-based   |
| **Hooks**        | `.claude/settings.json`                | Align with Claude Code   |
| **MCP servers**  | Stay in `.opencode/`                   | OpenCode-specific config |
| **Custom Tools** | `.claude/tools/` or via MCP            | TBD                      |

**Precedence (lowest to highest):**

1. Global user (`~/.claude/` or `~/.opencode/`)
2. Project (`.claude/` or `.opencode/`)
3. Environment overrides

---

## Prioritized Roadmap

### Already Done

- **Message reverts** - Full revert/unrevert/cleanup system
- **MCP settings** - Complete with OAuth, local/remote servers

---

### Phase 1: Core Editor UX (5-6 days)

_Foundation improvements for daily workflow_

| Order | Feature                              | Effort   | Rationale                                          |
| ----- | ------------------------------------ | -------- | -------------------------------------------------- |
| 1.1   | **Replace tabs in-place**            | 1 day    | Quick win, common VS Code expectation              |
| 1.2   | **Drag and drop tabs (split panes)** | 3-4 days | High-value editor feature, terminal infra reusable |
| 1.3   | **Queue message**                    | 2-3 days | Enables better workflow when Claude is busy        |

---

### Phase 2: Git Workflow (9-14 days)

_Complete git workflow without leaving the app_

| Order | Feature                           | Effort   | Rationale                                            |
| ----- | --------------------------------- | -------- | ---------------------------------------------------- |
| 2.1   | **Multi-repo support** | 4-6 days | **Foundation** - must come first, others build on it |
| 2.2   | **Branch switcher**               | 2-3 days | Per-repo branch switching (disabled for worktrees)   |
| 2.3   | **Push/Pull/Fetch/Merge**         | 3-5 days | Depends on branch switcher, completes git story      |

_Note: Multi-repo is architectural (worktrees disabled in multi-repo mode). Branch switcher and push/pull are incremental on top._

---

### Phase 3: Claude Code Alignment (4-6 days)

_Align with official Claude Code features_

| Order | Feature              | Effort   | Rationale                                              |
| ----- | -------------------- | -------- | ------------------------------------------------------ |
| 3.1   | **New Tasks format** | 4-6 days | Major Claude Code feature, cross-session collaboration |

_Note: This is the biggest single feature. Consider splitting into sub-phases:_

- 3.1a: Basic task structure with dependencies (2 days)
- 3.1b: Filesystem storage & cross-session sync (2-3 days)
- 3.1c: UI with dependency visualization (1-2 days)

---

### Phase 4: Settings & Configuration (6-10 days)

_Settings UI for all configuration types_

| Order | Feature                       | Effort   | Rationale                        |
| ----- | ----------------------------- | -------- | -------------------------------- |
| 4.1   | **Skills settings UI**        | 1 day    | Quick - just list existing files |
| 4.2   | **Agents/Subagents settings** | 2-3 days | Core configuration               |
| 4.3   | **Hooks settings**            | 2-3 days | Align with SDK's 12 hook types   |
| 4.4   | **Custom Tools settings**     | 2-3 days | Allow tool definitions via UI    |

_Consider doing 4.1-4.4 together as a "Settings Overhaul" initiative since they share patterns_

---

### Phase 5: GitHub Integration (5-7 days)

_Full PR workflow_

| Order | Feature | Effort   | Rationale                                       |
| ----- | ------- | -------- | ----------------------------------------------- |
| 5.1   | **PRs** | 5-7 days | Depends on git being solid, biggest integration |

---

## Alternative Orderings

### If prioritizing Claude Code compatibility:

1. New Tasks format (Phase 3)
2. Settings migration to `.claude`
3. Hooks alignment with SDK
4. Then editor UX

### If prioritizing quick wins:

1. Replace tabs in-place (1 day)
2. Skills settings UI (1 day)
3. Branch switcher (2-3 days)
4. Then bigger features

### If prioritizing git workflow:

1. Multi-repo support → Branch switcher → Push/Pull/Fetch/Merge → PRs
2. Then editor and settings
