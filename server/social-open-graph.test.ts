import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "client/index.html"), "utf8");
const serverEntry = fs.readFileSync(path.join(projectRoot, "server/_core/index.ts"), "utf8");
const storageProxy = fs.readFileSync(path.join(projectRoot, "server/_core/storageProxy.ts"), "utf8");

describe("tarjeta social EVGreen", () => {
  it("publica una tarjeta grande versionada de 1200×630 para app.evgreen.lat", () => {
    expect(html).toContain('<meta property="og:title" content="EVGreen | Carga el futuro, hoy" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta property="og:image:type" content="image/jpeg" />');
    expect(html).toContain('https://app.evgreen.lat/manus-storage/evgreen-og-whatsapp-v20260904-1200x630_837a9405.jpg');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it("mantiene URL canónica y Open Graph en el mismo dominio que se comparte", () => {
    expect(html).toContain('<meta property="og:url" content="https://app.evgreen.lat/" />');
    expect(html).toContain('<link rel="canonical" href="https://app.evgreen.lat/" />');
    expect(html).toContain('property="og:image:alt"');
    expect(html).toContain('name="twitter:image:alt"');
  });

  it("registra el proxy público antes de las rutas de autenticación", () => {
    expect(serverEntry).toContain('import { registerStorageProxy } from "./storageProxy";');
    expect(serverEntry.indexOf("registerStorageProxy(app);")).toBeLessThan(serverEntry.indexOf("registerAuth0Routes(app);"));
    expect(storageProxy).toContain('app.get("/manus-storage/*"');
    expect(storageProxy).toContain("ENV.forgeApiKey");
    expect(storageProxy).not.toContain("BUILT_IN_FORGE_API_KEY=");
  });
});
