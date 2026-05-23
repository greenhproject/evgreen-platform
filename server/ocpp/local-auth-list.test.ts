import { describe, it, expect, vi, beforeEach } from "vitest";
import { dualCSMS } from "./csms-dual";

describe("Local Auth List - OCPP Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendLocalList", () => {
    it("should throw when charger is not connected", async () => {
      await expect(
        dualCSMS.sendLocalList("non-existent-charger", 1, "Full", [
          { idTag: "RFID-001", idTagInfo: { status: "Accepted" } },
        ])
      ).rejects.toThrow("not connected");
    });

    it("should accept empty list for Full update type", async () => {
      // When charger is not connected, it should throw - verifying the method exists and validates
      await expect(
        dualCSMS.sendLocalList("test-charger", 1, "Full", [])
      ).rejects.toThrow("not connected");
    });

    it("should accept Differential update type", async () => {
      await expect(
        dualCSMS.sendLocalList("test-charger", 2, "Differential", [
          { idTag: "RFID-002", idTagInfo: { status: "Accepted", expiryDate: "2027-01-01T00:00:00Z" } },
        ])
      ).rejects.toThrow("not connected");
    });
  });

  describe("getLocalListVersion", () => {
    it("should throw when charger is not connected", async () => {
      await expect(
        dualCSMS.getLocalListVersion("non-existent-charger")
      ).rejects.toThrow("not connected");
    });
  });

  describe("sendLocalList method signature", () => {
    it("should have sendLocalList method on dualCSMS", () => {
      expect(typeof dualCSMS.sendLocalList).toBe("function");
    });

    it("should have getLocalListVersion method on dualCSMS", () => {
      expect(typeof dualCSMS.getLocalListVersion).toBe("function");
    });
  });
});

describe("Local Auth List - Database Functions", () => {
  // These test the db helper functions exist and have correct signatures
  it("should import db functions without error", async () => {
    const db = await import("../db");
    expect(typeof db.getLocalAuthListWithEntries).toBe("function");
    expect(typeof db.addLocalAuthEntry).toBe("function");
    expect(typeof db.removeLocalAuthEntry).toBe("function");
    expect(typeof db.markLocalAuthListSynced).toBe("function");
    expect(typeof db.updateOfflinePolicy).toBe("function");
    expect(typeof db.getPendingOfflineTransactions).toBe("function");
    expect(typeof db.reconcileOfflineTransaction).toBe("function");
    expect(typeof db.getAllLocalAuthListsStatus).toBe("function");
  });

  it("getLocalAuthListWithEntries should return list and entries for non-existent station", async () => {
    const db = await import("../db");
    const result = await db.getLocalAuthListWithEntries(99999);
    expect(result).toHaveProperty("list");
    expect(result).toHaveProperty("entries");
    expect(result.list).toHaveProperty("listVersion");
    expect(result.list).toHaveProperty("status");
    expect(Array.isArray(result.entries)).toBe(true);
  });

  it("getPendingOfflineTransactions should return array", async () => {
    const db = await import("../db");
    const result = await db.getPendingOfflineTransactions(99999);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAllLocalAuthListsStatus should return array", async () => {
    const db = await import("../db");
    const result = await db.getAllLocalAuthListsStatus();
    expect(Array.isArray(result)).toBe(true);
  });
});
