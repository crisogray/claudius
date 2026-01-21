// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import solidJs from "@astrojs/solid-js"
import cloudflare from "@astrojs/cloudflare"
import theme from "toolbeam-docs-theme"
import config from "./config.mjs"

// https://astro.build/config
export default defineConfig({
  site: config.url,
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  devToolbar: {
    enabled: false,
  },
  server: {
    host: "0.0.0.0",
  },
  integrations: [
    solidJs(),
    starlight({
      title: "Claudius",
      disable404Route: true,
      favicon: "/favicon.ico",
      social: [{ icon: "github", label: "GitHub", href: config.github }],
      sidebar: [],
      plugins: [theme({ headerLinks: config.headerLinks })],
    }),
  ],
})
