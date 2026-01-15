import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
const base = "/home/";
export default defineConfig(({ mode, isPreview }) => ({
  // base: !isPreview ? base : `${base}/`,
  // base: mode === "development" ? "/home" : `/home/`,
  base: base,  

  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
}));
