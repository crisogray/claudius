/**
 * Centralized error handling utility for consistent error logging across the app.
 *
 * Use this instead of silent catches or inconsistent error handling patterns.
 */

type ErrorContext = string

/**
 * Log an error with context for debugging.
 * Use this for non-critical errors that shouldn't interrupt the user flow.
 */
export function logError(error: unknown, context: ErrorContext): void {
  console.error(`[${context}]`, error)
}

/**
 * Handle an error by logging it and returning undefined.
 * Useful as a .catch() handler for promises where the error is non-critical.
 *
 * @example
 * sdk.permission.respond(input).catch(handleError("Permission.respond"))
 */
export function handleError(context: ErrorContext) {
  return (error: unknown): undefined => {
    logError(error, context)
    return undefined
  }
}

/**
 * Handle an error by logging it and running a cleanup function.
 * Useful when you need to clean up state after a failed operation.
 *
 * @example
 * sdk.permission.respond(input).catch(handleErrorWithCleanup("Permission.respond", () => {
 *   responded.delete(input.permissionID)
 * }))
 */
export function handleErrorWithCleanup(context: ErrorContext, cleanup: () => void) {
  return (error: unknown): undefined => {
    logError(error, context)
    cleanup()
    return undefined
  }
}
