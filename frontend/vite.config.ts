import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo-192.png", "logo-512.png", "favicon-64.png", "icon-192.svg", "icon-512.svg"],
      manifest: false,
      workbox: {
        importScripts: ["/sw-redirect.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // The full-size logo is only for link previews; the app uses logo-192.png.
        globIgnores: ["**/logo.png"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
