# Upstream Cherry-Pick Analysis

Fork point: `bd9c13bb2` (v1.1.8)
Total commits since fork: 149

## CHERRY-PICK (Recommended)

### TUI Fixes
| Hash | Description | Status |
|------|-------------|--------|
| `1a5a63843` | feat(terminal): implement better dynamic terminal numbering (#8081) | ✅ Done |
| `983f8ffec` | fix(tui): prevent layout jump when toggling tips visibility (#8068) | ⏭️ Skip (conflicts with our tips) |
| `cd56845dc` | tui: add hint for variants toggle | ✅ Done |
| `22c68a699` | fix(tui): reopen autocomplete after backspace deletes space (#6031) | ✅ Done |
| `20399bbdf` | tui: rename kvStore to store for consistency | ⏭️ Skip (conflicts) |
| `547a97570` | tui: redesign tips display on home screen | ⏭️ Skip (conflicts with did-you-know) |
| `c009cab15` | Redesign tips display on home screen (#6126) | ✅ Done |
| `e6bc3b253` | tui: remove update complete toast notification | ✅ Done |
| `a5b6c57a7` | tweak: make the subagent header have clickable nav | ✅ Done |
| `82b432349` | feat(tui): add mouse hover and click support to questions tool (#7905) | ✅ Done |
| `68ed664a3` | tui: fix prompt ref initialization to prevent undefined reference errors | ⏭️ Skip (conflicts) |
| `3a3077387` | tui: refactor event streaming to use SDK instead of manual RPC subscription | ⏭️ Skip (conflicts with thread/worker) |
| `0c0057a7d` | Fix: TUI single-line paste cursor position (#7277) | ✅ Done |
| `a803cf8ae` | feat(tui): add mouse hover and click support to autocomplete (#7820) | ✅ Done |
| `c526e2d90` | fix(tui): copy oauth url when no device code (#7812) | ⏭️ Skip (we use API key auth) |
| `43c2da24d` | fix(tui): slash command autocomplete highlighted row jumping (#7815) | ✅ Done |
| `9280db329` | fix(tui): move props.ref to onMount (#7702) | ✅ Done |
| `a457828a6` | fix(opencode): command palette mouse hover highlights wrong item (#7721) | ✅ Done |

### Desktop Fixes
| Hash | Description | Status |
|------|-------------|--------|
| `b4f33485a` | fix(desktop): Improve User Message Badges for Big Titles and Small Screens (#8037) | ⏭️ Skip (conflicts) |
| `c6092e4ad` | disable appimage | ✅ Done |
| `ebbb4dd88` | fix(desktop): improve server detection & connection logic (#7962) | ✅ Done (manual) |
| `e0eb460fc` | app: resolve defaultServerUrl inside AppInterface | ✅ Done (manual) |
| `3e9366487` | feat(desktop): User Message Badges on Hover (#7835) | ✅ Done |
| `025ed04da` | feat(desktop): Image Preview support for Image Attachments (#7841) | ✅ Done |
| `76386f5cf` | feat(desktop): Fork Session (#7673) - see [Agent SDK Sessions docs](https://platform.claude.com/docs/en/agent-sdk/sessions#forking-sessions) | ✅ Done |
| `a9275def4` | feat(desktop): Make mouse hover / click work on prompt input autocomplete (#7661) | ✅ Done |
| `50ed4c6b5` | feat(deskop): Add Copy to Messages (#7658) | ✅ Done |
| `f882cca98` | fix(desktop): add missing StoreExt import and fix unused mut warning (#7707) | ✅ Done |
| `2d2a04496` | fix(desktop): build failing - missing import (#7697) | ✅ Done |
| `02b7eb59f` | feat: support configuring default server URL for desktop (#7363) | ✅ Done |
| `1a642a79a` | fix(desktop): remove split operation in serverDisplayName function (#7397) | ✅ Done |
| `afb1cad26` | fix(desktop): Allow Selecting Card Errors (#7506) | ✅ Done |
| `8b062ed62` | feat(desktop): Change Terminal's Cursor to Bar and Stop Blinking when not focused (#7402) | ✅ Done |
| `b1e381cff` | fix(desktop): complete symlink support implementation and enable CI for PRs (#7113) | ✅ Done |

### Core Fixes (Non-provider)
| Hash | Description | Status |
|------|-------------|--------|
| `d954e1e3b` | fix(session): store api url in metadata (#8090) | ✅ Done |
| `fd37d5b54` | tweak: truncation dir perm | ⏭️ Skip (touches deleted truncation.ts) |
| `d7a1c268d` | fix(app): sanitize markdown -> html | ✅ Done |
| `0be37cc2c` | tweak: make the .env reads ask user for permission instead of blocking | ✅ Done |
| `9c69c1de9` | fix(formatter): use biome `check` instead of `format` to include import sorting (#8057) | ✅ Done |
| `735f3d17b` | fix: ensure plurals are properly handled (#8070) | ✅ Done |
| `f0912ee83` | core: rename OPENCODE_PASSWORD to OPENCODE_SERVER_PASSWORD | ⏭️ Skip (conflicts) |
| `7ca767de5` | core: fix HTTP exception handling order to prevent NamedError from masking HTTP exceptions | ✅ Done |
| `1954c1255` | core: add password authentication and improve server security | ✅ Done |
| `e47f38313` | core: improve error handling for built-in plugin installation failures | ⏭️ Skip (conflicts) |
| `62702fbd1` | fix: permissions wildcarding so that for ex: 'ls *' includes ls * AND 'ls' | ✅ Done |
| `fa79736b8` | fix: check worktree for external_directory permission in subdirs (#7811) | ⏭️ Skip (touches deleted files) |
| `44fa3d539` | feat(acp): track file modified (#7723) | ✅ Done |
| `4752c8315` | feat: pass sessionID to chat.system.transform (#7718) | ⏭️ Skip (touches deleted llm.ts) |
| `f94ee5ce9` | core: extract external directory validation to shared utility | ⏭️ Skip (touches deleted tool files) |
| `d5738f542` | fix(grep): follow symlinks by default in ripgrep searches (#7501) | ⏭️ Skip (we already have this) |
| `a593ed4c9` | fix: disable telemetry in the php lsp server (#7649) | ✅ Done |
| `982b71e86` | disable server unless explicitly opted in (#7529) | ✅ Done |
| `75df5040e` | fix: report config errors instead of silent termination (#7522) | ✅ Done |
| `a5edf3a31` | fix: resolve broken forked sessions with compactions (#6445) | ✅ Done |
| `8e3ab4afa` | feat(config): deduplicate plugins by name with priority-based resolution (#5957) | ✅ Done |

### App/UI Fixes
| Hash | Description | Status |
|------|-------------|--------|
| `b3a1360ad` | feat(dialog-select-server): add icon button for server removal (#8053) | ✅ Done |
| `8b9a85b7e` | fix(mcp): support `resource` content type in MCP tool output (#7879) | ⏭️ Skip (touches deleted prompt.ts) |
| `b6b009775` | fix(ui): allow text editing shortcuts in search dialogs on macOS (#7419) | ✅ Done |
| `6da60bd5d` | fix(app): more defensive dom access | ✅ Done |
| `075fa2c0e` | fix: instance dispose issue | ✅ Done (manual) |
| `0f2124db3` | fix(app): no inline js | ✅ Done |
| `44297ffe7` | fix(app): break words in user message | ✅ Done |
| `030b14ac4` | fix: prevent model picker overflow with Zen in new sessions (#7495) | ✅ Done |
| `0433d4d06` | fix(app): store terminal and review pane visibility per session | ✅ Done |
| `ec828619c` | fix(app): more defensive todo access | ✅ Done |

### Nix/Build
| Hash | Description | Status |
|------|-------------|--------|
| `ca1b597b0` | fix(nix): filter optional dependencies by target platform (#8033) | ⏭️ Skip (hash conflicts) |
| `762c58b75` | Update Nix flake.lock and hashes | ⏭️ Skip (hash conflicts) |
| `22f51c6b4` | upgrade opentui to v0.1.72 | ⏭️ Skip (version conflicts) |
| `e82b11275` | upgrade opentui to v0.1.71 | ⏭️ Skip (version conflicts) |
| `f2b294029` | Update Nix flake.lock and hashes | ⏭️ Skip (hash conflicts) |
| `7df36cf0f` | Update Nix flake.lock and hashes | ✅ Done |
| `7c2907cbb` | ci: fix failing pipeline | ⏭️ Skip (empty) |

---

## SKIP (Don't cherry-pick)

### Codex/OpenAI/GPT Specific
| Hash | Description | Reason |
|------|-------------|--------|
| `8f22a6b69` | Add nova-2 to region prefix models | Bedrock |
| `20c18689c` | bump copilot plugin version | Copilot |
| `0cc3c3bc7` | ensure codex built in plugin is always available | Codex |
| `ee8b38ab2` | fix: ensure /connect works for openai business plans | OpenAI |
| `794c5981a` | fix: exclude 'none' variant for gpt-5.2-codex | Codex |
| `1662e149b` | fix: add ChatGPT-Account-Id header | OpenAI |
| `b03172d72` | fix: ensure gpt-5.2-codex has variants | Codex |
| `a44d4acb3` | tweak: adjust codex styling and fix hint | Codex |
| `8b8a358de` | update docs and auth methods for openai | OpenAI |
| `8b287caaa` | tweak codex instructions prompt | Codex |
| `172bbdace` | feat: codex auth support (#7537) | Codex |
| `e30a15926` | fix(cli): enable API key prompt for Bedrock | Bedrock |
| `a618fbe8c` | bump copilot plugin version | Copilot |
| `07dc1f8ec` | fix: model dialog issue (touches provider code) | Multi-provider |
| `71a7ad1a4` | fix model selection in title generation | May conflict |

### SDK Regeneration
| Hash | Description | Reason |
|------|-------------|--------|
| `835e48cd2` | chore: generate | SDK regen |
| `64f0205f9` | chore: generate | SDK regen |
| `08d4d6d4a` | chore: generate | SDK regen |
| `e6045ca92` | chore: generate | SDK regen |
| `087473be6` | chore: generate | SDK regen |
| `bdbbcd8a0` | chore: generate | SDK regen |
| `a8f23fb54` | chore: generate | SDK regen |
| `58186004d` | chore: generate | SDK regen |
| `e20535655` | chore: generate | SDK regen |
| `7c06ef247` | chore: generate | SDK regen |
| `5c74bff8e` | chore: generate | SDK regen |
| `bce9dc040` | chore: generate | SDK regen |
| `445c8631a` | chore: generate | SDK regen |
| `a98d108d2` | chore: generate | SDK regen |
| `cf97633d7` | chore: generate | SDK regen |
| `61d0b3e4d` | chore: bump ai sdk packages | AI SDK |

### WIP/Internal
| Hash | Description | Reason |
|------|-------------|--------|
| `e146083b7` | wip: black | WIP |
| `b41fbda68` | wip: black | WIP |
| `b3e6b7a98` | wip: black | WIP |
| `c4eacd0cc` | wip: black | WIP |
| `dd5ec26c8` | wip: black | WIP |
| `ab97a9503` | wip: black | WIP |
| `2e875b2d6` | wip: black | WIP |
| `790baec41` | wip: zen | WIP |
| `52fbd16e0` | wip: zen | WIP |
| `18cf4df6c` | wip: zen | WIP |

### Releases/Ignores
| Hash | Description | Reason |
|------|-------------|--------|
| `db7243c36` | release: v1.1.15 | Release tag |
| `7c6b3f981` | release: v1.1.14 | Release tag |
| `efbab087d` | release: v1.1.13 | Release tag |
| `449270aac` | release: v1.1.12 | Release tag |
| `8a43c2493` | release: v1.1.11 | Release tag |
| `563b4c33f` | release: v1.1.10 | Release tag |
| `4695e685c` | ignore: update download stats | Stats |
| `3205db9c1` | ignore: update download stats | Stats |
| `e92a2ec9d` | ignore: update download stats | Stats |
| `d34fdac85` | ignore: update download stats | Stats |
| `de286b08f` | ignore: bump plugin version | Ignore |
| `eb5c113cf` | ignore: add PR template | Ignore |

### Docs (Optional)
| Hash | Description |
|------|-------------|
| `c47438068` | docs: fix permission rule ordering in examples (#7010) |
| `2e9c22d91` | docs: fix typo (#8041) |
| `65724b693` | docs: fix scroll_speed default value (#7867) |
| `7cbec9a1a` | docs: fix typos in settings doc (#7892) |
| `b81eca4eb` | docs: fix typos on the providers page (#7829) |
| `e342795bd` | docs: add url based instructions to web docs (#7216) |
| `f3e8a275b` | docs: update brew formula references |
| `559013e12` | docs: perf plans |
| `3fe2e89d5` | docs: Add Scaleway to provider docs (#7389) |
| `dfe3e7930` | docs(ecosystem): add micode and octto plugins (#7327) |
| `c4ba5961c` | chore: update GitHub stars count to 60K |

### Tests
| Hash | Description |
|------|-------------|
| `5c4345da4` | test: fix read test |
| `d527ceeb2` | test: fix |

### Other/Misc
| Hash | Description | Reason |
|------|-------------|--------|
| `f2504d8eb` | security.md | Doc |
| `1c24dd02a` | ci: adjust triage prompt | CI |
| `b7b09fdfc` | admin unshare | Admin |
| `f1a13f25a` | ci: don't continue-on-error | CI |
| `2e0c2c9db` | chore(lander): fix spacing | Website |
| `13305966e` | ci: tweak pr standards workflow | CI |
| `8c3cc0d44` | chore: prep | Prep |
| `e30562d5f` | chore: prep | Prep |
| `58eccf7f5` | chore: prep | Prep |
| `cbb314113` | fix(app): no custom url param | Maybe conflicts |

---

## Summary

| Category | Count | Done | Skipped |
|----------|-------|------|---------|
| TUI Fixes | 18 | 12 | 6 |
| Desktop Fixes | 16 | 15 | 1 |
| Core Fixes | 21 | 14 | 7 |
| App/UI Fixes | 10 | 9 | 1 |
| Nix/Build | 7 | 1 | 6 |
| **Total** | **72** | **51** | **21** |

## Recommended Order

1. Start with core fixes (most likely to apply cleanly)
2. Then TUI fixes
3. Then Desktop fixes
4. Then App/UI fixes
5. Finally Nix/Build updates
