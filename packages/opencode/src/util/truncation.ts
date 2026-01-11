import path from "path"
import { Global } from "../global"

/**
 * Constants for tool output truncation
 *
 * The SDK handles truncation internally, but we expose the output directory
 * for permission rules (allowing agents to read truncated output files).
 */
export namespace Truncate {
  export const MAX_LINES = 2000
  export const MAX_BYTES = 50 * 1024
  export const DIR = path.join(Global.Path.data, "tool-output")
}
