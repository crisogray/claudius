import type { Message, Session, Part, FileDiff, SessionStatus, PermissionRequest, QuestionRequest, PlanRequest } from "@opencode-ai/sdk/v2"
import { createSimpleContext } from "./helper"
import { PreloadMultiFileDiffResult } from "@pierre/diffs/ssr"

type Data = {
  session: Session[]
  session_status: {
    [sessionID: string]: SessionStatus
  }
  session_diff: {
    [sessionID: string]: FileDiff[]
  }
  session_diff_preload?: {
    [sessionID: string]: PreloadMultiFileDiffResult<any>[]
  }
  permission?: {
    [sessionID: string]: PermissionRequest[]
  }
  question?: {
    [sessionID: string]: QuestionRequest[]
  }
  plan?: {
    [sessionID: string]: PlanRequest[]
  }
  message: {
    [sessionID: string]: Message[]
  }
  part: {
    [messageID: string]: Part[]
  }
}

export type PermissionRespondFn = (input: {
  sessionID: string
  permissionID: string
  response: "once" | "always" | "reject"
}) => void

export type QuestionRespondFn = (input: {
  sessionID: string
  requestID: string
  answers: string[][]
}) => void

export type QuestionRejectFn = (input: {
  sessionID: string
  requestID: string
}) => void

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions"

export type PlanRespondFn = (input: {
  sessionID: string
  requestID: string
  approved: boolean
  message?: string
  permissionMode?: PermissionMode
}) => void

export type NavigateToSessionFn = (sessionID: string) => void

export const { use: useData, provider: DataProvider } = createSimpleContext({
  name: "Data",
  init: (props: {
    data: Data
    directory: string
    onPermissionRespond?: PermissionRespondFn
    onQuestionRespond?: QuestionRespondFn
    onQuestionReject?: QuestionRejectFn
    onPlanRespond?: PlanRespondFn
    onNavigateToSession?: NavigateToSessionFn
  }) => {
    return {
      get store() {
        return props.data
      },
      get directory() {
        return props.directory
      },
      respondToPermission: props.onPermissionRespond,
      respondToQuestion: props.onQuestionRespond,
      rejectQuestion: props.onQuestionReject,
      respondToPlan: props.onPlanRespond,
      navigateToSession: props.onNavigateToSession,
    }
  },
})
