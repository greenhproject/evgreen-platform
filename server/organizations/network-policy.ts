export const NETWORK_ACCESS_MODES = ["PRIVATE", "EVGREEN_NETWORK", "ROAMING"] as const;
export type NetworkAccessMode = (typeof NETWORK_ACCESS_MODES)[number];

export type OrganizationNetworkState = {
  networkMember: boolean | number;
  orgStatus: "active" | "trial" | "suspended" | "cancelled" | string;
};

export function normalizeNetworkAccessMode(
  mode: NetworkAccessMode | undefined,
  isPublic?: boolean,
): NetworkAccessMode | undefined {
  if (mode) return mode;
  if (isPublic === undefined) return undefined;
  return isPublic ? "EVGREEN_NETWORK" : "PRIVATE";
}

/** Una organización habilitada para la red puede publicar o hacer roaming. */
export function canUseEvgreenNetwork(org: OrganizationNetworkState): boolean {
  return Boolean(org.networkMember) && ["active", "trial"].includes(org.orgStatus);
}

/** Una estación privada siempre puede configurarse; las otras requieren membresía. */
export function canConfigureNetworkMode(org: OrganizationNetworkState, mode: NetworkAccessMode): boolean {
  return mode === "PRIVATE" || canUseEvgreenNetwork(org);
}

/** Regla de descubrimiento para mapa, API y uso público. */
export function isDiscoverableOnEvgreenNetwork(input: {
  mode: NetworkAccessMode;
  isActive: boolean | number;
  isPublic: boolean | number;
  organization?: OrganizationNetworkState | null;
}): boolean {
  if (!input.isActive || !input.isPublic || input.mode === "PRIVATE") return false;
  return !input.organization || canUseEvgreenNetwork(input.organization);
}
