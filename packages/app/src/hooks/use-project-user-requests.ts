import { useGlobalSync } from "@/context/global-sync"
import type { LocalProject } from "@/context/layout"
import { createMemo, type Accessor } from "solid-js"

export function useProjectUserRequests(project: Accessor<LocalProject | undefined>) {
  const globalSync = useGlobalSync()

  const hasUserRequest = createMemo(() => {
    const p = project()
    if (!p) return false

    const directories = [p.worktree, ...(p.sandboxes ?? [])]

    for (const directory of directories) {
      const [store] = globalSync.child(directory)

      for (const session of store.session) {
        if (session.parentID) continue

        const sessionID = session.id
        if ((store.permission?.[sessionID] ?? []).length > 0) return true
        if ((store.question?.[sessionID] ?? []).length > 0) return true
        if ((store.plan?.[sessionID] ?? []).length > 0) return true

        const childSessions = store.session.filter((s) => s.parentID === sessionID)
        for (const child of childSessions) {
          if ((store.permission?.[child.id] ?? []).length > 0) return true
          if ((store.question?.[child.id] ?? []).length > 0) return true
          if ((store.plan?.[child.id] ?? []).length > 0) return true
        }
      }
    }
    return false
  })

  return { hasUserRequest }
}
