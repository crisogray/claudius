# Upstream Cherry-Pick Analysis

**Range**: v1.1.19 → v1.1.23
**Date**: 2026-01-16

## Already Cherry-Picked (This Session)

| Hash | Description | Our Commit |
|------|-------------|------------|
| `779610d66` | fix(desktop): open external links in system browser | `b945e68a4` |
| `e60ded01d` | chore(desktop): Stop Killing opencode-cli on dev | `fd87824b6` |
| `b0345284f` | fix(core): filter dead worktrees | `24429187a` |
| `ee6ca104e` | fix(app): file listing | `0c10d853f` |
| `05cbb1170` | fix(ui): layout-bottom icons | `0f2120fd6` |
| `37f30993f` | fix: show toast error message on ConfigMarkdown parse error | `b26993d26` |
| `4d08123ca` | feat(install): respect ZDOTDIR for zsh config detection | `31db113a2` |

---

## CHERRY-PICK CANDIDATES

### Desktop Fixes
| Hash | Description | Status |
|------|-------------|--------|
| `a761f66a1` | fix(desktop): correct health check endpoint URL to /global/health | ⬜ Pending |
| `3c9d80d75` | feat(desktop): Adding Provider Icons | ⬜ Pending |
| `dc654c93d` | fix(desktop): Revert provider icon on select model dialog | ⬜ Pending |
| `dfa59dd21` | feat(desktop): Ask Question Tool Support | ⬜ Pending |
| `077ca4454` | fix(desktop): "load more" button behavior in desktop sidebar | ⬜ Pending |
| `4b2a14c15` | chore(desktop): Question Tools Updates | ⬜ Pending |
| `472a6cc83` | fix(app): sidebar toggle on desktop | ⬜ Pending |

### Core Fixes
| Hash | Description | Status |
|------|-------------|--------|
| `73d5cacc0` | fix: add missing metadata() and ask() definitions to ToolContext type | ⬜ Pending |
| `562f06713` | fix: deduplicate file refs in sent prompts | ⬜ Pending |
| `f9fcdead5` | fix(session): skip duplicate system prompt for Codex OAuth sessions | ⬜ Pending |
| `a57c8669b` | feat: show connected providers in /connect dialog | ⬜ Pending |
| `fcc561ebb` | fix plan mode when not in git worktree | ⬜ Pending |
| `6e13e8f74` | fix(session): remove typo'd duplicate path import | ⬜ Pending |
| `3a9e6b558` | feat(opencode): add AWS Web Identity Token File support for Bedrock | ⬜ Pending |
| `1f86aa8bb` | fix: adjust gitlab logic in provider.ts | ⬜ Pending |
| `7d3c7a9f6` | add check incase provider doesnt exist in models list | ⬜ Pending |
| `b3ae1931f` | fix: plan path permissions | ⬜ Pending |
| `dd1f981d2` | fix: honor per-server MCP timeouts | ⬜ Pending |
| `4edb4fa4f` | fix: handle broken symlinks gracefully in grep tool | ⬜ Pending |
| `dc1c25cff` | fix: ensure frontmatter can process same content as other agents | ⬜ Pending |
| `d71153eae` | fix(core): loading models.dev in dev | ⬜ Pending |
| `af2a09940` | fix(core): more defensive project list | ⬜ Pending |
| `b14622352` | fix(session): ensure agent exists before processing title | ⬜ Pending |
| `8d720f946` | fix(opencode): add input limit for compaction | ⬜ Pending |

### App/UI Fixes
| Hash | Description | Status |
|------|-------------|--------|
| `43680534d` | add fullscreen view to permission prompt | ⬜ Pending |
| `1fccb3bda` | fix(prompt-input): handle Shift+Enter before IME check | ⬜ Pending |
| `73adf7e86` | fix: update User-Agent string to latest Chrome version in webfetch | ⬜ Pending |
| `bfc9b24b4` | use native text truncation for sidebar diff paths | ⬜ Pending |
| `beb97d21f` | fix(app): show session busy even for active session | ⬜ Pending |
| `da3dea042` | fix(app): persist workspace order and collapsed state | ⬜ Pending |
| `47d43aaf2` | feat(app): persist workspace branch | ⬜ Pending |

### MCP/State Fixes
| Hash | Description | Status |
|------|-------------|--------|
| `4dc72669e` | fix(mcp): close existing client before reassignment to prevent leaks | ⬜ Pending |
| `9b7633723` | fix(state): delete key from recordsByKey on instance disposal | ⬜ Pending |

### Themes
| Hash | Description | Status |
|------|-------------|--------|
| `e37104cb1` | feat: add Undertale and Deltarune built-in themes | ⬜ Pending |

---

## NEW LAYOUT FEATURE (Manual Integration Required)

These commits implement terminal splits and new sidebar layout. They conflict heavily with our layout and require manual integration.

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

## SKIP - TUI (Deleted in our fork)

| Hash | Description |
|------|-------------|
| `bee4b6801` | fix(TUI): make tui work when OPENCODE_SERVER_PASSWORD is set |
| `1ff46c75f` | fix(tui): track all timeouts in Footer to prevent memory leak |
| `90eaf9b3f` | fix(TUI): make tui work when OPENCODE_SERVER_PASSWORD is set (dupe) |
| `8917dfdf5` | fix(tui): track all timeouts in Footer (dupe) |
| `b2b123a39` | feat(tui): improve question prompt UX |
| `76a79284d` | feat(tui): make dialog keybinds configurable |
| `3a9fd1bb3` | fix: restore brand integrity of TUI wordmark |
| `08ca1237c` | fix(tui): Center the initially selected session |
| `ebc194ca9` | Prettify retry duration display in TUI |
| `994c55f70` | upgrade opentui |
| `4eb6b5750` | tweak: external dir permission rendering in tui |

---

## SKIP - Documentation Only

| Hash | Description |
|------|-------------|
| `2f7b2cf60` | docs: Update plan mode restrictions |
| `b8828f260` | docs: add 302ai provider |
| `f4a28b265` | docs: Update plan mode restrictions (dupe) |
| `adcc66179` | docs: add 302ai provider (dupe) |
| `a184714f6` | docs: document ~/.claude/CLAUDE.md compatibility behavior |
| `6b019a125` | docs: fix permission system documentation |
| `b75d4d1c5` | docs: update screenshot images |
| `e6e7eaf6e` | docs: Web usage page |
| `207a59aad` | docs: add comprehensive security threat model |
| `6b6d6e9e0` | update security |
| `f5fd54598` | docs: add /thinking command documentation |
| `63176bb04` | docs: fix typos in documentation |

---

## SKIP - Console/Website

| Hash | Description |
|------|-------------|
| `bc557e828` | console: reduce desktop download cache ttl |
| `bb3926bf4` | fix(homepage): Update FAQ |
| `78be8fecd` | feat(console): add /changelog page |
| `8ce5c2b90` | feat(console/app): Style changes, view transitions |
| `44d24d42b` | ignore: fix auth redirect |
| `5b431c36f` | ignore: remove nowrap constraint |
| `346c5e0da` | fix(console): make logo link |
| `3206ed47e` | feat(console): add OG image |
| `c0b43d3cb` | ignore: add slash command to checks |
| `1fb611ef0` | fix: enable sticky header on changelog |
| `fe58c649c` | feat(console): Update /black plan selection |
| `ea643f1e3` | feat(console): Style improvements for /black |

---

## SKIP - Chore/Release/Nix/Sync

| Hash | Description |
|------|-------------|
| `f24251f89` | sync |
| `8ae10f1c9` | sync |
| `b7a1d8f2f` | Update Nix flake.lock and x86_64-linux hash |
| `f3d4dd509` | Update aarch64-darwin hash |
| `7aa7dd369` | chore: generate |
| `aa522aad6` | release: v1.1.17 |
| `15e80fca6` | chore: generate |
| `fcaa041ef` | chore: generate |
| `c67b0a9ba` | release: v1.1.18 |
| `f642a6c5b` | chore: generate |
| `29703aee9` | chore: generate |
| `874e22a04` | chore: generate |
| `16b2bfa8e` | add family to gpt 5.2 codex in codex plugin |
| `a160a35d0` | chore: generate |
| `2aed4d263` | chore: generate |
| `3839d70a9` | chore: generate |
| `9b2d595cf` | Update Nix flake.lock |
| `ff669d441` | Update aarch64-darwin hash |
| `76b10d85e` | chore: generate |
| `4347a77d8` | ignore: update download stats |
| `2256362ba` | chore: generate |
| `09ff3b9bb` | release: v1.1.20 |
| `9fd61aef6` | chore: generate |
| `cc67bc005` | Update Nix flake.lock |
| `b5e9f9666` | Update aarch64-darwin hash |
| `d83756eaa` | chore: generate |
| `50dfa9caf` | chore: upgrade bun |
| `216a2d87c` | chore: generate |
| `5a8a0f6a5` | fix: downgrade bun to fix avx issue |
| `161e3db79` | Update Nix flake.lock |
| `3f3550a16` | Update aarch64-darwin hash |
| `b4717d809` | bun/package.json updates |
| `60aa0cb96` | Update Nix flake.lock |
| `3f16e0d89` | Update Nix flake.lock |
| `2691e1e66` | Update aarch64-darwin hash |
| `d3fc29bde` | Update aarch64-darwin hash |
| `9862303ee` | fix: update hix hashes |
| `df8e6e601` | release: v1.1.23 |
| `99a1e73fa` | release: v1.1.21 |
| `ba4c86448` | chore: generate |

---

## SKIP - Black/Zen (Subscription features)

| Hash | Description |
|------|-------------|
| `eaf18d991` | wip: black |
| `45fa4eda1` | wip: black |
| `82319bbd8` | wip: black |
| `6fe265e7d` | Merge branch 'zen-black' into dev |
| `9b2d595cf` | wip: black |
| `bbb3120b5` | zen: gpt-5.2-codex |
| `e03932e58` | zen: black usage |

---

## SKIP - CI/Workflow

| Hash | Description |
|------|-------------|
| `5b699a0d9` | fix(github): add persist-credentials: false to workflow templates |
| `87438fb38` | ci: dedup stuff in changelog |

---

## SKIP - Provider Plugins (Not using)

| Hash | Description |
|------|-------------|
| `a520c4ff9` | feat: Add GitLab Duo Agentic Chat Provider Support |
| `0ce849c3d` | chore: update gitlab-ai-provider |
| `d78d31430` | feat: official copilot plugin |
| `74baae597` | chore: bump plugin version |
| `6a2fed704` | chore: bump cache version |
| `b36837ae9` | tweak: add error message for copilot reauthentication |
| `92931437c` | fix: codex id issue |
| `fcf2da957` | feat: allow provider-level store option |
| `16cac69a7` | Revert "feat: allow provider-level store option" |

---

## SKIP - Misc/Cleanup

| Hash | Description |
|------|-------------|
| `45a770cdb` | fix(opencode): fix docker image after sst rename in tips |
| `0ddf8e6c6` | fix(cli): mcp auth duplicate radio button icon |
| `759939616` | tweak: ensure external dir and bash tool invocations render workdir details |
| `3997d3f2d` | feat: add plan mode with enter/exit tools |
| `cd6e07355` | test: fix plan agent test path |
| `4c37e17ac` | remove plan |
| `905226c01` | fix: Add Plugin Mocks to Provider Tests |
| `bcdaf7e77` | tweak: prompt for explore agent better |
| `0026bc581` | do not allow agent to ask custom-less questions |
| `ad17e8d1f` | feat: add choco and scoop to opencode upgrade methods |
| `9d92ae753` | copy changes |
| `096e14d78` | tweak: adjust lsp wording |
| `dbd1987f0` | chore: cleanup |
| `e5973e286` | chore: cleanup |
| `076dfb375` | chore: cleanup |
| `2f32f2ceb` | chore: cleanup |
| `7e016fdda` | chore: cleanup |

---

## Summary

| Category | Pending | Manual | Skip |
|----------|---------|--------|------|
| Desktop Fixes | 7 | - | - |
| Core Fixes | 17 | - | - |
| App/UI Fixes | 7 | - | - |
| MCP/State Fixes | 2 | - | - |
| Themes | 1 | - | - |
| New Layout | - | 26 | - |
| TUI | - | - | 11 |
| Docs | - | - | 12 |
| Console/Website | - | - | 12 |
| Chore/Release/Nix | - | - | 39 |
| Black/Zen | - | - | 7 |
| CI/Workflow | - | - | 2 |
| Provider Plugins | - | - | 9 |
| Misc/Cleanup | - | - | 17 |
| **Total** | **34** | **26** | **109** |
