import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";

// CRÍTICO: Solo cargar manus-runtime en modo desarrollo (vite serve).
// En modo build (vite build), NUNCA cargarlo porque inyecta una copia completa
// de React (~350KB) inline en el HTML, causando conflictos con el React del bundle
// y resultando en pantalla negra en producción.
const isProduction = process.env.NODE_ENV === "production";

// Intentar cargar manus-runtime solo si NO es producción
let manusPlugin: any = null;
if (!isProduction) {
  try {
    const mod = await import("vite-plugin-manus-runtime");
    if (mod?.vitePluginManusRuntime) {
      manusPlugin = mod.vitePluginManusRuntime();
    }
  } catch (e) {
    // Plugin not available outside Manus sandbox, skip silently
  }
}

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const plugins: any[] = [react(), tailwindcss(), jsxLocPlugin()];

  // Doble protección: no incluir manus-runtime ni en producción ni en build
  if (!isBuild && !isProduction && manusPlugin) {
    plugins.push(manusPlugin);
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    publicDir: path.resolve(import.meta.dirname, "client", "public"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      host: true,
      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
      ],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
