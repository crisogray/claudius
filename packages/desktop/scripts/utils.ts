import { $ } from "bun"
import path from "path"
import fs from "fs/promises"
import { ZipReader, BlobReader, BlobWriter } from "@zip.js/zip.js"

export const SIDECAR_BINARIES: Array<{ rustTarget: string; ocBinary: string; assetExt: string }> = [
  {
    rustTarget: "aarch64-apple-darwin",
    ocBinary: "opencode-darwin-arm64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-apple-darwin",
    ocBinary: "opencode-darwin-x64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-pc-windows-msvc",
    ocBinary: "opencode-windows-x64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-unknown-linux-gnu",
    ocBinary: "opencode-linux-x64",
    assetExt: "tar.gz",
  },
  {
    rustTarget: "aarch64-unknown-linux-gnu",
    ocBinary: "opencode-linux-arm64",
    assetExt: "tar.gz",
  },
]

export const RUST_TARGET = Bun.env.RUST_TARGET

export function getCurrentSidecar(target = RUST_TARGET) {
  if (!target && !RUST_TARGET) throw new Error("RUST_TARGET not set")

  const binaryConfig = SIDECAR_BINARIES.find((b) => b.rustTarget === target)
  if (!binaryConfig) throw new Error(`Sidecar configuration not available for Rust target '${RUST_TARGET}'`)

  return binaryConfig
}

export async function copyBinaryToSidecarFolder(source: string, target = RUST_TARGET) {
  await $`mkdir -p src-tauri/sidecars`
  const dest = `src-tauri/sidecars/opencode-cli-${target}${process.platform === "win32" ? ".exe" : ""}`
  await $`cp ${source} ${dest}`

  console.log(`Copied ${source} to ${dest}`)
}

export async function copyCLIJsToSidecarFolder(source: string, _target = RUST_TARGET) {
  await $`mkdir -p src-tauri/sidecars`
  // cli.js is platform-independent JavaScript - same file for all targets
  const dest = `src-tauri/sidecars/cli.js`
  await $`cp ${source} ${dest}`

  console.log(`Copied ${source} to ${dest}`)
}

// Ripgrep platform mappings
const RIPGREP_VERSION = "14.1.1"
const RIPGREP_PLATFORMS: Record<string, { platform: string; extension: "tar.gz" | "zip"; platformKey: string }> = {
  "aarch64-apple-darwin": {
    platform: "aarch64-apple-darwin",
    extension: "tar.gz",
    platformKey: "arm64-darwin",
  },
  "x86_64-apple-darwin": {
    platform: "x86_64-apple-darwin",
    extension: "tar.gz",
    platformKey: "x64-darwin",
  },
  "x86_64-pc-windows-msvc": {
    platform: "x86_64-pc-windows-msvc",
    extension: "zip",
    platformKey: "x64-win32",
  },
  "x86_64-unknown-linux-gnu": {
    platform: "x86_64-unknown-linux-musl",
    extension: "tar.gz",
    platformKey: "x64-linux",
  },
  "aarch64-unknown-linux-gnu": {
    platform: "aarch64-unknown-linux-gnu",
    extension: "tar.gz",
    platformKey: "arm64-linux",
  },
}

export async function downloadRipgrep(rustTarget: string) {
  const config = RIPGREP_PLATFORMS[rustTarget]
  if (!config) {
    console.warn(`Ripgrep not available for platform: ${rustTarget}`)
    return
  }

  const { platform, extension, platformKey } = config
  const filename = `ripgrep-${RIPGREP_VERSION}-${platform}.${extension}`
  const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${filename}`

  // Create destination directory
  const destDir = path.resolve("src-tauri/sidecars/vendor/ripgrep", platformKey)
  await $`mkdir -p ${destDir}`

  const rgBinary = platformKey.includes("win32") ? "rg.exe" : "rg"
  const rgPath = path.join(destDir, rgBinary)

  // Check if already exists
  if (await Bun.file(rgPath).exists()) {
    console.log(`Ripgrep already exists at ${rgPath}`)
    return
  }

  console.log(`Downloading ripgrep from ${url}...`)

  // Download
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ripgrep: ${response.status} ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const archivePath = path.join(destDir, filename)
  await Bun.write(archivePath, buffer)

  console.log(`Extracting ripgrep to ${destDir}...`)

  // Extract
  if (extension === "tar.gz") {
    // Extract tar.gz
    const args = ["tar", "-xzf", archivePath, "--strip-components=1"]

    if (platformKey.endsWith("-darwin")) {
      args.push("--include=*/rg")
    } else if (platformKey.endsWith("-linux")) {
      args.push("--wildcards", "*/rg")
    }

    const proc = Bun.spawn(args, {
      cwd: destDir,
      stderr: "pipe",
      stdout: "pipe",
    })

    await proc.exited

    if (proc.exitCode !== 0) {
      const stderr = await Bun.readableStreamToText(proc.stderr)
      throw new Error(`Failed to extract ripgrep: ${stderr}`)
    }
  } else if (extension === "zip") {
    // Extract zip (Windows)
    const zipFileReader = new ZipReader(new BlobReader(new Blob([buffer])))
    const entries = await zipFileReader.getEntries()

    let rgEntry: any
    for (const entry of entries) {
      if (entry.filename.endsWith("rg.exe")) {
        rgEntry = entry
        break
      }
    }

    if (!rgEntry) {
      throw new Error("rg.exe not found in zip archive")
    }

    const rgBlob = await rgEntry.getData(new BlobWriter())
    if (!rgBlob) {
      throw new Error("Failed to extract rg.exe from zip archive")
    }

    await Bun.write(rgPath, await rgBlob.arrayBuffer())
    await zipFileReader.close()
  }

  // Clean up archive
  await fs.unlink(archivePath)

  // Set executable permissions on Unix
  if (!platformKey.includes("win32")) {
    await fs.chmod(rgPath, 0o755)
  }

  console.log(`✓ Ripgrep installed to ${rgPath}`)
}
