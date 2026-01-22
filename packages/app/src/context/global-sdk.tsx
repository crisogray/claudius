import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2/client"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { batch, createSignal, onCleanup, type Accessor } from "solid-js"
import { usePlatform } from "./platform"
import { useServer } from "./server"

export type ConnectionStatus = "connected" | "connecting" | "disconnected"

export const { use: useGlobalSDK, provider: GlobalSDKProvider } = createSimpleContext({
  name: "GlobalSDK",
  init: () => {
    const server = useServer()
    const platform = usePlatform()
    const abort = new AbortController()

    const eventSdk = createOpencodeClient({
      baseUrl: server.url,
      signal: abort.signal,
      fetch: platform.fetch,
    })
    const emitter = createGlobalEmitter<{
      [key: string]: Event
    }>()

    type Queued = { directory: string; payload: Event }

    let queue: Array<Queued | undefined> = []
    const coalesced = new Map<string, number>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = 0

    const key = (directory: string, payload: Event) => {
      if (payload.type === "session.status") return `session.status:${directory}:${payload.properties.sessionID}`
      if (payload.type === "lsp.updated") return `lsp.updated:${directory}`
      if (payload.type === "message.part.updated") {
        const part = payload.properties.part
        return `message.part.updated:${directory}:${part.messageID}:${part.id}`
      }
      // Coalesce high-frequency events to reduce re-renders
      if (payload.type === "session.diff") return `session.diff:${directory}:${payload.properties.sessionID}`
      if (payload.type === "todo.updated") return `todo.updated:${directory}:${payload.properties.sessionID}`
      if (payload.type === "session.updated") return `session.updated:${directory}:${payload.properties.info.id}`
      // Permission events
      if (payload.type === "permission.asked")
        return `permission.asked:${directory}:${payload.properties.sessionID}`
      if (payload.type === "permission.replied")
        return `permission.replied:${directory}:${payload.properties.sessionID}:${payload.properties.requestID}`
    }

    const flush = () => {
      if (timer) clearTimeout(timer)
      timer = undefined

      const events = queue
      queue = []
      coalesced.clear()
      if (events.length === 0) return

      last = Date.now()
      batch(() => {
        for (const event of events) {
          if (!event) continue
          emitter.emit(event.directory, event.payload)
        }
      })
    }

    const schedule = () => {
      if (timer) return
      const elapsed = Date.now() - last
      timer = setTimeout(flush, Math.max(0, 16 - elapsed))
    }

    const stop = () => {
      flush()
    }

    const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>("connecting")

    const connectEventStream = async () => {
      let backoff = 1000
      const maxBackoff = 30000

      while (!abort.signal.aborted) {
        try {
          setConnectionStatus("connecting")
          const events = await eventSdk.global.event()
          setConnectionStatus("connected")
          backoff = 1000 // Reset backoff on successful connection

          let yielded = Date.now()
          for await (const event of events.stream) {
            const directory = event.directory ?? "global"
            const payload = event.payload
            const k = key(directory, payload)
            if (k) {
              const i = coalesced.get(k)
              if (i !== undefined) {
                queue[i] = undefined
              }
              coalesced.set(k, queue.length)
            }
            queue.push({ directory, payload })
            schedule()

            if (Date.now() - yielded < 8) continue
            yielded = Date.now()
            await new Promise<void>((resolve) => setTimeout(resolve, 0))
          }
          // Stream ended normally, try to reconnect
          if (!abort.signal.aborted) {
            setConnectionStatus("disconnected")
          }
        } catch {
          if (abort.signal.aborted) break
          setConnectionStatus("disconnected")
        }

        // Wait before reconnecting with exponential backoff
        if (!abort.signal.aborted) {
          await new Promise<void>((resolve) => setTimeout(resolve, backoff))
          backoff = Math.min(backoff * 2, maxBackoff)
        }
      }
      stop()
    }

    void connectEventStream()

    onCleanup(() => {
      abort.abort()
      stop()
    })

    const sdk = createOpencodeClient({
      baseUrl: server.url,
      fetch: platform.fetch,
      throwOnError: true,
    })

    return {
      url: server.url,
      client: sdk,
      event: emitter,
      connectionStatus: connectionStatus as Accessor<ConnectionStatus>,
    }
  },
})
