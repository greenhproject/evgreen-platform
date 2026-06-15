/**
 * Tests para la funcionalidad de restauración de backup
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de getDb
const mockExecute = vi.fn();
const mockDb = {
  execute: mockExecute,
};
vi.mock("../db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock de storage
vi.mock("../storage", () => ({
  storagePut: vi.fn(),
  storageGet: vi.fn(),
}));

describe("Backup Restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: execute returns success
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
  });

  it("should import restoreBackup from backup-service", async () => {
    const { restoreBackup } = await import("./backup-service");
    expect(restoreBackup).toBeDefined();
    expect(typeof restoreBackup).toBe("function");
  });

  it("should skip tables not in BACKUP_TABLES allowed list", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    const result = await restoreBackup({
      tables: {
        "malicious_table": [{ id: 1, name: "test" }],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    expect(result.tablesSkipped).toBe(1);
    expect(result.tablesRestored).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("no está en la lista");
  });

  it("should skip tables with empty data", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    const result = await restoreBackup({
      tables: {
        "users": [],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    expect(result.tablesSkipped).toBe(1);
    expect(result.tablesRestored).toBe(0);
  });

  it("should restore valid tables in merge mode", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    mockExecute.mockResolvedValue([{ affectedRows: 2 }]);
    
    const result = await restoreBackup({
      tables: {
        "users": [
          { id: 1, name: "Test User", email: "test@test.com" },
          { id: 2, name: "User 2", email: "user2@test.com" },
        ],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    expect(result.tablesRestored).toBe(1);
    expect(result.totalRowsRestored).toBeGreaterThan(0);
    
    // Should use INSERT IGNORE for merge mode
    const calls = mockExecute.mock.calls;
    const insertCall = calls.find((c: any) => {
      const queryStr = c[0]?.queryChunks?.[0]?.value?.[0] || c[0]?.toString?.() || String(c[0]);
      return queryStr.includes("INSERT IGNORE");
    });
    expect(insertCall).toBeDefined();
  });

  it("should use DELETE + INSERT for replace mode", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    
    const result = await restoreBackup({
      tables: {
        "users": [
          { id: 1, name: "Test User", email: "test@test.com" },
        ],
      },
      mode: "replace",
      triggeredBy: "test",
    });

    expect(result.tablesRestored).toBe(1);
    
    // Should have called SET FOREIGN_KEY_CHECKS = 0, DELETE, INSERT, SET FOREIGN_KEY_CHECKS = 1
    const calls = mockExecute.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it("should handle multiple tables", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    
    const result = await restoreBackup({
      tables: {
        "users": [{ id: 1, name: "User" }],
        "wallets": [{ id: 1, userId: 1, balance: 100 }],
        "transactions": [{ id: 1, amount: 50 }],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    expect(result.tablesRestored).toBe(3);
  });

  it("should return proper result structure", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    
    const result = await restoreBackup({
      tables: {
        "users": [{ id: 1, name: "Test" }],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    expect(result).toHaveProperty("tablesRestored");
    expect(result).toHaveProperty("tablesSkipped");
    expect(result).toHaveProperty("totalRowsRestored");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("details");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("should handle null values in data", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    
    const result = await restoreBackup({
      tables: {
        "users": [{ id: 1, name: null, email: undefined }],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    expect(result.tablesRestored).toBe(1);
    // Should not throw
  });

  it("should handle JSON objects in data", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    
    const result = await restoreBackup({
      tables: {
        "users": [{ id: 1, name: "Test", metadata: { key: "value", nested: { a: 1 } } }],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    expect(result.tablesRestored).toBe(1);
  });

  it("should reject table names with SQL injection characters", async () => {
    const { restoreBackup } = await import("./backup-service");
    
    const result = await restoreBackup({
      tables: {
        "users; DROP TABLE users": [{ id: 1 }],
      },
      mode: "merge",
      triggeredBy: "test",
    });

    // Should be skipped because it's not in allowed tables
    expect(result.tablesSkipped).toBe(1);
    expect(result.tablesRestored).toBe(0);
  });
});
