import type { Argv } from "yargs"
import { Provider } from "../../provider/provider"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { EOL } from "os"

export const ModelsCommand = cmd({
  command: "models",
  describe: "list available Claude models",
  builder: (yargs: Argv) => {
    return yargs.option("verbose", {
      describe: "show model details (costs, context, etc.)",
      type: "boolean",
    })
  },
  handler: async (args) => {
    const models = Provider.sort(Provider.list())

    for (const model of models) {
      process.stdout.write(model.id)
      process.stdout.write(EOL)
      if (args.verbose) {
        process.stdout.write(JSON.stringify(model, null, 2))
        process.stdout.write(EOL)
      }
    }
  },
})
