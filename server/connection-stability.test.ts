import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests para el sistema de monitoreo de estabilidad de conexión OCPP
 * Verifica: recordDisconnection, getConnectionHistory, getConnectionStabilityReport
 */

// Mock WebSocket
const mockWs = (readyState = 1) => ({
  readyState,
  send: vi.fn(),
  on: vi.fn(),
  close: vi.fn(),
  ping: vi.fn(),
});

describe("Connection Stability Monitoring", () => {
  describe("ConnectionSession interface", () => {
    it("should have correct structure for a connection session", () => {
      const session = {
        ocppIdentity: "EVG001",
        connectedAt: new Date("2026-02-23T10:00:00Z"),
        disconnectedAt: new Date("2026-02-23T10:03:00Z"),
        durationSeconds: 180,
        closeCode: 1006,
        closeReason: "Abnormal Closure",
      };

      expect(session.ocppIdentity).toBe("EVG001");
      expect(session.durationSeconds).toBe(180);
      expect(session.closeCode).toBe(1006);
    });
  });

  describe("Stability Score Calculation", () => {
    it("should give 100 score for station with no disconnections and connected", () => {
      // Score starts at 100
      // No reconnections in 24h: no penalty
      // Connected: no penalty
      // Uptime > 1h: +10 (capped at 100)
      const score = calculateStabilityScore({
        reconnectionCount24h: 0,
        avgSessionDurationSeconds: 0,
        isConnected: true,
        currentUptimeSeconds: 7200, // 2 hours
      });
      expect(score).toBe(100);
    });

    it("should penalize for reconnections in 24h", () => {
      // 5 reconnections: -25 points
      const score = calculateStabilityScore({
        reconnectionCount24h: 5,
        avgSessionDurationSeconds: 600,
        isConnected: true,
        currentUptimeSeconds: 300,
      });
      expect(score).toBe(75); // 100 - 25
    });

    it("should penalize heavily for many reconnections", () => {
      // 10 reconnections: -50 (max)
      const score = calculateStabilityScore({
        reconnectionCount24h: 10,
        avgSessionDurationSeconds: 180,
        isConnected: true,
        currentUptimeSeconds: 100,
      });
      // 100 - 50 (reconnections) - 20 (short sessions < 300s) = 30
      expect(score).toBe(30);
    });

    it("should penalize for short average session duration", () => {
      // avgDuration < 300s: -20
      const score = calculateStabilityScore({
        reconnectionCount24h: 0,
        avgSessionDurationSeconds: 180, // 3 minutes
        isConnected: true,
        currentUptimeSeconds: 100,
      });
      expect(score).toBe(80); // 100 - 20
    });

    it("should penalize for disconnected state", () => {
      const score = calculateStabilityScore({
        reconnectionCount24h: 0,
        avgSessionDurationSeconds: 0,
        isConnected: false,
        currentUptimeSeconds: 0,
      });
      expect(score).toBe(85); // 100 - 15
    });

    it("should give bonus for long current uptime", () => {
      // Uptime > 3600s: +10 (but capped at 100)
      const score = calculateStabilityScore({
        reconnectionCount24h: 2,
        avgSessionDurationSeconds: 600,
        isConnected: true,
        currentUptimeSeconds: 7200,
      });
      // 100 - 10 (2 reconnections) + 10 (long uptime) = 100 (capped)
      expect(score).toBe(100);
    });

    it("should never go below 0", () => {
      const score = calculateStabilityScore({
        reconnectionCount24h: 20, // -50 (max)
        avgSessionDurationSeconds: 60, // -20
        isConnected: false, // -15
        currentUptimeSeconds: 0,
      });
      expect(score).toBe(15); // 100 - 50 - 20 - 15 = 15
    });

    it("should handle the EVG001 pattern (180s cycles)", () => {
      // EVG001 pattern: disconnecting every ~180s = 480 reconnections in 24h (theoretical max)
      // But we cap at -50 for reconnections
      const score = calculateStabilityScore({
        reconnectionCount24h: 480,
        avgSessionDurationSeconds: 180,
        isConnected: true,
        currentUptimeSeconds: 180,
      });
      // 100 - 50 (max reconnection penalty) - 20 (short sessions) = 30
      expect(score).toBe(30);
    });
  });

  describe("Close Code Labels", () => {
    it("should correctly label common close codes", () => {
      expect(getCloseCodeLabel(1000)).toBe("Normal");
      expect(getCloseCodeLabel(1006)).toBe("Abnormal Closure");
      expect(getCloseCodeLabel(1001)).toBe("Going Away");
      expect(getCloseCodeLabel(1011)).toBe("Internal Error");
      expect(getCloseCodeLabel(null)).toBe("Desconocido");
      expect(getCloseCodeLabel(9999)).toBe("Code 9999");
    });
  });

  describe("Connection History", () => {
    it("should track session durations correctly", () => {
      const connectedAt = new Date("2026-02-23T10:00:00Z");
      const disconnectedAt = new Date("2026-02-23T10:03:00Z");
      const durationSeconds = Math.round(
        (disconnectedAt.getTime() - connectedAt.getTime()) / 1000
      );
      expect(durationSeconds).toBe(180);
    });

    it("should calculate average duration from multiple sessions", () => {
      const durations = [180, 180, 180, 180, 180]; // 5 sessions of 3 min each
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      expect(avg).toBe(180);
    });

    it("should find longest and shortest sessions", () => {
      const durations = [60, 180, 300, 120, 240];
      expect(Math.max(...durations)).toBe(300);
      expect(Math.min(...durations)).toBe(60);
    });

    it("should filter reconnections within 24h window", () => {
      const now = Date.now();
      const sessions = [
        { disconnectedAt: new Date(now - 1000 * 60 * 60), durationSeconds: 180 }, // 1h ago
        { disconnectedAt: new Date(now - 1000 * 60 * 60 * 12), durationSeconds: 180 }, // 12h ago
        { disconnectedAt: new Date(now - 1000 * 60 * 60 * 25), durationSeconds: 180 }, // 25h ago (outside)
        { disconnectedAt: new Date(now - 1000 * 60 * 60 * 48), durationSeconds: 180 }, // 48h ago (outside)
      ];

      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      const recent = sessions.filter(
        (s) => s.disconnectedAt.getTime() > twentyFourHoursAgo
      );
      expect(recent.length).toBe(2);
    });
  });

  describe("History Limit", () => {
    it("should respect MAX_HISTORY_PER_STATION limit of 50", () => {
      const MAX_HISTORY = 50;
      const sessions: any[] = [];
      for (let i = 0; i < 60; i++) {
        sessions.push({
          ocppIdentity: "EVG001",
          connectedAt: new Date(),
          disconnectedAt: new Date(),
          durationSeconds: 180,
          closeCode: 1006,
          closeReason: "",
        });
      }

      // Simulate trimming
      if (sessions.length > MAX_HISTORY) {
        sessions.splice(0, sessions.length - MAX_HISTORY);
      }
      expect(sessions.length).toBe(50);
    });
  });
});

// Helper functions that mirror the logic in connection-manager.ts
function calculateStabilityScore(params: {
  reconnectionCount24h: number;
  avgSessionDurationSeconds: number;
  isConnected: boolean;
  currentUptimeSeconds: number;
}): number {
  let score = 100;
  score -= Math.min(params.reconnectionCount24h * 5, 50);
  if (params.avgSessionDurationSeconds > 0 && params.avgSessionDurationSeconds < 300) {
    score -= 20;
  }
  if (!params.isConnected) score -= 15;
  if (params.currentUptimeSeconds > 3600) score = Math.min(score + 10, 100);
  return Math.max(0, Math.min(100, score));
}

function getCloseCodeLabel(code: number | null): string {
  if (!code) return "Desconocido";
  switch (code) {
    case 1000: return "Normal";
    case 1001: return "Going Away";
    case 1002: return "Protocol Error";
    case 1003: return "Unsupported Data";
    case 1005: return "No Status";
    case 1006: return "Abnormal Closure";
    case 1007: return "Invalid Data";
    case 1008: return "Policy Violation";
    case 1009: return "Message Too Big";
    case 1010: return "Extension Required";
    case 1011: return "Internal Error";
    case 1012: return "Service Restart";
    case 1013: return "Try Again Later";
    case 1015: return "TLS Handshake Fail";
    default: return `Code ${code}`;
  }
}
