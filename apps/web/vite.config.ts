import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { msw } from "msw/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const apiTarget = env.API_PROXY_TARGET ?? "http://localhost:3000";

  return {
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      msw(),
    ],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/hooks": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
