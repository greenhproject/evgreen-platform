import { describe, expect, it } from "vitest";

describe("capacidad documental contractual", () => {
  it("declara las dos columnas que deben conservar contratos completos", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./contracts/ensure-contract-document-storage.ts", import.meta.url), "utf8")
    );

    expect(source).toContain('table: "contract_templates", column: "html_content"');
    expect(source).toContain('table: "site_contracts", column: "contract_html"');
    expect(source).toContain("LONGTEXT NOT NULL");
    expect(source).toContain("const CONTRACT_TABLES");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS");
    expect(source).toContain("contractSchemaReady");
    expect(source).toContain("Contract schema verified for this instance");
  });
});
