import { describe, it, expect } from "vitest";

/**
 * Tests para la lógica de disponibilidad de estación al escanear QR
 * 
 * La estación se considera online si:
 * 1. Tiene conexión OCPP activa (WebSocket abierto), O
 * 2. Está marcada como online en la BD (grace period), O
 * 3. Está activa Y tiene al menos un conector disponible en la BD
 */

describe("Station QR Availability Logic", () => {
  // Simular la lógica de isOnline del endpoint getStationByCode
  function calculateIsOnline(params: {
    isOcppConnected: boolean;
    stationIsOnline: boolean;
    stationIsActive: boolean;
    connectorStatuses: string[];
  }): boolean {
    const { isOcppConnected, stationIsOnline, stationIsActive, connectorStatuses } = params;
    const hasAvailableConnector = connectorStatuses.some(s => s === 'AVAILABLE');
    return isOcppConnected || stationIsOnline || (stationIsActive && hasAvailableConnector);
  }

  it("should be online when OCPP WebSocket is connected", () => {
    expect(calculateIsOnline({
      isOcppConnected: true,
      stationIsOnline: false,
      stationIsActive: true,
      connectorStatuses: ["UNAVAILABLE"],
    })).toBe(true);
  });

  it("should be online when station is marked online in DB (grace period)", () => {
    expect(calculateIsOnline({
      isOcppConnected: false,
      stationIsOnline: true,
      stationIsActive: true,
      connectorStatuses: ["UNAVAILABLE"],
    })).toBe(true);
  });

  it("should be online when station is active and has available connector", () => {
    expect(calculateIsOnline({
      isOcppConnected: false,
      stationIsOnline: false,
      stationIsActive: true,
      connectorStatuses: ["AVAILABLE"],
    })).toBe(true);
  });

  it("should be online when station is active and has mixed connector statuses", () => {
    expect(calculateIsOnline({
      isOcppConnected: false,
      stationIsOnline: false,
      stationIsActive: true,
      connectorStatuses: ["CHARGING", "AVAILABLE", "UNAVAILABLE"],
    })).toBe(true);
  });

  it("should be offline when no OCPP, not online in DB, and no available connectors", () => {
    expect(calculateIsOnline({
      isOcppConnected: false,
      stationIsOnline: false,
      stationIsActive: true,
      connectorStatuses: ["UNAVAILABLE", "FAULTED"],
    })).toBe(false);
  });

  it("should be offline when station is inactive even with available connectors", () => {
    expect(calculateIsOnline({
      isOcppConnected: false,
      stationIsOnline: false,
      stationIsActive: false,
      connectorStatuses: ["AVAILABLE"],
    })).toBe(false);
  });

  it("should be offline when everything is false/empty", () => {
    expect(calculateIsOnline({
      isOcppConnected: false,
      stationIsOnline: false,
      stationIsActive: false,
      connectorStatuses: [],
    })).toBe(false);
  });

  it("should be online when all conditions are true", () => {
    expect(calculateIsOnline({
      isOcppConnected: true,
      stationIsOnline: true,
      stationIsActive: true,
      connectorStatuses: ["AVAILABLE"],
    })).toBe(true);
  });

  it("should handle CHARGING connectors as not available but station can still be online via OCPP", () => {
    expect(calculateIsOnline({
      isOcppConnected: true,
      stationIsOnline: false,
      stationIsActive: true,
      connectorStatuses: ["CHARGING"],
    })).toBe(true);
  });

  it("should handle station with only RESERVED connectors as not available without OCPP", () => {
    expect(calculateIsOnline({
      isOcppConnected: false,
      stationIsOnline: false,
      stationIsActive: true,
      connectorStatuses: ["RESERVED"],
    })).toBe(false);
  });
});
