/**
 * ConnectorStateService — FUENTE ÚNICA DE VERDAD
 *
 * Este servicio es el ÚNICO punto de escritura del estado de conectores (EVSEs)
 * en toda la plataforma EVGreen. Ningún otro módulo debe escribir directamente
 * en evses.connector_status.
 *
 * Responsabilidades:
 * 1. Validar transiciones de estado (evita estados fantasma)
 * 2. Escribir en BD (evses.connector_status) de forma atómica
 * 3. Sincronizar el estado en memoria (connection-manager)
 * 4. Registrar auditoría en evse_state_log
 * 5. Propagar el estado del cargador a la estación
 *
 * Uso:
 *   import { ConnectorStateService } from "./connector-state.service";
 *   await ConnectorStateService.transition(evseId, "CHARGING", "OCPP:StartTransaction", "OCPP");
 */

import { eq, and, inArray } from "drizzle-orm";
import { getDb, getPlatformSettings } from "../db";
import { evses, evseStateLog, chargingStations, chargers, organizations } from "../../drizzle/schema";
import { updateConnectorStatus } from "../ocpp/connection-manager";
import { getSiemEligibility } from "../ocpi/ocpi-catalog";
import { getEvseStatusDedupeKey, buildOcpiEvseStatusPayload } from "../ocpi/ocpi-status-projection";
import { stageOcpiEvent } from "../ocpi/ocpi-outbox";

// ============================================================================
// TIPOS
// ============================================================================

export type ConnectorStatus =
  | "AVAILABLE"
  | "PREPARING"
  | "CHARGING"
  | "SUSPENDED_EVSE"
  | "SUSPENDED_EV"
  | "FINISHING"
  | "RESERVED"
  | "UNAVAILABLE"
  | "FAULTED";

export type TriggeredBy =
  | "OCPP"
  | "SYSTEM"
  | "ADMIN"
  | "BILLING"
  | "OVERSTAY"
  | "RESERVATION"
  | "SIMULATOR";

export interface TransitionOptions {
  evseId: number;
  newStatus: ConnectorStatus;
  triggeredBy: TriggeredBy;
  reason?: string;
  transactionId?: number;
  ocppMessageType?: string;
  /** Si true, omite la validación de transición (solo para casos de reset/fuerza mayor) */
  force?: boolean;
}

// ============================================================================
// TRANSICIONES VÁLIDAS
// Define qué estados pueden transicionar a qué otros estados.
// Si el estado origen no está en el mapa, cualquier transición es permitida.
// ============================================================================

const VALID_TRANSITIONS: Record<ConnectorStatus, ConnectorStatus[]> = {
  AVAILABLE:      ["PREPARING", "RESERVED", "UNAVAILABLE", "FAULTED", "CHARGING"],
  PREPARING:      ["CHARGING", "AVAILABLE", "FAULTED", "UNAVAILABLE"],
  CHARGING:       ["FINISHING", "SUSPENDED_EVSE", "SUSPENDED_EV", "FAULTED", "AVAILABLE", "UNAVAILABLE"],
  SUSPENDED_EVSE: ["CHARGING", "FINISHING", "AVAILABLE", "FAULTED"],
  SUSPENDED_EV:   ["CHARGING", "FINISHING", "AVAILABLE", "FAULTED"],
  FINISHING:      ["AVAILABLE", "FAULTED", "UNAVAILABLE"],
  RESERVED:       ["PREPARING", "AVAILABLE", "FAULTED", "UNAVAILABLE"],
  UNAVAILABLE:    ["AVAILABLE", "FAULTED", "CHARGING"],
  FAULTED:        ["AVAILABLE", "UNAVAILABLE"],
};

// ============================================================================
// SERVICIO
// ============================================================================

export const ConnectorStateService = {
  /**
   * Realiza una transición de estado de un conector.
   * Es el ÚNICO método que debe usarse para cambiar el estado de un conector.
   *
   * @returns true si la transición fue exitosa, false si fue rechazada
   */
  async transition(options: TransitionOptions): Promise<boolean> {
    const { evseId, newStatus, triggeredBy, reason, transactionId, ocppMessageType, force } = options;

    const db = (await getDb())!;
    if (!db) {
      console.error(`[ConnectorState] DB no disponible para evseId=${evseId}`);
      return false;
    }

    // 1. Obtener estado actual del EVSE
    const [evse] = await db.select().from(evses).where(eq(evses.id, evseId)).limit(1);
    if (!evse) {
      console.warn(`[ConnectorState] EVSE ${evseId} no encontrado`);
      return false;
    }

    const previousStatus = evse.connectorStatus as ConnectorStatus;

    // 2. Validar transición (a menos que sea forzada)
    if (!force && previousStatus === newStatus) {
      // Sin cambio — no registrar log, solo retornar true silenciosamente
      return true;
    }

    if (!force) {
      const allowed = VALID_TRANSITIONS[previousStatus];
      if (allowed && !allowed.includes(newStatus)) {
        console.warn(
          `[ConnectorState] Transición inválida EVSE ${evseId}: ${previousStatus} → ${newStatus} (by ${triggeredBy}${reason ? `: ${reason}` : ""})`
        );
        // No bloquear — registrar como advertencia y continuar
        // Esto evita que un bug en la validación rompa el sistema
      }
    }

    // 3. Escribir en BD de forma atómica
    try {
      await db
        .update(evses)
        .set({
          connectorStatus: newStatus,
          lastStatusUpdate: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(evses.id, evseId));
    } catch (err) {
      console.error(`[ConnectorState] Error al actualizar EVSE ${evseId}:`, err);
      return false;
    }

    // 4. Sincronizar estado en memoria (connection-manager) para el monitor OCPP
    try {
      // Buscar el ocppIdentity del cargador asociado
      const ocppIdentity = await ConnectorStateService._getOcppIdentity(evse.stationId, evseId, db);
      if (ocppIdentity) {
        updateConnectorStatus(ocppIdentity, evse.connectorId, newStatus);
      }
    } catch (err) {
      // No crítico — el monitor OCPP puede quedar desincronizado temporalmente
      console.warn(`[ConnectorState] No se pudo sincronizar memoria para EVSE ${evseId}:`, err);
    }

    // 5. Registrar auditoría en evse_state_log (no bloquear si falla)
    try {
      await db.insert(evseStateLog).values({
        evseId,
        stationId: evse.stationId,
        chargerId: evse.chargerId ?? null,
        previousStatus,
        newStatus,
        triggeredBy,
        reason: reason ?? null,
        transactionId: transactionId ?? null,
        ocppMessageType: ocppMessageType ?? null,
        createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      });
    } catch (err) {
      console.warn(`[ConnectorState] No se pudo registrar auditoría para EVSE ${evseId}:`, err);
    }

    // 6. Propagar estado a la estación
    try {
      await ConnectorStateService._propagateToStation(evse.stationId, db);
    } catch (err) {
      console.warn(`[ConnectorState] No se pudo propagar estado a estación ${evse.stationId}:`, err);
    }

    // Preparación local para SIEM: nunca bloquea la operación de carga ni envía red.
    try {
      await ConnectorStateService._stageSiemEvseStatus(evse, newStatus, db);
    } catch (err) {
      console.warn(`[ConnectorState] No se pudo preparar evento SIEM para EVSE ${evseId}:`, err);
    }

    console.log(
      `[ConnectorState] EVSE ${evseId} (estación ${evse.stationId}): ${previousStatus} → ${newStatus} [${triggeredBy}${reason ? `: ${reason}` : ""}]`
    );

    return true;
  },

  /**
   * Marca todos los EVSEs de una estación como FAULTED.
   * Usado cuando el cargador reporta InternalError en connectorId=0.
   */
  async faultAllEvses(stationId: number, triggeredBy: TriggeredBy, reason?: string): Promise<void> {
    const db = (await getDb())!;
    if (!db) return;

    const stationEvses = await db
      .select()
      .from(evses)
      .where(and(eq(evses.stationId, stationId), eq(evses.isActive, 1)));

    for (const evse of stationEvses) {
      // No interrumpir sesiones activas de carga
      if (evse.connectorStatus === "CHARGING" || evse.connectorStatus === "RESERVED") {
        console.warn(
          `[ConnectorState] EVSE ${evse.id} en ${evse.connectorStatus} — no se marca como FAULTED automáticamente`
        );
        continue;
      }
      await ConnectorStateService.transition({
        evseId: evse.id,
        newStatus: "FAULTED",
        triggeredBy,
        reason: reason ?? "Station-level fault",
        force: true,
      });
    }
  },

  /**
   * Marca todos los EVSEs de una estación como UNAVAILABLE (ej: estación offline).
   */
  async setAllUnavailable(stationId: number, triggeredBy: TriggeredBy, reason?: string): Promise<void> {
    const db = (await getDb())!;
    if (!db) return;

    const stationEvses = await db
      .select()
      .from(evses)
      .where(and(eq(evses.stationId, stationId), eq(evses.isActive, 1)));

    for (const evse of stationEvses) {
      if (evse.connectorStatus === "CHARGING" || evse.connectorStatus === "RESERVED") continue;
      await ConnectorStateService.transition({
        evseId: evse.id,
        newStatus: "UNAVAILABLE",
        triggeredBy,
        reason: reason ?? "Station offline",
        force: true,
      });
    }
  },

  /**
   * Obtiene el historial de estados de un EVSE (últimas N entradas).
   */
  async getHistory(evseId: number, limit = 20) {
    const db = (await getDb())!;
    if (!db) return [];
    return db
      .select()
      .from(evseStateLog)
      .where(eq(evseStateLog.evseId, evseId))
      .orderBy(evseStateLog.createdAt)
      .limit(limit);
  },

  // ============================================================================
  // MÉTODOS INTERNOS
  // ============================================================================

  async _getOcppIdentity(stationId: number, evseId: number, db: any): Promise<string | null> {
    // Primero intentar desde la tabla chargers (nuevo modelo)
    if (evseId) {
      const [evse] = await db.select({ chargerId: evses.chargerId }).from(evses).where(eq(evses.id, evseId)).limit(1);
      if (evse?.chargerId) {
        const [charger] = await db.select({ ocppIdentity: chargers.ocppIdentity }).from(chargers).where(eq(chargers.id, evse.chargerId)).limit(1);
        if (charger?.ocppIdentity) return charger.ocppIdentity;
      }
    }
    // Fallback: desde charging_stations (modelo anterior)
    const [station] = await db
      .select({ ocppIdentity: chargingStations.ocppIdentity })
      .from(chargingStations)
      .where(eq(chargingStations.id, stationId))
      .limit(1);
    return station?.ocppIdentity ?? null;
  },

  async _propagateToStation(stationId: number, db: any): Promise<void> {
    const stationEvses = await db
      .select({ connectorStatus: evses.connectorStatus })
      .from(evses)
      .where(and(eq(evses.stationId, stationId), eq(evses.isActive, 1)));

    if (stationEvses.length === 0) return;

    const statuses = stationEvses.map((e: any) => e.connectorStatus as ConnectorStatus);
    const allFaulted = statuses.every((s: ConnectorStatus) => s === "FAULTED" || s === "UNAVAILABLE");
    const anyCharging = statuses.some((s: ConnectorStatus) => s === "CHARGING");
    const anyAvailable = statuses.some((s: ConnectorStatus) => s === "AVAILABLE");

    // Actualizar isOnline de la estación según el estado de sus conectores
    // isOnline = 0 solo si TODOS los conectores están FAULTED/UNAVAILABLE
    const isOnline = allFaulted ? 0 : 1;

    await db
      .update(chargingStations)
      .set({ isOnline })
      .where(eq(chargingStations.id, stationId));

    // También actualizar chargers asociados si los hay
    const stationChargers = await db
      .select({ id: chargers.id, ocppIdentity: chargers.ocppIdentity })
      .from(chargers)
      .where(and(eq(chargers.stationId, stationId), eq(chargers.isActive, 1)));

    for (const charger of stationChargers) {
      const chargerEvses = await db
        .select({ connectorStatus: evses.connectorStatus })
        .from(evses)
        .where(and(eq(evses.stationId, stationId), eq(evses.chargerId, charger.id)));

      if (chargerEvses.length === 0) continue;

      const chargerStatuses = chargerEvses.map((e: any) => e.connectorStatus as ConnectorStatus);
      const chargerAllFaulted = chargerStatuses.every((s: ConnectorStatus) => s === "FAULTED" || s === "UNAVAILABLE");
      const chargerAnyCharging = chargerStatuses.some((s: ConnectorStatus) => s === "CHARGING");

      let chargerStatus: "ONLINE" | "OFFLINE" | "FAULTED" | "UNKNOWN" = "ONLINE";
      if (chargerAllFaulted) chargerStatus = "FAULTED";
      else if (chargerAnyCharging) chargerStatus = "ONLINE";

      await db
        .update(chargers)
        .set({ chargerStatus, isOnline: chargerAllFaulted ? 0 : 1 })
        .where(eq(chargers.id, charger.id));
    }
  },

  async _stageSiemEvseStatus(evse: any, status: ConnectorStatus, db: any): Promise<void> {
    const [station] = await db.select({
      id: chargingStations.id,
      organizationId: chargingStations.organizationId,
      isActive: chargingStations.isActive,
      isPublic: chargingStations.isPublic,
      networkAccessMode: chargingStations.networkAccessMode,
      siemReportingEnabled: chargingStations.siemReportingEnabled,
      organizationStatus: organizations.orgStatus,
      networkMember: organizations.networkMember,
    }).from(chargingStations).leftJoin(organizations, eq(chargingStations.organizationId, organizations.id)).where(eq(chargingStations.id, evse.stationId)).limit(1);
    if (!station || !getSiemEligibility(station as any).eligible) return;

    const settings: any = await getPlatformSettings();
    const updatedAt = new Date().toISOString();
    await stageOcpiEvent(db, {
      eventType: "EVSE_STATUS",
      organizationId: station.organizationId,
      stationId: station.id,
      dedupeKey: getEvseStatusDedupeKey(station.id, evse.id),
      payload: buildOcpiEvseStatusPayload({
        countryCode: settings?.ocpiCountryCode || "CO",
        partyId: settings?.ocpiPartyId || "EVG",
        stationId: station.id,
        evseId: evse.id,
        evseUid: evse.evseIdLocal,
        status,
        updatedAt,
      }),
    });
  },
};
