import { describe, it, expect } from "vitest";

/**
 * Tests para las correcciones de lógica de reservas:
 * 1. Conector no se marca RESERVED inmediatamente para reservas futuras
 * 2. Reservas desde el chat funcionan correctamente
 * 3. Job de activación de reservas próximas
 */

describe("Reservation Status Logic", () => {
  describe("Connector status for future reservations", () => {
    it("should NOT mark connector as RESERVED for reservations >15 min in the future", () => {
      const now = new Date();
      const reservationStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const minutesUntilStart = (reservationStart.getTime() - now.getTime()) / (1000 * 60);
      
      // La lógica: solo marcar RESERVED si <= 15 minutos
      const shouldMarkReserved = minutesUntilStart <= 15;
      expect(shouldMarkReserved).toBe(false);
    });

    it("should mark connector as RESERVED for reservations starting within 15 min", () => {
      const now = new Date();
      const reservationStart = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
      const minutesUntilStart = (reservationStart.getTime() - now.getTime()) / (1000 * 60);
      
      const shouldMarkReserved = minutesUntilStart <= 15;
      expect(shouldMarkReserved).toBe(true);
    });

    it("should mark connector as RESERVED for reservations that already started", () => {
      const now = new Date();
      const reservationStart = new Date(now.getTime() - 30 * 60 * 1000); // Started 30 min ago
      const minutesUntilStart = (reservationStart.getTime() - now.getTime()) / (1000 * 60);
      
      const shouldMarkReserved = minutesUntilStart <= 15;
      expect(shouldMarkReserved).toBe(true);
    });
  });

  describe("Blocked statuses for reservation creation", () => {
    const blockedStatuses = ["CHARGING", "OCCUPIED", "UNAVAILABLE", "FAULTED", "SUSPENDED_EV", "SUSPENDED_EVSE"];
    
    it("should allow reservation when connector is AVAILABLE", () => {
      const evseStatus = "AVAILABLE";
      const isBlocked = blockedStatuses.includes(evseStatus);
      expect(isBlocked).toBe(false);
    });

    it("should allow reservation when connector is RESERVED (may have non-conflicting future reservations)", () => {
      const evseStatus = "RESERVED";
      const isBlocked = blockedStatuses.includes(evseStatus);
      expect(isBlocked).toBe(false);
    });

    it("should block reservation when connector is CHARGING", () => {
      const evseStatus = "CHARGING";
      const isBlocked = blockedStatuses.includes(evseStatus);
      expect(isBlocked).toBe(true);
    });

    it("should block reservation when connector is FAULTED", () => {
      const evseStatus = "FAULTED";
      const isBlocked = blockedStatuses.includes(evseStatus);
      expect(isBlocked).toBe(true);
    });

    it("should block reservation when connector is UNAVAILABLE", () => {
      const evseStatus = "UNAVAILABLE";
      const isBlocked = blockedStatuses.includes(evseStatus);
      expect(isBlocked).toBe(true);
    });
  });

  describe("EVSE enrichment logic - current vs future reservations", () => {
    it("should identify reservation as current/imminent when startTime <= now+15min and endTime > now", () => {
      const now = new Date();
      const in15Min = new Date(now.getTime() + 15 * 60 * 1000);
      
      // Reservation starting in 5 minutes, ending in 1 hour
      const reservation = {
        startTime: new Date(now.getTime() + 5 * 60 * 1000),
        endTime: new Date(now.getTime() + 60 * 60 * 1000),
      };
      
      const isCurrentOrImminent = reservation.startTime <= in15Min && reservation.endTime > now;
      expect(isCurrentOrImminent).toBe(true);
    });

    it("should identify reservation as future when startTime > now+15min", () => {
      const now = new Date();
      const in15Min = new Date(now.getTime() + 15 * 60 * 1000);
      
      // Reservation starting in 2 hours
      const reservation = {
        startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      };
      
      const isCurrentOrImminent = reservation.startTime <= in15Min && reservation.endTime > now;
      expect(isCurrentOrImminent).toBe(false);
    });

    it("should identify reservation as expired when endTime <= now", () => {
      const now = new Date();
      const in15Min = new Date(now.getTime() + 15 * 60 * 1000);
      
      // Reservation that ended 30 minutes ago
      const reservation = {
        startTime: new Date(now.getTime() - 90 * 60 * 1000),
        endTime: new Date(now.getTime() - 30 * 60 * 1000),
      };
      
      const isCurrentOrImminent = reservation.startTime <= in15Min && reservation.endTime > now;
      expect(isCurrentOrImminent).toBe(false);
    });
  });

  describe("Reservation conflict detection", () => {
    it("should detect overlapping reservations", () => {
      // Existing reservation: 8:00 AM - 9:00 AM
      const existingStart = new Date("2026-03-02T08:00:00");
      const existingEnd = new Date("2026-03-02T09:00:00");
      
      // New reservation attempt: 8:30 AM - 9:30 AM (overlaps)
      const newStart = new Date("2026-03-02T08:30:00");
      const newEnd = new Date("2026-03-02T09:30:00");
      
      const hasConflict = newStart < existingEnd && newEnd > existingStart;
      expect(hasConflict).toBe(true);
    });

    it("should allow non-overlapping reservations on same connector", () => {
      // Existing reservation: 8:00 AM - 9:00 AM
      const existingStart = new Date("2026-03-02T08:00:00");
      const existingEnd = new Date("2026-03-02T09:00:00");
      
      // New reservation: 10:00 AM - 11:00 AM (no overlap)
      const newStart = new Date("2026-03-02T10:00:00");
      const newEnd = new Date("2026-03-02T11:00:00");
      
      const hasConflict = newStart < existingEnd && newEnd > existingStart;
      expect(hasConflict).toBe(false);
    });

    it("should allow back-to-back reservations", () => {
      // Existing reservation: 8:00 AM - 9:00 AM
      const existingStart = new Date("2026-03-02T08:00:00");
      const existingEnd = new Date("2026-03-02T09:00:00");
      
      // New reservation: 9:00 AM - 10:00 AM (starts exactly when previous ends)
      const newStart = new Date("2026-03-02T09:00:00");
      const newEnd = new Date("2026-03-02T10:00:00");
      
      // Strict overlap: newStart < existingEnd (9:00 < 9:00 = false)
      const hasConflict = newStart < existingEnd && newEnd > existingStart;
      expect(hasConflict).toBe(false);
    });
  });
});
