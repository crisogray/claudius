import { createEffect, createMemo, on, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useSDK } from "./sdk"
import { usePlatform } from "./platform"

// Types matching the backend Git namespace
export type GitFileStatus = {
  path: string
  status: "modified" | "added" | "deleted" | "untracked" | "renamed" | "copied"
  staged: boolean
  added: number
  removed: number
  oldPath?: string
}

export type GitStatus = {
  branch?: string
  upstream?: string
  ahead: number
  behind: number
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  conflicted: GitFileStatus[]
}

export type GitCommit = {
  hash: string
  hashShort: string
  author: string
  email: string
  date: number
  message: string
  messageShort: string
}

export const { use: useGit, provider: GitProvider } = createSimpleContext({
  name: "Git",
  init: () => {
    const sdk = useSDK()
    const platform = usePlatform()
    const [store, setStore] = createStore({
      status: null as GitStatus | null,
      log: [] as GitCommit[],
      loading: false,
      error: null as string | null,
      refreshedAt: 0,
    })

    // Helper to make API calls (uses platform.fetch for Tauri auth support, falls back to fetch for web)
    const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const res = await (platform.fetch ?? fetch)(`${sdk.url}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-opencode-directory": sdk.directory,
          ...options?.headers,
        },
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error(`Git API error: ${res.statusText}`)
      }
      return res.json()
    }

    // Compare two GitFileStatus arrays for equality
    const fileStatusesEqual = (a: GitFileStatus[], b: GitFileStatus[]): boolean => {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        const fa = a[i]
        const fb = b[i]
        if (
          fa.path !== fb.path ||
          fa.status !== fb.status ||
          fa.staged !== fb.staged ||
          fa.added !== fb.added ||
          fa.removed !== fb.removed ||
          fa.oldPath !== fb.oldPath
        ) {
          return false
        }
      }
      return true
    }

    // Compare two GitStatus objects for equality
    const statusEqual = (a: GitStatus | null, b: GitStatus | null): boolean => {
      if (a === b) return true
      if (!a || !b) return false
      return (
        a.branch === b.branch &&
        a.upstream === b.upstream &&
        a.ahead === b.ahead &&
        a.behind === b.behind &&
        fileStatusesEqual(a.staged, b.staged) &&
        fileStatusesEqual(a.unstaged, b.unstaged) &&
        fileStatusesEqual(a.untracked, b.untracked) &&
        fileStatusesEqual(a.conflicted, b.conflicted)
      )
    }

    // Compare two GitCommit arrays for equality
    const logEqual = (a: GitCommit[], b: GitCommit[]): boolean => {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (a[i].hash !== b[i].hash) return false
      }
      return true
    }

    const refresh = async (options?: { showLoading?: boolean }) => {
      // Only show loading for explicit refreshes, not background polls
      if (options?.showLoading) {
        setStore("loading", true)
      }
      try {
        const [status, log] = await Promise.all([api<GitStatus>("/git/status"), api<GitCommit[]>("/git/log?limit=20")])

        // Only update store if status actually changed (prevents unnecessary re-renders)
        const statusChanged = !statusEqual(store.status, status)
        const logChanged = !logEqual(store.log, log)

        if (statusChanged) {
          setStore("status", status)
        }
        if (logChanged) {
          setStore("log", log)
        }
        setStore("error", null)

        // Only update refreshedAt when something actually changed
        if (statusChanged || logChanged) {
          setStore("refreshedAt", Date.now())
        }
      } catch (e) {
        setStore("error", e instanceof Error ? e.message : "Unknown error")
      } finally {
        if (options?.showLoading) {
          setStore("loading", false)
        }
      }
    }

    const stage = async (files: string[]) => {
      await api("/git/stage", {
        method: "POST",
        body: JSON.stringify({ files }),
      })
      await refresh({ showLoading: true })
    }

    const unstage = async (files: string[]) => {
      await api("/git/unstage", {
        method: "POST",
        body: JSON.stringify({ files }),
      })
      await refresh({ showLoading: true })
    }

    const stageAll = async () => {
      await api("/git/stage-all", { method: "POST" })
      await refresh({ showLoading: true })
    }

    const unstageAll = async () => {
      await api("/git/unstage-all", { method: "POST" })
      await refresh({ showLoading: true })
    }

    const discard = async (files: string[]) => {
      await api("/git/discard", {
        method: "POST",
        body: JSON.stringify({ files }),
      })
      await refresh({ showLoading: true })
    }

    const deleteUntracked = async (files: string[]) => {
      await api("/git/delete-untracked", {
        method: "POST",
        body: JSON.stringify({ files }),
      })
      await refresh({ showLoading: true })
    }

    const commit = async (message: string, options?: { amend?: boolean }) => {
      await api("/git/commit", {
        method: "POST",
        body: JSON.stringify({ message, amend: options?.amend }),
      })
      await refresh({ showLoading: true })
    }

    const diff = async (file: string, staged = false): Promise<string> => {
      const result = await api<{ diff: string }>(`/git/diff?file=${encodeURIComponent(file)}&staged=${staged}`)
      return result.diff
    }

    const show = async (file: string, ref = "HEAD"): Promise<string> => {
      const result = await api<{ content: string }>(
        `/git/show?file=${encodeURIComponent(file)}&ref=${encodeURIComponent(ref)}`,
      )
      return result.content
    }

    // Initial load
    onMount(() => {
      refresh({ showLoading: true })
    })

    // Refresh when directory changes (for reactive project switching)
    createEffect(
      on(
        () => sdk.directory,
        () => {
          // Clear stale data immediately, then fetch new data
          setStore("status", null)
          setStore("log", [])
          refresh({ showLoading: true })
        },
        { defer: true }, // Skip initial run (onMount handles it)
      ),
    )

    // Refresh periodically (every 5 seconds)
    const interval = setInterval(refresh, 5000)
    onCleanup(() => clearInterval(interval))

    // Create a map of file paths to their git status for easy lookup
    const fileStatuses = createMemo(() => {
      const map = new Map<string, GitFileStatus>()
      if (!store.status) return map

      for (const file of store.status.staged) {
        map.set(file.path, file)
      }
      for (const file of store.status.unstaged) {
        map.set(file.path, file)
      }
      for (const file of store.status.untracked) {
        map.set(file.path, file)
      }
      return map
    })

    // Create a map of folder paths to the types of changes they contain
    const folderStatuses = createMemo(() => {
      const folderMap = new Map<string, Set<string>>()
      if (!store.status) return folderMap

      const allFiles = [...store.status.staged, ...store.status.unstaged, ...store.status.untracked]

      for (const file of allFiles) {
        const parts = file.path.split("/")
        for (let i = 0; i < parts.length - 1; i++) {
          const dirPath = parts.slice(0, i + 1).join("/")
          let statusSet = folderMap.get(dirPath)
          if (!statusSet) {
            statusSet = new Set()
            folderMap.set(dirPath, statusSet)
          }
          statusSet.add(file.status)
        }
      }

      return folderMap
    })

    return {
      get status() {
        return store.status
      },
      get log() {
        return store.log
      },
      get loading() {
        return store.loading
      },
      get error() {
        return store.error
      },
      get refreshedAt() {
        return store.refreshedAt
      },
      fileStatuses,
      folderStatuses,
      refresh,
      stage,
      unstage,
      stageAll,
      unstageAll,
      discard,
      deleteUntracked,
      commit,
      diff,
      show,
    }
  },
})
