import { Auth } from "../../auth"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import path from "path"
import os from "os"
import { Global } from "../../global"

export const AuthCommand = cmd({
  command: "auth",
  describe: "manage credentials",
  builder: (yargs) =>
    yargs.command(AuthLoginCommand).command(AuthLogoutCommand).command(AuthListCommand).demandCommand(),
  async handler() {},
})

export const AuthListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list credentials",
  async handler() {
    UI.empty()
    const authPath = path.join(Global.Path.data, "auth.json")
    const homedir = os.homedir()
    const displayPath = authPath.startsWith(homedir) ? authPath.replace(homedir, "~") : authPath
    prompts.intro(`Credentials ${UI.Style.TEXT_DIM}${displayPath}`)
    const results = Object.entries(await Auth.all())

    for (const [providerID, result] of results) {
      prompts.log.info(`${providerID} ${UI.Style.TEXT_DIM}${result.type}`)
    }

    prompts.outro(`${results.length} credentials`)

    // Check for ANTHROPIC_API_KEY env var
    if (process.env.ANTHROPIC_API_KEY) {
      UI.empty()
      prompts.intro("Environment")
      prompts.log.info(`Anthropic ${UI.Style.TEXT_DIM}ANTHROPIC_API_KEY`)
      prompts.outro("1 environment variable")
    }
  },
})

export const AuthLoginCommand = cmd({
  command: "login",
  describe: "add Anthropic API key",
  async handler() {
    UI.empty()
    prompts.intro("Add Anthropic API key")

    prompts.log.info("Get your API key at https://console.anthropic.com/settings/keys")

    const key = await prompts.password({
      message: "Enter your API key",
      validate: (x) => (x && x.length > 0 ? undefined : "Required"),
    })
    if (prompts.isCancel(key)) throw new UI.CancelledError()

    await Auth.set("anthropic", {
      type: "api",
      key,
    })

    prompts.outro("Done")
  },
})

export const AuthLogoutCommand = cmd({
  command: "logout",
  describe: "remove stored credential",
  async handler() {
    UI.empty()
    const credentials = await Auth.all().then((x) => Object.entries(x))
    prompts.intro("Remove credential")
    if (credentials.length === 0) {
      prompts.log.error("No credentials found")
      return
    }
    const providerID = await prompts.select({
      message: "Select credential",
      options: credentials.map(([key, value]) => ({
        label: key + UI.Style.TEXT_DIM + " (" + value.type + ")",
        value: key,
      })),
    })
    if (prompts.isCancel(providerID)) throw new UI.CancelledError()
    await Auth.remove(providerID)
    prompts.outro("Logout successful")
  },
})
