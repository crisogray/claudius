import { SessionStatusHeader } from "./session-status-header"
import { FileList } from "./file-list"
import { GitStatus } from "./git-status"

interface MiddlePanelProps {
  onFileClick?: (path: string) => void
  onOpenChat?: () => void
}

export function MiddlePanel(props: MiddlePanelProps) {
  return (
    <div class="flex flex-col h-full bg-background-base">
      <SessionStatusHeader />
      <FileList onFileClick={props.onFileClick} />
      <GitStatus />
    </div>
  )
}
