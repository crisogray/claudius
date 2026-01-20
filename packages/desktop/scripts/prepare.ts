#!/usr/bin/env bun
import { $ } from "bun"

import {
  copyBinaryToSidecarFolder,
  copyCLIJsToSidecarFolder,
  getCurrentSidecar,
  downloadRipgrep,
  SIDECAR_BINARIES,
} from "./utils"

const sidecarConfig = getCurrentSidecar()

const dir = "src-tauri/target/opencode-binaries"

await $`mkdir -p ${dir}`
await $`gh run download ${Bun.env.GITHUB_RUN_ID} -n opencode-cli`.cwd(dir)

await copyBinaryToSidecarFolder(
  `${dir}/${sidecarConfig.ocBinary}/bin/opencode${process.platform === "win32" ? ".exe" : ""}`,
)
await copyCLIJsToSidecarFolder(`${dir}/${sidecarConfig.ocBinary}/bin/cli.js`)

// Download ripgrep for all platforms
console.log("Downloading ripgrep for all platforms...")
for (const { rustTarget } of SIDECAR_BINARIES) {
  await downloadRipgrep(rustTarget)
}
