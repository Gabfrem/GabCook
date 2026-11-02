import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// Site statique servi par GitHub Pages sur yummly.fr (racine du domaine).
export default defineConfig({
  base: "/",
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.png", "icons/apple-touch-icon.png", "logo-wordmark.png"],
      manifest: {
        name: "Yummly — cuisine avec ce que tu as",
        short_name: "Yummly",
        description: "Des centaines de recettes, ton frigo, ta liste de courses et ton planning de la semaine.",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FBF5E6",
        theme_color: "#1D402D",
        categories: ["food", "lifestyle"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,json}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // photos des plats : servies depuis le cache, rafraîchies rarement
            urlPattern: ({ url }) => url.hostname === "www.themealdb.com" || url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/"),
            handler: "CacheFirst",
            options: {
              cacheName: "photos",
              expiration: { maxEntries: 900, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ url }) => url.hostname === "world.openfoodfacts.org",
            handler: "NetworkFirst",
            options: { cacheName: "openfoodfacts", networkTimeoutSeconds: 6, expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })
  ],
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 900
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
} as any);
