/**
 * Módulo OCPI 2.2.1 - Reporte Automático a UPME
 * 
 * Este módulo implementa el cliente OCPI 2.2.1 para el reporte automático
 * de información de estaciones de carga a la UPME (Unidad de Planeación Minero Energética).
 * 
 * Cumple con la Resolución 40559 de 2025 del Ministerio de Minas y Energía de Colombia.
 * 
 * Requisitos normativos:
 * - Reporte cada 60 segundos
 * - Formato JSON según OCPI 2.2.1
 * - Autenticación JWT
 * - Información requerida: estado, ubicación, conectores, precios, horarios, energía
 */

import * as db from "../db";

// ============================================================================
// TYPES - OCPI 2.2.1 Data Structures
// ============================================================================

interface OCPILocation {
  country_code: string;
  party_id: string;
  id: string;
  publish: boolean;
  name: string;
  address: string;
  city: string;
  postal_code?: string;
  country: string;
  coordinates: {
    latitude: string;
    longitude: string;
  };
  evses: OCPIEVSE[];
  operator?: {
    name: string;
    website?: string;
    logo?: {
      url: string;
      category: string;
      type: string;
    };
  };
  opening_times?: {
    twentyfourseven: boolean;
    regular_hours?: Array<{
      weekday: number;
      period_begin: string;
      period_end: string;
    }>;
  };
  time_zone: string;
  last_updated: string;
}

interface OCPIEVSE {
  uid: string;
  evse_id: string;
  status: OCPIStatus;
  capabilities: string[];
  connectors: OCPIConnector[];
  floor_level?: string;
  physical_reference?: string;
  last_updated: string;
}

interface OCPIConnector {
  id: string;
  standard: OCPIConnectorType;
  format: "SOCKET" | "CABLE";
  power_type: "AC_1_PHASE" | "AC_3_PHASE" | "DC";
  max_voltage: number;
  max_amperage: number;
  max_electric_power: number;
  tariff_ids?: string[];
  last_updated: string;
}

type OCPIStatus = 
  | "AVAILABLE"
  | "BLOCKED"
  | "CHARGING"
  | "INOPERATIVE"
  | "OUTOFORDER"
  | "PLANNED"
  | "REMOVED"
  | "RESERVED"
  | "UNKNOWN";

type OCPIConnectorType =
  | "IEC_62196_T2"      // Tipo 2
  | "IEC_62196_T2_COMBO" // CCS Combo 2
  | "CHADEMO"
  | "IEC_62196_T1"      // Tipo 1
  | "IEC_62196_T1_COMBO";

interface OCPITariff {
  country_code: string;
  party_id: string;
  id: string;
  currency: string;
  elements: Array<{
    price_components: Array<{
      type: "ENERGY" | "FLAT" | "PARKING_TIME" | "TIME";
      price: number;
      step_size: number;
    }>;
  }>;
  last_updated: string;
}

interface OCPISession {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time?: string;
  kwh: number;
  auth_method: string;
  location: {
    id: string;
    name: string;
  };
  evse_uid: string;
  connector_id: string;
  currency: string;
  total_cost?: number;
  status: "ACTIVE" | "COMPLETED" | "INVALID" | "PENDING";
  last_updated: string;
}

interface UPMECredentials {
  apiKey: string;
  apiUrl: string;
  partyId: string;
  countryCode: string;
}

// ============================================================================
// UPME REPORTER CLASS
// ============================================================================

export class UPMEReporter {
  private credentials: UPMECredentials | null = null;
  private jwtToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private reportInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private reportIntervalMs: number = 60000; // 60 segundos según normativa

  constructor() {
    // Las credenciales se configuran mediante setCredentials
  }

  /**
   * Configura las credenciales de acceso a la UPME
   */
  setCredentials(credentials: UPMECredentials): void {
    this.credentials = credentials;
    console.log("[OCPI] Credentials configured for UPME reporting");
  }

  /**
   * Inicia el reporte automático cada 60 segundos
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[OCPI] Reporter already running");
      return;
    }

    if (!this.credentials) {
      console.warn("[OCPI] Cannot start reporter: credentials not configured");
      return;
    }

    this.isRunning = true;
    console.log("[OCPI] Starting UPME reporter (interval: 60s)");

    // Ejecutar reporte inicial
    await this.sendReport();

    // Configurar intervalo de 60 segundos
    this.reportInterval = setInterval(async () => {
      await this.sendReport();
    }, this.reportIntervalMs);
  }

  /**
   * Detiene el reporte automático
   */
  stop(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
    this.isRunning = false;
    console.log("[OCPI] UPME reporter stopped");
  }

  /**
   * Obtiene un token JWT de la UPME
   */
  private async getJWTToken(): Promise<string | null> {
    if (!this.credentials) return null;

    // Verificar si el token actual sigue siendo válido
    if (this.jwtToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.jwtToken;
    }

    try {
      // Solicitar nuevo token a la UPME
      const response = await fetch(`${this.credentials.apiUrl}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.credentials.apiKey,
        },
        body: JSON.stringify({
          party_id: this.credentials.partyId,
          country_code: this.credentials.countryCode,
        }),
      });

      if (!response.ok) {
        console.error("[OCPI] Failed to get JWT token:", response.status);
        return null;
      }

      const data = await response.json();
      this.jwtToken = data.token;
      // Token válido por 1 hora (ajustar según especificación UPME)
      this.tokenExpiry = new Date(Date.now() + 3600000);

      console.log("[OCPI] JWT token obtained successfully");
      return this.jwtToken;
    } catch (error) {
      console.error("[OCPI] Error getting JWT token:", error);
      return null;
    }
  }

  /**
   * Envía el reporte completo a la UPME
   */
  async sendReport(): Promise<boolean> {
    if (!this.credentials) {
      console.warn("[OCPI] Cannot send report: credentials not configured");
      return false;
    }

    try {
      console.log("[OCPI] Preparing UPME report...");

      // Obtener token JWT
      const token = await this.getJWTToken();
      if (!token) {
        console.error("[OCPI] Cannot send report: no valid token");
        return false;
      }

      // Obtener datos de todas las estaciones
      const locations = await this.buildLocationsPayload();
      const tariffs = await this.buildTariffsPayload();

      // Enviar reporte de ubicaciones
      const locationsResponse = await fetch(
        `${this.credentials.apiUrl}/ocpi/cpo/2.2.1/locations`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Token ${token}`,
            "X-Request-ID": this.generateRequestId(),
            "X-Correlation-ID": this.generateCorrelationId(),
          },
          body: JSON.stringify({
            data: locations,
            status_code: 1000,
            status_message: "Success",
            timestamp: new Date().toISOString(),
          }),
        }
      );

      if (!locationsResponse.ok) {
        console.error("[OCPI] Failed to send locations report:", locationsResponse.status);
        return false;
      }

      // Enviar reporte de tarifas
      const tariffsResponse = await fetch(
        `${this.credentials.apiUrl}/ocpi/cpo/2.2.1/tariffs`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Token ${token}`,
            "X-Request-ID": this.generateRequestId(),
            "X-Correlation-ID": this.generateCorrelationId(),
          },
          body: JSON.stringify({
            data: tariffs,
            status_code: 1000,
            status_message: "Success",
            timestamp: new Date().toISOString(),
          }),
        }
      );

      if (!tariffsResponse.ok) {
        console.error("[OCPI] Failed to send tariffs report:", tariffsResponse.status);
        return false;
      }

      console.log(`[OCPI] Report sent successfully: ${locations.length} locations, ${tariffs.length} tariffs`);
      return true;
    } catch (error) {
      console.error("[OCPI] Error sending report:", error);
      return false;
    }
  }

  /**
   * Construye el payload de ubicaciones según OCPI 2.2.1
   */
  private async buildLocationsPayload(): Promise<OCPILocation[]> {
    const stations = await db.getAllChargingStations({ isActive: true, isPublic: true });
    const locations: OCPILocation[] = [];

    for (const station of stations) {
      const evses = await db.getEvsesByStationId(station.id);
      const tariff = await db.getActiveTariffByStationId(station.id);

      const ocpiEvses: OCPIEVSE[] = evses.map(evse => ({
        uid: `${station.id}-${evse.evseIdLocal}`,
        evse_id: `CO*GEV*E${station.id.toString().padStart(6, "0")}*${evse.evseIdLocal}`,
        status: this.mapStatusToOCPI(evse.status),
        capabilities: ["REMOTE_START_STOP_CAPABLE", "RESERVABLE"],
        connectors: [{
          id: evse.connectorId.toString(),
          standard: this.mapConnectorTypeToOCPI(evse.connectorType),
          format: "CABLE",
          power_type: evse.chargeType === "DC" ? "DC" : "AC_3_PHASE",
          max_voltage: evse.maxVoltage || (evse.chargeType === "DC" ? 500 : 400),
          max_amperage: evse.maxAmperage || Math.round(parseFloat(evse.powerKw) * 1000 / (evse.chargeType === "DC" ? 500 : 400)),
          max_electric_power: parseFloat(evse.powerKw) * 1000,
          tariff_ids: tariff ? [tariff.id.toString()] : undefined,
          last_updated: evse.lastStatusUpdate.toISOString(),
        }],
        last_updated: evse.lastStatusUpdate.toISOString(),
      }));

      // Parsear horarios de operación
      let openingTimes: OCPILocation["opening_times"] = { twentyfourseven: true };
      if (station.operatingHours) {
        const hours = station.operatingHours as Record<string, { open: string; close: string }>;
        const regularHours: Array<{ weekday: number; period_begin: string; period_end: string }> = [];
        
        const dayMap: Record<string, number> = {
          monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
          friday: 5, saturday: 6, sunday: 7
        };

        for (const [day, times] of Object.entries(hours)) {
          if (dayMap[day] && times.open && times.close) {
            regularHours.push({
              weekday: dayMap[day],
              period_begin: times.open,
              period_end: times.close,
            });
          }
        }

        if (regularHours.length > 0) {
          openingTimes = {
            twentyfourseven: false,
            regular_hours: regularHours,
          };
        }
      }

      locations.push({
        country_code: "CO",
        party_id: this.credentials?.partyId || "GEV",
        id: station.id.toString(),
        publish: true,
        name: station.name,
        address: station.address,
        city: station.city,
        postal_code: station.postalCode || undefined,
        country: "COL",
        coordinates: {
          latitude: station.latitude.toString(),
          longitude: station.longitude.toString(),
        },
        evses: ocpiEvses,
        operator: {
          name: "Green EV - Green House Project",
          website: "https://greenev.co",
        },
        opening_times: openingTimes,
        time_zone: "America/Bogota",
        last_updated: station.updatedAt.toISOString(),
      });
    }

    return locations;
  }

  /**
   * Construye el payload de tarifas según OCPI 2.2.1
   */
  private async buildTariffsPayload(): Promise<OCPITariff[]> {
    const stations = await db.getAllChargingStations({ isActive: true, isPublic: true });
    const tariffs: OCPITariff[] = [];
    const processedTariffs = new Set<number>();

    for (const station of stations) {
      const tariff = await db.getActiveTariffByStationId(station.id);
      if (!tariff || processedTariffs.has(tariff.id)) continue;

      processedTariffs.add(tariff.id);

      const priceComponents: Array<{ type: "ENERGY" | "FLAT" | "PARKING_TIME" | "TIME"; price: number; step_size: number }> = [];

      // Precio por kWh
      if (parseFloat(tariff.pricePerKwh) > 0) {
        priceComponents.push({
          type: "ENERGY",
          price: parseFloat(tariff.pricePerKwh) / 1000, // Convertir a precio por Wh para OCPI
          step_size: 1000, // 1 kWh
        });
      }

      // Precio por minuto
      if (tariff.pricePerMinute && parseFloat(tariff.pricePerMinute) > 0) {
        priceComponents.push({
          type: "TIME",
          price: parseFloat(tariff.pricePerMinute),
          step_size: 60, // 1 minuto
        });
      }

      // Cargo por sesión
      if (tariff.pricePerSession && parseFloat(tariff.pricePerSession) > 0) {
        priceComponents.push({
          type: "FLAT",
          price: parseFloat(tariff.pricePerSession),
          step_size: 1,
        });
      }

      // Penalización por tiempo excedido (parking time)
      if (tariff.overstayPenaltyPerMinute && parseFloat(tariff.overstayPenaltyPerMinute) > 0) {
        priceComponents.push({
          type: "PARKING_TIME",
          price: parseFloat(tariff.overstayPenaltyPerMinute),
          step_size: 60, // 1 minuto
        });
      }

      tariffs.push({
        country_code: "CO",
        party_id: this.credentials?.partyId || "GEV",
        id: tariff.id.toString(),
        currency: "COP",
        elements: [{
          price_components: priceComponents,
        }],
        last_updated: tariff.updatedAt.toISOString(),
      });
    }

    return tariffs;
  }

  /**
   * Mapea el estado interno al estado OCPI
   */
  private mapStatusToOCPI(status: string): OCPIStatus {
    const statusMap: Record<string, OCPIStatus> = {
      AVAILABLE: "AVAILABLE",
      PREPARING: "AVAILABLE",
      CHARGING: "CHARGING",
      SUSPENDED_EVSE: "BLOCKED",
      SUSPENDED_EV: "CHARGING",
      FINISHING: "CHARGING",
      RESERVED: "RESERVED",
      UNAVAILABLE: "INOPERATIVE",
      FAULTED: "OUTOFORDER",
    };
    return statusMap[status] || "UNKNOWN";
  }

  /**
   * Mapea el tipo de conector interno al estándar OCPI
   */
  private mapConnectorTypeToOCPI(connectorType: string): OCPIConnectorType {
    const typeMap: Record<string, OCPIConnectorType> = {
      TYPE_2: "IEC_62196_T2",
      CCS_2: "IEC_62196_T2_COMBO",
      CHADEMO: "CHADEMO",
      TYPE_1: "IEC_62196_T1",
    };
    return typeMap[connectorType] || "IEC_62196_T2";
  }

  /**
   * Genera un ID de solicitud único
   */
  private generateRequestId(): string {
    return `GEV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Genera un ID de correlación único
   */
  private generateCorrelationId(): string {
    return `COR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Envía un reporte de sesión de carga completada
   */
  async reportSession(transactionId: number): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const transaction = await db.getTransactionById(transactionId);
      if (!transaction) return false;

      const station = await db.getChargingStationById(transaction.stationId);
      const evse = await db.getEvseById(transaction.evseId);
      if (!station || !evse) return false;

      const token = await this.getJWTToken();
      if (!token) return false;

      const session: OCPISession = {
        country_code: "CO",
        party_id: this.credentials.partyId,
        id: transaction.id.toString(),
        start_date_time: transaction.startTime.toISOString(),
        end_date_time: transaction.endTime?.toISOString(),
        kwh: parseFloat(transaction.kwhConsumed || "0"),
        auth_method: transaction.startMethod || "APP_USER",
        location: {
          id: station.id.toString(),
          name: station.name,
        },
        evse_uid: `${station.id}-${evse.evseIdLocal}`,
        connector_id: evse.connectorId.toString(),
        currency: "COP",
        total_cost: parseFloat(transaction.totalCost || "0"),
        status: transaction.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
        last_updated: transaction.updatedAt.toISOString(),
      };

      const response = await fetch(
        `${this.credentials.apiUrl}/ocpi/cpo/2.2.1/sessions/${session.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Token ${token}`,
            "X-Request-ID": this.generateRequestId(),
            "X-Correlation-ID": this.generateCorrelationId(),
          },
          body: JSON.stringify({
            data: session,
            status_code: 1000,
            status_message: "Success",
            timestamp: new Date().toISOString(),
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error("[OCPI] Error reporting session:", error);
      return false;
    }
  }

  /**
   * Obtiene el estado actual del reporter
   */
  getStatus(): { isRunning: boolean; lastReport?: Date; credentials: boolean } {
    return {
      isRunning: this.isRunning,
      credentials: this.credentials !== null,
    };
  }
}

// Singleton instance
let reporterInstance: UPMEReporter | null = null;

export function getUPMEReporter(): UPMEReporter {
  if (!reporterInstance) {
    reporterInstance = new UPMEReporter();
  }
  return reporterInstance;
}

export async function startUPMEReporter(credentials: UPMECredentials): Promise<UPMEReporter> {
  const reporter = getUPMEReporter();
  reporter.setCredentials(credentials);
  await reporter.start();
  return reporter;
}
