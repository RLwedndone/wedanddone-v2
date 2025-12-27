// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const isGhPages = mode === "gh";
  const basePath = isGhPages ? "/wedanddone-v2/" : "/";

  return {
    base: basePath,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png"],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        },
        manifest: {
          name: "Wed&Done",
          short_name: "Wed&Done",
          description: "Wedding planning, magically simplified.",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          display: "standalone",
          start_url: basePath,
          scope: basePath,
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
      }),
    ],
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