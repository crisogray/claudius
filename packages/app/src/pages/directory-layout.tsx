import { createMemo, Show, type ParentProps } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { SDKProvider, useSDK } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { GitProvider } from "@/context/git"
import { LocalProvider } from "@/context/local"
import { LspProvider } from "@/context/lsp"

import { base64Decode } from "@opencode-ai/util/encode"
import { DataProvider } from "@opencode-ai/ui/context"
import { iife } from "@opencode-ai/util/iife"

export default function Layout(props: ParentProps) {
  const params = useParams()
  const navigate = useNavigate()
  const directory = createMemo(() => {
    return base64Decode(params.dir!)
  })
  return (
    <Show when={params.dir} keyed>
      <SDKProvider directory={directory()}>
        <SyncProvider>
          {iife(() => {
            const sync = useSync()
            const sdk = useSDK()
            const respond = (input: {
              sessionID: string
              permissionID: string
              response: "once" | "always" | "reject"
            }) => sdk.client.permission.respond(input)

            const respondToQuestion = (input: {
              sessionID: string
              requestID: string
              answers: string[][]
            }) => sdk.client.question.reply({ requestID: input.requestID, answers: input.answers })

            const rejectQuestion = (input: { sessionID: string; requestID: string }) =>
              sdk.client.question.reject({ requestID: input.requestID })

            const respondToPlan = (input: { sessionID: string; requestID: string; approved: boolean; message?: string }) => {
              if (input.approved) {
                sdk.client.plan.approve({ requestID: input.requestID })
              } else {
                sdk.client.plan.reject({ requestID: input.requestID, message: input.message })
              }
            }

            const navigateToSession = (sessionID: string) => {
              navigate(`/${params.dir}/session/${sessionID}`)
            }

            return (
              <DataProvider
                data={sync.data}
                directory={directory()}
                onPermissionRespond={respond}
                onQuestionRespond={respondToQuestion}
                onQuestionReject={rejectQuestion}
                onPlanRespond={respondToPlan}
                onNavigateToSession={navigateToSession}
              >
                <LspProvider>
                  <GitProvider>
                    <LocalProvider>{props.children}</LocalProvider>
                  </GitProvider>
                </LspProvider>
              </DataProvider>
            )
          })}
        </SyncProvider>
      </SDKProvider>
    </Show>
  )
}
