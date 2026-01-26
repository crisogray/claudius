import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    process.stderr.write("[startup] serve command handler started\n")
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      process.stderr.write("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.\n")
    }
    process.stderr.write("[startup] resolving network options\n")
    const opts = await resolveNetworkOptions(args)
    process.stderr.write(`[startup] calling Server.listen with ${opts.hostname}:${opts.port}\n`)
    const server = Server.listen(opts)
    process.stderr.write(`opencode server listening on http://${server.hostname}:${server.port}\n`)
    await new Promise(() => {})
    await server.stop()
  },
})
