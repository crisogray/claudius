# Git Worktree Folders for Sessions

## Overview

Two related improvements:

1. **Sidebar grouping** - Group sessions by worktree within projects
2. **New session page** - Clearer worktree/branch selection with two separate selectors

---

## Part 1: Sidebar Session Grouping (UI-Only)

### Current State

- Sessions have `directory` field (the worktree path)
- Projects have `worktree` (base) and `sandboxes` (linked worktrees)
- Sessions currently displayed flat under project

### Goal

Group sessions by their worktree:

```
Project A
├── my-project (main) ← base worktree, collapsible
│   ├── Session 1
│   └── Session 3
├── feature-x (feature/login) ← linked worktree, collapsible
│   └── Session 2
```

---

## Part 2: New Session Page - Two Selectors

### Current Problem

The existing dropdown conflates worktrees and branches:

- Shows "Main branch" but means main worktree
- Uses branch icon but lists worktrees
- "Create new worktree" doesn't show source branch selection

### New Design: Two Explicit Selectors

**1. Worktree Selector:**

```
[Worktree: main-project (main) ▼]
  - main-project (main)           ← base worktree + its current branch
  - feature-x (feature/login)     ← linked worktree + its branch
  - Create new worktree...        ← triggers inline source branch selector
```

**2. When "Create new worktree" selected, show inline branch picker:**

```
[Worktree: Create new worktree ▼]
[From branch: main ▼]            ← inline selector appears
  - main
  - develop
  - feature/other
  - (remote branches...)
```

This gives explicit control: users clearly understand they're selecting a worktree, and when creating a new one, they explicitly choose which branch to base it on.

---

## Implementation Steps

### Part 1: Sidebar Session Grouping

#### Step 1.1: Add branch info to worktree data

**File: `packages/opencode/src/project/vcs.ts`**

Add function to get branch for any worktree directory:

```ts
export async function branchFor(directory: string) {
  return $`git rev-parse --abbrev-ref HEAD`
    .quiet()
    .nothrow()
    .cwd(directory)
    .text()
    .then((x) => x.trim())
    .catch(() => undefined)
}
```

**File: `packages/opencode/src/server/server.ts`** or sync endpoints

Include branch info when returning sandbox/worktree data.

#### Step 1.2: Create worktree grouping in layout

**File: `packages/app/src/pages/layout.tsx`**

In `SortableProject`, group sessions by worktree:

```tsx
const sessionsByWorktree = createMemo(() => {
  const result: Array<{
    directory: string
    sessions: Session[]
    isBase: boolean
    branch?: string
  }> = []

  // Always include base worktree
  const baseStore = globalSync.child(props.project.worktree)[0]
  result.push({
    directory: props.project.worktree,
    sessions: baseStore.session
      .filter((s) => s.directory === props.project.worktree && !s.parentID)
      .toSorted(sortSessions),
    isBase: true,
    branch: baseStore.vcs?.branch,
  })

  // Add linked worktrees with sessions
  for (const sandbox of props.project.sandboxes ?? []) {
    if (sandbox === props.project.worktree) continue
    const store = globalSync.child(sandbox)[0]
    const sessions = store.session.filter((s) => s.directory === sandbox && !s.parentID).toSorted(sortSessions)
    if (sessions.length > 0) {
      result.push({
        directory: sandbox,
        sessions,
        isBase: false,
        branch: store.vcs?.branch,
      })
    }
  }
  return result
})
```

#### Step 1.3: Create WorktreeSection component

```tsx
const WorktreeSection = (props: {
  directory: string
  sessions: Session[]
  isBase: boolean
  branch?: string
  project: LocalProject
  mobile?: boolean
}) => {
  const [expanded, setExpanded] = createSignal(true)
  const folderName = getFilename(props.directory)

  return (
    <Collapsible open={expanded()} onOpenChange={setExpanded}>
      <Collapsible.Trigger class="flex items-center gap-2 px-2 py-1 text-12-medium text-text-weak">
        <Icon name="git-branch" size="small" />
        <span>{folderName}</span>
        <Show when={props.branch}>
          <span class="text-text-weaker">({props.branch})</span>
        </Show>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <For each={props.sessions}>
          {session => <SessionItem session={session} ... />}
        </For>
        <Show when={props.sessions.length === 0}>
          <A href={`${base64Encode(props.directory)}/session`}>New session</A>
        </Show>
      </Collapsible.Content>
    </Collapsible>
  )
}
```

---

### Part 2: New Session Page - Two Selectors

#### Step 2.1: Add branch listing endpoint

**File: `packages/opencode/src/project/vcs.ts`**

```ts
export async function listBranches() {
  const local = await $`git branch --format='%(refname:short)'`.quiet().nothrow().cwd(Instance.worktree).text()
  const remote = await $`git branch -r --format='%(refname:short)'`.quiet().nothrow().cwd(Instance.worktree).text()

  return {
    local: local.split("\n").filter(Boolean),
    remote: remote
      .split("\n")
      .filter(Boolean)
      .map((b) => b.replace("origin/", "")),
  }
}
```

**File: `packages/opencode/src/server/server.ts`**

Add endpoint: `GET /vcs/branches`

#### Step 2.2: Update Worktree.create to accept source branch

**File: `packages/opencode/src/worktree/index.ts`**

```ts
export const CreateInput = z.object({
  name: z.string().optional(),
  fromBranch: z.string().optional(), // NEW: source branch
  startCommand: z.string().optional(),
})

// In create():
const created = await $`git worktree add -b ${info.branch} ${info.directory} ${input?.fromBranch ?? "HEAD"}`
```

#### Step 2.3: Redesign NewSessionView

**File: `packages/app/src/components/session/session-new-view.tsx`**

```tsx
export function NewSessionView(props: NewSessionViewProps) {
  const [selectedWorktree, setSelectedWorktree] = createSignal<string>("main")
  const [showBranchPicker, setShowBranchPicker] = createSignal(false)
  const [fromBranch, setFromBranch] = createSignal("main")

  // Worktree options with branch info
  const worktreeOptions = createMemo(() => [
    { value: "main", label: `${getFilename(sync.project?.worktree)} (${vcs.branch})`, branch: vcs.branch },
    ...sandboxes().map((s) => ({
      value: s.directory,
      label: `${getFilename(s.directory)} (${s.branch})`,
      branch: s.branch,
    })),
    { value: "create", label: "Create new worktree..." },
  ])

  return (
    <div>
      {/* Worktree Selector */}
      <div class="flex items-center gap-2">
        <Icon name="folder" size="small" />
        <Select
          options={worktreeOptions()}
          current={selectedWorktree()}
          onSelect={(v) => {
            setSelectedWorktree(v)
            setShowBranchPicker(v === "create")
          }}
        />
      </div>

      {/* Inline branch picker - shown when "Create new worktree" selected */}
      <Show when={showBranchPicker()}>
        <div class="flex items-center gap-2 mt-2">
          <Icon name="git-branch" size="small" />
          <span>From branch:</span>
          <Select
            options={branches()} // from /vcs/branches endpoint
            current={fromBranch()}
            onSelect={setFromBranch}
          />
        </div>
      </Show>
    </div>
  )
}
```

---

## Files to Modify

**Part 1 (Sidebar Grouping):**

- `packages/app/src/pages/layout.tsx` - Add WorktreeSection, grouping logic
- `packages/opencode/src/project/vcs.ts` - Add branchFor() helper (optional)

**Part 2 (New Session Page):**

- `packages/opencode/src/project/vcs.ts` - Add listBranches()
- `packages/opencode/src/server/server.ts` - Add GET /vcs/branches endpoint
- `packages/opencode/src/worktree/index.ts` - Add fromBranch to CreateInput
- `packages/app/src/components/session/session-new-view.tsx` - Two-selector redesign

---

## Verification

**Part 1:**

1. Open project with multiple worktrees
2. Verify sessions grouped under worktree folders
3. Verify labels show "folder (branch)"
4. Verify folders independently collapsible
5. Verify base worktree always visible

**Part 2:**

1. Navigate to new session page
2. Verify worktree dropdown shows folder + branch
3. Select "Create new worktree"
4. Verify "From branch" selector appears inline
5. Create worktree and verify it's based on selected branch
