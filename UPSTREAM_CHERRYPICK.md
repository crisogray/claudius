# Upstream Cherry-Pick Analysis

**Range**: v1.1.23 → v1.1.27
**Date**: 2026-01-20
**Total Commits**: ~230
**Status**: ✅ Clean applies DONE (54 commits) | ⏳ Phased conflicts TODO

---

## Current State

| Phase | Description | Status |
|-------|-------------|--------|
| Clean Applies | 54 commits (Desktop, App, UI, Sidebar, Edit Dialog, Core, Docs) | ✅ DONE |
| Phase 1 | Bug Fixes (6 commits) | ⏳ TODO |
| Phase 2 | List/Search Robustness (2 commits) | ⏳ TODO |
| Phase 3 | Pure Styling (~25 commits) | ⏳ TODO |
| Phase 4 | Workspace Management (3 commits) | ⏳ TODO |
| Phase 5 | Session Layout Architecture (6 commits) | ⏳ TODO - **Needs careful approach** |
| Phase 6 | Misc Features (5 commits) | ⏳ TODO |

**Note**: Phase 5 (Session Layout Architecture) requires special attention. The upstream implementation changed the session title system significantly:
- **Upstream**: Uses `props.sessionTitle` (session-level title) with conditional display logic
- **Our fork**: Uses `msg().summary?.title` (message-level summary) always displayed
- These are fundamentally different data sources - careful manual resolution needed

---

## Policy Decisions

| Category | Decision |
|----------|----------|
| Share/Unshare | **SKIP** - Remove sharing entirely |
| Workspace management | **ACCEPT** - Rename, delete, reset |
| Session layout | **ACCEPT WITH CARE** - Preserve our title approach |
| Bug fixes | **ACCEPT ALL** |
| Pure styling | **ACCEPT ALL** (note: session row deliberately different) |

---

## Context: Claude SDK Migration Impact

Our migration from Vercel AI SDK to Claude Agent SDK has **deleted several core files**, making many upstream commits irrelevant or conflicting:

| Deleted File | Upstream Commits Affected |
|--------------|---------------------------|
| `src/session/llm.ts` | Provider features, LiteLLM, user-agent |
| `src/session/prompt.ts` | Attachment handling, image fixes, truncation |
| `src/provider/transform.ts` | GPT ID fixes, interleaved blocks, Azure |
| `src/provider/sdk/*` (21 providers) | All provider-specific fixes |
| `src/tool/task.ts` | Subagent reasoning effort |
| `src/tool/batch.ts` | Batch tool limits |
| `src/tool/websearch.ts`, `src/tool/question.txt` | Tool description updates |
| `src/cli/cmd/tui/*` | All TUI-related commits |
| `packages/console/*` | All Zen/Black/console commits |

**Bottom line**: ~40% of commits touch deleted files and are N/A. Focus should be on app/desktop/UI changes.

---

## ✅ DONE: Desktop/App Clean Applies (54 commits)

These commits have been cherry-picked successfully:

### Desktop UI Fixes (Clean Apply)
| Hash | Description | Value |
|------|-------------|-------|
| `c325aa114` | fix(desktop): Stream bash output + strip-ansi (#8961) | High |
| `c4e4f2a05` | fix(desktop): Windows getComputedStyle polyfill (#9054) | Medium |
| `8b379329a` | fix(desktop): completely disable pinch to zoom | Medium |
| `46f415ecb` | fix: desktop hamburger shift | Low |
| `d645e8bbe` | fix: (desktop) command palette width | Low |

### App UI Fixes (Clean Apply)
| Hash | Description | Value |
|------|-------------|-------|
| `529eb6e14` | fix(app): persist workspace order and collapsed state | High |
| `c551a4b6e` | fix(app): persist workspace order and collapsed state | Dup |
| `00ec29dae` | fix(app): scroll jumping when expanding workspaces | High |
| `360765c59` | fix(app): center dialog on page instead of session | Medium |
| `da78b758d` | fix(app): handle new session correctly | Medium |
| `6c0991d16` | fix(app): remove redundant toast for thinking effort (#9181) | Medium |
| `5a199b04c` | fix: don't open command palette if dialog open (#9116) | Medium |
| `4ee540309` | fix(app): hide settings button | Low |
| `72cb7ccc0` | fix(app): list jumping with mouse/keyboard nav (#9435) | Medium |
| `cac35bc52` | fix(app): global terminal/review pane toggles | Medium |
| `5f0372183` | fix(app): persist quota | Low |
| `c3393ecc6` | fix(app): feedback for unsupported paste filetype (#9452) | Low |
| `b4075cd85` | fix: remove loading text after splash | Low |

### UI Component Fixes (Clean Apply)
| Hash | Description | Value |
|------|-------------|-------|
| `1250486dd` | feat: add Keybind component for keyboard shortcuts | High |
| `54e52896a` | refactor: use Keybind component in search modal | Medium |
| `69215d456` | fix: display arrow keys as symbols in keybind | Low |
| `6f78a71fa` | feat: add hideIcon/class to List search | Medium |
| `e0c6459fa` | fix: remove smooth scroll from list component | Low |
| `38847e13b` | fix: truncate long search queries in empty state | Low |
| `3173ba128` | fix(app): fade under sticky elements | Medium |
| `79ae749ed` | fix(app): don't change resize handle on hover | Low |
| `7f9ffe57f` | update thinking text styling in desktop app | Low |
| `c7f0cb3d2` | fix: remove focus outline from dropdown menu | Low |
| `b72a00eaa` | fix text field border showing through focus ring | Low |
| `d19e76d96` | fix: keyboard nav when mouse hovered over list (#9500) | Medium |

### Sidebar/Layout Fixes (Clean Apply)
| Hash | Description | Value |
|------|-------------|-------|
| `94ab87ffa` | fix: view all sessions state styles | Low |
| `2c5437791` | fix: updated project/sessions list width | Low |
| `e8dad8523` | fix: responsive menu desktop | Medium |
| `9a71a73f5` | fix: updating panel min size and button max-width | Low |
| `21012fab4` | fix: load more label alignment | Low |
| `e36b3433f` | fix: remove max width on sidebar new buttons | Low |
| `cad415872` | fix: recent sessions gutter | Low |
| `ab705dacf` | fix: add left padding to command items in search | Low |
| `53227bfc2` | fix: command palette file list item spacing | Low |

### Edit Dialog Fixes (Clean Apply)
| Hash | Description | Value |
|------|-------------|-------|
| `89be504ab` | update: align edit project dialog padding/avatar | Low |
| `e12b94d91` | update: adjust edit project icon helper text | Low |
| `494e8d5be` | update: tweak edit project icon container | Low |
| `b0794172b` | update: tighten edit project color spacing | Low |

### Core/Config Fixes (Clean Apply)
| Hash | Description | Value |
|------|-------------|-------|
| `e1d0b2ba6` | fix: dynamic import for circular dep in config.ts | High |
| `98578d3a7` | fix(bun): reinstall plugins when cache missing (#8815) | High |
| `10433cb45` | fix(windows): fix jdtls download on Windows (#9195) | Medium |
| `3591372c4` | feat(tool): increase question header/label limits (#9201) | Medium |
| `2dcca4755` | fix: import issue in patch module | High |
| `b1684f3d1` | fix(config): rename uv formatter for consistency (#9409) | Low |
| `5b8672463` | fix: cargo fmt doesn't support single files | Low |
| `769c97af0` | chore: rm double conditional | Low |

### Docs (Clean Apply)
| Hash | Description | Value |
|------|-------------|-------|
| `db78a59f0` | docs: Add OpenWork to ecosystem (#8741) | Low |
| `eb968a665` | docs(config): autoupdate with package managers (#9092) | Low |
| `c29d44fce` | docs: note untracked files in review | Low |
| `b4d4a1ea7` | docs: clarify agent tool access (#9300) | Medium |

---

## ⏳ TODO: Desktop/App Conflicts (Phased Approach)

These have conflicts but are **valuable desktop features** worth manual resolution.
See "Phased Approach" section below for recommended order:

### High Priority Conflicts
| Hash | Description | Conflict Reason | Effort |
|------|-------------|-----------------|--------|
| `06bc4dcb0` | feat(desktop): session unshare button (#8660) | session-header.tsx changes | Medium |
| `ad2e03284` | refactor(desktop): session search button styling (#9251) | session-header.tsx changes | Low |
| `08005d755` | refactor(desktop): share button layout shift (#9322) | session-header.tsx changes | Low |
| `13276aee8` | fix(desktop): getComputedStyle polyfill all platforms (#9369) | desktop/index.tsx | Low |
| `0384e6b0e` | fix: update desktop initializing splash logo | desktop/index.tsx changes | Low |
| `657f3d508` | feat(app): unified search for commands/files | dialog-select-file.tsx | High |
| `49939c4d8` | feat(app): skeleton loader for sessions | layout.tsx changes | Medium |
| `086603494` | feat(app): edit project and session titles | layout.tsx + global-sync.tsx | Medium |
| `f26de6c52` | feat(app): delete workspace | layout.tsx + experimental routes | Medium |
| `093a3e787` | feat(app): reset worktree | layout.tsx + worktree | Medium |
| `befd0f163` | feat(app): new session layout | session.tsx + session-turn | High |
| `7811e01c8` | fix(app): new layout improvements | session-turn.tsx/css | High |
| `1f11a8a6e` | feat(app): improved session layout | layout.tsx + session.tsx | High |
| `a4d182441` | fix(app): no more favicons | layout.tsx + project.ts | Medium |
| `4ddfa86e7` | fix(app): message list overflow & scrolling (#9530) | session.tsx | Medium |
| `bfa986d45` | feat(app): select project directory text (#9344) | layout.tsx | Low |
| `b711ca57f` | fix(app): localStorage quota | persist.ts changes | Low |
| `353115a89` | fix(app): user message expand on click | message-part.tsx | Low |

### Medium Priority Conflicts (Sidebar/Layout)
| Hash | Description | Conflict Reason | Effort |
|------|-------------|-----------------|--------|
| `306fc05c0` | fix: project avatar border radius | layout.tsx | Low |
| `b1a22e08f` | fix: avatar radius and current project | layout.tsx | Low |
| `3ba03a97d` | fix: search bar size/padding, shortcut style | session-header.tsx | Low |
| `416f419a8` | fix: add default icon to sessions | layout.tsx | Low |
| `704276753` | bug: moved createMemo down | layout.tsx | Low |
| `74d584af3` | fix: session icon and label alignment | layout.tsx | Low |
| `a49102db0` | fix: truncate workspace name on hover | layout.tsx | Low |
| `4be0ba19c` | fix: web mobile menu | layout.tsx | Low |
| `d0399045d` | fix: hamburger centred with avatars | titlebar.tsx | Low |
| `e92d5b592` | fix(app): can't expand workspaces | layout.tsx | Low |
| `2ccaa10e7` | fix(app): open workspace on session nav | layout.tsx | Low |
| `95f7403da` | fix(app): truncate workspace title | layout.tsx | Low |
| `6e00348bd` | fix(app): remember last opened project | layout.tsx + server.tsx | Low |
| `c3d33562c` | fix: align project avatar notification dot | layout.tsx | Low |
| `d3baaf740` | fix: shrink project notification dot and mask | layout.tsx | Low |
| `0cc9a22a4` | fix: show project name in avatar hover | layout.tsx | Low |
| `c19d03114` | fix: reduce prompt dock bottom spacing | session.tsx | Low |
| `2a4e8bc01` | fix: adjust recent sessions popover padding | layout.tsx | Low |
| `c89085399` | fix: keep project avatar hover while popover open | layout.tsx | Low |
| `ded9bd26b` | fix: adjust session list tooltip trigger/delay | layout.tsx | Low |
| `389d97ece` | fix: adjust project path tooltip placement | layout.tsx | Low |

### Search Modal Conflicts
| Hash | Description | Conflict Reason | Effort |
|------|-------------|-----------------|--------|
| `b18fb16e9` | refactor: use Keybind in titlebar search button | session-header.tsx | Low |
| `d1b93616f` | fix: keybind border-radius in search modal | dialog-select-file.tsx | Low |
| `f8f1f46a4` | fix: command item left padding in search | dialog-select-file.tsx | Low |
| `dfa2a9f22` | fix: reduce command item left padding | dialog-select-file.tsx | Low |
| `d23c21023` | fix: refine search modal styling and list | dialog-select-file.tsx | Low |
| `ef7ef6538` | fix: limit search modal max-height to 480px | dialog-select-file.tsx | Low |
| `80b278dda` | fix: remove secondary text from commands | session.tsx | Low |
| `759ce8fb8` | fix: prevent text clipping on search button | session-header.tsx | Low |
| `07dc8d8ce` | fix: escape CSS selector keys (#9030) | list.tsx | Low |
| `092428633` | fix(app): layout jumping | list.tsx | Low |

### Session Popover/Hover Conflicts
| Hash | Description | Conflict Reason | Effort |
|------|-------------|-----------------|--------|
| `cf284e32a` | update session hover popover styling | layout.tsx + hover-card.css | Low |
| `a05c33470` | retain session hover state when popover open | layout.tsx + hover-card.css | Low |
| `ad31b555a` | position session messages popover at top | layout.tsx | Low |
| `7b336add8` | update session messages popover gutter to 28px | layout.tsx | Low |
| `b91b76e9e` | add 8px padding to recent sessions popover | layout.tsx | Low |

### Edit Project Dialog Conflicts
| Hash | Description | Conflict Reason | Effort |
|------|-------------|-----------------|--------|
| `9fbf2e72b` | update: constrain edit project dialog width | dialog-edit-project.tsx | Low |
| `2dbdd1848` | add hover overlay with upload/trash icons | dialog-edit-project.tsx + icon.tsx | Medium |
| `6ed656a61` | remove top padding from edit project form | dialog-edit-project.tsx | Low |

### Session Turn Conflicts
| Hash | Description | Conflict Reason | Effort |
|------|-------------|-----------------|--------|
| `c720a2163` | chore: cleanup | session-turn.css | Low |
| `eb779a7cc` | chore: cleanup | session-turn.tsx/css | Low |
| `bec294b78` | fix(app): remove copy button from summary | session-turn.tsx | Low |

---

## Irrelevant (Skip Entirely)

### TUI/CLI (Deleted)
All commits touching `src/cli/cmd/tui/*` - we deleted the TUI.

| Hash | Description |
|------|-------------|
| `83ed1adcb` | feat: add Carbonfox theme (#8723) |
| `07e7ebdb8` | fix(tui): add tab navigation in questions |
| `12b621068` | fix(tui): dim question option prefixes |
| `4af9defb8` | fix(tui): correct theme count tip |
| `46be47d0b` | stop select dialog event propagation |
| `ac5453548` | feat: add version to session header/status |
| `bd914a8c0` | Revert "stop select dialog event propagation" |
| `626fa1462` | fix: home/end keys in menu list modals |
| `08b94a689` | fix: keep primary model after subagent runs |
| `c25155586` | fix: open help dialog with tui/open-help route |
| `3d095e7fe` | fix: centralize OSC 52 clipboard for SSH |
| `93e43d8e5` | Hide variants hint when list empty |
| `759e68616` | refactor(tui): unify command registry |
| `bfb8c531c` | feat: bind vim-style line-by-line scrolling |
| `f3513bacf` | tui: fix model state persistence |
| `d939a3ad5` | feat(tui): use mouse for permission buttons |
| `e81bb8679` | fix: Windows evaluating text on copy |
| `c47699536` | fix: Don't wrap lines unnecessarily |
| `091e88c1e` | fix(opencode): sets input mode mouse vs keyboard |
| `88c5a7fe9` | fix(tui): clarify resume session tip |
| `aa4b06e16` | tui: fix message history cleanup memory leaks |

### Console/Zen/Black (Deleted)
All commits touching `packages/console/*` - we deleted console.

| Hash | Description |
|------|-------------|
| `7443b9929` | feat(console): Fix /black page View Transition Safari |
| `7e619a930` | zen: black admin |
| `12ae80856` | wip: zen |
| `e4a34beb8` | chore: update GitHub stars and commits statistics |
| `f66e6d703` | wip: zen |
| `ea8ef37d5` | wip: zen |
| `d5a5e6e06` | feat(console): /black shader improvements |
| `cbe1c8147` | wip: black |
| `f96c4badd` | wip: black |
| `e8746ddb1` | zen: fix opus unicode characters |
| `bee2f6540` | zen: fix checkout link for black users |
| `843d76191` | zen: fix black reset date |

### Provider/LLM (SDK Migration Made Irrelevant)
All commits touching deleted provider/llm code:

| Hash | Description | Why N/A |
|------|-------------|---------|
| `9b57db30d` | feat: add litellmProxy provider option | llm.ts deleted |
| `f4086ac45` | fix: subagent reasoningEffort not applied | task.ts deleted |
| `9d8d0e97e` | Revert subagent reasoningEffort | task.ts deleted |
| `8b08d340a` | fix: stop changing main model/agent from subtasks | prompt.ts deleted |
| `d47510785` | strip itemIds in more cases | transform.ts deleted |
| `d7192d6af` | tweak: set opencode as user agent | llm.ts deleted |
| `d8ef9f808` | test: fix transform test | transform.test.ts deleted |
| `40836e968` | fix: itemId stripping logic for gpt models | transform.ts deleted |
| `578239e0d` | chore: cleanup transform code | transform.ts deleted |
| `b8e2895df` | fix(app): support anthropic models on azure | llm.ts + transform.ts deleted |
| `14d1e2028` | Revert azure cognitive services | llm.ts + transform.ts deleted |
| `7c3eeeb0f` | fix: gpt id stuff fr fr this time | transform.ts deleted |
| `ea13b6e8a` | test: add azure test case | transform.test.ts deleted |
| `d841e70d2` | fix: bad variants for grok models | transform.ts deleted |
| `0d8e706fa` | test: fix transform test | transform.test.ts deleted |
| `fc6c9cbbd` | fix(github-copilot): auto-route GPT-5+ to Responses | transform.ts deleted |
| `260ab60c0` | fix: track reasoning by output_index for copilot | provider/sdk deleted |
| `3fd0043d1` | chore: handle fields in interleaved block | transform.ts deleted |

### Tool Descriptions (SDK Handles)
| Hash | Description | Why N/A |
|------|-------------|---------|
| `5092b5f07` | docs: clarify question tool guidance | question.txt deleted |
| `1a43e5fe8` | fix: websearch tool date emphasis | websearch.ts/txt deleted |
| `b7ad6bd83` | feat: apply_patch tool for openai models | tool/registry.ts deleted |
| `4299450d7` | tweak apply_patch tool description | apply_patch.ts/txt deleted |
| `dd0906be8` | tweak: apply patch description | apply_patch.txt deleted |
| `673e79f45` | tweak(batch): up max batch tool from 10 to 25 | batch.ts/txt deleted |
| `36f5ba52e` | fix(batch): update batch tool definition | batch.txt deleted |
| `9706aaf55` | rm filetime assertions from patch tool | apply_patch.ts deleted |
| `616329ae9` | chore: generate (apply_patch) | apply_patch.ts deleted |
| `3515b4ff7` | omit todo tools for openai models | registry.ts deleted |

### Session/Prompt (SDK Migration)
| Hash | Description | Why N/A |
|------|-------------|---------|
| `de2de099b` | fix: rm user message with image attachments | prompt.ts deleted |
| `e0a854f03` | Revert image attachment fix | prompt.ts deleted |
| `8fd1b92e6` | fix: tool attachments not sent as user messages | prompt.ts deleted |
| `f5a6a4af7` | Revert tool attachment fix | prompt.ts deleted |
| `bfd2f91d5` | feat(hook): command execute before hook | prompt.ts deleted |
| `0d49df46e` | fix: truncation handling for mcp servers | prompt.ts deleted |
| `419004992` | chore: remove duplicate prompt file | prompt file conflict |

### Nix (Deleted)
All commits touching nix/* or flake.* files:

| Hash | Description |
|------|-------------|
| `a7cae8f67` | fix: nix desktop workflow |
| `aca1eb6b5` | fix(nix): add desktop application entry |
| `6e020ef9e` | chore: cleanup nix |
| `55224d64a` | Update flake.lock |
| `43a9c5038` - `f5eb90514` | Update node_modules hash (various platforms) |
| `06c543e93` | fix(nix): resolve hash race condition |
| `dac099a48` | feat(nix): overhaul nix flake and packages |
| `2fc4ab968` | ci: simplify nix hash updates |
| `91787ceb3` | fix: nix ci - swapped dash/underscore |

### Releases/Stats (Skip)
| Hash | Description |
|------|-------------|
| `bc3616d9c` | release: v1.1.24 |
| `968239bb7` | release: v1.1.25 |
| `1ee8a9c0b` | release: v1.1.26 |
| `f197b8a0c` | ignore: update download stats 2026-01-16 |
| `a58d1be82` | ignore: update download stats 2026-01-17 |
| `5c9cc9c74` | ignore: update download stats 2026-01-18 |
| `06d03dec3` | ignore: update download stats 2026-01-19 |

### SDK/Docs Generation (Usually Conflicts)
| Hash | Description | Note |
|------|-------------|------|
| Multiple `chore: generate` | Various SDK regen | Usually conflict |
| Various docs commits | providers.mdx, acp.mdx conflicts | Some may apply |

### Test/E2E (Conflicts on Deleted)
| Hash | Description |
|------|-------------|
| `03d7467ea` | test(app): initial e2e test setup |
| `19d15ca4d` | test(app): more e2e tests |
| `dd19c3d8f` | test(app): e2e utilities |
| `f1daf3b43` | fix(app): tests in ci |
| `182c43a78` | chore: cleanup (e2e) |
| `b90315bc7` | chore: cleanup (test.yml) |
| `e9ede7079` | chore: cleanup (test.yml) |
| `1ba7c606e` | chore: cleanup (e2e specs) |

### MCP/OAuth (Conflicts)
| Hash | Description | Reason |
|------|-------------|--------|
| `b572c6810` | fix(mcp): show auth URL when browser can't open | cli/cmd/mcp.ts deleted |
| `40b275d7e` | feat(mcp): add OAuth redirect URI configuration | complex conflict |
| `33290c54c` | Revert OAuth redirect URI configuration | complex conflict |

### ACP (Conflicts but Less Relevant)
| Hash | Description | Reason |
|------|-------------|--------|
| `bef1f6628` | fix(acp): single global event subscription (#5628) | acp/agent.ts conflict |
| `095a64291` | fix(acp): preserve file attachment metadata (#6342) | acp/agent.ts conflict |

### Misc Conflicts (Low Priority)
| Hash | Description | Reason |
|------|-------------|--------|
| `81983d4a2` | fix(agent): default agent selection in acp/headless | agent/agent.ts conflict |
| `052f887a9` | core: prevent env vars in config from being replaced | config.ts conflict |
| `6b481b5fb` | fix(opencode): use streamObject for openai oauth in agent | agent/agent.ts conflict |
| `e2f1f4d81` | add scheduler, cleanup module (#9346) | snapshot + truncation conflict |
| `501ef2d98` | fix: update gitlab-ai-provider to 1.3.2 | bun.lock + package.json |
| `38c641a2f` | fix(tool): treat .fbs files as text | tool/read.ts deleted |
| `fc50b2962` | fix(app): terminal sessions scoped to workspace | terminal.tsx conflict |
| `c2f9fd5fe` | fix(app): reload instance after workspace reset | layout.tsx conflict |
| `88fd6a294` | feat(desktop): Terminal Splits (#8767) | terminal-split.tsx add/add |
| `71306cbd1` | Revert Terminal Splits | terminal-split.tsx |
| `889c60d63` | fix(web): rename favicons to v2 for cache busting | Multiple conflicts |
| `ecc51ddb4` | fix(app): hash nav | layout.tsx + session.tsx |
| `d605a78a0` | fix(app): keybind for cycling thinking effort | session.tsx |
| `4e04bee0c` | fix(app): favicon | layout.tsx |
| `272970559` | fix(app): archive session sometimes flaky | layout.tsx |
| `054ccee78` | update review session empty state styling | session.tsx |

---

## Summary

| Category | Clean (Done) | Conflict (TODO) | Irrelevant/Skip |
|----------|--------------|-----------------|-----------------|
| Desktop Core | 5 ✅ | 5 | 0 |
| App UI Fixes | 13 ✅ | 50+ | 0 |
| UI Components | 12 ✅ | 15 | 0 |
| Core/Config | 8 ✅ | 3 | 0 |
| Sidebar/Layout | 9 ✅ | - | 0 |
| Edit Dialog | 4 ✅ | - | 0 |
| Docs | 4 ✅ | 4 | 0 |
| TUI | 0 | 0 | 21 |
| Console/Zen | 0 | 0 | 12 |
| Provider/LLM | 0 | 0 | 17 |
| Tool Descriptions | 0 | 0 | 10 |
| Session/Prompt | 0 | 0 | 6 |
| Nix | 0 | 0 | 20+ |
| Releases/Stats | 0 | 0 | 7 |
| Tests/E2E | 2 | 8 | 0 |
| **Total** | **54 ✅** | **~48** | **~93** |

### Progress
```
Clean applies: 54 commits ✅
Phased conflicts: ~48 commits ⏳
Skipped: ~93 commits ❌
```

---

## Phased Approach (Remaining Work)

### ⏳ Phase 1: Bug Fixes (6 commits)

| Hash | Description | Conflict Level |
|------|-------------|----------------|
| `13276aee8` | fix(desktop): getComputedStyle polyfill all platforms | Low |
| `704276753` | bug: moved createMemo down | Low |
| `e92d5b592` | fix(app): can't expand workspaces | Medium |
| `2ccaa10e7` | fix(app): open workspace on session nav | Low |
| `416f419a8` | fix: add default icon to sessions | Low |
| `4be0ba19c` | fix: web mobile menu | Low |

### ⏳ Phase 2: List/Search Robustness (2 commits)

| Hash | Description | Conflict Level |
|------|-------------|----------------|
| `07dc8d8ce` | fix: escape CSS selector keys | Low |
| `092428633` | fix(app): layout jumping (custom scrollIntoView) | Low |

### ⏳ Phase 3: Pure Styling (~25 commits)

Avatar, Workspace, Search/Dialog, and Popover styling fixes.
See "Medium Priority Conflicts" tables above for full list.

### ⏳ Phase 4: Workspace Management (3 commits)

| Hash | Description | Conflict Level |
|------|-------------|----------------|
| `086603494` | feat(app): edit project and session titles | Medium |
| `f26de6c52` | feat(app): delete workspace | Medium |
| `093a3e787` | feat(app): reset worktree | Medium |

### ⏳ Phase 5: Session Layout Architecture (6 commits) - CAREFUL

**WARNING**: These commits change the title system significantly.

| Hash | Description | Conflict Level |
|------|-------------|----------------|
| `1f11a8a6e` | feat(app): improved session layout | **High** |
| `befd0f163` | feat(app): new session layout | **High** |
| `7811e01c8` | fix(app): new layout improvements | **High** |
| `eb779a7cc` | chore: cleanup | Low |
| `c720a2163` | chore: cleanup | Low |
| `bec294b78` | fix(app): remove copy button from summary | Low |

**Key conflict**: Upstream uses `props.sessionTitle` with conditional `titleShown` logic.
Our fork uses `msg().summary?.title` displayed unconditionally.
Must preserve our approach when resolving these conflicts.

### ⏳ Phase 6: Misc Features (5 commits)

| Hash | Description | Conflict Level |
|------|-------------|----------------|
| `a4d182441` | fix(app): no more favicons | Low |
| `6e00348bd` | fix(app): remember last opened project | Low |
| `0384e6b0e` | fix: update desktop initializing splash logo | Low |
| `4ddfa86e7` | fix(app): message list overflow & scrolling | Low |
| `353115a89` | fix(app): user message expand on click | Low |

### ❌ SKIP: Share Functionality

Policy decision: Remove sharing entirely

- SKIP `06bc4dcb0` - feat(desktop): session unshare button
- SKIP `ad2e03284` - refactor(desktop): session search button styling
- SKIP `08005d755` - refactor(desktop): share button layout shift

---

## Notes

**Key Files with Many Conflicts**:
- `layout.tsx` - Many sidebar/workspace commits touch this file
- `session-turn.tsx` - Session layout changes touch this file
- `session.tsx` - Various session-related commits

**Recommended Approach**:
1. Apply phases 1-4 one at a time, verify build after each phase
2. Apply phase 5 (Session Layout) with extra care - review each change manually
3. Apply phase 6 last

**What to preserve in our fork**:
- Two-row session item design in layout.tsx
- `msg().summary?.title` approach for session titles (not upstream's `props.sessionTitle`)
- "Claudius" branding (not OpenCode)
