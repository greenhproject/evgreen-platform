import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function source(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("security regression contracts", () => {
  it("keeps full financial details and station financial metrics administrative", () => {
    const financialRouter = source("./financial/financial-router.ts");

    expect(financialRouter).toMatch(/getSettlementDetail:\s*adminProcedure/);
    expect(financialRouter).toMatch(/getMetrics:\s*adminProcedure/);
    expect(financialRouter).toMatch(/getLatestMetric:\s*adminProcedure/);
    expect(financialRouter).toMatch(/maintenanceFundSummary:\s*adminProcedure/);
    expect(financialRouter).toMatch(/maintenanceFundHistory:\s*adminProcedure/);
  });

  it("does not allow API credentials in query strings", () => {
    const publicApi = source("./api/public-api.ts");
    const authBlock = publicApi.slice(
      publicApi.indexOf("async function authenticateApiKey"),
      publicApi.indexOf("// Rate limiting store"),
    );

    expect(authBlock).toContain('req.headers["x-api-key"]');
    expect(authBlock).not.toContain("req.query.api_key");
  });

  it("uses Railway proxy-aware limits and limits public health output", () => {
    const server = source("./_core/index.ts");
    const healthBlock = server.slice(
      server.indexOf('app.get("/api/health"'),
      server.indexOf("// Endpoint de verificación OCPP"),
    );

    expect(server).toContain('app.set("trust proxy", 1)');
    expect(healthBlock).not.toContain("process.memoryUsage");
    expect(healthBlock).not.toContain("getPoolStats");
  });
});
