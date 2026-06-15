/**
 * Tests para el módulo de Perfiles de Consumo y Consentimiento
 * Verifica:
 * 1. Servicio de consentimiento (grant/revoke/check)
 * 2. Router tRPC (getConsentStatus, grantConsent, revokeConsent, getMyProfile)
 * 3. Cumplimiento Ley 1581/2012 (opt-in, supresión)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

// Mock schema imports
vi.mock("../../drizzle/schema", () => ({
  transactions: { userId: "userId", status: "status", startTime: "startTime", kwhConsumed: "kwhConsumed", totalCost: "totalCost", endTime: "endTime", stationId: "stationId", chargeMode: "chargeMode", appliedPricePerKwh: "appliedPricePerKwh" },
  userConsumptionProfile: { userId: "userId" },
  userDataConsents: { userId: "userId", consentType: "consentType", granted: "granted", updatedAt: "updatedAt" },
  personalizedOffers: { userId: "userId", id: "id", status: "status", createdAt: "createdAt" },
}));

import { getDb } from "../db";
import {
  hasActiveConsent,
  grantConsent,
  revokeConsent,
  buildPersonalizationContext,
} from "./consumption-profile-service";
import { CURRENT_POLICY_VERSION } from "./profiles-router";

describe("Profiles - Consent Service", () => {
  const mockChain: any = {};
  mockChain.select = vi.fn().mockReturnValue(mockChain);
  mockChain.from = vi.fn().mockReturnValue(mockChain);
  mockChain.where = vi.fn().mockReturnValue(mockChain);
  mockChain.orderBy = vi.fn().mockReturnValue(mockChain);
  mockChain.limit = vi.fn().mockResolvedValue([]);
  mockChain.insert = vi.fn().mockReturnValue(mockChain);
  mockChain.values = vi.fn().mockResolvedValue(undefined);
  mockChain.delete = vi.fn().mockReturnValue(mockChain);
  mockChain.onDuplicateKeyUpdate = vi.fn().mockReturnValue(mockChain);
  mockChain.update = vi.fn().mockReturnValue(mockChain);
  mockChain.set = vi.fn().mockReturnValue(mockChain);
  mockChain.selectDistinct = vi.fn().mockReturnValue(mockChain);
  const mockDb = mockChain;

  beforeEach(() => {
    vi.clearAllMocks();
    (getDb as any).mockResolvedValue(mockDb);
  });

  describe("hasActiveConsent", () => {
    it("returns false when database is not available", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await hasActiveConsent(1, "AI_PROFILING");
      expect(result).toBe(false);
    });

    it("returns false when no consent record exists", async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const result = await hasActiveConsent(1, "AI_PROFILING");
      expect(result).toBe(false);
    });

    it("returns true when consent is granted", async () => {
      mockDb.limit.mockResolvedValueOnce([{ granted: true }]);
      const result = await hasActiveConsent(1, "AI_PROFILING");
      expect(result).toBe(true);
    });

    it("returns false when consent is revoked", async () => {
      mockDb.limit.mockResolvedValueOnce([{ granted: false }]);
      const result = await hasActiveConsent(1, "AI_PROFILING");
      expect(result).toBe(false);
    });
  });

  describe("grantConsent", () => {
    it("throws when database is not available", async () => {
      (getDb as any).mockResolvedValue(null);
      await expect(
        grantConsent({
          userId: 1,
          consentType: "AI_PROFILING",
          policyVersion: CURRENT_POLICY_VERSION,
        })
      ).rejects.toThrow("Database not available");
    });

    it("inserts consent record with correct data", async () => {
      mockDb.values.mockResolvedValueOnce(undefined);
      await grantConsent({
        userId: 42,
        consentType: "AI_PROFILING",
        policyVersion: "2026-06-v1",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
          consentType: "AI_PROFILING",
          granted: true,
          policyVersion: "2026-06-v1",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        })
      );
    });
  });

  describe("revokeConsent", () => {
    it("throws when database is not available", async () => {
      (getDb as any).mockResolvedValue(null);
      await expect(revokeConsent(1, "AI_PROFILING")).rejects.toThrow(
        "Database not available"
      );
    });

    it("inserts revocation record and deletes profile for AI_PROFILING", async () => {
      mockDb.values.mockResolvedValueOnce(undefined);
      mockDb.where.mockResolvedValueOnce(undefined);
      await revokeConsent(1, "AI_PROFILING");

      // Should insert revocation
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          consentType: "AI_PROFILING",
          granted: false,
          policyVersion: "revocation",
        })
      );

      // Should delete profile (derecho de supresión)
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("does NOT delete profile for MARKETING revocation", async () => {
      mockDb.values.mockResolvedValueOnce(undefined);
      await revokeConsent(1, "MARKETING");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe("buildPersonalizationContext", () => {
    it("returns null when database is not available", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await buildPersonalizationContext(1);
      expect(result).toBeNull();
    });

    it("returns null when user has no consent", async () => {
      // hasActiveConsent will query and get no results
      mockDb.limit.mockResolvedValueOnce([]);
      const result = await buildPersonalizationContext(1);
      expect(result).toBeNull();
    });

    it("returns null when profile confidence is LOW", async () => {
      // First call: hasActiveConsent → granted
      mockDb.limit.mockResolvedValueOnce([{ granted: true }]);
      // Second call: getProfile → LOW confidence
      mockDb.limit.mockResolvedValueOnce([{
        confidence: "LOW",
        sessionsAnalyzed: 2,
        windowDays: 90,
        peakHour: 18,
        peakWeekday: 1,
        sessionsPerWeek: "0.50",
        avgKwhPerSession: "15.00",
        avgCostPerSession: "12000.00",
        avgSessionDurationMin: 45,
        topStations: [],
      }]);
      const result = await buildPersonalizationContext(1);
      expect(result).toBeNull();
    });

    it("returns personalization string when profile is MEDIUM or HIGH", async () => {
      // hasActiveConsent → granted
      mockDb.limit.mockResolvedValueOnce([{ granted: true }]);
      // getProfile → HIGH confidence
      mockDb.limit.mockResolvedValueOnce([{
        confidence: "HIGH",
        sessionsAnalyzed: 30,
        windowDays: 90,
        peakHour: 18,
        peakWeekday: 1,
        sessionsPerWeek: "3.50",
        avgKwhPerSession: "22.50",
        avgCostPerSession: "18000.00",
        avgSessionDurationMin: 55,
        topStations: [{ stationId: 1 }, { stationId: 5 }],
      }]);
      const result = await buildPersonalizationContext(1);
      expect(result).not.toBeNull();
      expect(result).toContain("PERFIL DE CONSUMO DEL USUARIO");
      expect(result).toContain("confianza: HIGH");
      expect(result).toContain("30 sesiones");
      expect(result).toContain("lunes"); // peakWeekday = 1
      expect(result).toContain("18:00"); // peakHour = 18
    });
  });
});

describe("Profiles - Policy Version", () => {
  it("CURRENT_POLICY_VERSION is defined and follows expected format", () => {
    expect(CURRENT_POLICY_VERSION).toBeDefined();
    expect(CURRENT_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });
});
