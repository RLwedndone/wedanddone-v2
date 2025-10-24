// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  return {
    // ✅ Use root locally, GitHub subfolder in production
    base: mode === "production" ? "/wedanddone-v2/" : "/",

    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api/stripe": {
          target: "http://127.0.0.1:5001",
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(
              /^\/api\/stripe/,
              "/wedndonev2/us-central1/stripeApi"
            ),
        },
      },
    },

    plugins: [react()],

    optimizeDeps: {
      exclude: ["lucide-react"],
    },

    build: {
      // 👇 ensures assets like /assets/images/... get rewritten properly for GitHub Pages
      assetsDir: "assets",
      outDir: "dist",
      emptyOutDir: true,
    },

    assetsInclude: ["**/*.mp4", "**/*.webm", "**/*.png", "**/*.jpg", "**/*.jpeg"],
    publicDir: "public",
  };
});