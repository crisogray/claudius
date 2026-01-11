import { useTheme } from "../context/theme"
import type { Todo } from "@/session/todo"

export interface TodoItemProps {
  todo: Todo.Info
}

export function TodoItem(props: TodoItemProps) {
  const { theme } = useTheme()

  // Show activeForm when in_progress, otherwise show content
  const displayText = () =>
    props.todo.status === "in_progress" && props.todo.activeForm ? props.todo.activeForm : props.todo.content

  return (
    <box flexDirection="row" gap={0}>
      <text
        flexShrink={0}
        style={{
          fg: props.todo.status === "in_progress" ? theme.warning : theme.textMuted,
        }}
      >
        [{props.todo.status === "completed" ? "✓" : props.todo.status === "in_progress" ? "•" : " "}]{" "}
      </text>
      <text
        flexGrow={1}
        wrapMode="word"
        style={{
          fg: props.todo.status === "in_progress" ? theme.warning : theme.textMuted,
        }}
      >
        {displayText()}
      </text>
    </box>
  )
}
