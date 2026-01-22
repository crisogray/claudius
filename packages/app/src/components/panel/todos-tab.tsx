import { createMemo, For } from "solid-js"
import { useSync } from "@/context/sync"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import type { Todo } from "@opencode-ai/sdk/v2/client"

export function TodosTab(props: { sessionID?: string }) {
  const sync = useSync()

  const todos = createMemo(() => (props.sessionID ? (sync.data.todo[props.sessionID] ?? []) : []))

  return (
    <div data-component="todos" data-panel>
      <For each={todos()}>
        {(todo: Todo) => (
          <Checkbox readOnly checked={todo.status === "completed"}>
            <div data-slot="message-part-todo-content" data-completed={todo.status === "completed"}>
              {todo.content}
            </div>
          </Checkbox>
        )}
      </For>
    </div>
  )
}

// Hook for parent to compute badge values
export function useTodosState(sessionID: string | undefined) {
  const sync = useSync()

  const todos = createMemo(() => (sessionID ? (sync.data.todo[sessionID] ?? []) : []))
  const hasTodos = createMemo(() => todos().length > 0)
  const completedCount = createMemo(() => todos().filter((t) => t.status === "completed").length)
  const totalCount = createMemo(() => todos().length)

  return { todos, hasTodos, completedCount, totalCount }
}
