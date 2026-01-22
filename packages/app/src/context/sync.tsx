import { batch, createMemo } from "solid-js"
import { createStore, produce, reconcile } from "solid-js/store"
import { Binary } from "@opencode-ai/util/binary"
import { retry } from "@opencode-ai/util/retry"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useGlobalSync } from "./global-sync"
import { useSDK } from "./sdk"
import type { Message, Part } from "@opencode-ai/sdk/v2/client"

export const { use: useSync, provider: SyncProvider } = createSimpleContext({
  name: "Sync",
  init: () => {
    const globalSync = useGlobalSync()
    const sdk = useSDK()

    // Reactive store accessor - switches stores when sdk.directory changes
    const storeAccessor = createMemo(() => globalSync.child(sdk.directory))
    const getStore = () => storeAccessor()[0]
    const getSetStore = () => storeAccessor()[1]

    const absolute = (path: string) => (getStore().path.directory + "/" + path).replace("//", "/")
    const chunk = 50
    const inflight = new Map<string, Promise<void>>()
    const inflightDiff = new Map<string, Promise<void>>()
    const inflightTodo = new Map<string, Promise<void>>()
    const [meta, setMeta] = createStore({
      limit: {} as Record<string, number>,
      complete: {} as Record<string, boolean>,
      loading: {} as Record<string, boolean>,
    })

    const getSession = (sessionID: string) => {
      const match = Binary.search(getStore().session, sessionID, (s) => s.id)
      if (match.found) return getStore().session[match.index]
      return undefined
    }

    const limitFor = (count: number) => {
      if (count <= chunk) return chunk
      return Math.ceil(count / chunk) * chunk
    }

    const hydrateMessages = (sessionID: string) => {
      if (meta.limit[sessionID] !== undefined) return

      const messages = getStore().message[sessionID]
      if (!messages) return

      const limit = limitFor(messages.length)
      setMeta("limit", sessionID, limit)
      setMeta("complete", sessionID, messages.length < limit)
    }

    const loadMessages = async (sessionID: string, limit: number) => {
      if (meta.loading[sessionID]) return

      setMeta("loading", sessionID, true)

      await retry(() => sdk.client.session.messages({ sessionID, limit }))
        .then((messages) => {
          const items = (messages.data ?? []).filter((x) => !!x?.info?.id)
          const next = items
            .map((x) => x.info)
            .filter((m) => !!m?.id)
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id))

          batch(() => {
            getSetStore()("message", sessionID, reconcile(next, { key: "id" }))

            for (const message of items) {
              getSetStore()(
                "part",
                message.info.id,
                reconcile(
                  message.parts
                    .filter((p) => !!p?.id)
                    .slice()
                    .sort((a, b) => a.id.localeCompare(b.id)),
                  { key: "id" },
                ),
              )
            }

            setMeta("limit", sessionID, limit)
            setMeta("complete", sessionID, next.length < limit)
          })
        })
        .finally(() => {
          setMeta("loading", sessionID, false)
        })
    }

    return {
      get data() {
        return getStore()
      },
      get set() {
        return getSetStore()
      },
      get status() {
        return getStore().status
      },
      get ready() {
        return getStore().status !== "loading"
      },
      get project() {
        const match = Binary.search(globalSync.data.project, getStore().project, (p) => p.id)
        if (match.found) return globalSync.data.project[match.index]
        return undefined
      },
      session: {
        get: getSession,
        addOptimisticMessage(input: {
          sessionID: string
          messageID: string
          parts: Part[]
          permissionMode: "default" | "plan" | "acceptEdits" | "bypassPermissions"
          model: { providerID: string; modelID: string }
        }) {
          const message: Message = {
            id: input.messageID,
            sessionID: input.sessionID,
            role: "user",
            time: { created: Date.now() },
            permissionMode: input.permissionMode,
            model: input.model,
          }
          getSetStore()(
            produce((draft) => {
              const messages = draft.message[input.sessionID]
              if (!messages) {
                draft.message[input.sessionID] = [message]
              } else {
                const result = Binary.search(messages, input.messageID, (m) => m.id)
                messages.splice(result.index, 0, message)
              }
              draft.part[input.messageID] = input.parts
                .filter((p) => !!p?.id)
                .slice()
                .sort((a, b) => a.id.localeCompare(b.id))
            }),
          )
        },
        async sync(sessionID: string) {
          const hasSession = getSession(sessionID) !== undefined
          hydrateMessages(sessionID)

          const hasMessages = getStore().message[sessionID] !== undefined
          if (hasSession && hasMessages) return

          const pending = inflight.get(sessionID)
          if (pending) return pending

          const limit = meta.limit[sessionID] ?? chunk

          const sessionReq = hasSession
            ? Promise.resolve()
            : retry(() => sdk.client.session.get({ sessionID })).then((session) => {
                const data = session.data
                if (!data) return
                getSetStore()(
                  "session",
                  produce((draft) => {
                    const match = Binary.search(draft, sessionID, (s) => s.id)
                    if (match.found) {
                      draft[match.index] = data
                      return
                    }
                    draft.splice(match.index, 0, data)
                  }),
                )
              })

          const messagesReq = hasMessages ? Promise.resolve() : loadMessages(sessionID, limit)

          const promise = Promise.all([sessionReq, messagesReq])
            .then(() => {})
            .finally(() => {
              inflight.delete(sessionID)
            })

          inflight.set(sessionID, promise)
          return promise
        },
        async diff(sessionID: string) {
          if (getStore().session_diff[sessionID] !== undefined) return

          const pending = inflightDiff.get(sessionID)
          if (pending) return pending

          const promise = retry(() => sdk.client.session.diff({ sessionID }))
            .then((diff) => {
              getSetStore()("session_diff", sessionID, reconcile(diff.data ?? [], { key: "file" }))
            })
            .finally(() => {
              inflightDiff.delete(sessionID)
            })

          inflightDiff.set(sessionID, promise)
          return promise
        },
        async todo(sessionID: string) {
          if (getStore().todo[sessionID] !== undefined) return

          const pending = inflightTodo.get(sessionID)
          if (pending) return pending

          const promise = retry(() => sdk.client.session.todo({ sessionID }))
            .then((todo) => {
              getSetStore()("todo", sessionID, reconcile(todo.data ?? [], { key: "id" }))
            })
            .finally(() => {
              inflightTodo.delete(sessionID)
            })

          inflightTodo.set(sessionID, promise)
          return promise
        },
        history: {
          more(sessionID: string) {
            if (getStore().message[sessionID] === undefined) return false
            if (meta.limit[sessionID] === undefined) return false
            if (meta.complete[sessionID]) return false
            return true
          },
          loading(sessionID: string) {
            return meta.loading[sessionID] ?? false
          },
          async loadMore(sessionID: string, count = chunk) {
            if (meta.loading[sessionID]) return
            if (meta.complete[sessionID]) return

            const current = meta.limit[sessionID] ?? chunk
            await loadMessages(sessionID, current + count)
          },
        },
        fetch: async (count = 10) => {
          getSetStore()("limit", (x) => x + count)
          await sdk.client.session.list().then((x) => {
            const sessions = (x.data ?? [])
              .filter((s) => !!s?.id)
              .slice()
              .sort((a, b) => a.id.localeCompare(b.id))
              .slice(0, getStore().limit)
            getSetStore()("session", reconcile(sessions, { key: "id" }))
          })
        },
        more: createMemo(() => getStore().session.length >= getStore().limit),
        archive: async (sessionID: string) => {
          await sdk.client.session.update({ sessionID, time: { archived: Date.now() } })
          getSetStore()(
            produce((draft) => {
              const match = Binary.search(draft.session, sessionID, (s) => s.id)
              if (match.found) draft.session.splice(match.index, 1)
            }),
          )
        },
      },
      absolute,
      get directory() {
        return getStore().path.directory
      },
    }
  },
})
