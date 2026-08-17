import { describe, expect, it } from "vitest";
import { canApiKeyAccessOrganizationResource, getApiKeyScopedResource } from "./tenant-api-policy";

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

  it("oculta una estación ajena antes de consultar su configuración OCPP", () => {
    const foreignStation = { id: 202, organizationId: 20, ocppIdentity: null };
    expect(getApiKeyScopedResource(10, foreignStation)).toBeNull();
    expect(getApiKeyScopedResource(20, foreignStation)).toEqual(foreignStation);
  });
});
