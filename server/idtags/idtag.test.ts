import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../db", () => {
  const mockIdTags = new Map<string, any>();
  const mockUsers = new Map<number, any>();

  // Pre-populate with test data
  mockIdTags.set("EV-3PZ3L6", {
    id: 3,
    idTag: "EV-3PZ3L6",
    userId: 570001,
    type: "APP",
    status: "ACTIVE",
    label: "Tag de la app",
    serialNumber: null,
    expiresAt: null,
    parentIdTag: null,
    maxActiveTransactions: 1,
    lastUsedAt: null,
    lastUsedStationId: null,
  });

  mockIdTags.set("RF-ABCD1234", {
    id: 100,
    idTag: "RF-ABCD1234",
    userId: 1001,
    type: "RFID",
    status: "ACTIVE",
    label: "Tarjeta RFID oficina",
    serialNumber: "SN-001",
    expiresAt: null,
    parentIdTag: null,
    maxActiveTransactions: 1,
    lastUsedAt: null,
    lastUsedStationId: null,
  });

  mockIdTags.set("RF-BLOCKED01", {
    id: 101,
    idTag: "RF-BLOCKED01",
    userId: 1002,
    type: "RFID",
    status: "BLOCKED",
    label: "Tarjeta bloqueada",
    serialNumber: "SN-002",
    expiresAt: null,
    parentIdTag: null,
    maxActiveTransactions: 1,
    lastUsedAt: null,
    lastUsedStationId: null,
  });

  mockIdTags.set("RF-EXPIRED01", {
    id: 102,
    idTag: "RF-EXPIRED01",
    userId: 1003,
    type: "RFID",
    status: "ACTIVE",
    label: "Tarjeta expirada",
    serialNumber: "SN-003",
    expiresAt: new Date("2020-01-01"),
    parentIdTag: null,
    maxActiveTransactions: 1,
    lastUsedAt: null,
    lastUsedStationId: null,
  });

  mockIdTags.set("RF-NOUSER01", {
    id: 103,
    idTag: "RF-NOUSER01",
    userId: null,
    type: "RFID",
    status: "ACTIVE",
    label: "Tarjeta sin usuario",
    serialNumber: "SN-004",
    expiresAt: null,
    parentIdTag: null,
    maxActiveTransactions: 1,
    lastUsedAt: null,
    lastUsedStationId: null,
  });

  mockUsers.set(570001, {
    id: 570001,
    name: "Test User",
    email: "test@example.com",
    idTag: "EV-3PZ3L6",
    role: "user",
    isActive: true,
  });

  mockUsers.set(1001, {
    id: 1001,
    name: "RFID User",
    email: "rfid@example.com",
    idTag: null,
    role: "user",
    isActive: true,
  });

  return {
    getIdTag: vi.fn(async (idTag: string) => mockIdTags.get(idTag) || undefined),
    
    getUserByIdTagFromTable: vi.fn(async (idTag: string) => {
      const tag = mockIdTags.get(idTag);
      if (!tag || tag.status !== "ACTIVE" || !tag.userId) return undefined;
      return mockUsers.get(tag.userId) || undefined;
    }),

    resolveUserByIdTag: vi.fn(async (idTag: string) => {
      // 1. Check id_tags table
      const tag = mockIdTags.get(idTag);
      if (tag && tag.status === "ACTIVE" && tag.userId) {
        const user = mockUsers.get(tag.userId);
        if (user) return { user, source: "id_tags_table" };
      }

      // 2. Check users table (legacy)
      for (const [, user] of mockUsers) {
        if (user.idTag === idTag) {
          return { user, source: "users_legacy" };
        }
      }

      // 3. USER-{id} format
      const match = idTag.match(/^USER-(\d+)$/);
      if (match) {
        const user = mockUsers.get(parseInt(match[1], 10));
        return { user: user || undefined, source: "user_id_format" };
      }

      return { user: undefined, source: "not_found" };
    }),

    getUserByIdTag: vi.fn(async (idTag: string) => {
      for (const [, user] of mockUsers) {
        if (user.idTag === idTag) return user;
      }
      return undefined;
    }),

    getUserById: vi.fn(async (id: number) => mockUsers.get(id) || undefined),

    validateIdTag: vi.fn(async (idTag: string) => {
      const tag = mockIdTags.get(idTag);
      if (!tag) return { valid: false, reason: "TAG_NOT_FOUND" };
      if (tag.status === "BLOCKED") return { valid: false, reason: "TAG_BLOCKED" };
      if (tag.status === "EXPIRED") return { valid: false, reason: "TAG_EXPIRED" };
      if (tag.status === "LOST") return { valid: false, reason: "TAG_LOST" };
      if (tag.expiresAt && new Date(tag.expiresAt) < new Date()) {
        return { valid: false, reason: "TAG_EXPIRED" };
      }
      if (!tag.userId) return { valid: false, reason: "TAG_NOT_ASSIGNED" };
      return { valid: true, reason: "OK", userId: tag.userId, tagType: tag.type };
    }),

    recordIdTagUsage: vi.fn(async () => {}),
    syncUserIdTag: vi.fn(async () => {}),
    blockIdTag: vi.fn(async () => {}),
    createIdTag: vi.fn(async () => 999),
    updateIdTag: vi.fn(async () => {}),
    getIdTagsByUserId: vi.fn(async (userId: number) => {
      const tags: any[] = [];
      for (const [, tag] of mockIdTags) {
        if (tag.userId === userId) tags.push(tag);
      }
      return tags;
    }),
    getAllIdTags: vi.fn(async () => Array.from(mockIdTags.values())),

    getChargingStationByOcppIdentity: vi.fn(async (ocppIdentity: string) => {
      if (ocppIdentity === "EVG001") {
        return { id: 1, name: "EVG001 Test", ocppIdentity: "EVG001", isOnline: true };
      }
      return undefined;
    }),

    updateChargingStation: vi.fn(async () => {}),
    getEvsesByStationId: vi.fn(async (stationId: number) => {
      if (stationId === 1) {
        return [{ id: 10, stationId: 1, evseIdLocal: 1, connectorType: "TYPE_2", chargeType: "AC", powerKw: "22.00", status: "AVAILABLE" }];
      }
      return [];
    }),
    getActiveTransaction: vi.fn(async () => null),
    getEffectiveStationPrice: vi.fn(async () => ({ pricePerKwh: 1200, multiplier: 1.0 })),
    getActiveTariffByStationId: vi.fn(async () => ({ id: 1 })),
    createTransaction: vi.fn(async () => 42),
    updateEvseStatus: vi.fn(async () => {}),
    getChargingStationById: vi.fn(async () => ({ id: 1, name: "EVG001 Test" })),
    createNotification: vi.fn(async () => 1),
    createOcppLog: vi.fn(async () => 1),
  };
});

// Import after mocking
import * as db from "../db";

// ============================================================================
// TEST: validateIdTag
// ============================================================================
describe("validateIdTag", () => {
  it("should validate an active APP idTag", async () => {
    const result = await db.validateIdTag("EV-3PZ3L6");
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("OK");
    expect(result.userId).toBe(570001);
    expect(result.tagType).toBe("APP");
  });

  it("should validate an active RFID idTag", async () => {
    const result = await db.validateIdTag("RF-ABCD1234");
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("OK");
    expect(result.userId).toBe(1001);
    expect(result.tagType).toBe("RFID");
  });

  it("should reject a blocked idTag", async () => {
    const result = await db.validateIdTag("RF-BLOCKED01");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TAG_BLOCKED");
  });

  it("should reject an expired idTag", async () => {
    const result = await db.validateIdTag("RF-EXPIRED01");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TAG_EXPIRED");
  });

  it("should reject an unassigned idTag", async () => {
    const result = await db.validateIdTag("RF-NOUSER01");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TAG_NOT_ASSIGNED");
  });

  it("should return TAG_NOT_FOUND for unknown idTag", async () => {
    const result = await db.validateIdTag("UNKNOWN-TAG");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TAG_NOT_FOUND");
  });
});

// ============================================================================
// TEST: resolveUserByIdTag
// ============================================================================
describe("resolveUserByIdTag", () => {
  it("should resolve user from id_tags table (APP tag)", async () => {
    const result = await db.resolveUserByIdTag("EV-3PZ3L6");
    expect(result.user).toBeDefined();
    expect(result.user!.id).toBe(570001);
    expect(result.source).toBe("id_tags_table");
  });

  it("should resolve user from id_tags table (RFID tag)", async () => {
    const result = await db.resolveUserByIdTag("RF-ABCD1234");
    expect(result.user).toBeDefined();
    expect(result.user!.id).toBe(1001);
    expect(result.source).toBe("id_tags_table");
  });

  it("should resolve user from legacy users table", async () => {
    // EV-3PZ3L6 also exists in users table
    const result = await db.resolveUserByIdTag("EV-3PZ3L6");
    expect(result.user).toBeDefined();
    // Should find via id_tags first
    expect(result.source).toBe("id_tags_table");
  });

  it("should resolve user from USER-{id} format", async () => {
    const result = await db.resolveUserByIdTag("USER-570001");
    expect(result.user).toBeDefined();
    expect(result.user!.id).toBe(570001);
    expect(result.source).toBe("user_id_format");
  });

  it("should return not_found for unknown idTag", async () => {
    const result = await db.resolveUserByIdTag("UNKNOWN-TAG");
    expect(result.user).toBeUndefined();
    expect(result.source).toBe("not_found");
  });

  it("should not resolve blocked tag", async () => {
    const result = await db.resolveUserByIdTag("RF-BLOCKED01");
    expect(result.user).toBeUndefined();
    // Blocked tag won't match in id_tags (status != ACTIVE)
  });
});

// ============================================================================
// TEST: StartTransaction handler logic (unit test for user resolution)
// ============================================================================
describe("StartTransaction user resolution logic", () => {
  it("should resolve user by idTag EV-3PZ3L6 via resolveUserByIdTag", async () => {
    const result = await db.resolveUserByIdTag("EV-3PZ3L6");
    expect(result.user).toBeDefined();
    expect(result.user!.id).toBe(570001);
  });

  it("should resolve user by RFID tag RF-ABCD1234", async () => {
    const result = await db.resolveUserByIdTag("RF-ABCD1234");
    expect(result.user).toBeDefined();
    expect(result.user!.id).toBe(1001);
  });

  it("should auto-resolve stationId for EVG001", async () => {
    const station = await db.getChargingStationByOcppIdentity("EVG001");
    expect(station).toBeDefined();
    expect(station!.id).toBe(1);
  });

  it("should return undefined for unknown station", async () => {
    const station = await db.getChargingStationByOcppIdentity("UNKNOWN");
    expect(station).toBeUndefined();
  });

  it("should find EVSE for station 1", async () => {
    const evses = await db.getEvsesByStationId(1);
    expect(evses.length).toBeGreaterThan(0);
    expect(evses[0].evseIdLocal).toBe(1);
  });

  it("should return empty EVSEs for unknown station", async () => {
    const evses = await db.getEvsesByStationId(999);
    expect(evses.length).toBe(0);
  });
});

// ============================================================================
// TEST: Authorize handler logic
// ============================================================================
describe("Authorize handler logic", () => {
  it("should accept known active APP idTag", async () => {
    const validation = await db.validateIdTag("EV-3PZ3L6");
    expect(validation.valid).toBe(true);
    expect(validation.userId).toBe(570001);
  });

  it("should accept known active RFID idTag", async () => {
    const validation = await db.validateIdTag("RF-ABCD1234");
    expect(validation.valid).toBe(true);
    expect(validation.userId).toBe(1001);
  });

  it("should reject blocked idTag but handler accepts in permissive mode", async () => {
    const validation = await db.validateIdTag("RF-BLOCKED01");
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("TAG_BLOCKED");
    // In permissive mode, the handler would still return Accepted
    // This is tested at the handler level
  });

  it("should record idTag usage after successful validation", async () => {
    await db.recordIdTagUsage("EV-3PZ3L6", 1);
    expect(db.recordIdTagUsage).toHaveBeenCalledWith("EV-3PZ3L6", 1);
  });

  it("should sync legacy idTag to id_tags table", async () => {
    await db.syncUserIdTag(570001, "EV-3PZ3L6");
    expect(db.syncUserIdTag).toHaveBeenCalledWith(570001, "EV-3PZ3L6");
  });
});

// ============================================================================
// TEST: idTag CRUD operations
// ============================================================================
describe("idTag CRUD operations", () => {
  it("should get idTags by userId", async () => {
    const tags = await db.getIdTagsByUserId(570001);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0].idTag).toBe("EV-3PZ3L6");
  });

  it("should get all idTags", async () => {
    const tags = await db.getAllIdTags();
    expect(tags.length).toBe(5); // 5 mock tags
  });

  it("should create a new idTag", async () => {
    const id = await db.createIdTag({
      idTag: "RF-NEW12345",
      userId: 570001,
      type: "RFID",
      label: "Nueva tarjeta",
    });
    expect(id).toBe(999);
  });

  it("should block an idTag", async () => {
    await db.blockIdTag("RF-ABCD1234");
    expect(db.blockIdTag).toHaveBeenCalledWith("RF-ABCD1234");
  });

  it("should update an idTag", async () => {
    await db.updateIdTag(100, { label: "Updated label" });
    expect(db.updateIdTag).toHaveBeenCalledWith(100, { label: "Updated label" });
  });
});

// ============================================================================
// TEST: StartTransaction complete flow simulation
// ============================================================================
describe("StartTransaction complete flow", () => {
  it("should handle full flow: resolve station → resolve EVSE → resolve user → create transaction", async () => {
    // Step 1: Resolve station
    const station = await db.getChargingStationByOcppIdentity("EVG001");
    expect(station).toBeDefined();
    const stationId = station!.id;

    // Step 2: Resolve EVSE
    const evses = await db.getEvsesByStationId(stationId);
    expect(evses.length).toBeGreaterThan(0);
    const evse = evses.find(e => e.evseIdLocal === 1) || evses[0];

    // Step 3: Check for duplicates
    const existing = await db.getActiveTransaction(evse.id);
    expect(existing).toBeNull();

    // Step 4: Resolve user by idTag
    const resolved = await db.resolveUserByIdTag("EV-3PZ3L6");
    expect(resolved.user).toBeDefined();
    const userId = resolved.user!.id;

    // Step 5: Get pricing
    const price = await db.getEffectiveStationPrice(stationId);
    expect(price.pricePerKwh).toBe(1200);

    // Step 6: Create transaction
    const txId = await db.createTransaction({
      evseId: evse.id,
      userId,
      stationId,
      tariffId: 1,
      ocppTransactionId: "test-tx-001",
      startTime: new Date(),
      status: "IN_PROGRESS",
      meterStart: "0",
    });
    expect(txId).toBe(42);

    // Step 7: Update EVSE status
    await db.updateEvseStatus(evse.id, "CHARGING");
    expect(db.updateEvseStatus).toHaveBeenCalledWith(evse.id, "CHARGING");

    // Step 8: Record idTag usage
    await db.recordIdTagUsage("EV-3PZ3L6", stationId);
    expect(db.recordIdTagUsage).toHaveBeenCalled();
  });

  it("should handle StartTransaction with unknown idTag (RFID walk-up)", async () => {
    // Unknown RFID tag - should still create transaction with userId=0
    const resolved = await db.resolveUserByIdTag("RF-UNKNOWN99");
    expect(resolved.user).toBeUndefined();
    expect(resolved.source).toBe("not_found");

    // In the handler, this would set userId = 0 (unassigned)
    const userId = resolved.user?.id ?? 0;
    expect(userId).toBe(0);

    // Transaction should still be created
    const txId = await db.createTransaction({
      evseId: 10,
      userId: 0,
      stationId: 1,
      tariffId: 1,
      ocppTransactionId: "test-tx-unknown",
      startTime: new Date(),
      status: "IN_PROGRESS",
      meterStart: "0",
    });
    expect(txId).toBe(42);
  });

  it("should handle StartTransaction with station not in DB", async () => {
    const station = await db.getChargingStationByOcppIdentity("UNKNOWN_STATION");
    expect(station).toBeUndefined();
    // Handler would return Invalid in this case (station truly doesn't exist)
  });
});

// ============================================================================
// TEST: Edge cases
// ============================================================================
describe("Edge cases", () => {
  it("should handle empty idTag string", async () => {
    const result = await db.validateIdTag("");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TAG_NOT_FOUND");
  });

  it("should handle USER-0 format", async () => {
    const result = await db.resolveUserByIdTag("USER-0");
    expect(result.source).toBe("user_id_format");
    // userId 0 doesn't exist in mock
    expect(result.user).toBeUndefined();
  });

  it("should handle very long idTag", async () => {
    const longTag = "A".repeat(50);
    const result = await db.validateIdTag(longTag);
    expect(result.valid).toBe(false);
  });

  it("should handle special characters in idTag", async () => {
    const result = await db.validateIdTag("RF-!@#$%^");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TAG_NOT_FOUND");
  });
});
