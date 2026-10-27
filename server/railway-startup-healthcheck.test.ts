import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const serverSource = readFileSync(path.join(projectRoot, "server", "_core", "index.ts"), "utf8");
const railwayConfig = JSON.parse(
  readFileSync(path.join(projectRoot, "railway.json"), "utf8"),
) as {
  deploy?: { healthcheckPath?: string; healthcheckTimeout?: number };
};

describe("Railway startup healthcheck", () => {
  it("da margen suficiente al healthcheck externo para una instancia con base de datos fría", () => {
    expect(railwayConfig.deploy?.healthcheckPath).toBe("/api/health");
    expect(railwayConfig.deploy?.healthcheckTimeout).toBeGreaterThanOrEqual(90);
  });

  it("abre el puerto antes de verificar el esquema contractual idempotente", () => {
    const startupPreamble = serverSource.slice(
      serverSource.indexOf("async function startServer()"),
      serverSource.indexOf("const app = express();"),
    );
    const listenCallback = serverSource.slice(
      serverSource.indexOf("server.listen(port, () => {"),
      serverSource.indexOf("// Registrar Heartbeat job", serverSource.indexOf("server.listen(port, () => {")),
    );

    expect(startupPreamble).not.toContain("await ensureContractDocumentStorage()");
    expect(listenCallback).toContain("void ensureContractDocumentStorage().catch");
    expect(listenCallback).toContain("Deferred document storage verification failed");
  });
});
