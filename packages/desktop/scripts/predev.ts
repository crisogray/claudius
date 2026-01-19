import { $ } from "bun"

import { copyBinaryToSidecarFolder, copyCLIJsToSidecarFolder, getCurrentSidecar } from "./utils"

const RUST_TARGET = Bun.env.TAURI_ENV_TARGET_TRIPLE

const sidecarConfig = getCurrentSidecar(RUST_TARGET)

const binaryPath = `../opencode/dist/${sidecarConfig.ocBinary}/bin/opencode${process.platform === "win32" ? ".exe" : ""}`
const cliJsPath = `../opencode/dist/${sidecarConfig.ocBinary}/bin/cli.js`

await $`cd ../opencode && bun run build --single`

await copyBinaryToSidecarFolder(binaryPath, RUST_TARGET)
await copyCLIJsToSidecarFolder(cliJsPath, RUST_TARGET)
