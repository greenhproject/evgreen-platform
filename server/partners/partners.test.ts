import { describe, it, expect, vi } from "vitest";
import { appRouter } from "../routers";

// Mock notification
vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

const publicCtx = { user: null } as any;
const adminCtx = {
  user: { id: 1, openId: "admin-1", name: "Admin", role: "admin" },
} as any;
const userCtx = {
  user: { id: 2, openId: "user-2", name: "User", role: "user" },
} as any;

describe("Partners Router", () => {
  const publicCaller = appRouter.createCaller(publicCtx);
  const adminCaller = appRouter.createCaller(adminCtx);
  const userCaller = appRouter.createCaller(userCtx);

  describe("submitApplication", () => {
    it("should submit a partner application successfully", async () => {
      const result = await publicCaller.partners.submitApplication({
        companyName: "Test Partner Corp",
        contactName: "Juan Test",
        email: "partner@test.com",
        phone: "+573001234567",
        city: "Bogotá",
        currentBrands: "ABB, Schneider",
        annualVolume: "50-100 unidades",
        message: "Interesados en el programa",
      });

      expect(result).toEqual({ success: true });
    });

    it("should fail with invalid email", async () => {
      await expect(
        publicCaller.partners.submitApplication({
          companyName: "Test",
          contactName: "Test",
          email: "invalid-email",
          phone: "123456",
        })
      ).rejects.toThrow();
    });

    it("should fail with missing required fields", async () => {
      await expect(
        publicCaller.partners.submitApplication({
          companyName: "",
          contactName: "Test",
          email: "test@test.com",
          phone: "123456",
        })
      ).rejects.toThrow();
    });
  });

  describe("admin.list", () => {
    it("should list applications for admin", async () => {
      const results = await adminCaller.partners.admin.list({});
      expect(Array.isArray(results)).toBe(true);
      // Should contain the application we just submitted
      expect(results.length).toBeGreaterThan(0);
      const app = results.find((a: any) => a.email === "partner@test.com");
      expect(app).toBeDefined();
      expect(app!.companyName).toBe("Test Partner Corp");
      expect(app!.status).toBe("pending");
    });

    it("should filter by status", async () => {
      const results = await adminCaller.partners.admin.list({ status: "approved" });
      expect(Array.isArray(results)).toBe(true);
      // Our test application is "pending", so it shouldn't appear in "approved" filter
      const app = results.find((a: any) => a.email === "partner@test.com");
      expect(app).toBeUndefined();
    });

    it("should search by company name", async () => {
      const results = await adminCaller.partners.admin.list({ search: "Test Partner" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("should deny access to regular users", async () => {
      await expect(
        userCaller.partners.admin.list({})
      ).rejects.toThrow("FORBIDDEN");
    });
  });

  describe("admin.updateStatus", () => {
    it("should update application status", async () => {
      // First get the list to find our application's ID
      const list = await adminCaller.partners.admin.list({});
      const app = list.find((a: any) => a.email === "partner@test.com");
      expect(app).toBeDefined();

      const result = await adminCaller.partners.admin.updateStatus({
        id: app!.id,
        status: "contacted",
      });
      expect(result).toEqual({ success: true });

      // Verify the status was updated
      const updatedList = await adminCaller.partners.admin.list({ status: "contacted" });
      const updatedApp = updatedList.find((a: any) => a.email === "partner@test.com");
      expect(updatedApp).toBeDefined();
      expect(updatedApp!.status).toBe("contacted");
    });

    it("should deny access to regular users", async () => {
      await expect(
        userCaller.partners.admin.updateStatus({ id: 1, status: "approved" })
      ).rejects.toThrow("FORBIDDEN");
    });
  });
});
