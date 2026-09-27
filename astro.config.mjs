import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL || "https://harish2k01.xyz",
  output: "static",
  trailingSlash: "always",
});
