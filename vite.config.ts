// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
  assetsInclude: ["**/*.mp4"],
  publicDir: "public",
});