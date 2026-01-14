import { createEffect, createMemo, onCleanup, onMount } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useSDK } from "./sdk"
import { useSync } from "./sync"

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
    const [store, setStore] = createStore({
      status: null as GitStatus | null,
      log: [] as GitCommit[],
      loading: false,
      error: null as string | null,
    })

    // Helper to make API calls
    const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const res = await fetch(`${sdk.url}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-opencode-directory": sdk.directory,
          ...options?.headers,
        },
      })
      if (!res.ok) {
        throw new Error(`Git API error: ${res.statusText}`)
      }
      return res.json()
    }

    const refresh = async () => {
      setStore("loading", true)
      try {
        const [status, log] = await Promise.all([
          api<GitStatus>("/git/status"),
          api<GitCommit[]>("/git/log?limit=20"),
        ])
        setStore("status", status)
        setStore("log", log)
        setStore("error", null)
      } catch (e) {
        setStore("error", e instanceof Error ? e.message : "Unknown error")
      } finally {
        setStore("loading", false)
      }
    }

    const stage = async (files: string[]) => {
      await api("/git/stage", {
        method: "POST",
        body: JSON.stringify({ files }),
      })
      await refresh()
    }

    const unstage = async (files: string[]) => {
      await api("/git/unstage", {
        method: "POST",
        body: JSON.stringify({ files }),
      })
      await refresh()
    }

    const stageAll = async () => {
      await api("/git/stage-all", { method: "POST" })
      await refresh()
    }

    const unstageAll = async () => {
      await api("/git/unstage-all", { method: "POST" })
      await refresh()
    }

    const discard = async (files: string[]) => {
      await api("/git/discard", {
        method: "POST",
        body: JSON.stringify({ files }),
      })
      await refresh()
    }

    const commit = async (message: string, options?: { amend?: boolean }) => {
      await api("/git/commit", {
        method: "POST",
        body: JSON.stringify({ message, amend: options?.amend }),
      })
      await refresh()
    }

    const diff = async (file: string, staged = false): Promise<string> => {
      const result = await api<{ diff: string }>(`/git/diff?file=${encodeURIComponent(file)}&staged=${staged}`)
      return result.diff
    }

    // Initial load
    onMount(() => {
      refresh()
    })

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
      fileStatuses,
      refresh,
      stage,
      unstage,
      stageAll,
      unstageAll,
      discard,
      commit,
      diff,
    }
  },
})
