import { Plugin } from "../plugin"
import { Share } from "../share/share"
import { Format } from "../format"
import { LSP } from "../lsp"
import { FileWatcher } from "../file/watcher"
import { File } from "../file"
import { Project } from "./project"
import { Bus } from "../bus"
import { Command } from "../command"
import { Instance } from "./instance"
import { Vcs } from "./vcs"
import { Log } from "@/util/log"
import { ShareNext } from "@/share/share-next"

export async function InstanceBootstrap() {
  process.stderr.write("[startup] InstanceBootstrap starting\n")
  Log.Default.info("bootstrapping", { directory: Instance.directory })
  process.stderr.write("[startup] Plugin.init()\n")
  await Plugin.init()
  process.stderr.write("[startup] Share.init()\n")
  Share.init()
  process.stderr.write("[startup] ShareNext.init()\n")
  ShareNext.init()
  process.stderr.write("[startup] Format.init()\n")
  Format.init()
  process.stderr.write("[startup] LSP.init()\n")
  await LSP.init()
  process.stderr.write("[startup] FileWatcher.init()\n")
  FileWatcher.init()
  process.stderr.write("[startup] File.init()\n")
  File.init()
  process.stderr.write("[startup] Vcs.init()\n")
  Vcs.init()
  process.stderr.write("[startup] InstanceBootstrap complete\n")

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}
