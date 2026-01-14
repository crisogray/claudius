import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { json } from "@codemirror/lang-json"
import { markdown } from "@codemirror/lang-markdown"
import { css } from "@codemirror/lang-css"
import { html } from "@codemirror/lang-html"
import { rust } from "@codemirror/lang-rust"
import { go } from "@codemirror/lang-go"
import type { Extension } from "@codemirror/state"

type LanguageFactory = () => Extension

const LANGUAGE_MAP: Record<string, LanguageFactory> = {
  // JavaScript/TypeScript
  ts: () => javascript({ typescript: true, jsx: false }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  js: () => javascript({ jsx: false }),
  jsx: () => javascript({ jsx: true }),
  mjs: () => javascript(),
  cjs: () => javascript(),
  mts: () => javascript({ typescript: true }),
  cts: () => javascript({ typescript: true }),

  // JSON
  json: () => json(),
  jsonc: () => json(),
  jsonl: () => json(),

  // Markdown
  md: () => markdown(),
  mdx: () => markdown(),
  markdown: () => markdown(),

  // CSS
  css: () => css(),
  scss: () => css(),
  sass: () => css(),
  less: () => css(),

  // HTML
  html: () => html(),
  htm: () => html(),
  vue: () => html(),
  svelte: () => html(),

  // Python
  py: () => python(),
  pyw: () => python(),
  pyi: () => python(),

  // Rust
  rs: () => rust(),

  // Go
  go: () => go(),
}

/**
 * Get the appropriate language extension for a file path
 */
export function getLanguageExtension(path?: string): Extension {
  if (!path) return []

  // Get file extension
  const ext = path.split(".").pop()?.toLowerCase()
  if (!ext) return []

  // Look up language factory
  const factory = LANGUAGE_MAP[ext]
  return factory ? factory() : []
}

/**
 * Get the language name for a file path (for display)
 */
export function getLanguageName(path?: string): string | undefined {
  if (!path) return undefined

  const ext = path.split(".").pop()?.toLowerCase()
  if (!ext) return undefined

  const names: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript React",
    js: "JavaScript",
    jsx: "JavaScript React",
    mjs: "JavaScript",
    cjs: "JavaScript",
    mts: "TypeScript",
    cts: "TypeScript",
    json: "JSON",
    jsonc: "JSON with Comments",
    md: "Markdown",
    mdx: "MDX",
    css: "CSS",
    scss: "SCSS",
    sass: "Sass",
    less: "Less",
    html: "HTML",
    htm: "HTML",
    vue: "Vue",
    svelte: "Svelte",
    py: "Python",
    rs: "Rust",
    go: "Go",
  }

  return names[ext]
}
