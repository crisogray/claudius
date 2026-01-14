import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"

// Theme colors
const colors = {
  // UI colors
  bg: "var(--background-strong)",
  bgAlt: "var(--background-strong)",
  fg: "var(--text-base)",
  fgMuted: "var(--text-weak)",
  fgStrong: "var(--text-strong)",
  border: "var(--border-base)",
  primary: "var(--color-primary)",
  // Syntax highlighting
  comment: "var(--syntax-comment)",
  string: "var(--syntax-string)",
  keyword: "var(--syntax-keyword)",
  primitive: "var(--syntax-primitive)",
  operator: "var(--syntax-operator)",
  variable: "var(--syntax-variable)",
  property: "var(--syntax-property)",
  type: "var(--syntax-type)",
  constant: "var(--syntax-constant)",
  punctuation: "var(--syntax-punctuation)",
  diffAdd: "var(--syntax-diff-add)",
  diffDelete: "var(--syntax-diff-delete)",
}

// Editor theme
export const opencodeDarkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: colors.bg,
      color: colors.fg,
      fontSize: "13px",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "var(--text-strong)",
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--text-strong)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--surface-base-interactive-active)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--surface-base)",
    },
    ".cm-gutters": {
      backgroundColor: colors.bg,
      color: colors.fgMuted,
      border: "none",
      paddingRight: "8px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 16px",
      minWidth: "40px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--surface-base)",
      color: colors.fg,
    },
    ".cm-foldPlaceholder": {
      backgroundColor: colors.bgAlt,
      border: "none",
      color: colors.fgMuted,
    },
    ".cm-tooltip": {
      backgroundColor: "var(--surface-float-base)",
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: "12px",
      },
      "& > ul > li": {
        padding: "4px 8px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: colors.primary,
        color: "var(--text-on-interactive-base)",
      },
    },
    ".cm-panels": {
      backgroundColor: colors.bgAlt,
      borderBottom: `1px solid ${colors.border}`,
    },
    ".cm-searchMatch": {
      backgroundColor: "var(--surface-warning-base)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "var(--surface-warning-strong)",
    },
  },
  { dark: true },
)

// Syntax highlighting
export const opencodeDarkHighlight = HighlightStyle.define([
  // Keywords
  { tag: tags.keyword, color: colors.keyword },
  { tag: tags.controlKeyword, color: colors.keyword },
  { tag: tags.operatorKeyword, color: colors.keyword },
  { tag: tags.definitionKeyword, color: colors.keyword },
  { tag: tags.moduleKeyword, color: colors.keyword },
  // Operators and punctuation
  { tag: tags.operator, color: colors.operator },
  { tag: tags.punctuation, color: colors.punctuation },
  { tag: tags.bracket, color: colors.punctuation },
  { tag: tags.separator, color: colors.punctuation },
  // Strings
  { tag: tags.string, color: colors.string },
  { tag: tags.regexp, color: colors.string },
  { tag: tags.escape, color: colors.constant },
  // Primitives (numbers, booleans, null)
  { tag: tags.number, color: colors.primitive },
  { tag: tags.bool, color: colors.primitive },
  { tag: tags.null, color: colors.primitive },
  { tag: tags.atom, color: colors.primitive },
  // Variables
  { tag: tags.variableName, color: colors.variable },
  { tag: tags.definition(tags.variableName), color: colors.variable },
  { tag: tags.local(tags.variableName), color: colors.variable },
  { tag: tags.special(tags.variableName), color: colors.constant },
  { tag: tags.function(tags.variableName), color: colors.property },
  { tag: tags.definition(tags.function(tags.variableName)), color: colors.property },
  // Properties
  { tag: tags.propertyName, color: colors.property },
  { tag: tags.function(tags.propertyName), color: colors.property },
  { tag: tags.definition(tags.propertyName), color: colors.property },
  // Types
  { tag: tags.typeName, color: colors.type },
  { tag: tags.className, color: colors.type },
  { tag: tags.namespace, color: colors.type },
  { tag: tags.macroName, color: colors.type },
  { tag: tags.labelName, color: colors.variable },
  // Attributes (HTML/JSX)
  { tag: tags.attributeName, color: colors.keyword },
  { tag: tags.attributeValue, color: colors.string },
  // Comments
  { tag: tags.comment, color: colors.comment, fontStyle: "italic" },
  { tag: tags.lineComment, color: colors.comment, fontStyle: "italic" },
  { tag: tags.blockComment, color: colors.comment, fontStyle: "italic" },
  { tag: tags.docComment, color: colors.comment, fontStyle: "italic" },
  // Meta
  { tag: tags.invalid, color: colors.diffDelete },
  { tag: tags.meta, color: colors.comment },
  { tag: tags.documentMeta, color: colors.comment },
  { tag: tags.annotation, color: colors.type },
  { tag: tags.processingInstruction, color: colors.type },
  // Markdown
  { tag: tags.heading, color: colors.fgStrong, fontWeight: "bold" },
  { tag: tags.heading1, color: colors.fgStrong, fontWeight: "bold", fontSize: "1.4em" },
  { tag: tags.heading2, color: colors.fgStrong, fontWeight: "bold", fontSize: "1.2em" },
  { tag: tags.heading3, color: colors.fgStrong, fontWeight: "bold" },
  { tag: tags.link, color: colors.primary, textDecoration: "underline" },
  { tag: tags.url, color: colors.primary },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
])

// Combined theme extension
export const opencodeDark = [opencodeDarkTheme, syntaxHighlighting(opencodeDarkHighlight)]
