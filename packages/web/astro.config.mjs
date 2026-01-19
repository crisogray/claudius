// @ts-check
import { defineConfig } from "astro/config"
import solidJs from "@astrojs/solid-js"
import cloudflare from "@astrojs/cloudflare"
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
  integrations: [solidJs()],
})
