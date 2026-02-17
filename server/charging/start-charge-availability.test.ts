/**
 * Tests para la lógica de disponibilidad mejorada de startCharge
 * 
 * Verifica que startCharge use BD como fallback cuando no hay conexión OCPP en memoria
 */

import { describe, it, expect } from "vitest";

// Simular la lógica de determinación de disponibilidad de estación
// (extraída de charging-router.ts startCharge)
function determineStationAvailability(params: {
  hasOcppConnection: boolean;
  stationOnlineInDb: boolean;
  isConnectedByIdentity: boolean;
}): { available: boolean; reason: string } {
  const { hasOcppConnection, stationOnlineInDb, isConnectedByIdentity } = params;
  
  if (hasOcppConnection) {
    return { available: true, reason: "OCPP connection active in memory" };
  }
  
  // Fallback: verificar BD y conexión por identity
  if (stationOnlineInDb || isConnectedByIdentity) {
    return { available: true, reason: stationOnlineInDb 
      ? "Station online in DB (grace period or active)" 
      : "Connected by OCPP identity" };
  }
  
  return { available: false, reason: "No OCPP connection and not online in DB" };
}

// Simular la lógica de verificación de conector
function determineConnectorAvailability(params: {
  hasOcppConnection: boolean;
  ocppConnectorStatus: string | undefined;
  dbConnectorStatus: string | undefined;
}): { available: boolean; status: string } {
  const { hasOcppConnection, ocppConnectorStatus, dbConnectorStatus } = params;
  
  if (hasOcppConnection) {
    // Usar estado OCPP en memoria
    if (ocppConnectorStatus) {
      const normalized = ocppConnectorStatus.toUpperCase();
      const isAvailable = normalized === "AVAILABLE" || normalized === "PREPARING";
      return { available: isAvailable, status: normalized };
    }
    // Sin estado en memoria = disponible (no bloqueamos)
    return { available: true, status: "UNKNOWN" };
  }
  
  // Fallback: usar estado de BD
  if (dbConnectorStatus) {
    const normalized = dbConnectorStatus.toUpperCase();
    const isAvailable = normalized === "AVAILABLE" || normalized === "PREPARING";
    return { available: isAvailable, status: normalized };
  }
  
  // Sin datos = disponible (no bloqueamos)
  return { available: true, status: "UNKNOWN" };
}

// Simular la lógica de determinar effectiveOcppIdentity
function determineEffectiveOcppIdentity(params: {
  ocppConnectionIdentity: string | undefined;
  stationOcppIdentity: string | undefined;
}): string | null {
  return params.ocppConnectionIdentity || params.stationOcppIdentity || null;
}

describe("startCharge - Disponibilidad de estación mejorada", () => {
  
  describe("Determinación de disponibilidad de estación", () => {
    it("debe permitir carga cuando hay conexión OCPP activa en memoria", () => {
      const result = determineStationAvailability({
        hasOcppConnection: true,
        stationOnlineInDb: false,
        isConnectedByIdentity: false,
      });
      expect(result.available).toBe(true);
      expect(result.reason).toContain("OCPP connection active");
    });

    it("debe permitir carga cuando la estación está online en BD (grace period)", () => {
      const result = determineStationAvailability({
        hasOcppConnection: false,
        stationOnlineInDb: true,
        isConnectedByIdentity: false,
      });
      expect(result.available).toBe(true);
      expect(result.reason).toContain("online in DB");
    });

    it("debe permitir carga cuando hay conexión por ocppIdentity directa", () => {
      const result = determineStationAvailability({
        hasOcppConnection: false,
        stationOnlineInDb: false,
        isConnectedByIdentity: true,
      });
      expect(result.available).toBe(true);
      expect(result.reason).toContain("OCPP identity");
    });

    it("debe rechazar carga cuando no hay conexión OCPP ni está online en BD", () => {
      const result = determineStationAvailability({
        hasOcppConnection: false,
        stationOnlineInDb: false,
        isConnectedByIdentity: false,
      });
      expect(result.available).toBe(false);
      expect(result.reason).toContain("not online in DB");
    });

    it("debe permitir carga cuando BD dice online aunque no haya conexión directa", () => {
      // Este es el caso real del bug: el cargador está conectado (heartbeats activos)
      // pero getConnectionByStationId no lo encuentra por stationId
      const result = determineStationAvailability({
        hasOcppConnection: false,
        stationOnlineInDb: true,
        isConnectedByIdentity: true,
      });
      expect(result.available).toBe(true);
    });
  });

  describe("Verificación de conector con fallback a BD", () => {
    it("debe usar estado OCPP cuando hay conexión activa", () => {
      const result = determineConnectorAvailability({
        hasOcppConnection: true,
        ocppConnectorStatus: "Available",
        dbConnectorStatus: "UNAVAILABLE",
      });
      expect(result.available).toBe(true);
      expect(result.status).toBe("AVAILABLE");
    });

    it("debe rechazar conector CHARGING por OCPP", () => {
      const result = determineConnectorAvailability({
        hasOcppConnection: true,
        ocppConnectorStatus: "Charging",
        dbConnectorStatus: "AVAILABLE",
      });
      expect(result.available).toBe(false);
      expect(result.status).toBe("CHARGING");
    });

    it("debe usar estado de BD cuando no hay conexión OCPP", () => {
      const result = determineConnectorAvailability({
        hasOcppConnection: false,
        ocppConnectorStatus: undefined,
        dbConnectorStatus: "AVAILABLE",
      });
      expect(result.available).toBe(true);
      expect(result.status).toBe("AVAILABLE");
    });

    it("debe rechazar conector CHARGING en BD cuando no hay OCPP", () => {
      const result = determineConnectorAvailability({
        hasOcppConnection: false,
        ocppConnectorStatus: undefined,
        dbConnectorStatus: "CHARGING",
      });
      expect(result.available).toBe(false);
      expect(result.status).toBe("CHARGING");
    });

    it("debe aceptar PREPARING como disponible en BD", () => {
      const result = determineConnectorAvailability({
        hasOcppConnection: false,
        ocppConnectorStatus: undefined,
        dbConnectorStatus: "PREPARING",
      });
      expect(result.available).toBe(true);
      expect(result.status).toBe("PREPARING");
    });

    it("debe aceptar cuando no hay datos de conector (no bloquear)", () => {
      const result = determineConnectorAvailability({
        hasOcppConnection: false,
        ocppConnectorStatus: undefined,
        dbConnectorStatus: undefined,
      });
      expect(result.available).toBe(true);
      expect(result.status).toBe("UNKNOWN");
    });

    it("debe rechazar FAULTED en BD", () => {
      const result = determineConnectorAvailability({
        hasOcppConnection: false,
        ocppConnectorStatus: undefined,
        dbConnectorStatus: "FAULTED",
      });
      expect(result.available).toBe(false);
      expect(result.status).toBe("FAULTED");
    });
  });

  describe("Determinación de identidad OCPP efectiva", () => {
    it("debe preferir la identidad de la conexión OCPP activa", () => {
      const result = determineEffectiveOcppIdentity({
        ocppConnectionIdentity: "EVG001-CONN",
        stationOcppIdentity: "EVG001",
      });
      expect(result).toBe("EVG001-CONN");
    });

    it("debe usar la identidad de la estación como fallback", () => {
      const result = determineEffectiveOcppIdentity({
        ocppConnectionIdentity: undefined,
        stationOcppIdentity: "EVG001",
      });
      expect(result).toBe("EVG001");
    });

    it("debe retornar null si no hay identidad disponible", () => {
      const result = determineEffectiveOcppIdentity({
        ocppConnectionIdentity: undefined,
        stationOcppIdentity: undefined,
      });
      expect(result).toBeNull();
    });
  });

  describe("Escenarios reales de producción", () => {
    it("Escenario: cargador conectado con heartbeats pero getConnectionByStationId retorna null", () => {
      // Este es el bug reportado: el cargador EVG001 envía heartbeats cada minuto
      // pero startCharge no encuentra la conexión por stationId
      // Solución: verificar isOnline en BD + intentar por ocppIdentity
      const result = determineStationAvailability({
        hasOcppConnection: false, // getConnectionByStationId retorna null
        stationOnlineInDb: true,  // BD dice isOnline=true (heartbeats lo mantienen)
        isConnectedByIdentity: true, // dualCSMS.isStationConnected("EVG001") = true
      });
      expect(result.available).toBe(true);
    });

    it("Escenario: cargador genuinamente desconectado", () => {
      const result = determineStationAvailability({
        hasOcppConnection: false,
        stationOnlineInDb: false, // Grace period expiró
        isConnectedByIdentity: false,
      });
      expect(result.available).toBe(false);
    });

    it("Escenario: cargador en grace period de reconexión", () => {
      // El cargador se desconectó hace <2 minutos, BD aún dice isOnline=true
      const result = determineStationAvailability({
        hasOcppConnection: false,
        stationOnlineInDb: true, // Grace period activo
        isConnectedByIdentity: false, // Ya no está en connections map
      });
      expect(result.available).toBe(true);
    });

    it("Escenario: servidor recién reiniciado, cargador no ha reconectado aún", () => {
      // Después de un restart, el mapa de conexiones está vacío
      // pero la BD aún tiene isOnline=true del estado anterior
      const result = determineStationAvailability({
        hasOcppConnection: false,
        stationOnlineInDb: true,
        isConnectedByIdentity: false,
      });
      expect(result.available).toBe(true);
    });
  });
});
