# Upstream Cherry-Pick Analysis

**Range**: v1.1.19 → v1.1.23
**Date**: 2026-01-16

---

## Skipped (Conflicts)

### Desktop Fixes
| Hash | Description | Reason |
|------|-------------|--------|
| `dc654c93d` | fix(desktop): Revert provider icon on select model dialog | N/A (reverts skipped commit) |
| `077ca4454` | fix(desktop): "load more" button behavior | Massive SDK regen conflict |
| `4b2a14c15` | chore(desktop): Question Tools Updates | Depends on Ask Question Tool |

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

## Summary

| Category | Applied | Skipped | Already Present |
|----------|---------|---------|-----------------|
| Desktop Fixes | 1 | 6 | 0 |
| Core Fixes | 3 | 14 | 0 |
| App/UI Fixes | 0 | 6 | 1 |
| MCP/State | 0 | 0 | 2 |
| Themes | 0 | 0 | 1 |
| Layout | 26 | 0 | 0 |
| **Total** | **30** | **26** | **4** |