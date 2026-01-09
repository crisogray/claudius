# Phase 2: Git Identity + PAT Auth

## Goal

Per-project git identity (name/email) and GitHub/GitLab PAT for push/pull.

**Estimated effort:** ~4 hours

---

## Architecture

### Two Separate Mechanisms

| Feature | Storage | When Applied |
|---------|---------|--------------|
| **Identity** (name/email) | `.git/config` (native git) | On user save in dialog |
| **PAT** (token) | OpenCode storage (`~/.opencode/data/...`) | Injected per git command in bash tool |

### Why This Split?

**Identity in `.git/config`:**
- Standard git behavior - respects existing user setup
- ADE becomes a convenience UI for `git config`
- Read existing values, only write if user explicitly changes
- No injection needed - git uses its normal config

**PAT in OpenCode storage:**
- Can't put plaintext token in `.git/config` (insecure)
- OpenCode already has secure storage patterns
- Injected via env vars only during git command execution
- Token never written to repo files

---

## Git Identity Implementation

### Reading Current Identity

On dialog open, read from git:

```typescript
async function readGitIdentity(worktree: string) {
  const name = await $`git config --local user.name`.quiet().nothrow().cwd(worktree).text()
  const email = await $`git config --local user.email`.quiet().nothrow().cwd(worktree).text()
  return {
    name: name.trim() || undefined,
    email: email.trim() || undefined,
  }
}
```

### Writing Identity (on save, if changed)

```typescript
async function writeGitIdentity(worktree: string, name?: string, email?: string) {
  if (name) {
    await $`git config --local user.name ${name}`.quiet().cwd(worktree)
  }
  if (email) {
    await $`git config --local user.email ${email}`.quiet().cwd(worktree)
  }
}
```

### No Schema Change for Identity

Identity is **not stored in Project schema** - it lives in `.git/config`. The dialog reads/writes directly to git config.

---

## PAT Auth Implementation

### Schema Changes

**File:** `packages/opencode/src/project/project.ts`

Add to `Project.Info` schema:

```typescript
gitAuth: z.object({
  provider: z.enum(["github", "gitlab"]),
  token: z.string(),
  host: z.string().optional(), // For self-hosted instances
}).optional(),
```

### Update Endpoint

**File:** `packages/opencode/src/server/project.ts`

Add `gitAuth` to `Project.update.schema`:

```typescript
gitAuth: z.object({
  provider: z.enum(["github", "gitlab"]),
  token: z.string(),
  host: z.string().optional(),
}).optional(),
```

### Injection into Git Commands

**File:** `packages/opencode/src/tool/bash.ts`

When running git commands that need auth (push, pull, fetch, clone), inject credentials:

```typescript
// Detect git command that might need auth
const isGitRemoteCommand = /git\s+(push|pull|fetch|clone|ls-remote)/.test(params.command)

if (isGitRemoteCommand && project.gitAuth?.token) {
  const host = project.gitAuth.host || 
    (project.gitAuth.provider === 'github' ? 'github.com' : 'gitlab.com')
  
  // Inline credential helper via GIT_CONFIG_PARAMETERS
  const helper = `!f() { echo "username=x-access-token"; echo "password=${project.gitAuth.token}"; }; f`
  gitEnv.GIT_CONFIG_PARAMETERS = `'credential.helper=${helper}'`
}
```

**Note:** Identity is NOT injected - git reads it from `.git/config` naturally.

---

## UI Changes

**File:** `packages/app/src/components/dialog-edit-project.tsx`

### Store Changes

```typescript
const [store, setStore] = createStore({
  // Existing
  name: defaultName(),
  color: props.project.icon?.color || "pink",
  iconUrl: props.project.icon?.url || "",
  saving: false,
  
  // New - Git Identity (read from git config on mount)
  gitName: "",
  gitEmail: "",
  gitNameOriginal: "", // Track original to detect changes
  gitEmailOriginal: "",
  
  // New - Git Auth (read from project)
  gitProvider: props.project.gitAuth?.provider || "",
  gitToken: props.project.gitAuth?.token || "",
  gitHost: props.project.gitAuth?.host || "",
})
```

### On Mount - Read Git Config

```typescript
onMount(async () => {
  if (props.project.vcs === "git") {
    const identity = await readGitIdentity(props.project.worktree)
    setStore({
      gitName: identity.name || "",
      gitEmail: identity.email || "",
      gitNameOriginal: identity.name || "",
      gitEmailOriginal: identity.email || "",
    })
  }
})
```

### On Save - Write If Changed

```typescript
async function handleSubmit(e: SubmitEvent) {
  e.preventDefault()
  setStore("saving", true)
  
  // Existing project update (name, icon)
  await globalSDK.client.project.update({
    projectID: props.project.id,
    name: store.name.trim() === folderName() ? "" : store.name.trim(),
    icon: { color: store.color, url: store.iconUrl },
    // PAT auth (stored in OpenCode)
    gitAuth: store.gitProvider ? {
      provider: store.gitProvider,
      token: store.gitToken,
      host: store.gitHost || undefined,
    } : undefined,
  })
  
  // Git identity - write to .git/config if changed
  if (store.gitName !== store.gitNameOriginal || store.gitEmail !== store.gitEmailOriginal) {
    await writeGitIdentity(props.project.worktree, store.gitName, store.gitEmail)
  }
  
  setStore("saving", false)
  dialog.close()
}
```

### UI Section

```tsx
{/* Git Settings - only show for git projects */}
<Show when={props.project.vcs === "git"}>
  <div class="flex flex-col gap-4">
    <h3 class="text-14-medium">Git Settings</h3>
    
    {/* Identity - read from .git/config */}
    <div class="flex flex-col gap-3">
      <TextField
        label="Author Name"
        placeholder="John Doe"
        value={store.gitName}
        onChange={(v) => setStore("gitName", v)}
      />
      <TextField
        label="Author Email"  
        placeholder="john@example.com"
        value={store.gitEmail}
        onChange={(v) => setStore("gitEmail", v)}
      />
      <p class="text-12 text-text-weak">
        Used for git commits. Reads from .git/config.
      </p>
    </div>

    {/* Authentication - stored in OpenCode */}
    <div class="flex flex-col gap-3">
      <Select
        label="Git Provider"
        value={store.gitProvider}
        onChange={(v) => setStore("gitProvider", v)}
        options={[
          { value: "", label: "None" },
          { value: "github", label: "GitHub" },
          { value: "gitlab", label: "GitLab" },
        ]}
      />
      
      <Show when={store.gitProvider}>
        <TextField
          label="Personal Access Token"
          type="password"
          placeholder="ghp_xxxx or glpat-xxxx"
          value={store.gitToken}
          onChange={(v) => setStore("gitToken", v)}
        />
        <TextField
          label="Host (optional)"
          placeholder={store.gitProvider === 'github' ? 'github.com' : 'gitlab.com'}
          value={store.gitHost}
          onChange={(v) => setStore("gitHost", v)}
        />
        <Button 
          variant="ghost" 
          onClick={testConnection}
          disabled={!store.gitToken}
        >
          Test Connection
        </Button>
        <p class="text-12 text-text-weak">
          <Show when={store.gitProvider === 'github'}>
            <a href="https://github.com/settings/tokens" target="_blank" class="underline">
              Create a GitHub token
            </a> with 'repo' scope.
          </Show>
          <Show when={store.gitProvider === 'gitlab'}>
            <a href="https://gitlab.com/-/user_settings/personal_access_tokens" target="_blank" class="underline">
              Create a GitLab token
            </a> with 'read_repository' and 'write_repository' scopes.
          </Show>
        </p>
      </Show>
    </div>
  </div>
</Show>
```

---

## Token Validation

```typescript
async function testConnection() {
  setStore("testing", true)
  try {
    const host = store.gitHost || 
      (store.gitProvider === 'github' ? 'github.com' : 'gitlab.com')
    
    if (store.gitProvider === 'github') {
      const res = await fetch(`https://api.${host}/user`, {
        headers: { Authorization: `Bearer ${store.gitToken}` }
      })
      if (!res.ok) throw new Error('Invalid token')
      const user = await res.json()
      showToast({ title: `Connected as ${user.login}`, variant: 'success' })
    } else {
      const res = await fetch(`https://${host}/api/v4/user`, {
        headers: { 'PRIVATE-TOKEN': store.gitToken }
      })
      if (!res.ok) throw new Error('Invalid token')
      const user = await res.json()
      showToast({ title: `Connected as ${user.username}`, variant: 'success' })
    }
  } catch (e) {
    showToast({ title: 'Connection failed', description: e.message, variant: 'error' })
  } finally {
    setStore("testing", false)
  }
}
```

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `packages/opencode/src/project/project.ts` - Add gitAuth to schema |
| Modify | `packages/opencode/src/server/project.ts` - Add gitAuth to update endpoint |
| Modify | `packages/opencode/src/tool/bash.ts` - Inject PAT for git remote commands |
| Modify | `packages/app/src/components/dialog-edit-project.tsx` - Add git settings UI |

---

## Implementation Steps

1. Add `gitAuth` to Project schema (NOT gitIdentity - that's in .git/config)
2. Add `gitAuth` to update endpoint
3. Modify bash tool to inject PAT via GIT_CONFIG_PARAMETERS for remote git commands
4. Update DialogEditProject:
   - Read git identity from .git/config on mount
   - Write git identity to .git/config on save (if changed)
   - Read/write gitAuth via project API
5. Add token validation function
6. Test identity changes write to .git/config
7. Test PAT injection works for push/pull

---

## Security Considerations

- PAT stored in OpenCode project storage (follow existing patterns)
- PAT only injected for git remote commands, not all bash commands
- Identity stored in .git/config (standard git location)
- Token never written to repo files

---

## Testing Checklist

- [ ] Identity fields pre-populate from .git/config
- [ ] Changing identity writes to .git/config
- [ ] Not changing identity doesn't touch .git/config
- [ ] Git commit uses correct author name/email
- [ ] Git push to GitHub works with PAT
- [ ] Git push to GitLab works with PAT
- [ ] Token validation shows correct username
- [ ] Invalid token shows error
- [ ] SSH remotes still work (PAT not used for SSH)
- [ ] Non-git projects don't show git settings
