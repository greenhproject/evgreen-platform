import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));

vi.mock("../db", () => ({ getDb: mockGetDb }));

import { appRouter } from "../routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCommercialContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 77,
    openId: "commercial-user-077",
    email: "comercial@evgreen.lat",
    name: "Comercial EVGreen",
    loginMethod: "manus",
    role: "comercial",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function createLimitedDb(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit })),
      })),
    })),
  };
}

describe("spaces.admin — permisos tRPC del comercial", () => {
  beforeEach(() => {
    mockGetDb.mockReset();
  });

  it("bloquea mutaciones administrativas aunque el comercial conozca el endpoint", async () => {
    const caller = appRouter.createCaller(createCommercialContext());

    await expect(caller.spaces.admin.updateStatus({ id: 1, status: "under_review" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.spaces.admin.bulkUpdateStatus({ ids: [1], status: "approved" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.spaces.admin.bulkDelete({ ids: [1] }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite que el comercial alcance los flujos comerciales, sujetos a sus validaciones de negocio", async () => {
    const caller = appRouter.createCaller(createCommercialContext());

    mockGetDb.mockResolvedValue(createLimitedDb([{ id: 1, spaceStatus: "pending" }]));
    await expect(caller.spaces.admin.sendLetter({ id: 1 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });

    mockGetDb.mockResolvedValue(createLimitedDb([{ id: 1, spaceStatus: "pending" }]));
    await expect(caller.spaces.admin.publishToCrowdfunding({ id: 1 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });

    mockGetDb.mockResolvedValue(createLimitedDb([]));
    await expect(caller.spaces.admin.advanceCommercialStage({
      id: 1,
      targetStatus: "funded",
      note: "Confirmación de fondeo recibida.",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
