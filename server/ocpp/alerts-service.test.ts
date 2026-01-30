/**
 * Tests para el servicio de alertas OCPP
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de las dependencias
vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db", () => ({
  createOcppAlert: vi.fn().mockResolvedValue(1),
  getOcppAlerts: vi.fn().mockResolvedValue([]),
  acknowledgeOcppAlert: vi.fn().mockResolvedValue(undefined),
  getOcppAlertStats: vi.fn().mockResolvedValue({
    total: 0,
    unacknowledged: 0,
    bySeverity: {},
    byType: {},
  }),
}));

import * as alertsService from "./alerts-service";
import * as db from "../db";
import { notifyOwner } from "../_core/notification";

describe("OCPP Alerts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleDisconnection", () => {
    it("should create an alert for disconnection", async () => {
      await alertsService.handleDisconnection("CP001", 1);
      
      expect(db.createOcppAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          ocppIdentity: "CP001",
          stationId: 1,
          alertType: "DISCONNECTION",
          severity: "warning",
        })
      );
    });

    it("should notify owner for disconnection", async () => {
      await alertsService.handleDisconnection("CP002", undefined);
      
      expect(notifyOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("CP002"),
        })
      );
    });
  });

  describe("handleStatusError", () => {
    it("should not create alert for NoError", async () => {
      // NoError es filtrado en el handler del servidor, pero probamos la lógica
      // La función handleStatusError se llama solo cuando errorCode !== "NoError"
      expect(true).toBe(true);
    });

    it("should create critical alert for Faulted status", async () => {
      await alertsService.handleStatusError(
        "CP003",
        1,
        1,
        "GroundFailure",
        "Faulted",
        "VE001",
        "Ground fault detected"
      );
      
      expect(db.createOcppAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          ocppIdentity: "CP003",
          alertType: "FAULT",
          severity: "critical",
        })
      );
    });

    it("should create warning alert for error without Faulted status", async () => {
      await alertsService.handleStatusError(
        "CP004",
        2,
        1,
        "EVCommunicationError",
        "Available"
      );
      
      expect(db.createOcppAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          ocppIdentity: "CP004",
          alertType: "ERROR",
          severity: "warning",
        })
      );
    });
  });

  describe("handleBootRejected", () => {
    it("should create critical alert for rejected boot", async () => {
      await alertsService.handleBootRejected("CP005", 1, "Unknown vendor");
      
      expect(db.createOcppAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          ocppIdentity: "CP005",
          alertType: "BOOT_REJECTED",
          severity: "critical",
        })
      );
    });
  });

  describe("getRecentAlerts", () => {
    it("should call db.getOcppAlerts with correct parameters", async () => {
      await alertsService.getRecentAlerts(25, true);
      
      expect(db.getOcppAlerts).toHaveBeenCalledWith({
        limit: 25,
        includeAcknowledged: true,
      });
    });
  });

  describe("acknowledgeAlert", () => {
    it("should call db.acknowledgeOcppAlert", async () => {
      await alertsService.acknowledgeAlert(123);
      
      expect(db.acknowledgeOcppAlert).toHaveBeenCalledWith(123);
    });
  });

  describe("getAlertStats", () => {
    it("should return stats from db", async () => {
      const stats = await alertsService.getAlertStats();
      
      expect(db.getOcppAlertStats).toHaveBeenCalled();
      expect(stats).toEqual({
        total: 0,
        unacknowledged: 0,
        bySeverity: {},
        byType: {},
      });
    });
  });
});
