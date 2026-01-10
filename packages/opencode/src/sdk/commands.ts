import { Command } from "@/command"
import { ConfigMarkdown } from "@/config/markdown"
import { Log } from "@/util/log"
import { $ } from "bun"

export namespace SDKCommands {
  const log = Log.create({ service: "sdk.commands" })

  export interface ExpandedCommand {
    isOurs: boolean
    prompt: string
    command?: Command.Info
  }

  /**
   * Expand opencode commands and determine if SDK should handle the input
   *
   * - If input starts with "/" and matches an opencode command, expand it
   * - If input starts with "/" but doesn't match, pass through to SDK (could be /compact, /clear, etc.)
   * - If input doesn't start with "/", pass through as-is
   */
  export async function expandCommand(input: string): Promise<ExpandedCommand> {
    if (!input.startsWith("/")) {
      return { isOurs: false, prompt: input }
    }

    const [name, ...rest] = input.slice(1).split(" ")
    const args = rest.join(" ")
    const command = await Command.get(name)

    if (!command) {
      // Not our command - pass through to SDK (could be /compact, /clear, etc.)
      log.info("passing through to SDK", { name })
      return { isOurs: false, prompt: input }
    }

    log.info("expanding command", { name, args })

    // Expand template with arguments
    let template = await command.template

    // Parse arguments (handles quoted strings and [Image N])
    const argsArray = args.match(/(?:\[Image\s+\d+\]|"[^"]*"|'[^']*'|[^\s"']+)/gi) ?? []

    // Replace $1, $2, etc. with positional arguments
    template = template.replace(/\$(\d+)/g, (_, index) => {
      const i = Number(index) - 1
      return i < argsArray.length ? argsArray[i] : ""
    })

    // Replace $ARGUMENTS with all arguments
    template = template.replace(/\$ARGUMENTS/g, args)

    // Execute bash commands in template (!`...`)
    const shell = ConfigMarkdown.shell(template)
    if (shell.length > 0) {
      const results = await Promise.all(
        shell.map(async ([, cmd]) => {
          try {
            log.info("executing shell in template", { cmd })
            return await $`${{ raw: cmd }}`.quiet().nothrow().text()
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e)
            log.error("shell execution failed", { cmd, error })
            return `Error: ${error}`
          }
        }),
      )
      let i = 0
      template = template.replace(/!`([^`]+)`/g, () => results[i++])
    }

    return {
      isOurs: true,
      prompt: template.trim(),
      command,
    }
  }

  /**
   * Check if a command name is a built-in SDK command
   */
  export function isSDKBuiltinCommand(name: string): boolean {
    const sdkBuiltins = ["compact", "clear", "help", "init", "doctor", "config", "bug"]
    return sdkBuiltins.includes(name.toLowerCase())
  }
}
