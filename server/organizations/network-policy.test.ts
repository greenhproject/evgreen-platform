import { describe, expect, it } from "vitest";
import {
  canConfigureNetworkMode,
  isDiscoverableOnEvgreenNetwork,
  normalizeNetworkAccessMode,
} from "./network-policy";

describe("network policy", () => {
  const networkOrg = { networkMember: 1, orgStatus: "active" } as const;
  const privateOrg = { networkMember: 0, orgStatus: "active" } as const;

  it("mantiene compatibilidad del booleano público anterior", () => {
    expect(normalizeNetworkAccessMode(undefined, true)).toBe("EVGREEN_NETWORK");
    expect(normalizeNetworkAccessMode(undefined, false)).toBe("PRIVATE");
  });

  it("no permite publicar ni hacer roaming a un tenant sin membresía de red", () => {
    expect(canConfigureNetworkMode(privateOrg, "PRIVATE")).toBe(true);
    expect(canConfigureNetworkMode(privateOrg, "EVGREEN_NETWORK")).toBe(false);
    expect(canConfigureNetworkMode(privateOrg, "ROAMING")).toBe(false);
  });

  it("no descubre estaciones privadas, inactivas o de tenants no habilitados", () => {
    expect(isDiscoverableOnEvgreenNetwork({ mode: "PRIVATE", isActive: 1, isPublic: 1, organization: networkOrg })).toBe(false);
    expect(isDiscoverableOnEvgreenNetwork({ mode: "EVGREEN_NETWORK", isActive: 0, isPublic: 1, organization: networkOrg })).toBe(false);
    expect(isDiscoverableOnEvgreenNetwork({ mode: "ROAMING", isActive: 1, isPublic: 1, organization: privateOrg })).toBe(false);
  });

  it("descubre estaciones EVGreen y roaming de tenants habilitados", () => {
    expect(isDiscoverableOnEvgreenNetwork({ mode: "EVGREEN_NETWORK", isActive: 1, isPublic: 1, organization: networkOrg })).toBe(true);
    expect(isDiscoverableOnEvgreenNetwork({ mode: "ROAMING", isActive: 1, isPublic: 1, organization: networkOrg })).toBe(true);
  });
});
