# Upstream Cherry-Pick Analysis

**Range**: v1.1.19 → v1.1.23
**Date**: 2026-01-16

## Cherry-Picked This Session

| Hash | Description | Our Commit |
|------|-------------|------------|
| `779610d66` | fix(desktop): open external links in system browser | `b945e68a4` |
| `e60ded01d` | chore(desktop): Stop Killing opencode-cli on dev | `fd87824b6` |
| `b0345284f` | fix(core): filter dead worktrees | `24429187a` |
| `ee6ca104e` | fix(app): file listing | `0c10d853f` |
| `05cbb1170` | fix(ui): layout-bottom icons | `0f2120fd6` |
| `37f30993f` | fix: show toast error message on ConfigMarkdown parse error | `b26993d26` |
| `4d08123ca` | feat(install): respect ZDOTDIR for zsh config detection | `31db113a2` |
| `a761f66a1` | fix(desktop): correct health check endpoint URL | `b834081a6` |
| `73d5cacc0` | fix: add missing metadata() and ask() to ToolContext type | `51d85aa2b` |
| `af2a09940` | fix(core): more defensive project list | `5f17c2a01` |
| `dd1f981d2` | fix: update MCP timeout config descriptions | `da1bacf1e` |

---

## Skipped (Conflicts)

### Desktop Fixes
| Hash | Description | Reason |
|------|-------------|--------|
| `3c9d80d75` | feat(desktop): Adding Provider Icons | Conflicts with our model priority sorting |
| `dc654c93d` | fix(desktop): Revert provider icon on select model dialog | N/A (reverts skipped commit) |
| `dfa59dd21` | feat(desktop): Ask Question Tool Support | 6 file conflicts, needs manual integration |
| `077ca4454` | fix(desktop): "load more" button behavior | Massive SDK regen conflict |
| `4b2a14c15` | chore(desktop): Question Tools Updates | Depends on Ask Question Tool |
| `472a6cc83` | fix(app): sidebar toggle on desktop | We deleted titlebar.tsx |

### Core Fixes
| Hash | Description | Reason |
|------|-------------|--------|
| `562f06713` | fix: deduplicate file refs in sent prompts | TUI file deleted |
| `f9fcdead5` | fix(session): skip duplicate system prompt for Codex | llm.ts deleted |
| `a57c8669b` | feat: show connected providers in /connect dialog | TUI file deleted |
| `fcc561ebb` | fix plan mode when not in git worktree | prompt.ts deleted, agent.ts conflict |
| `6e13e2f74` | fix(session): remove typo'd duplicate path import | session/index.ts conflict |
| `3a9e6b558` | feat: AWS Web Identity Token File for Bedrock | auth.ts deleted, provider.ts conflict |
| `1f86aa8bb` | fix: adjust gitlab logic in provider.ts | provider.ts conflict |
| `7d3c7a9f6` | add check if provider doesn't exist in models | provider.ts conflict |
| `b3ae1931f` | fix: plan path permissions | Conflict |
| `4edb4fa4f` | fix: handle broken symlinks in grep tool | Conflict |
| `dc1c25cff` | fix: ensure frontmatter can process same content | Conflict |
| `d71153eae` | fix(core): loading models.dev in dev | Conflict |
| `b14622352` | fix(session): ensure agent exists before title | Conflict |
| `8d720f946` | fix(opencode): add input limit for compaction | Conflict |

### App/UI Fixes
| Hash | Description | Reason |
|------|-------------|--------|
| `43680534d` | add fullscreen view to permission prompt | Conflict |
| `73adf7e86` | fix: update User-Agent string in webfetch | Conflict |
| `bfc9b24b4` | use native text truncation for sidebar diff paths | Conflict |
| `beb97d21f` | fix(app): show session busy even for active | Conflict |
| `da3dea042` | fix(app): persist workspace order and collapsed state | Conflict |
| `47d43aaf2` | feat(app): persist workspace branch | Conflict |

---

## Already Present

| Hash | Description |
|------|-------------|
| `1fccb3bda` | fix(prompt-input): handle Shift+Enter before IME check |
| `4dc72669e` | fix(mcp): close existing client before reassignment |
| `9b7633723` | fix(state): delete key from recordsByKey on instance disposal |
| `e37104cb1` | feat: add Undertale and Deltarune built-in themes |

---

## NEW LAYOUT FEATURE (Manual Integration Required)

These commits implement terminal splits and new sidebar layout. **Cherry-picking doesn't work** - the 5 core commits depend on ~20+ interspersed changes to:
- Terminal context (Panel system, splits, pane management, focus)
- Session state (`agent`, `sessionTotal`, `hasPermissions`)
- Function signatures (`scrollToElement(el, behavior)`)
- Type definitions across multiple files

**Recommended approach:** Full upstream rebase or wait for feature stabilization (25+ fix commits suggest ongoing refinement).

| Hash | Description | Status |
|------|-------------|--------|
| `9f66a4597` | feat(app): new layout | ⬜ Manual |
| `679270d9e` | feat(app): new layout | ⬜ Manual |
| `564d3edfa` | fix(app): new layout issues | ⬜ Manual |
| `169844801` | fix(app): new layout sessions stale | ⬜ Manual |
| `f270ea65c` | fix(app): new layout issues | ⬜ Manual |
| `6450ba1b7` | fix: search bar in header | ⬜ Manual |
| `8cba7d7f5` | fix: tooltips cleanup | ⬜ Manual |
| `fbc8f6eba` | fix: recent sessions hover gutter | ⬜ Manual |
| `fe2cc0cff` | fix: archive icon replaces diff count on hover | ⬜ Manual |
| `e5b08da0f` | fix: tooltip gutter spacing | ⬜ Manual |
| `520c47e81` | fix: increase delay on session list tooltips | ⬜ Manual |
| `1c05ebaea` | fix: show project options on hover of row | ⬜ Manual |
| `f9a441d4f` | fix: avatar background | ⬜ Manual |
| `bb6e350d6` | fix: move left panel toggle over | ⬜ Manual |
| `3789a3142` | fix: project dropdown labels and order | ⬜ Manual |
| `a71dcc189` | fix: recent sessions title color | ⬜ Manual |
| `acd1eb574` | fix: load more button font size | ⬜ Manual |
| `a5d47f076` | fix: avatar button states | ⬜ Manual |
| `1ee916a3c` | fix: hide view all sessions on active project | ⬜ Manual |
| `55bd6e487` | fix: workspace name color | ⬜ Manual |
| `3b3505cfe` | fix: remove more options tooltip | ⬜ Manual |
| `74b1349cf` | fix: new session tooltip position and add shortcut | ⬜ Manual |
| `99110d12c` | fix: remove the active state from load more button | ⬜ Manual |
| `dc8f8cc56` | fix: current session background color | ⬜ Manual |
| `4d3e983ed` | fix: session icon and name alignment | ⬜ Manual |
| `0f7b17b1b` | fix: thinking animation opacity and design | ⬜ Manual |

---

## Summary

| Category | Applied | Skipped | Already Present |
|----------|---------|---------|-----------------|
| Desktop Fixes | 1 | 6 | 0 |
| Core Fixes | 3 | 14 | 0 |
| App/UI Fixes | 0 | 6 | 1 |
| MCP/State | 0 | 0 | 2 |
| Themes | 0 | 0 | 1 |
| **Total** | **4** | **26** | **4** |
