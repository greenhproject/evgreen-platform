/**
 * Tests for bulk operations and advanced filters on spaces admin
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// ============================================================================
// HELPERS
// ============================================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { origin: "https://evgreen.lat" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    res: {
      clearCookie: vi.fn(),
    } as any,
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user-001",
    email: "admin@evgreen.lat",
    name: "Admin EVGreen",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://evgreen.lat" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    res: {
      clearCookie: vi.fn(),
    } as any,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("spaces.admin bulk operations", () => {
  let publicCaller: ReturnType<typeof appRouter.createCaller>;
  let adminCaller: ReturnType<typeof appRouter.createCaller>;
  let createdIds: number[] = [];

  beforeAll(async () => {
    publicCaller = appRouter.createCaller(createPublicContext());
    adminCaller = appRouter.createCaller(createAdminContext());

    // Create test submissions for bulk operations
    for (let i = 0; i < 3; i++) {
      const result = await publicCaller.spaces.submit({
        submitterName: `BulkOps Test User ${i}`,
        submitterEmail: `bulkops${i}@example.com`,
        submitterPhone: `300000000${i}`,
        spaceName: `BulkOps Space ${i}`,
        spaceType: "parking",
        address: `Calle ${i} #${i}-${i}`,
        city: i === 0 ? "Bogotá" : i === 1 ? "Medellín" : "Cali",
      });
      createdIds.push(result.submissionId);
    }
  });

  describe("admin.list with advanced filters", () => {
    it("filters by city", async () => {
      const result = await adminCaller.spaces.admin.list({ city: "Bogotá" });
      expect(result.submissions.length).toBeGreaterThan(0);
      expect(result.submissions.every((s: any) => s.city === "Bogotá")).toBe(true);
    });

    it("filters by spaceType", async () => {
      const result = await adminCaller.spaces.admin.list({ spaceType: "parking" });
      expect(result.submissions.length).toBeGreaterThan(0);
      expect(result.submissions.every((s: any) => s.spaceType === "parking")).toBe(true);
    });

    it("filters by hasScore=unscored", async () => {
      const result = await adminCaller.spaces.admin.list({ hasScore: "unscored" });
      expect(result.submissions.length).toBeGreaterThan(0);
      expect(result.submissions.every((s: any) => s.aiScore === null)).toBe(true);
    });

    it("returns filterOptions with cities and types", async () => {
      const result = await adminCaller.spaces.admin.list({});
      expect(result.filterOptions).toBeDefined();
      expect(result.filterOptions.cities).toBeInstanceOf(Array);
      expect(result.filterOptions.types).toBeInstanceOf(Array);
      expect(result.filterOptions.cities.length).toBeGreaterThan(0);
    });

    it("filters by date range (today)", async () => {
      const today = new Date().toISOString().split("T")[0];
      const result = await adminCaller.spaces.admin.list({ dateFrom: today, dateTo: today });
      expect(result.submissions.length).toBeGreaterThan(0);
    });
  });

  describe("admin.bulkUpdateStatus", () => {
    it("changes status of multiple spaces", async () => {
      const result = await adminCaller.spaces.admin.bulkUpdateStatus({
        ids: createdIds,
        status: "under_review",
      });
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);

      // Verify the status was actually changed
      const detail = await adminCaller.spaces.admin.getById({ id: createdIds[0] });
      expect(detail.status).toBe("under_review");
    });
  });

  describe("admin.bulkAssignScore", () => {
    it("assigns technical score to multiple spaces", async () => {
      const result = await adminCaller.spaces.admin.bulkAssignScore({
        ids: createdIds,
        technicalScore: 75,
      });
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);

      // Verify the score was assigned
      const detail = await adminCaller.spaces.admin.getById({ id: createdIds[0] });
      expect(detail.technicalScore).toBe(75);
    });
  });

  describe("admin.bulkDelete", () => {
    it("deletes multiple spaces at once", async () => {
      const result = await adminCaller.spaces.admin.bulkDelete({
        ids: createdIds,
      });
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(3);

      // Verify they are actually deleted
      const list = await adminCaller.spaces.admin.list({ search: "BulkOps Space" });
      const remaining = list.submissions.filter((s: any) => createdIds.includes(s.id));
      expect(remaining.length).toBe(0);
    });
  });
});
