/**
 * Monitor de Salud de Estaciones
 * 
 * Detecta estaciones que están offline/desconectadas y genera alertas automáticas.
 * No depende de conexión OCPP previa - revisa el estado en BD.
 * 
 * Se ejecuta periódicamente y al consultar el dashboard del ingeniero.
 */

import * as db from "../db";
import { notifyTechniciansOfAlert } from "../notifications/technician-notification-service";
import { notifyOwner } from "../_core/notification";

export interface StationHealthStatus {
  stationId: number;
  stationName: string;
  ocppIdentity: string | null;
  isOnline: boolean;
  isActive: boolean;
  lastBootNotification: Date | null;
  healthStatus: "healthy" | "warning" | "critical" | "offline";
  issue?: string;
}

/**
 * Verifica el estado de salud de todas las estaciones activas
 * y genera alertas para las que están offline
 */
export async function checkStationHealth(): Promise<{
  stations: StationHealthStatus[];
  totalActive: number;
  online: number;
  offline: number;
  critical: number;
  alertsGenerated: number;
}> {
  const allStations = await db.getAllChargingStations({ isActive: true });
  const results: StationHealthStatus[] = [];
  let alertsGenerated = 0;
  let online = 0;
  let offline = 0;
  let critical = 0;

  for (const station of allStations) {
    const status: StationHealthStatus = {
      stationId: station.id,
      stationName: station.name,
      ocppIdentity: station.ocppIdentity || null,
      isOnline: station.isOnline,
      isActive: station.isActive,
      lastBootNotification: station.lastBootNotification || null,
      healthStatus: "healthy",
    };

    if (!station.isOnline) {
      // Estación offline
      offline++;
      
      if (!station.lastBootNotification) {
        // Nunca se ha conectado por OCPP - crítico
        status.healthStatus = "critical";
        status.issue = "Estación nunca se ha conectado al servidor OCPP";
        critical++;
      } else {
        // Se conectó antes pero ahora está offline
        const lastBoot = new Date(station.lastBootNotification);
        const hoursSinceLastBoot = (Date.now() - lastBoot.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastBoot > 24) {
          status.healthStatus = "critical";
          status.issue = `Sin conexión por más de ${Math.floor(hoursSinceLastBoot)} horas`;
          critical++;
        } else if (hoursSinceLastBoot > 1) {
          status.healthStatus = "warning";
          status.issue = `Sin conexión por ${Math.floor(hoursSinceLastBoot)} horas`;
        } else {
          status.healthStatus = "warning";
          status.issue = "Desconectada recientemente";
        }
      }
    } else {
      online++;
    }

    results.push(status);
  }

  return {
    stations: results,
    totalActive: allStations.length,
    online,
    offline,
    critical,
    alertsGenerated,
  };
}

/**
 * Genera alertas para estaciones offline que no tienen alertas recientes
 * Se llama periódicamente o al abrir el dashboard
 */
export async function generateOfflineAlerts(): Promise<number> {
  const allStations = await db.getAllChargingStations({ isActive: true });
  let alertsGenerated = 0;

  for (const station of allStations) {
    if (station.isOnline) continue; // Solo estaciones offline
    
    const identity = station.ocppIdentity || `station-${station.id}`;
    
    // Verificar si ya hay una alerta reciente (últimas 6 horas) para esta estación
    const recentAlerts = await db.getOcppAlerts({
      ocppIdentity: identity,
      limit: 1,
      includeAcknowledged: false,
    });

    const hasRecentAlert = recentAlerts.length > 0 && 
      recentAlerts[0].createdAt && 
      (Date.now() - new Date(recentAlerts[0].createdAt).getTime()) < 6 * 60 * 60 * 1000;

    if (hasRecentAlert) continue; // Ya tiene alerta reciente

    // Determinar severidad
    let severity: "info" | "warning" | "critical" = "warning";
    let title = `Estación ${station.name} desconectada`;
    let message = `La estación "${station.name}" (${identity}) está offline.`;

    if (!station.lastBootNotification) {
      severity = "critical";
      title = `Estación ${station.name} nunca conectada`;
      message = `La estación "${station.name}" (${identity}) nunca se ha conectado al servidor OCPP. Requiere configuración o revisión técnica.`;
    } else {
      const lastBoot = new Date(station.lastBootNotification);
      const hoursSinceLastBoot = (Date.now() - lastBoot.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastBoot > 24) {
        severity = "critical";
        message += ` Sin conexión por más de ${Math.floor(hoursSinceLastBoot)} horas. Última conexión: ${lastBoot.toLocaleString("es-CO")}.`;
      } else {
        message += ` Última conexión: ${lastBoot.toLocaleString("es-CO")}.`;
      }
    }

    // Crear la alerta en BD
    try {
      await db.createOcppAlert({
        ocppIdentity: identity,
        stationId: station.id,
        alertType: "OFFLINE_TIMEOUT",
        severity,
        title,
        message,
        payload: {
          stationName: station.name,
          lastBootNotification: station.lastBootNotification?.toISOString() || null,
          isOnline: station.isOnline,
        },
        acknowledged: false,
        createdAt: new Date(),
      });

      alertsGenerated++;

      // Notificar si es crítico
      if (severity === "critical" || severity === "warning") {
        // Notificar al owner
        const emoji = severity === "critical" ? "🚨" : "⚠️";
        await notifyOwner({
          title: `${emoji} ${title}`,
          content: message,
        }).catch(() => {});

        // Notificar a técnicos
        await notifyTechniciansOfAlert({
          alertType: "OFFLINE_TIMEOUT",
          severity,
          title,
          message,
          ocppIdentity: identity,
          stationId: station.id,
          stationName: station.name,
        }).catch(() => {});
      }
    } catch (error) {
      console.error(`[StationHealth] Error creating alert for ${station.name}:`, error);
    }
  }

  if (alertsGenerated > 0) {
    console.log(`[StationHealth] Generated ${alertsGenerated} offline alerts`);
  }

  return alertsGenerated;
}
