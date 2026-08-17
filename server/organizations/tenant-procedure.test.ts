import { describe, expect, it } from "vitest";
import { router, tenantProcedure } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";

const securedRouter = router({
  currentOrganization: tenantProcedure.query(({ ctx }) => ctx.tenant!.organizationId),
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
});
