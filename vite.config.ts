// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isGhPages = mode === "gh";

  return {
    base: isGhPages ? "/wedanddone-v2/" : "/",
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api/stripe": {
          target: "http://127.0.0.1:5001",
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/api\/stripe/, "/wedndonev2/us-central1/stripeApi"),
        },
      },
    },
    optimizeDeps: { exclude: ["lucide-react"] },
    build: {
      assetsDir: "assets",
      outDir: "dist",
      emptyOutDir: true,
    },
    assetsInclude: ["**/*.mp4", "**/*.webm", "**/*.png", "**/*.jpg", "**/*.jpeg"],
    publicDir: "public",
  };
});