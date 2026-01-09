import { IconButton } from "@opencode-ai/ui/icon-button"

interface MobileHeaderProps {
  title: string
  onBack: () => void
}

export function MobileHeader(props: MobileHeaderProps) {
  return (
    <div class="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-border-weak-base bg-background-base">
      <IconButton icon="arrow-left" variant="ghost" onClick={props.onBack} />
      <span class="text-14-medium text-text-strong">{props.title}</span>
    </div>
  )
}
