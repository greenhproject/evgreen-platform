import { describe, expect, it } from "vitest";
import { router, tenantProcedure } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { assertTenantOwnsResource } from "./tenant-scope";

const securedRouter = router({
  currentOrganization: tenantProcedure.query(({ ctx }) => ctx.tenant!.organizationId),
  stationById: tenantProcedure
    .input((value: unknown) => Number(value))
    .query(({ ctx, input }) => {
      const stations = new Map([[101, 10], [202, 20]]);
      assertTenantOwnsResource(ctx.tenant!.organizationId, stations.get(input), "Estación");
      return { id: input, organizationId: ctx.tenant!.organizationId };
    }),
});

function createContext(organizationId?: number): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "tenant-user-42",
      email: "tenant@example.com",
      name: "Tenant User",
      loginMethod: "oauth",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { headers: {} } as any,
    res: {} as any,
    tenant: organizationId ? {
      organizationId,
      organization: {
        id: organizationId,
        name: "Tenant A",
        slug: "tenant-a",
        plan: "professional",
        status: "active",
        networkMember: true,
        supportIncluded: false,
        transactionFeePercent: null,
        supportFeePercent: null,
        maxChargers: 10,
        primaryColor: null,
        secondaryColor: null,
        logoUrl: null,
        appName: null,
        customDomain: null,
      },
    } : undefined,
  };
}

describe("tenantProcedure", () => {
  it("rechaza a un usuario autenticado sin una organización resuelta", async () => {
    const caller = securedRouter.createCaller(createContext());
    await expect(caller.currentOrganization()).rejects.toThrow("No perteneces a una organización activa");
  });

  it("preserva la organización autorizada en el contexto del procedimiento", async () => {
    const caller = securedRouter.createCaller(createContext(7));
    await expect(caller.currentOrganization()).resolves.toBe(7);
  });
  it("no permite que el tenant A consulte por ID una estación del tenant B", async () => {
    const tenantA = securedRouter.createCaller(createContext(10));
    const tenantB = securedRouter.createCaller(createContext(20));

    await expect(tenantA.stationById(101)).resolves.toEqual({ id: 101, organizationId: 10 });
    await expect(tenantB.stationById(202)).resolves.toEqual({ id: 202, organizationId: 20 });
    await expect(tenantA.stationById(202)).rejects.toThrow("Estación no encontrado");
    await expect(tenantB.stationById(101)).rejects.toThrow("Estación no encontrado");
  });
});
