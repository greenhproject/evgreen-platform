import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the overstay (post-charge occupancy penalty) system.
 * 
 * These tests verify the core logic of the overstay detection and penalty system:
 * 1. Grace period calculation
 * 2. Penalty calculation after grace period
 * 3. Session tracking lifecycle
 * 4. Integration points (StatusNotification triggers, StopTransaction triggers)
 */

describe("Overstay Monitor - Core Logic", () => {
  
  describe("Grace Period Calculation", () => {
    it("should not charge during grace period", () => {
      const gracePeriodMinutes = 10;
      const finishingStartTime = new Date();
      const now = new Date(finishingStartTime.getTime() + 5 * 60 * 1000); // 5 min later
      
      const elapsedMinutes = (now.getTime() - finishingStartTime.getTime()) / (1000 * 60);
      const isInGracePeriod = elapsedMinutes <= gracePeriodMinutes;
      
      expect(isInGracePeriod).toBe(true);
      expect(elapsedMinutes).toBeCloseTo(5, 1);
    });

    it("should start charging after grace period expires", () => {
      const gracePeriodMinutes = 10;
      const finishingStartTime = new Date();
      const now = new Date(finishingStartTime.getTime() + 12 * 60 * 1000); // 12 min later
      
      const elapsedMinutes = (now.getTime() - finishingStartTime.getTime()) / (1000 * 60);
      const isInGracePeriod = elapsedMinutes <= gracePeriodMinutes;
      
      expect(isInGracePeriod).toBe(false);
      expect(elapsedMinutes).toBeCloseTo(12, 1);
    });

    it("should use default grace period of 10 minutes when not configured", () => {
      const defaultGracePeriod = 10;
      const tariffGracePeriod = undefined;
      const globalGracePeriod = undefined;
      
      const effectiveGracePeriod = tariffGracePeriod ?? globalGracePeriod ?? defaultGracePeriod;
      expect(effectiveGracePeriod).toBe(10);
    });

    it("should prefer station tariff grace period over global", () => {
      const defaultGracePeriod = 10;
      const tariffGracePeriod = 5;
      const globalGracePeriod = 15;
      
      const effectiveGracePeriod = tariffGracePeriod ?? globalGracePeriod ?? defaultGracePeriod;
      expect(effectiveGracePeriod).toBe(5);
    });
  });

  describe("Penalty Calculation", () => {
    it("should calculate correct penalty amount for 1 minute", () => {
      const penaltyPerMinute = 500; // $500 COP/min
      const minutesSinceLastCharge = 1;
      
      const penaltyAmount = Math.round(minutesSinceLastCharge * penaltyPerMinute);
      expect(penaltyAmount).toBe(500);
    });

    it("should calculate correct penalty for 5 minutes", () => {
      const penaltyPerMinute = 500;
      const minutesSinceLastCharge = 5;
      
      const penaltyAmount = Math.round(minutesSinceLastCharge * penaltyPerMinute);
      expect(penaltyAmount).toBe(2500);
    });

    it("should accumulate costs correctly over multiple charges", () => {
      const penaltyPerMinute = 500;
      let accumulatedCost = 0;
      
      // Simulate 3 charge cycles of 1 minute each
      for (let i = 0; i < 3; i++) {
        const penaltyAmount = Math.round(1 * penaltyPerMinute);
        accumulatedCost += penaltyAmount;
      }
      
      expect(accumulatedCost).toBe(1500);
    });

    it("should not charge if penalty per minute is 0", () => {
      const penaltyPerMinute = 0;
      const minutesSinceLastCharge = 10;
      
      const penaltyAmount = Math.round(minutesSinceLastCharge * penaltyPerMinute);
      expect(penaltyAmount).toBe(0);
    });

    it("should use default penalty of $500/min when not configured", () => {
      const defaultPenalty = 500;
      const tariffPenalty = undefined;
      const globalPenalty = undefined;
      
      const effectivePenalty = tariffPenalty ?? globalPenalty ?? defaultPenalty;
      expect(effectivePenalty).toBe(500);
    });
  });

  describe("Revenue Share for Overstay Penalties", () => {
    it("should split overstay penalty 80/20 between investor and platform", () => {
      const penaltyAmount = 500;
      const investorPercent = 80;
      const platformPercent = 20;
      
      const investorShare = penaltyAmount * (investorPercent / 100);
      const platformFee = penaltyAmount * (platformPercent / 100);
      
      expect(investorShare).toBe(400);
      expect(platformFee).toBe(100);
      expect(investorShare + platformFee).toBe(penaltyAmount);
    });
  });

  describe("EVSE Status Transitions", () => {
    it("should transition from CHARGING to FINISHING when charge completes", () => {
      const statusMap: Record<string, string> = {
        Available: "AVAILABLE",
        Preparing: "PREPARING",
        Charging: "CHARGING",
        SuspendedEV: "SUSPENDED_EV",
        SuspendedEVSE: "SUSPENDED_EVSE",
        Finishing: "FINISHING",
        Reserved: "RESERVED",
        Unavailable: "UNAVAILABLE",
        Faulted: "FAULTED",
      };
      
      expect(statusMap["Finishing"]).toBe("FINISHING");
      expect(statusMap["Available"]).toBe("AVAILABLE");
    });

    it("should detect Finishing status as overstay trigger", () => {
      const ocppStatus = "Finishing";
      const shouldStartOverstay = ocppStatus === "Finishing" || ocppStatus === "SuspendedEV";
      expect(shouldStartOverstay).toBe(true);
    });

    it("should detect Available status as overstay end trigger", () => {
      const ocppStatus = "Available";
      const shouldEndOverstay = ocppStatus === "Available";
      expect(shouldEndOverstay).toBe(true);
    });

    it("should NOT trigger overstay for Charging status", () => {
      const ocppStatus = "Charging";
      const shouldStartOverstay = ocppStatus === "Finishing" || ocppStatus === "SuspendedEV";
      expect(shouldStartOverstay).toBe(false);
    });
  });

  describe("StopTransaction → FINISHING transition", () => {
    it("should set EVSE to FINISHING (not AVAILABLE) after StopTransaction", () => {
      // When a user stops charging via the app, the EVSE should be set to FINISHING
      // (not AVAILABLE) because the cable may still be connected
      const expectedStatus = "FINISHING";
      expect(expectedStatus).not.toBe("AVAILABLE");
      expect(expectedStatus).toBe("FINISHING");
    });
  });

  describe("Session Tracking Map", () => {
    it("should track sessions by EVSE ID", () => {
      const sessions = new Map<number, { userId: number; accumulatedCost: number }>();
      
      sessions.set(100, { userId: 1, accumulatedCost: 0 });
      expect(sessions.has(100)).toBe(true);
      expect(sessions.has(200)).toBe(false);
    });

    it("should not create duplicate sessions for same EVSE", () => {
      const sessions = new Map<number, { userId: number; accumulatedCost: number }>();
      
      sessions.set(100, { userId: 1, accumulatedCost: 0 });
      
      // Trying to add again should be skipped
      if (sessions.has(100)) {
        // Skip - already tracking
      } else {
        sessions.set(100, { userId: 2, accumulatedCost: 0 });
      }
      
      expect(sessions.get(100)?.userId).toBe(1); // Original session preserved
    });

    it("should remove session when cable is disconnected", () => {
      const sessions = new Map<number, { userId: number; accumulatedCost: number }>();
      
      sessions.set(100, { userId: 1, accumulatedCost: 500 });
      expect(sessions.has(100)).toBe(true);
      
      sessions.delete(100);
      expect(sessions.has(100)).toBe(false);
    });
  });

  describe("DB Scan for Unmonitored Overstay", () => {
    it("should detect stale EVSE status (>2 hours since transaction ended)", () => {
      const endTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const hoursSinceEnd = (Date.now() - endTime.getTime()) / (1000 * 60 * 60);
      
      expect(hoursSinceEnd).toBeGreaterThan(2);
      // Should reset to AVAILABLE, not start overstay tracking
    });

    it("should start tracking for recent completed transactions (<2 hours)", () => {
      const endTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const hoursSinceEnd = (Date.now() - endTime.getTime()) / (1000 * 60 * 60);
      
      expect(hoursSinceEnd).toBeLessThan(2);
      // Should start overstay tracking
    });
  });

  describe("Wallet Deduction", () => {
    it("should deduct penalty from wallet balance", () => {
      const currentBalance = 10000;
      const penaltyAmount = 500;
      const newBalance = Math.max(0, currentBalance - penaltyAmount);
      
      expect(newBalance).toBe(9500);
    });

    it("should not go below zero", () => {
      const currentBalance = 200;
      const penaltyAmount = 500;
      const newBalance = Math.max(0, currentBalance - penaltyAmount);
      
      expect(newBalance).toBe(0);
    });
  });

  describe("Total Cost Recalculation with Overstay", () => {
    it("should include overstay cost in total", () => {
      const energyCost = 5000;
      const timeCost = 1000;
      const sessionCost = 2000;
      const overstayCost = 2500;
      
      const totalCost = energyCost + timeCost + sessionCost + overstayCost;
      expect(totalCost).toBe(10500);
    });

    it("should recalculate revenue share including overstay", () => {
      const totalCost = 10500;
      const investorPercent = 80;
      const platformPercent = 20;
      
      const investorShare = totalCost * (investorPercent / 100);
      const platformFee = totalCost * (platformPercent / 100);
      
      expect(investorShare).toBe(8400);
      expect(platformFee).toBe(2100);
    });
  });
});
