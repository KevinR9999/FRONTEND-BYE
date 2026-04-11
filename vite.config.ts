import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const ICON_VERSION = "20260409-1";
const versionedIcon = (fileName: string) => `/${fileName}?v=${ICON_VERSION}`;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ✅ CLAVE: ahora usaremos SW propio
      strategies: "injectManifest",
      injectManifest: {
        swSrc: "src/sw.ts",
      },

      registerType: "autoUpdate",
      includeAssets: [
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],

      manifest: {
        name: "BYE - Boost Your English",
        short_name: "BYE",
        description: "Aprende inglés de forma divertida y efectiva",
        theme_color: "#667eea",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: versionedIcon("icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
          { src: versionedIcon("icon-192.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: versionedIcon("icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
          { src: versionedIcon("icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: versionedIcon("apple-touch-icon.png"), sizes: "180x180", type: "image/png", purpose: "any" },
        ],
      },

      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    host: "localhost",
    port: 5174,
  },
});
