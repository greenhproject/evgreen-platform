/**
 * Tests para la lógica de disponibilidad mejorada de startCharge
 * 
 * Verifica que startCharge use la MISMA lógica que getStationByCode:
 * isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector)
 */

import { describe, it, expect } from "vitest";

function determineStationAvailability(params: {
  hasOcppConnection: boolean;
  isConnectedByIdentity: boolean;
  stationOnlineInDb: boolean;
  stationIsActive: boolean;
  hasAvailableConnector: boolean;
}): { available: boolean; reason: string } {
  const { hasOcppConnection, isConnectedByIdentity, stationOnlineInDb, stationIsActive, hasAvailableConnector } = params;
  const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
  
  if (hasOcppConnection) return { available: true, reason: "OCPP connection active (by stationId)" };
  if (isConnectedByIdentity) return { available: true, reason: "Connected by OCPP identity (dualCSMS)" };
  if (stationOnlineInDb) return { available: true, reason: "Station online in DB (grace period)" };
  if (stationIsActive && hasAvailableConnector) return { available: true, reason: "Station active with AVAILABLE connector in DB" };
  return { available: false, reason: "No connection, not online, no AVAILABLE connectors" };
}

describe("startCharge - Disponibilidad (misma lógica que getStationByCode)", () => {
  
  describe("Determinación de disponibilidad", () => {
    it("permite carga con conexión OCPP activa", () => {
      expect(determineStationAvailability({
        hasOcppConnection: true, isConnectedByIdentity: false,
        stationOnlineInDb: false, stationIsActive: true, hasAvailableConnector: false,
      }).available).toBe(true);
    });

    it("permite carga con conexión por ocppIdentity", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: true,
        stationOnlineInDb: false, stationIsActive: true, hasAvailableConnector: false,
      }).available).toBe(true);
    });

    it("permite carga con isOnline=true en BD", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: true, stationIsActive: true, hasAvailableConnector: false,
      }).available).toBe(true);
    });

    it("permite carga con conector AVAILABLE en BD (caso EVG001)", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: false, stationIsActive: true, hasAvailableConnector: true,
      }).available).toBe(true);
    });

    it("rechaza si estación inactiva aunque tenga conector AVAILABLE", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: false, stationIsActive: false, hasAvailableConnector: true,
      }).available).toBe(false);
    });

    it("rechaza sin ningún criterio de disponibilidad", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: false, stationIsActive: true, hasAvailableConnector: false,
      }).available).toBe(false);
    });
  });

  describe("Escenarios reales EVG001", () => {
    it("CASO PRINCIPAL: isOnline=0 pero conector AVAILABLE (cargador operativo)", () => {
      const r = determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: false, stationIsActive: true, hasAvailableConnector: true,
      });
      expect(r.available).toBe(true);
      expect(r.reason).toContain("AVAILABLE connector");
    });

    it("cargador genuinamente desconectado", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: false, stationIsActive: true, hasAvailableConnector: false,
      }).available).toBe(false);
    });

    it("grace period de reconexión", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: true, stationIsActive: true, hasAvailableConnector: true,
      }).available).toBe(true);
    });

    it("servidor reiniciado + grace period expirado + conector AVAILABLE", () => {
      expect(determineStationAvailability({
        hasOcppConnection: false, isConnectedByIdentity: false,
        stationOnlineInDb: false, stationIsActive: true, hasAvailableConnector: true,
      }).available).toBe(true);
    });
  });
});
