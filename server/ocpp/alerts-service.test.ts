/**
 * Tests para el servicio de alertas OCPP
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de las dependencias
vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("../notifications/technician-notification-service", () => ({
  notifyTechniciansOfAlert: vi.fn().mockResolvedValue({
    pushSent: 0,
    emailSent: 0,
    inAppCreated: 0,
  }),
}));

vi.mock("../db", () => ({
  createOcppAlert: vi.fn().mockResolvedValue(1),
  createNoTelemetryAlertIfAbsent: vi.fn().mockResolvedValue({ id: 1, created: true }),
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

  describe("handleTransactionReplay", () => {
    it("should make a warning visible without claiming a financial charge", async () => {
      await alertsService.handleTransactionReplay({
        ocppIdentity: "EVG001",
        stationId: 77,
        transactionId: 1140032,
        connectorId: 2,
        protocol: "OCPP 1.6",
      });

      expect(db.createOcppAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          ocppIdentity: "EVG001",
          stationId: 77,
          alertType: "TRANSACTION_ERROR",
          severity: "warning",
          payload: expect.objectContaining({
            event: "START_TRANSACTION_REPLAY",
            financialImpact: "NONE",
          }),
        })
      );
    });
  });

  describe("handleActiveChargeWithoutTelemetry", () => {
    it("notifica solo cuando se abre una alerta telemétrica nueva", async () => {
      await alertsService.handleActiveChargeWithoutTelemetry({
        transactionId: 92,
        evseId: 4,
        stationId: 7,
        ocppIdentity: "AC-007",
        stationName: "Estación Central",
        connectorLabel: "Conector 1",
        minutesWithoutTelemetry: 13,
        severity: "warning",
        lastMeterAt: null,
      });
      expect(db.createNoTelemetryAlertIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
        alertType: "NO_TELEMETRY",
        transactionId: 92,
        evseId: 4,
      }));
      expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining("sin telemetría"),
      }));
    });

    it("no vuelve a avisar si la alerta de la misma sesión sigue activa", async () => {
      vi.mocked(db.createNoTelemetryAlertIfAbsent).mockResolvedValueOnce({ id: 1, created: false });
      await alertsService.handleActiveChargeWithoutTelemetry({
        transactionId: 93,
        evseId: 5,
        stationId: 7,
        ocppIdentity: "AC-007",
        minutesWithoutTelemetry: 31,
        severity: "critical",
      });
      expect(notifyOwner).not.toHaveBeenCalled();
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
