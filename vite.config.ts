// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 👇 NEW: tell Vite the site will live at /wedanddone-v2/ on GitHub Pages
  base: "/wedanddone-v2/",

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
            "/wedndonev2/us-central1/stripeApi" // (leave as-is; this is your local dev proxy)
          ),
      },
    },
  },
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  assetsInclude: ["**/*.mp4"],
  publicDir: "public",
});