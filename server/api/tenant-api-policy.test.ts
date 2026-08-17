import { describe, expect, it } from "vitest";
import { canApiKeyAccessOrganizationResource } from "./tenant-api-policy";

describe("API key tenant policy", () => {
  it("permite a una API key de plataforma acceder a recursos operativos", () => {
    expect(canApiKeyAccessOrganizationResource(null, 20)).toBe(true);
  });

  it("permite a un tenant acceder solamente a recursos de su empresa", () => {
    expect(canApiKeyAccessOrganizationResource(10, 10)).toBe(true);
    expect(canApiKeyAccessOrganizationResource(10, "10" as unknown as number)).toBe(true);
  });

  it("niega una estación o transacción perteneciente a otro tenant", () => {
    expect(canApiKeyAccessOrganizationResource(10, 20)).toBe(false);
    expect(canApiKeyAccessOrganizationResource(20, 10)).toBe(false);
    expect(canApiKeyAccessOrganizationResource(10, null)).toBe(false);
  });
});
