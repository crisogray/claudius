# Phase 1: Three-Column Layout

## Goal

Add middle panel for session status/overview. Move chat to right panel as a tab.

**Estimated effort:** ~5 hours

---

## Current vs New Structure

**Current:**
```
SessionHeader
└─ flex-row
   ├─ SessionPanel (messages + prompt)
   └─ TabsPanel (Review, Context, Files)
```

**New:**
```
SessionHeader
└─ flex-row
   ├─ MiddlePanel (session status, file list, git)
   └─ RightPanel
       ├─ Chat tab (existing messages + prompt)
       ├─ Review tab
       ├─ Context tab
       └─ File tabs
```

---

## Key Insight

**No recreation needed.** Existing Messages and PromptInput code moves into a `<Tabs.Content value="chat">` wrapper.

---

## Layout Context Changes

**File:** `packages/app/src/context/layout.tsx`

Add to store:
```typescript
middlePanel: {
  width: 280,
},
```

Add methods:
```typescript
middlePanel: {
  width: createMemo(() => store.middlePanel?.width ?? 280),
  resize(width: number) {
    setStore("middlePanel", "width", width)
  },
},
```

---

## New Components

### MiddlePanel

**File:** `packages/app/src/components/session/middle-panel.tsx`

```typescript
export function MiddlePanel() {
  return (
    <div class="flex flex-col h-full">
      <SessionStatusHeader />
      <FileList />
      <GitStatus />
    </div>
  )
}
```

### SessionStatusHeader

**File:** `packages/app/src/components/session/session-status-header.tsx`

- Session title (editable?)
- Status badge: idle / busy / error
- Timer (optional, future)

### FileList

**File:** `packages/app/src/components/session/file-list.tsx`

- Maps `diffs()` to clickable file list
- Click → opens Review tab at that file
- Shows additions/deletions per file

### GitStatus

**File:** `packages/app/src/components/session/git-status.tsx`

- Current branch name (from VCS context)
- Collapsible section
- Future: ahead/behind counts, worktree info

---

## Session Page Changes

**File:** `packages/app/src/pages/session.tsx`

### Changes Required

1. Replace left panel content with `<MiddlePanel />`
2. Add "Chat" tab trigger to tabs list
   - Always visible
   - Cannot be closed
   - Shows message count or status indicator
3. Move existing Messages + PromptInput into `<Tabs.Content value="chat">`
4. Resize handle now controls `middlePanel.width` instead of `session.width`
5. Default tab logic:
   - Chat when no files changed
   - Review when files changed (existing behavior)

### Code Movement (not recreation)

Current location of chat UI (lines ~1050-1240):
```tsx
<div class="relative w-full h-full min-w-0">
  {/* SessionMessageRail */}
  {/* Message scroll container */}
  {/* PromptInput */}
</div>
```

This entire block moves into:
```tsx
<Tabs.Content value="chat" class="flex flex-col h-full overflow-hidden">
  {/* Same content, unchanged */}
</Tabs.Content>
```

---

## Mobile Handling

Follow existing pattern:
- `isDesktop()` media query already exists
- On mobile: Hide MiddlePanel entirely
- Show Chat directly (current behavior preserved)
- Keep existing mobile toggle (Session vs Review)

No changes to mobile behavior required.

---

## Files Summary

| Action | File |
|--------|------|
| Create | `packages/app/src/components/session/middle-panel.tsx` |
| Create | `packages/app/src/components/session/session-status-header.tsx` |
| Create | `packages/app/src/components/session/file-list.tsx` |
| Create | `packages/app/src/components/session/git-status.tsx` |
| Modify | `packages/app/src/pages/session.tsx` |
| Modify | `packages/app/src/context/layout.tsx` |
| Modify | `packages/app/src/components/session/index.ts` (exports) |

---

## Implementation Steps

1. Add `middlePanel` to layout context
2. Create `SessionStatusHeader` component
3. Create `FileList` component
4. Create `GitStatus` component
5. Create `MiddlePanel` container component
6. Modify `session.tsx`:
   - Add MiddlePanel to left side
   - Add Chat tab trigger
   - Wrap existing chat UI in Tabs.Content
   - Update resize handle binding
7. Test desktop layout
8. Verify mobile still works

---

## Component Details

### Chat Tab Trigger

```tsx
<Tabs.Trigger value="chat">
  <div class="flex items-center gap-2">
    <Icon name="message" />
    <span>Chat</span>
  </div>
</Tabs.Trigger>
```

### FileList Item

```tsx
<button onClick={() => openReviewAt(file.path)}>
  <FileIcon path={file.path} />
  <span class="truncate">{file.path}</span>
  <DiffChanges changes={[file]} variant="text" />
</button>
```

### Status Badge

```tsx
const status = session.status // 'idle' | 'busy' | 'error'
<div class={`badge badge-${status}`}>
  {status === 'busy' && <Spinner />}
  {status}
</div>
```

---

## Open Questions

- [ ] Should session title be editable inline in middle panel?
- [ ] Should FileList show all files or just changed files?
- [ ] Middle panel min/max width: 200px min, 400px max?
