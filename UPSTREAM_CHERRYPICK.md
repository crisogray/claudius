# Upstream Cherry-Pick Analysis

**Range**: v1.1.27 → v1.1.43
**Date**: 2026-01-30
**Total Commits**: ~836
**Status**: ⏳ Analysis complete, cherry-picks TODO

---

## Current State

| Phase         | Description                                                     | Status                                |
| ------------- | --------------------------------------------------------------- | ------------------------------------- |
| Previous Work | v1.1.23 → v1.1.27 (83 commits)                                  | ✅ DONE                               |
| New Range     | v1.1.27 → v1.1.43 (836 commits)                                 | ⏳ Cherry-picks in progress           |

---

## Cherry-Pick Progress (2026-02-01)

| Phase | Description | Status | Notes |
| ----- | ----------- | ------ | ----- |
| Phase 1 | AGENTS.md Features | ⚠️ PARTIAL | /learn command added, backend commits blocked by SDK architecture |
| Phase 2 | Performance | ⏸️ SKIPPED | SDK architecture conflicts (worktree.ts deleted) |
| Phase 4 | Settings Overhaul | ✅ DONE | Settings dialog fully functional, sound utils added |
| Phase 7 | Core/Config Fixes | ✅ PARTIAL | Unicode filenames, DISABLE_PROJECT_CONFIG, DISABLE_FILETIME_CHECK |
| Phase 3 | Line Selection | ⚠️ BLOCKED | Shadow DOM complexity in pierre diffs library |
| Phase 5 | Desktop Features | ✅ PARTIAL | Tooltip position fix applied |
| Phase 6 | Terminal Fixes | ✅ DONE | Terminal cleanup, adapted for our tabId split architecture |
| Phase 6 | Auto-scroll Fixes | ✅ DONE | All 11 auto-scroll commits applied |
| Phase 6-8 | Remaining | ⏸️ BLOCKED | i18n dependencies, heavy conflicts |

### Applied Commits

| Hash | Description | Phase |
| ---- | ----------- | ----- |
| manual | /learn command file (.opencode/command/learn.md) | Phase 1 |
| `8bcbfd639` | wip(app): settings - initial structure | Phase 4 |
| `de3641e8e` | wip(app): settings - sound utilities | Phase 4 |
| `df094a10f` | wip(app): settings - keybinds and command context | Phase 4 |
| `32e6bcae3` | fix: unicode filename handling in snapshot diff | Phase 7 |
| `a18ae2c8b` | feat: add OPENCODE_DISABLE_PROJECT_CONFIG | Phase 7 |
| `c9ea96680` | feat: add OPENCODE_DISABLE_FILETIME_CHECK | Phase 7 |
| `366da595a` | fix: tooltip position to bottom | Phase 5 |
| manual | enable settings button in sidebar | Phase 4 |
| manual | fix notification.tsx sound for permission/question/plan events | Phase 4 |
| `41f2653a3` | fix(app): prompt submission failing on first message | Standalone |
| `14b00f64a` | fix(app): escape should always close dialogs | Standalone |
| `52535654e` | fix(app): tab should select suggestion | Standalone |
| `156ce5436` | fix(ui): prevent Enter key action during IME composition | Standalone |
| `07015aae0` | fix(app): folder suggestions missing last part | Standalone |
| `9424f829e` | fix(ui): allow KaTeX inline math to be followed by punctuation | Standalone |
| `3e6710425` | fix(app): show retry status only on active turn | Standalone |
| `33d400c56` | fix(app): spinner color inherits | Standalone |
| manual | Terminal cleanup: pty.exited handler, WS close, auto-close panel | Phase 6 |
| manual | Terminal clone fix: proper tabId handling for remount | Phase 6 |
| `b4a9e1b19` | fix(app): auto-scroll | Phase 6 |
| `d7948c237` | fix(app): auto-scroll | Phase 6 |
| `b6565c606` | fix(app): auto-scroll button sometimes sticks | Phase 6 |
| `3807523f4` | fix(app): auto-scroll | Phase 6 |
| `09997bb6c` | fix(app): auto-scroll | Phase 6 |
| `ae2693425` | fix(app): snap to bottom on prompt | Phase 6 |
| `85ef23a09` | fix(app): don't interfere with scroll when using message nav | Phase 6 |
| `847a7ca00` | fix(app): don't show scroll to bottom if no scroll | Phase 6 |
| `a0636fcd5` | fix(app): auto-scroll ux | Phase 6 |
| `c69e3bbde` | fix(app): auto-scroll ux | Phase 6 |
| `63da3a338` | fix(app): breaking out of auto-scroll | Phase 6 |
| manual | Session loading deduplication (booting/sessionLoads Maps) | Phase 6 |
| manual | Hover card viewport overflow fix (max-height, overflow-y) | Phase 6 |
| `923e3da97` | feat(ui): add aura theme | Misc |
| `936f3ebe9` | feat(ui): add gruvbox theme | Misc |
| `7962ff38b` | feat(app): add transition to command palette | UI/Dialog |
| `3ac11df66` | feat(app): add transition to select provider dialog | UI/Dialog |
| `1d5ee3e58` | fix(app): not auto-navigating to last project | Project |
| `1f3b2b595` | fix(app): Edit-project name race condition | Project |
| `e5fe50f7d` | fix(app): close delete workspace dialog immediately | UI/Dialog |
| `80dc74a0e` | add keyboard shortcut (mod+,) to open settings dialog | Misc |
| manual | Add transition prop to Dialog component | UI/Dialog |

### Conflict Resolution Notes

- **AGENTS.md backend commits**: SDK tool architecture differences, files deleted in our fork
- **Performance commits**: Heavy worktree dependencies, files deleted in our fork
- **Line Selection**: Shadow DOM in pierre diffs blocks text selection events; needs custom implementation
- **Settings**: Applied cleanly after resolving dialog.tsx and notification.tsx conflicts
- **UI Fixes**: Many commits depend on i18n (`language.t()`) which we don't have
- **Terminal Splits**: Upstream added then reverted terminal splits (PR #8767). We kept the feature, so terminal fixes need adaptation for our `tabId` architecture
- **Remaining fixes**: Heavy divergence from upstream makes cherry-picking difficult

### Commit Breakdown Summary

| Category                        | Count  | Action |
| ------------------------------- | ------ | ------ |
| Releases/Stats/Downloads        | ~60    | SKIP   |
| CI/Nix/Hashes                   | ~60    | SKIP   |
| Chore: generate/format          | ~78    | SKIP   |
| Zen/Black (console)             | ~14    | SKIP   |
| TUI                             | ~8     | SKIP   |
| Test/E2E                        | ~28    | SKIP   |
| File Tree (ours is better)      | ~25    | SKIP   |
| Provider/LLM (SDK migration)    | ~15    | SKIP   |
| Line Selection + Comments       | ~50    | ⏳ REVIEW (mostly net new) |
| Settings Overhaul               | ~25    | ⏳ REVIEW (mostly net new) |
| i18n/Translations               | ~38    | ⏳ OPTIONAL (medium-high effort) |
| Desktop Features                | ~16    | ⏳ REVIEW |
| App/UI Fixes                    | ~100+  | ⏳ REVIEW |
| Core/Config                     | ~15    | ⏳ REVIEW |
| Performance                     | ~10    | ⏳ REVIEW |
| AGENTS.md Features              | ~4     | ⏳ HIGH PRIORITY |

---

## Policy Decisions (Updated)

| Category             | Decision                                                  |
| -------------------- | --------------------------------------------------------- |
| File Tree            | **SKIP** - Our implementation is better                   |
| Line Selection       | **ACCEPT** - Mostly net new files, useful feature         |
| Comment Cards        | **ACCEPT** - Part of line selection, mostly net new       |
| Settings Overhaul    | **ACCEPT** - Mostly net new files, cleaner settings UI    |
| i18n/Translations    | **OPTIONAL** - Medium-high effort, can add later          |
| Zen/Black            | **SKIP** - Console deleted                                |
| TUI                  | **SKIP** - TUI deleted                                    |
| Provider/LLM         | **SKIP** - SDK migration makes irrelevant                 |
| Desktop Features     | **ACCEPT** - Bug fixes and useful features                |
| App/UI Fixes         | **SELECTIVE** - Bug fixes, avoid feature conflicts        |
| AGENTS.md Features   | **HIGH PRIORITY** - Very useful for agent behavior        |
| Performance          | **ACCEPT** - Memory and rendering improvements            |

---

## ⭐ HIGH PRIORITY: AGENTS.md Improvements

These are very valuable commits that improve agent behavior:

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `39a73d489` | feat: dynamically resolve AGENTS.md files from subdirectories    | High   |
| `b59aec6f0` | feat: add /learn command to extract session learnings            | High   |
| `558590712` | fix: ensure parallel tool calls dont double load AGENTS.md       | Medium |
| `07d84fe00` | feat(app): show loaded agents.md files                           | Medium |

---

## ⭐ HIGH PRIORITY: Performance Improvements

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `842f17d6d` | perf(app): better memory management                              | High   |
| `27bb82761` | perf(app): shared terminal ghostty-web instance                  | High   |
| `c7e2f1965` | perf(app): cleanup connect provider timers                       | Medium |
| `3e420bf8e` | perf(app): don't keep parts in memory                            | High   |
| `c87232d5d` | perf(app): performance improvements                              | Medium |
| `d03c5f6b3` | perf(app): performance improvements                              | Medium |
| `dcc8d1a63` | perf(app): performance improvements                              | Medium |
| `da8f3e92a` | perf(app): better session stream rendering                       | High   |
| `4afb46f57` | perf(app): don't remount directory layout                        | Medium |
| `c4d223eb9` | perf(app): faster workspace creation                             | Medium |

---

## ⭐ HIGH PRIORITY: Desktop Features

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `2af326606` | feat(desktop): Add desktop deep link (#10072)                    | High   |
| `d00b8df77` | feat(desktop): properly integrate window controls on windows     | High   |
| `c365f0a7c` | feat: add restart and reload menu items on macOS                 | Medium |
| `98b66ff93` | feat(desktop): add Iosevka as a font choice                      | Low    |
| `65d9e829e` | feat(desktop): standardize desktop layout icons                  | Medium |
| `57ad1814e` | fix(desktop): enable ctrl+n and ctrl+p for popover navigation    | Medium |
| `d9e8b2b65` | fix(desktop): disable magnification gestures on macOS            | Medium |
| `df2ed9923` | fix(desktop): Navigation with Big Sessions                       | High   |
| `b29898226` | fix(desktop): Fixed reactive feedback loop in global project cache | High |
| `c3f393bcc` | fix(desktop): Expand font stacks to include macOS Nerd Font      | Low    |
| `b776ba6b7` | fix(desktop): correct NO_PROXY syntax                            | Medium |
| `224b2c37d` | fix(desktop): attempt to improve connection reliability          | Medium |
| `d6caaee81` | fix(desktop): no proxy for connecting to sidecar                 | Medium |
| `ab705bbc3` | fix(desktop): add workaround for nushell                         | Low    |
| `366da595a` | fix(desktop): change project path tooltip position to bottom     | Low    |
| `c73777695` | refactor(desktop): move markdown rendering to rust               | Medium |

---

## ⭐ HIGH PRIORITY: Line Selection + Comments Feature

**Difficulty: MEDIUM** - Mostly net new files with some modifications to existing components.

### New Files (Clean Additions)

| File | Lines | Description |
| ---- | ----- | ----------- |
| `packages/app/src/context/comments.tsx` | +155 | Comment state management context |
| `packages/ui/src/components/line-comment.tsx` | new | Line comment component |
| `packages/ui/src/components/line-comment.css` | new | Line comment styles |

### Modified Files (Need Review)

| File | Changes | Risk |
| ---- | ------- | ---- |
| `packages/ui/src/components/code.tsx` | +392 lines | Medium - adds line selection to code blocks |
| `packages/ui/src/components/diff.tsx` | +558 lines | Medium - adds line selection to diffs |
| `packages/app/src/pages/session.tsx` | +340 lines | Medium - integrates comment UI |
| `packages/app/src/components/prompt-input.tsx` | ~40 lines | Low - comment card display |

### Core Commits (in order)

| Hash | Description |
| ---- | ----------- |
| `640d1f1ec` | wip(app): line selection - initial implementation |
| `0ce0cacb2` | wip(app): line selection |
| `cb481d9ac` | wip(app): line selection |
| `1e1872aad` | wip(app): line selection |
| `99e15caaf` | wip(app): line selection |
| `0eb523631` | wip(app): line selection |
| `82f718b3c` | wip(app): line selection |
| `1780bab1c` | wip(app): line selection |
| `82ec84982` | Reapply "wip(app): line selection" |

### Polish/Fix Commits

| Hash | Description |
| ---- | ----------- |
| `6c1e18f11` | fix(app): line selection waits on ready |
| `5369e96ab` | fix(app): line selection colors |
| `9a89cd91d` | fix(app): line selection styling |
| `4c2d597ae` | fix(app): line selection colors |
| `d90b4c9eb` | fix(app): line selection ux |
| `42b802b68` | fix(app): line selection ux fixes |
| `6d8e99438` | fix(app): line selection fixes |

### Comment Card Styling (~27 commits)

All the `fix(app): comment*` and `fix(ui): comment*` commits for styling refinements.

---

## ⭐ HIGH PRIORITY: Settings Overhaul

**Difficulty: MEDIUM** - Mostly net new component files with clean integration points.

### New Files (Clean Additions - ~1,600 lines)

| File | Lines | Description |
| ---- | ----- | ----------- |
| `packages/app/src/context/settings.tsx` | +177 | Settings state management |
| `packages/app/src/components/dialog-settings.tsx` | +82 | Settings dialog container |
| `packages/app/src/components/settings-general.tsx` | +417 | General settings panel |
| `packages/app/src/components/settings-keybinds.tsx` | +434 | Keyboard shortcuts panel |
| `packages/app/src/components/settings-providers.tsx` | +263 | Provider settings panel |
| `packages/app/src/components/settings-permissions.tsx` | +228 | Permissions panel |
| `packages/app/src/components/settings-models.tsx` | +130 | Model settings panel |
| `packages/app/src/components/settings-agents.tsx` | +15 | Agents panel (stub) |
| `packages/app/src/components/settings-commands.tsx` | +15 | Commands panel (stub) |
| `packages/app/src/components/settings-mcp.tsx` | +15 | MCP panel (stub) |

### Modified Files (Need Review)

| File | Changes | Risk |
| ---- | ------- | ---- |
| `packages/app/src/app.tsx` | ~40 lines | Low - add settings context provider |
| `packages/app/src/pages/layout.tsx` | ~5 lines | Low - add settings trigger |
| `packages/ui/src/components/dialog.tsx` | ~4 lines | Low - x-large size support |
| `packages/ui/src/components/tabs.tsx` | ~9 lines | Low - settings variant |

### Core Commits

| Hash | Description |
| ---- | ----------- |
| `8bcbfd639` | wip(app): settings - initial structure |
| `de3641e8e` | wip(app): settings |
| `df094a10f` | wip(app): settings |
| `924fc9ed8` | wip(app): settings |
| `03d884797` | wip(app): provider settings |
| `c323d96de` | wip(app): provider settings |
| `1934ee13d` | wip(app): model settings |
| `84b12a8fb` | feat(app): model settings |
| `65e1186ef` | wip(app): global config |
| `2f35c40bb` | chore(app): global config changes |
| `bdfd8f8b0` | feat(app): custom provider |

### Settings Styling Commits (~15 commits)

Various commits for select dropdowns, tabs, icons, spacing, etc.

---

## OPTIONAL: i18n/Translations

**Difficulty: MEDIUM-HIGH** - Translation files are easy, but requires modifying many components.

### Assessment

| Aspect | Details |
| ------ | ------- |
| Translation files | ~11,000 lines across 15 language files (easy copy) |
| Infrastructure | `context/language.tsx` (+198 lines) - language context |
| Component changes | Many components need `t()` function calls |
| Languages included | EN, ZH, ZHT, JA, KO, DE, FR, ES, PL, RU, AR, BR, DA, NO, TH |

### New Files (Clean Additions)

| File | Lines | Description |
| ---- | ----- | ----------- |
| `packages/app/src/context/language.tsx` | +198 | Language context provider |
| `packages/app/src/i18n/en.ts` | +734 | English translations |
| `packages/app/src/i18n/*.ts` | ~720 each | Other language files (14 total) |

### Estimated Effort

| Task | Effort |
| ---- | ------ |
| Copy translation infrastructure | Low |
| Copy language files | Low |
| Modify components to use `t()` | Medium-High |
| Test all UI strings | Medium |

### Recommendation

**Phased approach:**
1. **Phase 1**: Add infrastructure only (`context/language.tsx`, `i18n/en.ts`)
2. **Phase 2**: Gradually add `t()` calls to components as needed
3. **Phase 3**: Add additional language files when ready

### Core Commits

| Hash | Description |
| ---- | ----------- |
| `0470717c7` | feat(app): initial i18n stubbing |
| `92beae141` - `233d003b4` | wip(app): i18n (infrastructure) |
| `e6438aa3f` | feat(app): korean translations |
| `118b4f65d` | feat(app): german translations |
| `09a9556c7` | feat(app): spanish translations |
| `efff52714` | feat(app): french translations |
| `4a386906d` | feat(app): japanese translations |
| `8b0353cb2` | feat(app): danish translations |
| `5ca28b645` | feat(app): polish translations |
| `383c2787f` | feat(i18n): add Russian language support |
| `23daac217` | feat(i18n): add Traditional Chinese |
| `ba2e35e29` | feat(i18n): add Arabic language support |
| `8427f40e8` | feat: Add support for Norwegian translations |
| `32f72f49a` | feat(i18n): add br locale support |
| `775d28802` | feat(i18n): add th locale support |

---

## Medium Priority: App Bug Fixes

### Session/Workspace Fixes

| Hash        | Description                                                      | Value  | Status |
| ----------- | ---------------------------------------------------------------- | ------ | ------ |
| `e84d92da2` | feat: Sequential numbering for forked session titles             | Medium | |
| `d4e3acf17` | fix(app): session sync issue                                     | High   | |
| `319ad2a39` | fix(app): session load cap                                       | Medium | |
| `e2c57735b` | fix(app): session diffs not always loading                       | Medium | |
| `71cd59932` | fix(app): session shouldn't be keyed                             | Medium | |
| `8595dae1a` | fix(app): session loading loop                                   | High   | ✅ Core dedup |
| `7170983ef` | fix(app): duplicate session loads                                | Medium | ✅ Via dedup |
| `7b23bf7c1` | fix(app): don't auto nav to workspace after reset                | Low    |
| `7c2e59de6` | fix(app): new workspace expanded and at the top                  | Low    |
| `5f67e6fd1` | fix(app): don't jump accordion on expand/collapse                | Low    |
| `7f862533d` | fix(app): better pending states for workspace operations         | Medium |
| `c72d9a473` | fix(app): View all sessions flakiness                            | Medium |

### Terminal Fixes

**Note**: Upstream added terminal splits (PR #8767) then reverted it the same day. We kept the feature, so these fixes needed manual adaptation for our `tabId` architecture.

| Hash        | Description                                                      | Value  | Status |
| ----------- | ---------------------------------------------------------------- | ------ | ------ |
| `01b12949e` | fix(app): terminal no longer hangs on exit or ctrl + D           | High   | ✅ Adapted |
| `80481c224` | fix(app): cleanup pty.exited event listener on unmount           | Medium | ✅ Adapted |
| `3fdd6ec12` | fix(app): terminal clone needs remount                           | Medium | ✅ Adapted |
| `df7f9ae3f` | fix(app): terminal corruption                                    | High   | ✅ Included in clone fix |
| `3ba1111ed` | fix(app): terminal issues/regression                             | High   | ⏸️ Review needed |
| `87d91c29e` | fix(app): terminal improvements - focus, rename, error state     | High   | ⏸️ Review needed |
| `2f1be914c` | fix(app): remove terminal connection error overlay               | Low    | SKIP |
| `af1e2887b` | fix(app): open terminal pane when creating new terminal          | Low    | SKIP |
| `281c9d187` | fix(app): change terminal.new keybind to ctrl+alt+t              | Low    |

### Auto-scroll Fixes ✅ DONE

| Hash        | Description                                                      | Value  | Status |
| ----------- | ---------------------------------------------------------------- | ------ | ------ |
| `b4a9e1b19` | fix(app): auto-scroll                                            | Medium | ✅ |
| `d7948c237` | fix(app): auto-scroll                                            | Medium | ✅ |
| `b6565c606` | fix(app): auto-scroll button sometimes sticks                    | Low    | ✅ |
| `3807523f4` | fix(app): auto-scroll                                            | Medium | ✅ |
| `09997bb6c` | fix(app): auto-scroll                                            | Medium | ✅ |
| `ae2693425` | fix(app): snap to bottom on prompt                               | Medium | ✅ |
| `85ef23a09` | fix(app): don't interfere with scroll when using message nav     | Medium | ✅ |
| `847a7ca00` | fix(app): don't show scroll to bottom if no scroll               | Low    | ✅ |
| `a0636fcd5` | fix(app): auto-scroll ux                                         | Medium | ✅ |
| `c69e3bbde` | fix(app): auto-scroll ux                                         | Medium | ✅ |
| `63da3a338` | fix(app): breaking out of auto-scroll                            | Medium | ✅ |

### Model Selector Fixes

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `dc1ff0e63` | fix(app): model select not closing on escape                     | Low    |
| `7ba25c6af` | fix(app): model selector ux                                      | Medium |
| `b951187a6` | fix(app): no select on new session                               | Low    |
| `27b45d070` | fix(app): scrolling for unpaid model selector                    | Low    |
| `00e79210e` | fix(app): tooltips causing getComputedStyle errors in model select | Medium |
| `19c787449` | fix(app): select model anchor                                    | Low    |
| `e376e1de1` | fix(app): enable dialog dismiss on model selector                | Low    |
| `f7a4cdcd3` | fix(app): no default model crash                                 | High   |
| `7655f51e1` | fix(app): add connect provider in model selector                 | Medium |

### UI/Dialog Fixes

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `aa1d0f616` | fix(app): better header item wrapping                            | Low    |
| `36df0d823` | fix(app): alignment and padding in dialogs                       | Low    |
| `14b00f64a` | fix(app): escape should always close dialogs                     | Medium |
| `f607353be` | fix(app): close review pane                                      | Low    |
| `d9741866c` | fix(app): reintroduce review tab                                 | Medium |
| `e5fe50f7d` | fix(app): close delete workspace dialog immediately              | Low    |
| `7962ff38b` | feat(app): add transition to command palette                     | Low    |
| `3ac11df66` | feat(app): add transition to select provider dialog              | Low    |
| `7caf59b43` | fix(ui): prevent double-close and fix dialog replacement         | Medium |
| `c551f7e47` | fix(ui): reduce dialog transition in time to 150ms               | Low    |

### Prompt/Input Fixes

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `2f9f588f7` | fix(app): submit button state                                    | Medium |
| `41f2653a3` | fix(app): prompt submission failing on first message             | High   |
| `52535654e` | fix(app): tab should select suggestion                           | Medium |
| `156ce5436` | fix(ui): prevent Enter key action during IME composition         | Medium |

### Project Fixes

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `1d5ee3e58` | fix(app): not auto-navigating to last project                    | Medium |
| `14db336e3` | fix(app): flash of fallback icon for projects                    | Low    |
| `2b9b98e9c` | fix(app): project icon color flash on load                       | Low    |
| `07015aae0` | fix(app): folder suggestions missing last part                   | Medium |
| `972cb01d5` | fix(app): allow adding projects from any depth                   | Medium |
| `a8018dcc4` | fix(app): allow adding projects from root                        | Medium |
| `bcf7a65e3` | fix(app): non-git projects should be renameable                  | Medium |
| `1f3b2b595` | fix(app): Edit-project name race condition                       | Medium |
| `ae8cff22e` | fix(app): renaming non-git projects shouldn't affect other projects | Medium |
| `d115f33b5` | fix(app): don't allow workspaces in non-vcs projects             | Medium |

### Miscellaneous App Fixes

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `095328faf` | fix(app): non-fatal error handling                               | Medium |
| `743e83d9b` | fix(app): agent fallback colors                                  | Low    |
| `33d400c56` | fix(app): spinner color                                          | Low    |
| `1ebf63c70` | fix(app): don't connect to localhost through vpn                 | Medium |
| `eac2d4c69` | fix(app): navigate to tabs when opening file                     | Medium |
| `3297e5230` | fix(app): open markdown links in external browser                | Medium |
| `984518b1c` | fix(app): restore external link opening in system browser        | Medium |
| `7fcdbd155` | fix(app): Order themes alphabetically                            | Low    |
| `7c34319b1` | fix(app): query selector with non-latin chars                    | Medium |
| `3296b9037` | fix(app): handle non-tool call permissions                       | Medium |
| `8d1a66d04` | fix(app): unnecessary suspense flash                             | Low    |
| `399fec770` | fix(app): markdown rendering with morphdom for better dom        | Medium |
| `6abe86806` | fix(app): better error screen when connecting to sidecar         | Medium |
| `962ab3bc8` | fix(app): reactive loops                                         | High   |
| `a900c8924` | fix(app): mobile horizontal scrolling due to session stat btn    | Low    |
| `caecc7911` | fix(app): cursor on resize                                       | Low    |
| `6d656e482` | fix(app): querySelector errors, more defensive scroll-to-item    | Medium |
| `46de1ed3b` | fix(app): windows path handling issues                           | Medium |

---

## Medium Priority: Core/Config Features

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `45ec3105b` | feat: support config skill registration                          | Medium |
| `b5ffa997d` | feat(config): add managed settings support for enterprise        | Low    |
| `aa92ef37f` | tweak: add 'skill' to permissions config section                 | Low    |
| `a18ae2c8b` | feat: add OPENCODE_DISABLE_PROJECT_CONFIG env var                | Medium |
| `c9ea96680` | feat: add OPENCODE_DISABLE_FILETIME_CHECK flag                   | Medium |
| `2a370f803` | feat: implement home directory expansion for permission patterns | High   |
| `1f9313847` | feat(core): add worktree to plugin tool context                  | Medium |
| `a8c18dba8` | fix(core): expose Instance.directory to custom tools             | Medium |
| `6cf2c3e3d` | fix: use Instance.directory instead of process.cwd() in read tool | Medium |
| `bb710e9ea` | fix(core): snapshot regression                                   | High   |
| `32e6bcae3` | core: fix unicode filename handling in snapshot diff             | Medium |
| `65938baf0` | core: update session summary after revert to show file changes   | Medium |
| `68bd16df6` | core: fix models snapshot loading to prevent caching issues      | Medium |

---

## Medium Priority: UI Component Improvements

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `c68261fc0` | fix(ui): add max-width 280px to tabs with text truncation        | Low    |
| `783121c06` | fix(ui): use focus-visible instead of focus                      | Medium |
| `a5b72a7d9` | fix(ui): tab click hit area                                      | Medium |
| `10d227b8d` | fix(ui): tab focus state                                         | Low    |
| `d97cd5686` | fix(ui): popover exit ux                                         | Low    |
| `b69521606` | fix(ui): align list search input width with list items           | Low    |
| `c2ec60821` | feat(ui): add link icon and use it for copy-to-clipboard buttons | Low    |
| `8845f2b92` | feat(ui): add onFilter callback to List                          | Medium |
| `9424f829e` | fix(ui): allow KaTeX inline math to be followed by punctuation   | Medium |
| `8c05eb22b` | fix(markdown): Add streaming prop to markdown element            | Medium |
| `2e5fe6d5c` | fix(ui): preserve filename casing in edit/write tool titles      | Medium |
| `a3a06ffc4` | fix(ui): show filename in Edit/Write permission titles           | Medium |
| `3c7d5174b` | fix(ui): prevent copy buttons from stealing focus from prompt    | Medium |
| `225b72ca3` | feat: always center selected item in selection dialogs           | Medium |
| `8105f186d` | fix(app): center checkbox indicator in provider selection        | Low    |

---

## Low Priority: Sidebar Features

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `cd4676171` | feat(app): better sidebar hover when collapsed                   | Medium |
| `5f7111fe9` | fix(app): Always close hovercard when view-sessions clicked      | Low    |
| `e85b95308` | fix(app): clear session hover state on navigation                | Low    |
| `8639b0767` | feat(app): add tooltips to sidebar new session/workspace buttons | Low    |
| `3b46f9012` | fix: icon size in sidebar                                        | Low    |
| `575cc59b3` | fix: increase sidebar icon size by removing 16px constraint      | Low    |
| `4350b8fd6` | fix: show View all sessions button for active project            | Low    |
| `211147374` | fix: remove close delay on hover cards to stop overlapping       | Low    |

---

## Low Priority: Misc Features

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `58b9b5460` | feat(app): forward and back buttons                              | Medium |
| `aeeb05e4a` | feat(app): back button in subagent sessions                      | Medium |
| `fb007d6ba` | feat(app): copy buttons for assistant messages and code blocks   | Medium |
| `aa1772900` | feat(app): add scrollbar styling to session page                 | Low    |
| `cf1fc02d2` | update jump to latest button with circular design and animation  | Low    |
| `80dc74a0e` | add keyboard shortcut (mod+,) to open settings dialog            | Medium |
| `de6582b38` | feat(app): delete sessions                                       | Medium |
| `fc53abe58` | feat(app): close projects from hover card                        | Low    |
| `62115832f` | feat(app): render audio players in session review                | Low    |
| `496bbd70f` | feat(app): render images in session review                       | Low    |
| `16fad51b5` | feat(app): add workspace startup script to projects              | High   |
| `94ce289dd` | fix(app): run start command after reset                          | Medium |
| `923e3da97` | feat(ui): add aura theme                                         | Low    |
| `936f3ebe9` | feat(ui): add gruvbox theme                                      | Low    |
| `fdac21688` | feat(app): add app version display to settings                   | Low    |

---

## Low Priority: OpenCode Core Fixes

| Hash        | Description                                                      | Value  |
| ----------- | ---------------------------------------------------------------- | ------ |
| `427ef95f7` | fix(opencode): allow media-src data: URL for small audio files   | Low    |
| `e5b33f8a5` | fix(opencode): add AbortSignal support to Ripgrep.files()        | Medium |
| `63f5669eb` | fix(opencode): ensure unsub(PartUpdated) is always called        | Medium |
| `694695050` | fix(opencode): preserve tool input from running state for MCP    | Medium |
| `c4594c4c1` | fix(opencode): relax bun version requirement                     | Medium |
| `17c4202ea` | fix(opencode): Allow compatible Bun versions in packageManager   | Medium |
| `3b7c347b2` | tweak: bash tool, ensure cat will trigger external_directory perm | Medium |
| `68e41a1ee` | fix: pass arguments to commands without explicit placeholders    | Medium |
| `397ee419d` | tweak: make question validation more lax to avoid tool failures  | Medium |
| `74bd52e8a` | fix: ensure apply patch tool emits edited events                 | Medium |
| `cbe20d22d` | fix: don't update session timestamp for metadata-only changes    | Low    |
| `3723e1b8d` | fix: correct dot prefix display in directory names for RTL       | Low    |
| `c2844697f` | fix: ensure images are properly returned as tool results         | Medium |

---

## Irrelevant (Skip Entirely)

### Releases/Stats (~60 commits)

| Pattern                    | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `release: v1.1.*`          | Release commits (v1.1.28 through v1.1.43)      |
| `ignore: update download*` | Daily download stats updates                   |

### CI/Nix (~60 commits)

| Pattern                        | Description                              |
| ------------------------------ | ---------------------------------------- |
| `ci:`, `ci$`, `ci (`           | CI workflow changes                      |
| `chore: update nix*`           | Nix hash updates                         |
| `chore: follow conventional*`  | Nix CI changes                           |

### Chore: generate/format (~78 commits)

| Pattern              | Description                              |
| -------------------- | ---------------------------------------- |
| `chore: generate`    | SDK/type generation                      |
| `chore: format code` | Code formatting                          |
| `chore: regen sdk`   | SDK regeneration                         |

### Zen/Black/Console (~14 commits)

| Pattern        | Description                              |
| -------------- | ---------------------------------------- |
| `zen:*`        | Zen subscription/model changes           |
| `wip: black`   | Black feature development                |
| `wip: zen*`    | Zen feature development                  |

### TUI (~8 commits)

| Pattern        | Description                              |
| -------------- | ---------------------------------------- |
| `fix(tui):*`   | TUI fixes (we deleted TUI)               |

### Test/E2E (~28 commits)

| Pattern              | Description                              |
| -------------------- | ---------------------------------------- |
| `test:*`             | Test fixes                               |
| `test(app):*`        | App test updates                         |

### File Tree (~25 commits)

**SKIP - Our implementation is better**

| Pattern                    | Description                              |
| -------------------------- | ---------------------------------------- |
| `feat(app): file tree`     | File tree implementation                 |
| `wip(app): file tree*`     | File tree WIP                            |
| `fix(app):*filetree*`      | File tree fixes                          |
| `fix(ui):*filetree*`       | File tree UI                             |

### Provider/LLM (~15 commits)

**SKIP - SDK migration makes irrelevant**

| Pattern                    | Description                              |
| -------------------------- | ---------------------------------------- |
| `fix(provider):*`          | Provider fixes                           |
| `feat(provider):*`         | Provider features                        |
| Provider temperature/model | Model-specific fixes                     |
| Copilot/Codex auth         | Auth plugin changes                      |

---

## Recommended Phased Approach

### Phase 1: AGENTS.md Features (4 commits) - HIGH PRIORITY
- `39a73d489` - dynamically resolve AGENTS.md from subdirectories
- `b59aec6f0` - /learn command for session learnings
- `558590712` - parallel tool calls AGENTS.md fix
- `07d84fe00` - show loaded agents.md files

### Phase 2: Performance (10 commits) - HIGH PRIORITY
All `perf(app):` commits listed above

### Phase 3: Line Selection + Comments (~50 commits) - HIGH PRIORITY
New feature with mostly net new files:
- Start with core WIP commits (`640d1f1ec` through `82ec84982`)
- Apply comment context and UI components
- Apply styling/polish commits

### Phase 4: Settings Overhaul (~25 commits) - HIGH PRIORITY
Cleaner settings UI with mostly net new files:
- Start with core WIP commits (`8bcbfd639` through `bdfd8f8b0`)
- Apply individual settings panels
- Apply styling commits

### Phase 5: Desktop Features (16 commits) - MEDIUM PRIORITY
Critical desktop fixes and new features

### Phase 6: Session/Terminal Fixes (~20 commits) - MEDIUM PRIORITY
Session loading, terminal corruption, auto-scroll

### Phase 7: Core/Config Fixes (~12 commits) - MEDIUM PRIORITY
Permission patterns, snapshot fixes, etc.

### Phase 8: UI Component Fixes (~15 commits) - LOW PRIORITY
Dialog, tab, and popover improvements

### Phase 9: i18n Infrastructure (OPTIONAL)
If internationalization is desired:
- Add `context/language.tsx` and `i18n/en.ts` first
- Gradually update components to use `t()` function
- Add language files as needed

---

## Notes

**Key Files with Many Upstream Changes (Likely Conflicts):**

- `packages/app/src/layout.tsx` - Sidebar, hover cards, workspace management
- `packages/app/src/session.tsx` - Session rendering, auto-scroll
- `packages/app/src/components/ui/*.tsx` - Many UI component changes
- `packages/app/src/settings/*.tsx` - Complete settings overhaul
- `packages/desktop/*` - Desktop-specific features

**What to Preserve in Our Fork:**

- Our file tree implementation (better than upstream)
- Two-row session item design in layout.tsx
- `msg().summary?.title` approach for session titles
- "Claudius" branding (not OpenCode)

**SDK Migration Impact (same as before):**

~40% of commits touch deleted files (TUI, provider SDK, tool descriptions, etc.) and are automatically irrelevant.

---

## Summary

| Category          | Potential Applies | Irrelevant/Skip |
| ----------------- | ----------------- | --------------- |
| AGENTS.md         | 4 ⭐              | 0               |
| Performance       | 10 ⭐             | 0               |
| Line Selection    | ~50 ⭐            | 0               |
| Settings Overhaul | ~25 ⭐            | 0               |
| Desktop           | 16                | 0               |
| Session/Terminal  | ~20               | 0               |
| Auto-scroll       | ✅ 11 applied      | 0               |
| Core/Config       | ~12               | 0               |
| UI Components     | ~15               | 0               |
| App Bug Fixes     | ~50               | 0               |
| i18n (optional)   | ~38               | 0               |
| Releases/Stats    | 0                 | ~60             |
| CI/Nix            | 0                 | ~60             |
| Chore: generate   | 0                 | ~78             |
| Zen/Console       | 0                 | ~14             |
| TUI               | 0                 | ~8              |
| Test/E2E          | 0                 | ~28             |
| File Tree         | 0                 | ~25             |
| Provider/LLM      | 0                 | ~15             |
| **Total**         | **~240 ⏳**       | **~290**        |

### Difficulty Estimates

| Feature | Difficulty | Notes |
| ------- | ---------- | ----- |
| AGENTS.md | Low | Small, targeted changes |
| Performance | Low-Medium | Isolated optimizations |
| Line Selection | **Medium** | Mostly net new files (~1,000 lines new), some integration |
| Settings Overhaul | **Medium** | Mostly net new files (~1,600 lines new), clean integration |
| i18n | **Medium-High** | Infrastructure easy, component changes extensive |
| Desktop | Low | Isolated to desktop package |
| Session/Terminal | Medium | Some overlap with existing code |

### Progress

```
Previous work:        83 commits ✅ (v1.1.23 → v1.1.27)
New analysis:        836 commits analyzed
────────────────────────────────
✅ Settings Overhaul:  ~25 commits applied
✅ Terminal Fixes:     ~4 commits adapted (for tabId architecture)
✅ Auto-scroll Fixes:  ~11 commits applied
✅ Session Dedup:      Core fix applied (booting/sessionLoads Maps)
✅ Hover Card:         Viewport overflow fix applied
✅ Standalone Fixes:   ~8 commits applied
✅ Core/Config:        ~3 commits applied
✅ Themes:             Aura + Gruvbox themes added
✅ UI/Dialog:          Dialog transitions, delete dialog fix
✅ Project Fixes:      Auto-nav fix, race condition fix
✅ Misc:               mod+, settings shortcut
⏸️ Line Selection:     Blocked (shadow DOM in pierre diffs)
⏸️ Performance:        Blocked (deleted worktree files)
⏸️ AGENTS.md backend:  Blocked (SDK architecture)
────────────────────────────────
Skip (irrelevant):   ~290 commits (releases, CI, chore)
Skip (file tree):    ~25 commits (ours is better)
Skip (i18n):         ~38 commits (optional, high effort)
```
