import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// We get passed "mode" = "development" when you run `npm run dev`,
// and "production" when we build for deploy.
export default defineConfig(({ mode }) => {
  return {
    // ✅ Use normal root in dev, GitHub subfolder in production
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

    assetsInclude: ["**/*.mp4"],
    publicDir: "public",
  };
});