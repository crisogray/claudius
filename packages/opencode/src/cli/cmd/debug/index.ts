import { Global } from "../../../global"
import { cmd } from "../cmd"
import { ConfigCommand } from "./config"

export const DebugCommand = cmd({
  command: "debug",
  describe: "debugging and troubleshooting tools",
  builder: (yargs) => yargs.command(ConfigCommand).command(PathsCommand).demandCommand(),
  async handler() {},
})

const PathsCommand = cmd({
  command: "paths",
  describe: "show global paths (data, config, cache, state)",
  handler() {
    for (const [key, value] of Object.entries(Global.Path)) {
      console.log(key.padEnd(10), value)
    }
  },
})
