# Phase 2: Git Identity + PAT Auth

## Goal

Per-project git identity (name/email) and GitHub/GitLab PAT for push/pull.

**Estimated effort:** ~4 hours

---

## Schema Changes

**File:** `packages/opencode/src/project/project.ts`

Add to `Project.Info` schema:

```typescript
gitIdentity: z.object({
  name: z.string().optional(),
  email: z.string().optional(),
}).optional(),

gitAuth: z.object({
  provider: z.enum(["github", "gitlab"]),
  token: z.string(),
  host: z.string().optional(), // For self-hosted instances
}).optional(),
```

---

## Update Endpoint

**File:** `packages/opencode/src/server/project.ts`

Add `gitIdentity` and `gitAuth` to `Project.update.schema`:

```typescript
export const update = {
  schema: z.object({
    name: z.string().optional(),
    icon: z.object({...}).optional(),
    gitIdentity: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
    }).optional(),
    gitAuth: z.object({
      provider: z.enum(["github", "gitlab"]),
      token: z.string(),
      host: z.string().optional(),
    }).optional(),
  }),
}
```

Token storage: Follow existing patterns for secrets (check how API keys are stored).

---

## Injection into Git Commands

**File:** `packages/opencode/src/tool/bash.ts`

When running commands, check if project has git settings and inject env vars:

```typescript
// Detect git command
const isGitCommand = params.command.trim().startsWith('git ') || 
                     params.command.includes(' git ')

if (isGitCommand) {
  const project = Instance.project
  const gitEnv: Record<string, string> = {}

  // Identity
  if (project.gitIdentity?.name) {
    gitEnv.GIT_AUTHOR_NAME = project.gitIdentity.name
    gitEnv.GIT_COMMITTER_NAME = project.gitIdentity.name
  }
  if (project.gitIdentity?.email) {
    gitEnv.GIT_AUTHOR_EMAIL = project.gitIdentity.email
    gitEnv.GIT_COMMITTER_EMAIL = project.gitIdentity.email
  }

  // Auth (for HTTPS remotes)
  if (project.gitAuth?.token) {
    const host = project.gitAuth.host || 
      (project.gitAuth.provider === 'github' ? 'github.com' : 'gitlab.com')
    
    gitEnv.GIT_ASKPASS = getAskpassPath() // Path to credential helper
    gitEnv.OPENCODE_GIT_TOKEN = project.gitAuth.token
    gitEnv.OPENCODE_GIT_HOST = host
  }

  env = { ...env, ...gitEnv }
}
```

---

## Git Credential Helper

Simple script that git calls to get username/password.

**Option A: Bundled script**

```bash
#!/bin/sh
# opencode-git-credential
# Git calls this with prompt like "Password for 'https://github.com':"

if echo "$1" | grep -qi "username"; then
  echo "x-access-token"
elif echo "$1" | grep -qi "password"; then
  echo "$OPENCODE_GIT_TOKEN"
fi
```

**Option B: Inline with git config**

Use `git -c credential.helper='!f() { echo "username=x-access-token"; echo "password=$OPENCODE_GIT_TOKEN"; }; f'`

Recommendation: Start with Option B (no external script needed), can switch to Option A if issues.

---

## UI Changes

**File:** `packages/app/src/components/dialog-edit-project.tsx`

Add new section after existing name/icon fields:

```tsx
{/* Git Settings */}
<div class="flex flex-col gap-4">
  <h3 class="text-14-medium">Git Settings</h3>
  
  {/* Identity */}
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
  </div>

  {/* Authentication */}
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
    </Show>
    
    <p class="text-12 text-text-weak">
      <Show when={store.gitProvider === 'github'}>
        <a href="https://github.com/settings/tokens" target="_blank">
          Create a GitHub token
        </a> with 'repo' scope.
      </Show>
      <Show when={store.gitProvider === 'gitlab'}>
        <a href="https://gitlab.com/-/user_settings/personal_access_tokens" target="_blank">
          Create a GitLab token
        </a> with 'read_repository' and 'write_repository' scopes.
      </Show>
    </p>
  </div>
</div>
```

---

## Token Validation

Add validation function to test the token works:

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
| Modify | `packages/opencode/src/project/project.ts` |
| Modify | `packages/opencode/src/server/project.ts` |
| Modify | `packages/opencode/src/tool/bash.ts` |
| Modify | `packages/app/src/components/dialog-edit-project.tsx` |
| Maybe | Create credential helper script if Option A |

---

## Implementation Steps

1. Add `gitIdentity` and `gitAuth` to Project schema
2. Add to update endpoint schema
3. Modify bash tool to inject env vars for git commands
4. Update DialogEditProject with git settings UI
5. Add token validation function
6. Test with GitHub PAT
7. Test with GitLab PAT
8. Test self-hosted (if accessible)

---

## Security Considerations

- Token stored in project JSON file
- Follow existing patterns for secret storage
- Consider encrypting tokens at rest (check how API keys are handled)
- Token only injected for git commands, not all bash commands

---

## Testing Checklist

- [ ] Git commit uses correct author name/email
- [ ] Git push to GitHub works with PAT
- [ ] Git push to GitLab works with PAT
- [ ] Git clone private repo works
- [ ] Token validation shows correct username
- [ ] Invalid token shows error
- [ ] Self-hosted GitHub Enterprise works
- [ ] Self-hosted GitLab works
- [ ] SSH remotes still work (PAT not used)
