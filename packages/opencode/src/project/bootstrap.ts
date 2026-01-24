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
  console.log("[startup] InstanceBootstrap starting")
  Log.Default.info("bootstrapping", { directory: Instance.directory })
  console.log("[startup] Plugin.init()")
  await Plugin.init()
  console.log("[startup] Share.init()")
  Share.init()
  console.log("[startup] ShareNext.init()")
  ShareNext.init()
  console.log("[startup] Format.init()")
  Format.init()
  console.log("[startup] LSP.init()")
  await LSP.init()
  console.log("[startup] FileWatcher.init()")
  FileWatcher.init()
  console.log("[startup] File.init()")
  File.init()
  console.log("[startup] Vcs.init()")
  Vcs.init()
  console.log("[startup] InstanceBootstrap complete")

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}
