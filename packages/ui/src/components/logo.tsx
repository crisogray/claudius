export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <div
      classList={{ [props.class ?? ""]: !!props.class }}
      style={{
        "font-family": "'Tiempos Text', Georgia, serif",
        "font-weight": "400",
        "letter-spacing": "-0.02em",
        "line-height": "1",
        color: "var(--icon-base)",
        "white-space": "nowrap",
        "font-size": "2.5rem",
        "text-align": "center",
      }}
    >
      Claudius
    </div>
  )
}
