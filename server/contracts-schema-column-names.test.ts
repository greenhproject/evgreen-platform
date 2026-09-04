import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("columnas físicas del expediente contractual", () => {
  it("mantiene Drizzle alineado con las columnas creadas por las migraciones", () => {
    const schema = readFileSync("drizzle/schema.ts", "utf8");
    expect(schema).not.toContain('mysqlEnum("contract_template_status"');
    expect(schema).not.toContain('mysqlEnum("site_contract_status"');
    expect(schema).not.toContain('mysqlEnum("contract_party_role"');
    expect(schema).not.toContain('mysqlEnum("contract_event_channel"');
    expect(schema).toContain('status: mysqlEnum("status", [\'DRAFT\', \'ACTIVE\', \'RETIRED\'])');
    expect(schema).toContain('role: mysqlEnum("role", [\'OPERATOR\', \'ALLY\'])');
    expect(schema).toContain('channel: mysqlEnum("channel", [\'INTERNAL\', \'DOCUSIGN\', \'MANUAL_PDF\'])');
  });
});
