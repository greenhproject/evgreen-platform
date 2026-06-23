import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";

// IMPORTANT: Do NOT import vite, vite.config, or any vite plugins at the top level.
// These are devDependencies and are not available in production.
// setupVite() is only called in development mode and uses dynamic imports.

export async function setupVite(app: Express, server: Server) {
  // All vite-related imports are dynamic to avoid bundling them in production
  const vite = await import("vite");
  const { nanoid } = await import("nanoid");
  const react = (await import("@vitejs/plugin-react")).default;
  const tailwindcss = (await import("@tailwindcss/vite")).default;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const clientRoot = path.resolve(import.meta.dirname, "../../client");

  const viteServer = await vite.createServer({
    plugins: [react(), tailwindcss()],
    root: clientRoot,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "../../client/src"),
        "@shared": path.resolve(import.meta.dirname, "../../shared"),
        "@assets": path.resolve(import.meta.dirname, "../../attached_assets"),
      },
    },
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(viteServer.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await viteServer.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      viteServer.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
