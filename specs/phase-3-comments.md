# Phase 3: Comment → Agent Loop

## Goal

Inline comments on diffs that persist as review threads and feed back to agent.

**Estimated effort:** ~10 hours

---

## Comment States

Comments follow GitHub PR review mental model:

- `pending` - Not yet addressed by agent
- `resolved` - Agent addressed, shows resolution

User can:
- Create comments on any diff line
- Resolve comments manually
- Reopen resolved comments if fix was wrong

---

## Comment Schema

**File:** `packages/opencode/src/session/comment.ts` (new)

```typescript
import z from "zod"
import { BusEvent } from "@/bus/bus-event"

export namespace Comment {
  export const Info = z
    .object({
      id: z.string(),
      sessionID: z.string(),
      file: z.string(),
      line: z.number(),
      side: z.enum(["old", "new"]), // Which side of diff
      content: z.string(),
      status: z.enum(["pending", "resolved"]),
      resolution: z.string().optional(), // How it was resolved
      time: z.object({
        created: z.number(),
        resolved: z.number().optional(),
      }),
    })
    .meta({
      ref: "Comment",
    })

  export type Info = z.infer<typeof Info>

  export const Event = {
    Created: BusEvent.define("comment.created", Info),
    Updated: BusEvent.define("comment.updated", Info),
    Deleted: BusEvent.define("comment.deleted", z.object({ id: z.string(), sessionID: z.string() })),
  }
}
```

---

## Storage

Store comments in session directory alongside other session data:

**Location:** `~/.opencode/data/session/{sessionID}/comments.json`

```typescript
// Storage functions
export async function list(sessionID: string): Promise<Comment.Info[]> {
  return Storage.read<Comment.Info[]>(["session", sessionID, "comments"]) ?? []
}

export async function create(sessionID: string, input: Omit<Comment.Info, "id" | "time">): Promise<Comment.Info> {
  const comment: Comment.Info = {
    ...input,
    id: Identifier.ascending("comment"),
    time: { created: Date.now() },
  }
  await Storage.update<Comment.Info[]>(["session", sessionID, "comments"], (comments) => {
    return [...(comments ?? []), comment]
  })
  Bus.publish(Comment.Event.Created, comment)
  return comment
}

export async function update(sessionID: string, commentID: string, updates: Partial<Comment.Info>): Promise<Comment.Info> {
  let updated: Comment.Info | undefined
  await Storage.update<Comment.Info[]>(["session", sessionID, "comments"], (comments) => {
    return (comments ?? []).map((c) => {
      if (c.id !== commentID) return c
      updated = { ...c, ...updates }
      if (updates.status === "resolved") {
        updated.time = { ...updated.time, resolved: Date.now() }
      }
      return updated
    })
  })
  if (updated) Bus.publish(Comment.Event.Updated, updated)
  return updated!
}

export async function remove(sessionID: string, commentID: string): Promise<void> {
  await Storage.update<Comment.Info[]>(["session", sessionID, "comments"], (comments) => {
    return (comments ?? []).filter((c) => c.id !== commentID)
  })
  Bus.publish(Comment.Event.Deleted, { id: commentID, sessionID })
}
```

---

## Server Endpoints

**File:** `packages/opencode/src/server/session.ts`

```typescript
// Create comment
app.post("/session/:sessionID/comment", async (c) => {
  const sessionID = c.req.param("sessionID")
  const body = await c.req.json()
  const comment = await Comment.create(sessionID, body)
  return c.json(comment)
})

// List comments
app.get("/session/:sessionID/comment", async (c) => {
  const sessionID = c.req.param("sessionID")
  const comments = await Comment.list(sessionID)
  return c.json(comments)
})

// Update comment (resolve/reopen)
app.patch("/session/:sessionID/comment/:commentID", async (c) => {
  const sessionID = c.req.param("sessionID")
  const commentID = c.req.param("commentID")
  const body = await c.req.json()
  const comment = await Comment.update(sessionID, commentID, body)
  return c.json(comment)
})

// Delete comment
app.delete("/session/:sessionID/comment/:commentID", async (c) => {
  const sessionID = c.req.param("sessionID")
  const commentID = c.req.param("commentID")
  await Comment.remove(sessionID, commentID)
  return c.json({ success: true })
})
```

---

## SSE Events

Add to existing SSE event handling:

**Events:**
- `comment.created` - New comment added
- `comment.updated` - Comment resolved/reopened
- `comment.deleted` - Comment removed

**File:** `packages/app/src/context/sync.tsx`

Handle events to update local comment store.

---

## Diff Annotation Wiring

**File:** `packages/ui/src/components/session-review.tsx`

The `@pierre/diffs` library supports annotations but they're currently unused.

```typescript
// Pass comments as annotations
<Diff
  before={...}
  after={...}
  annotations={comments()
    .filter((c) => c.file === file.path)
    .map((c) => ({
      side: c.side,
      lineNumber: c.line,
      data: c,
    }))}
/>
```

**File:** `packages/ui/src/components/diff-ssr.tsx`

Verify/enable annotation rendering. There's commented-out code (lines 41-62) that needs to be activated:

```typescript
// Uncomment and implement:
if (props.annotations?.length > 0 && props.renderAnnotation != null) {
  for (const annotation of props.annotations) {
    const slotName = `annotation-${annotation.side}-${annotation.lineNumber}`
    const slotElement = fileDiffRef.querySelector(`[slot="${slotName}"]`)
    if (slotElement != null) {
      slotElement.innerHTML = ''
      render(() => props.renderAnnotation!(annotation), slotElement)
    }
  }
}
```

---

## Comment UI Components

**File:** `packages/ui/src/components/diff-comment.tsx` (new)

### CommentAnnotation

Renders existing comment inline on diff:

```typescript
export function CommentAnnotation(props: { comment: Comment.Info; onResolve: () => void; onReopen: () => void }) {
  return (
    <div class="comment-annotation">
      <div class="comment-header">
        <span class={`status status-${props.comment.status}`}>
          {props.comment.status === "pending" ? "●" : "✓"}
        </span>
        <span class="timestamp">{formatTime(props.comment.time.created)}</span>
      </div>
      <div class="comment-content">{props.comment.content}</div>
      <Show when={props.comment.status === "resolved" && props.comment.resolution}>
        <div class="comment-resolution">
          <span class="label">Resolution:</span>
          {props.comment.resolution}
        </div>
      </Show>
      <div class="comment-actions">
        <Show when={props.comment.status === "pending"}>
          <Button size="small" onClick={props.onResolve}>Resolve</Button>
        </Show>
        <Show when={props.comment.status === "resolved"}>
          <Button size="small" variant="ghost" onClick={props.onReopen}>Reopen</Button>
        </Show>
      </div>
    </div>
  )
}
```

### CommentInput

Inline textarea for new comments:

```typescript
export function CommentInput(props: { onSubmit: (content: string) => void; onCancel: () => void }) {
  const [content, setContent] = createSignal("")
  
  return (
    <div class="comment-input">
      <textarea
        placeholder="Add a comment..."
        value={content()}
        onInput={(e) => setContent(e.currentTarget.value)}
        autofocus
      />
      <div class="comment-input-actions">
        <Button size="small" variant="ghost" onClick={props.onCancel}>Cancel</Button>
        <Button size="small" onClick={() => props.onSubmit(content())} disabled={!content().trim()}>
          Comment
        </Button>
      </div>
    </div>
  )
}
```

### Line Hover Button

Add "+" button on line hover to start comment:

```typescript
// In diff line rendering
<div class="diff-line" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
  <Show when={hovered()}>
    <button class="add-comment-button" onClick={() => startComment(lineNumber, side)}>
      +
    </button>
  </Show>
  {/* Line content */}
</div>
```

---

## Agent Integration

**File:** `packages/opencode/src/session/prompt.ts`

When building prompt context, include pending comments:

```typescript
async function buildContext(sessionID: string): Promise<string> {
  const comments = await Comment.list(sessionID)
  const pending = comments.filter((c) => c.status === "pending")
  
  if (pending.length === 0) return ""
  
  let context = "\n\n<review_comments>\n"
  context += "The user has left the following review comments to address:\n\n"
  
  for (const comment of pending) {
    context += `- ${comment.file}:${comment.line} (${comment.side} side): ${comment.content}\n`
  }
  
  context += "\nPlease address each comment in your response.\n"
  context += "</review_comments>"
  
  return context
}
```

Inject into system prompt or user message context.

---

## Resolution by Agent

**Option A: Explicit tool**

Agent can call a `resolve_comment` tool:

```typescript
const ResolveCommentTool = {
  name: "resolve_comment",
  description: "Mark a review comment as resolved",
  parameters: z.object({
    commentID: z.string(),
    resolution: z.string().describe("Brief explanation of how you addressed this comment"),
  }),
  async execute({ commentID, resolution }) {
    await Comment.update(sessionID, commentID, {
      status: "resolved",
      resolution,
    })
    return { success: true }
  },
}
```

**Option B: Implicit resolution**

After agent responds, show UI to user asking which comments were addressed.

Recommendation: Start with Option B (simpler), add Option A later if needed.

---

## Files Summary

| Action | File |
|--------|------|
| Create | `packages/opencode/src/session/comment.ts` |
| Create | `packages/ui/src/components/diff-comment.tsx` |
| Create | `packages/ui/src/components/diff-comment.css` |
| Modify | `packages/opencode/src/server/session.ts` |
| Modify | `packages/ui/src/components/session-review.tsx` |
| Modify | `packages/ui/src/components/diff-ssr.tsx` |
| Modify | `packages/app/src/context/sync.tsx` |
| Modify | `packages/opencode/src/session/prompt.ts` |

---

## Implementation Steps

1. Create Comment namespace with schema and storage functions
2. Add server endpoints for CRUD operations
3. Add SSE events to bus
4. Handle events in frontend sync context
5. Enable annotation rendering in diff-ssr.tsx
6. Create CommentAnnotation component
7. Create CommentInput component
8. Add line hover "+" button
9. Wire comments to SessionReview
10. Add pending comments to agent prompt context
11. Test full flow: comment → agent → resolution

---

## Testing Checklist

- [ ] Can create comment on diff line
- [ ] Comment appears inline on diff
- [ ] Comments persist across page refresh
- [ ] Can resolve comment manually
- [ ] Can reopen resolved comment
- [ ] Can delete comment
- [ ] Pending comments appear in agent prompt
- [ ] Agent response addresses comments
- [ ] SSE events update UI in real-time
- [ ] Multiple comments on same file work
- [ ] Comments on old vs new side work correctly
