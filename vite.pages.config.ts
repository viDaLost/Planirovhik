import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

function githubPagesBase() {
  if (process.env.PAGES_BASE_PATH) {
    return process.env.PAGES_BASE_PATH;
  }

  const [owner = "", repository = ""] = (
    process.env.GITHUB_REPOSITORY ?? ""
  ).split("/");
  if (!repository) return "/";
  const isUserSite =
    repository.toLowerCase() === `${owner.toLowerCase()}.github.io`;
  return isUserSite ? "/" : `/${repository}/`;
}

export default defineConfig({
  root: "static-app",
  publicDir: "../public",
  base: githubPagesBase(),
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  plugins: [react()],
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
    sourcemap: true,
  },
});
