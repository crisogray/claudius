#!/usr/bin/env bun
import { $ } from "bun"

const bump = process.argv[2] as "major" | "minor" | "patch"
if (!["major", "minor", "patch"].includes(bump)) {
  console.log("Usage: ./script/bump.ts <major|minor|patch>")
  process.exit(1)
}

const pkg = await Bun.file("package.json").json()
const [major, minor, patch] = pkg.version.split(".").map(Number)

const newVersion =
  bump === "major"
    ? `${major + 1}.0.0`
    : bump === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`

// Update all package.json files
const files = await Array.fromAsync(new Bun.Glob("**/package.json").scan({ absolute: true })).then((arr) =>
  arr.filter((x) => !x.includes("node_modules") && !x.includes("dist")),
)

for (const file of files) {
  let content = await Bun.file(file).text()
  content = content.replace(/"version": "[^"]+"/, `"version": "${newVersion}"`)
  await Bun.write(file, content)
  console.log("Updated:", file)
}

// Remove all local tags first (sync with remote)
await $`git tag -l | xargs git tag -d 2>/dev/null || true`

await $`git add -A`
await $`git commit -m "release: v${newVersion}"`
await $`git tag v${newVersion}`
await $`git push origin main --tags`

console.log(`\n✓ Released v${newVersion}`)
