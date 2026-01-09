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

Middle panel becomes an **intermediate navigation screen** on mobile.

### Mobile Flow

**Current (OpenCode):**
```
Sidebar → Session (chat + prompt) ←→ Review (toggle)
```

**New (ADE):**
```
Sidebar → Middle Panel → Chat / Review / Context
          (overview)     (detail views)
```

### Implementation

```tsx
// Track mobile view state
const [mobileView, setMobileView] = createSignal<"middle" | "chat" | "review" | "context">("middle")

// Mobile: show one view at a time with navigation
<Show when={!isDesktop()}>
  <Switch>
    <Match when={mobileView() === "middle"}>
      <MiddlePanel 
        onOpenChat={() => setMobileView("chat")} 
        onOpenFile={(f) => { setMobileView("review"); scrollToFile(f) }} 
      />
    </Match>
    <Match when={mobileView() === "chat"}>
      <MobileHeader title="Chat" onBack={() => setMobileView("middle")} />
      <ChatContent />
    </Match>
    <Match when={mobileView() === "review"}>
      <MobileHeader title="Review" onBack={() => setMobileView("middle")} />
      <ReviewContent />
    </Match>
    <Match when={mobileView() === "context"}>
      <MobileHeader title="Context" onBack={() => setMobileView("middle")} />
      <ContextContent />
    </Match>
  </Switch>
</Show>

// Desktop: side by side as planned
<Show when={isDesktop()}>
  <MiddlePanel />
  <ResizeHandle />
  <RightPanel /> {/* Tabs: Chat, Review, Context, Files */}
</Show>
```

### Mobile Middle Panel

On mobile, the middle panel is the **landing page** for a session:
- Shows session status, changed files, git info
- Tap "Chat" button → navigate to chat view
- Tap a file → navigate to review view, scrolled to that file
- Back button returns to middle panel

### Mobile Header Component

```tsx
function MobileHeader(props: { title: string; onBack: () => void }) {
  return (
    <div class="h-12 flex items-center gap-2 px-4 border-b border-border-weak-base">
      <IconButton icon="arrow-left" variant="ghost" onClick={props.onBack} />
      <span class="text-14-medium">{props.title}</span>
    </div>
  )
}
```

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
6. Create `MobileHeader` component
7. Modify `session.tsx`:
   - Add MiddlePanel to left side (desktop)
   - Add Chat tab trigger
   - Wrap existing chat UI in Tabs.Content
   - Update resize handle binding
   - Implement mobile view switching (middle → chat/review/context)
8. Test desktop layout
9. Test mobile navigation flow

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

---

## Patterns Verified

All patterns align with existing OpenCode codebase:

| Aspect | Pattern | Source |
|--------|---------|--------|
| Layout context store | `middlePanel: { width }` | Same as `sidebar`, `terminal`, `session` |
| Persisted state | `persisted()` wrapper | `layout.tsx` line 48 |
| Resize methods | `width()` / `resize()` | `session.width()` pattern |
| Component location | `components/session/` | Existing session components |
| Component exports | `index.ts` barrel | `components/session/index.ts` |
| VCS/branch data | `sync.data.vcs?.branch` | `global-sync.tsx` line 55 |
| Session status | `sync.data.session_status[id]` | Already available |
| Diffs data | `diffs()` computed | Already in `session.tsx` |
| Tabs component | `@opencode-ai/ui/tabs` | Already used |
| ResizeHandle | `@opencode-ai/ui/resize-handle` | Already used |
| Mobile detection | `isDesktop()` media query | `session.tsx` line 213 |
