import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@swifty.js/sentry"],
  },
  build: {
    sourcemap: "hidden",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8088",
        changeOrigin: true,
      },
      "/static": {
        target: "http://127.0.0.1:8088",
        changeOrigin: true,
      },
    },
  },
});
