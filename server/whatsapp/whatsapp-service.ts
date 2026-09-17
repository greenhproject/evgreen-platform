/**
 * WhatsApp Business Cloud API — Servicio de Notificaciones EVGreen
 * Basado en la integración probada en producción del CRM GHP (sales.ghp.center)
 * Phone Number ID: 1169338359590445 | WABA ID: 590534007472553
 */
import { getDb } from "../db";
import { whatsappConfig, whatsappNotificationLog, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type WaEventType =
  | "charge_start"
  | "charge_end"
  | "charge_progress"
  | "penalty"
  | "wallet_recharge"
  | "charger_offline"
  | "reservation_confirmed"
  | "monthly_summary"
  | "card_removed"
  | "card_added"
  | "charging_reminder"
  | "refund"
  | "claim_resolved"
  | "station_available";

export interface SendWhatsAppOptions {
  toPhone: string;           // Número en formato internacional sin + (ej: 573229587443)
  message: string;
  eventType: WaEventType;
  userId?: number;
  referenceId?: number;
  referenceType?: string;
  skipConfigCheck?: boolean; // Para mensajes de prueba: omite el check de notifKey habilitado
}

// ─── Obtener configuración activa ─────────────────────────────────────────────

export async function getWhatsAppConfig() {
  const db = (await getDb())!;
  if (!db) return null;
  const rows = await db.select().from(whatsappConfig).where(eq(whatsappConfig.id, 1)).limit(1);
  return rows[0] ?? null;
}

// ─── Nombres de plantillas aprobadas por Meta ────────────────────────────────

export const WA_TEMPLATE_NAMES = {
  recarga_billetera: "evgreen_recarga_billetera_v2",   // params: nombre, monto, saldo
  inicio_carga: "evgreen_inicio_carga_v2",             // params: nombre, estacion, conector, hora
  fin_carga: "evgreen_fin_carga_v2",                   // params: nombre, kwh, duracion, costo, saldo
  tarjeta_inscrita: "evgreen_tarjeta_inscrita_v2",     // params: nombre, marca, ultimos4
  tarjeta_eliminada: "evgreen_tarjeta_eliminada_v3",   // params: nombre
  recordatorio_carga: "evgreen_recordatorio_carga_v3", // params: nombre, hora
  pago_sesion: "evgreen_pago_sesion_v3",               // params: nombre, monto, estacion, saldo
  // ⚠️ PENDIENTE APROBACIÓN META — registrar en Meta Business Manager antes de usar
  overstay_gracia: "evgreen_overstay_gracia_v1",        // params: nombre, minutos_gracia, estacion, tarifa_por_min
  overstay_penalizacion: "evgreen_overstay_penalizacion_v1", // params: nombre, estacion, acumulado_cop, tarifa_por_min
  station_available: "evgreen_estacion_disponible_v1",  // params: nombre, conector, estacion
} as const;

export type StationAvailabilityTemplateState =
  | "APPROVED"
  | "NOT_CONFIGURED"
  | "IN_REVIEW"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "ERROR";

export type StationAvailabilityTemplateInfo = {
  name: string;
  id: string | null;
  status: StationAvailabilityTemplateState;
  canSend: boolean;
  checkedAt: string | null;
  reason?: string;
};

const AVAILABILITY_TEMPLATE_LANGUAGE = "es";

function mapMetaTemplateStatus(status?: string): StationAvailabilityTemplateState {
  const normalized = String(status ?? "").trim().toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "IN_REVIEW" || normalized === "PENDING") return "IN_REVIEW";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PAUSED") return "PAUSED";
  if (normalized === "DISABLED") return "DISABLED";
  return "ERROR";
}

/**
 * Devuelve el estado guardado de la plantilla de disponibilidad sin hacer
 * solicitudes a Meta. Sirve para decidir si una alerta se puede programar.
 */
export async function getConfiguredStationAvailabilityTemplate(): Promise<StationAvailabilityTemplateInfo> {
  const cfg = await getWhatsAppConfig();
  const name = cfg?.stationAvailableTemplateName || WA_TEMPLATE_NAMES.station_available;
  const configured = Boolean(cfg?.enabled && cfg?.notifyStationAvailable && cfg?.phoneNumberId && cfg?.accessToken);
  const status = (cfg?.stationAvailableTemplateStatus || "NOT_CONFIGURED") as StationAvailabilityTemplateState;
  return {
    name,
    id: cfg?.stationAvailableTemplateId || null,
    status,
    canSend: configured && status === "APPROVED",
    checkedAt: cfg?.stationAvailableTemplateCheckedAt || null,
    reason: !configured
      ? "WhatsApp no está habilitado para alertas de disponibilidad"
      : status !== "APPROVED"
        ? "La plantilla de disponibilidad aún no está aprobada por Meta"
        : undefined,
  };
}

/** Consulta Meta y persiste exclusivamente metadatos no sensibles de la plantilla. */
export async function refreshStationAvailabilityTemplateStatus(): Promise<StationAvailabilityTemplateInfo> {
  const cfg = await getWhatsAppConfig();
  const name = cfg?.stationAvailableTemplateName || WA_TEMPLATE_NAMES.station_available;
  const checkedAt = new Date().toISOString();
  if (!cfg?.enabled || !cfg.wabaId || !cfg.accessToken) {
    return {
      name,
      id: cfg?.stationAvailableTemplateId || null,
      status: "NOT_CONFIGURED",
      canSend: false,
      checkedAt,
      reason: "La configuración de WhatsApp Business no está completa o está deshabilitada",
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${cfg.wabaId}/message_templates?name=${encodeURIComponent(name)}&fields=id,name,status,language`,
      { headers: { Authorization: `Bearer ${cfg.accessToken}` } },
    );
    const data = (await response.json()) as {
      data?: Array<{ id?: string; name?: string; status?: string; language?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }
    const found = data.data?.find((template) => template.name === name && (!template.language || template.language === AVAILABILITY_TEMPLATE_LANGUAGE))
      ?? data.data?.find((template) => template.name === name);
    const status = found ? mapMetaTemplateStatus(found.status) : "NOT_CONFIGURED";
    const database = await getDb();
    if (database) {
      await database.update(whatsappConfig).set({
        stationAvailableTemplateName: name,
        stationAvailableTemplateId: found?.id || null,
        stationAvailableTemplateStatus: status,
        stationAvailableTemplateCheckedAt: checkedAt,
      } as any).where(eq(whatsappConfig.id, 1));
    }
    return {
      name,
      id: found?.id || null,
      status,
      canSend: Boolean(cfg.notifyStationAvailable && status === "APPROVED"),
      checkedAt,
      reason: status === "NOT_CONFIGURED" ? "La plantilla no existe aún en Meta" : undefined,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp] Error consultando plantilla de disponibilidad:", reason);
    return { name, id: cfg.stationAvailableTemplateId || null, status: "ERROR", canSend: false, checkedAt, reason };
  }
}

/**
 * Crea una plantilla de utilidad para alertas solicitadas por el usuario.
 * Meta la revisa; no se usa hasta que su estado sea APPROVED.
 */
export async function createStationAvailabilityTemplate(): Promise<StationAvailabilityTemplateInfo> {
  const cfg = await getWhatsAppConfig();
  const name = cfg?.stationAvailableTemplateName || WA_TEMPLATE_NAMES.station_available;
  if (!cfg?.enabled || !cfg.wabaId || !cfg.accessToken) {
    throw new Error("Configura y activa WhatsApp Business antes de crear la plantilla");
  }

  const existing = await refreshStationAvailabilityTemplateStatus();
  if (existing.status !== "NOT_CONFIGURED") return existing;

  const response = await fetch(`https://graph.facebook.com/v23.0/${cfg.wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      category: "UTILITY",
      language: AVAILABILITY_TEMPLATE_LANGUAGE,
      parameter_format: "POSITIONAL",
      components: [{
        type: "BODY",
        text: "Hola {{1}}, el conector {{2}} de {{3}} ya está disponible. Abre EVGreen para iniciar tu carga.",
        example: { body_text: [["Luis", "GBT AC", "EVG Diamante"]] },
      }],
    }),
  });
  const data = (await response.json()) as { id?: string; status?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || `Meta no aceptó la creación de la plantilla (HTTP ${response.status})`);
  }

  const checkedAt = new Date().toISOString();
  const status = mapMetaTemplateStatus(data.status || "IN_REVIEW");
  const database = await getDb();
  if (database) {
    await database.update(whatsappConfig).set({
      stationAvailableTemplateName: name,
      stationAvailableTemplateId: data.id,
      stationAvailableTemplateStatus: status,
      stationAvailableTemplateCheckedAt: checkedAt,
    } as any).where(eq(whatsappConfig.id, 1));
  }
  return {
    name,
    id: data.id,
    status,
    canSend: false,
    checkedAt,
    reason: "La plantilla fue enviada a revisión de Meta y se habilitará al quedar APPROVED",
  };
}

// ─── Enviar mensaje con plantilla aprobada (funciona sin ventana de 24h) ─────

export interface SendWhatsAppTemplateOptions {
  toPhone: string;
  templateName: string;
  parameters: string[];   // Valores en orden para {{1}}, {{2}}, etc.
  eventType: WaEventType;
  userId?: number;
  referenceId?: number;
  referenceType?: string;
}

// Mapeo de eventType a campo de preferencia del usuario
function eventTypeToUserPrefKey(eventType: WaEventType): keyof typeof users.$inferSelect | null {
  const map: Partial<Record<WaEventType, keyof typeof users.$inferSelect>> = {
    charge_start:      "waNotifyChargeStart",
    charge_end:        "waNotifyChargeEnd",
    charging_reminder: "waNotifyReminder",
    penalty:           "waNotifyPenalty",
    wallet_recharge:   "waNotifyWallet",
    card_added:        "waNotifyWallet",
    card_removed:      "waNotifyWallet",
    refund:            "waNotifyWallet",
  };
  return map[eventType] ?? null;
}

export async function sendWhatsAppTemplate(opts: SendWhatsAppTemplateOptions): Promise<boolean> {
  const cfg = await getWhatsAppConfig();
  if (!cfg || !cfg.enabled || !cfg.phoneNumberId || !cfg.accessToken) {
    console.log("[WhatsApp] Servicio deshabilitado o sin credenciales — omitiendo plantilla");
    return false;
  }
  // Verificar que el tipo de notificación esté habilitado (control global admin)
  const notifKey = eventTypeToConfigKey(opts.eventType);
  if (notifKey && !(cfg as Record<string, unknown>)[notifKey]) {
    console.log(`[WhatsApp] Notificación tipo '${opts.eventType}' deshabilitada globalmente — omitiendo plantilla`);
    return false;
  }
  // Verificar preferencias del usuario (control individual)
  if (opts.userId) {
    const userPrefKey = eventTypeToUserPrefKey(opts.eventType);
    if (userPrefKey) {
      try {
        const db = (await getDb())!;
        if (db) {
          const userRows = await db.select().from(users).where(eq(users.id, opts.userId)).limit(1);
          const user = userRows[0];
          if (user && user[userPrefKey] === false) {
            console.log(`[WhatsApp] Usuario ${opts.userId} desactivó notificación '${opts.eventType}' — omitiendo`);
            return false;
          }
        }
      } catch (prefErr) {
        console.error("[WhatsApp] Error verificando preferencias de usuario:", prefErr);
        // Si falla la verificación, continuar con el envío (fail-open)
      }
    }
  }
  let toPhone = opts.toPhone.replace(/[\s\-\+]/g, "");
  if (toPhone.length === 10 && (toPhone.startsWith("3") || toPhone.startsWith("6"))) {
    toPhone = "57" + toPhone;
  }

  const bodyParams = opts.parameters.map(p => ({ type: "text", text: p }));

  let wamid: string | undefined;
  let status: "sent" | "failed" = "sent";
  let errorMessage: string | undefined;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toPhone,
          type: "template",
          template: {
            name: opts.templateName,
            language: { code: "es" },
            components: [
              {
                type: "body",
                parameters: bodyParams,
              },
            ],
          },
        }),
      }
    );

    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };

    if (res.ok && data.messages?.[0]?.id) {
      wamid = data.messages[0].id;
      console.log(`[WhatsApp] ✅ Template '${opts.templateName}' enviado a ${toPhone} | wamid: ${wamid}`);
    } else {
      status = "failed";
      errorMessage = data.error?.message ?? `HTTP ${res.status}`;
      console.error(`[WhatsApp] ❌ Error enviando template '${opts.templateName}' a ${toPhone}: ${errorMessage}`);
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[WhatsApp] ❌ Excepción enviando template: ${errorMessage}`);
  }

  // Registrar en el log
  try {
    const dbForLog = await getDb();
    if (dbForLog) {
      await dbForLog.insert(whatsappNotificationLog).values({
        userId: opts.userId,
        toPhone,
        eventType: opts.eventType,
        messageBody: `[template:${opts.templateName}] ${opts.parameters.join(" | ")}`,
        status,
        wamid,
        errorMessage,
        referenceId: opts.referenceId,
        referenceType: opts.referenceType,
      });
    }
  } catch (logErr) {
    console.error("[WhatsApp] Error guardando log de template:", logErr);
  }

  return status === "sent";
}

// ─── Enviar mensaje de texto ──────────────────────────────────────────────────

export async function sendWhatsAppMessage(opts: SendWhatsAppOptions): Promise<boolean> {
  const cfg = await getWhatsAppConfig();

  if (!cfg || !cfg.enabled || !cfg.phoneNumberId || !cfg.accessToken) {
    console.log("[WhatsApp] Servicio deshabilitado o sin credenciales — omitiendo notificación");
    return false;
  }

  // Verificar que el tipo de notificación esté habilitado (se puede omitir para mensajes de prueba)
  if (!opts.skipConfigCheck) {
    const notifKey = eventTypeToConfigKey(opts.eventType);
    if (notifKey && !(cfg as Record<string, unknown>)[notifKey]) {
      console.log(`[WhatsApp] Notificación tipo '${opts.eventType}' deshabilitada — omitiendo`);
      return false;
    }
  }

  // Normalizar número (quitar +, espacios, guiones)
  let toPhone = opts.toPhone.replace(/[\s\-\+]/g, "");
  // Si el número no empieza con código de país (10 dígitos = Colombia sin código), agregar 57
  // Números colombianos: 10 dígitos empezando por 3 (móvil) o 6 (fijo)
  if (toPhone.length === 10 && (toPhone.startsWith("3") || toPhone.startsWith("6"))) {
    toPhone = "57" + toPhone;
    console.log(`[WhatsApp] Número normalizado con código de país: ${toPhone}`);
  }

  let wamid: string | undefined;
  let status: "sent" | "failed" = "sent";
  let errorMessage: string | undefined;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toPhone,
          type: "text",
          text: { body: opts.message },
        }),
      }
    );

    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };

    if (res.ok && data.messages?.[0]?.id) {
      wamid = data.messages[0].id;
      console.log(`[WhatsApp] ✅ Enviado a ${toPhone} | wamid: ${wamid}`);
    } else {
      status = "failed";
      errorMessage = data.error?.message ?? `HTTP ${res.status}`;
      console.error(`[WhatsApp] ❌ Error enviando a ${toPhone}: ${errorMessage}`);
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[WhatsApp] ❌ Excepción enviando a ${toPhone}: ${errorMessage}`);
  }

  // Registrar en el log
  try {
    const dbForLog = await getDb();
    if (!dbForLog) return status === "sent";
    await dbForLog.insert(whatsappNotificationLog).values({
      userId: opts.userId,
      toPhone,
      eventType: opts.eventType,
      messageBody: opts.message,
      status,
      wamid,
      errorMessage,
      referenceId: opts.referenceId,
      referenceType: opts.referenceType,
    });
  } catch (logErr) {
    console.error("[WhatsApp] Error guardando log:", logErr);
  }

  return status === "sent";
}

// ─── Mapeo de eventType a campo de configuración ──────────────────────────────

function eventTypeToConfigKey(eventType: WaEventType): string | null {
  const map: Record<WaEventType, string> = {
    charge_start: "notifyChargeStart",
    charge_end: "notifyChargeEnd",
    charge_progress: "notifyChargeProgress",
    penalty: "notifyPenalty",
    wallet_recharge: "notifyWalletRecharge",
    charger_offline: "notifyChargerOffline",
    reservation_confirmed: "notifyReservation",
    monthly_summary: "notifyMonthlySummary",
    station_available: "notifyStationAvailable",
    card_removed: "notifyWalletRecharge",    // reutiliza el flag de billetera
    card_added: "notifyWalletRecharge",
    charging_reminder: "notifyChargeStart",  // reutiliza el flag de carga
    refund: "notifyWalletRecharge",
    claim_resolved: "notifyWalletRecharge",
  };
  return map[eventType] ?? null;
}

// ─── Templates de mensajes ────────────────────────────────────────────────────

export const WaTemplates = {
  chargeStart: (params: {
    stationName: string;
    connectorId: number | string;
    time: string;
    userName?: string;
  }) =>
    `⚡ *EVGreen — Carga Iniciada*\n\nHola${params.userName ? ` ${params.userName}` : ""}! Tu sesión de carga ha comenzado.\n\n📍 *Estación:* ${params.stationName}\n🔌 *Conector:* #${params.connectorId}\n🕐 *Hora de inicio:* ${params.time}\n\nTe notificaremos cuando finalice. ¡Buena carga! 🌱`,

  chargeEnd: (params: {
    stationName: string;
    kwhConsumed: number | string;
    durationMin: number | string;
    totalCost: string;
    balance?: string;
    userName?: string;
  }) =>
    `✅ *EVGreen — Carga Completada*\n\nHola${params.userName ? ` ${params.userName}` : ""}! Tu sesión ha finalizado.\n\n📍 *Estación:* ${params.stationName}\n⚡ *Energía:* ${params.kwhConsumed} kWh\n⏱ *Duración:* ${params.durationMin} min\n💰 *Costo:* ${params.totalCost}${params.balance ? `\n💳 *Saldo restante:* ${params.balance}` : ""}\n\n¡Gracias por cargar con EVGreen! 🌿`,

  chargeProgress: (params: {
    stationName: string;
    percent: number;
    kwhConsumed: number | string;
  }) =>
    `⚡ *EVGreen — Progreso de Carga*\n\n📍 ${params.stationName}\n🔋 Progreso: *${params.percent}%* completado\n⚡ Energía: ${params.kwhConsumed} kWh`,

  penalty: (params: {
    stationName: string;
    amount: string;
    reason: string;
    userName?: string;
  }) =>
    `⚠️ *EVGreen — Penalización Aplicada*\n\nHola${params.userName ? ` ${params.userName}` : ""}. Se ha aplicado una penalización a tu cuenta.\n\n📍 *Estación:* ${params.stationName}\n💸 *Monto:* ${params.amount}\n📋 *Motivo:* ${params.reason}\n\nSi tienes dudas, contáctanos en soporte.evgreen.lat`,

  walletRecharge: (params: {
    amount: string;
    newBalance: string;
    userName?: string;
  }) =>
    `💳 *EVGreen — Billetera Recargada*\n\nHola${params.userName ? ` ${params.userName}` : ""}!\n\n✅ *Recarga exitosa:* ${params.amount}\n💰 *Nuevo saldo:* ${params.newBalance}\n\nYa puedes cargar tu vehículo. ¡Gracias! 🌱`,

  chargerOffline: (params: {
    stationName: string;
    connectorId?: number | string;
  }) =>
    `🔌 *EVGreen — Cargador Desconectado*\n\n📍 *Estación:* ${params.stationName}${params.connectorId ? `\n🔌 *Conector:* #${params.connectorId}` : ""}\n\nEl cargador se ha desconectado. Nuestro equipo técnico ya fue notificado. Intenta otro conector disponible.`,

  reservationConfirmed: (params: {
    stationName: string;
    date: string;
    time: string;
    connectorId?: number | string;
    userName?: string;
  }) =>
    `📅 *EVGreen — Reserva Confirmada*\n\nHola${params.userName ? ` ${params.userName}` : ""}!\n\n✅ Tu reserva ha sido confirmada.\n\n📍 *Estación:* ${params.stationName}${params.connectorId ? `\n🔌 *Conector:* #${params.connectorId}` : ""}\n📅 *Fecha:* ${params.date}\n🕐 *Hora:* ${params.time}\n\nRecuerda llegar a tiempo. ¡Hasta pronto! 🌿`,

  monthlySummary: (params: {
    month: string;
    sessions: number;
    kwhTotal: number | string;
    totalSpent: string;
    userName?: string;
  }) =>
    `📊 *EVGreen — Resumen de ${params.month}*\n\nHola${params.userName ? ` ${params.userName}` : ""}! Aquí está tu resumen mensual:\n\n🔋 *Sesiones:* ${params.sessions}\n⚡ *Energía total:* ${params.kwhTotal} kWh\n💰 *Total gastado:* ${params.totalSpent}\n\n¡Gracias por ser parte de la red verde! 🌱`,

  // ─── Nuevos templates ─────────────────────────────────────────────────────

  cardRemoved: (params: { userName?: string }) =>
    `🗑️ *EVGreen — Tarjeta Eliminada*\n\nHola${params.userName ? ` ${params.userName}` : ""}!\n\nTu tarjeta ha sido desvinculada exitosamente de tu cuenta EVGreen.\n\nPuedes inscribir una nueva tarjeta en cualquier momento desde la sección *Billetera* de la app.\n\n¿Necesitas ayuda? Escríbenos 💬`,

  cardAdded: (params: { cardBrand: string; cardLastFour: string; userName?: string }) =>
    `✅ *EVGreen — Tarjeta Inscrita*\n\nHola${params.userName ? ` ${params.userName}` : ""}!\n\nTu tarjeta *${params.cardBrand} ····${params.cardLastFour}* ha sido inscrita exitosamente.\n\nAhora puedes recargar tu billetera con un solo toque. 🚀\n\n_Protegida con encriptación PCI DSS · Wompi_ 🔒`,

  chargingReminder: (params: { hour: string; stationHint?: string; userName?: string }) =>
    `⚡ *EVGreen — Hora de Carga*\n\nHola${params.userName ? ` ${params.userName}` : ""}!\n\nNormalmente cargas alrededor de las *${params.hour}:00*. ¿Necesitas cargar hoy?${params.stationHint ? `\n\n📍 ${params.stationHint}` : ""}\n\nAbre la app para encontrar el cargador más cercano 🗺️`,

  refund: (params: { amount: string; newBalance: string; reason: string; userName?: string }) =>
    `💰 *EVGreen — Reembolso Aplicado*\n\nHola${params.userName ? ` ${params.userName}` : ""}!\n\n✅ Se te ha reembolsado *${params.amount}* a tu billetera.\n💳 *Nuevo saldo:* ${params.newBalance}\n📋 *Motivo:* ${params.reason}\n\n¡Ya puedes seguir cargando! 🌱`,

  claimResolved: (params: { status: "RESOLVED" | "REJECTED"; resolution: string; userName?: string }) =>
    `${params.status === "RESOLVED" ? "✅" : "❌"} *EVGreen — Reclamo ${params.status === "RESOLVED" ? "Resuelto" : "Rechazado"}*\n\nHola${params.userName ? ` ${params.userName}` : ""}!\n\nTu reclamo ha sido *${params.status === "RESOLVED" ? "resuelto" : "rechazado"}*.\n📋 *Resolución:* ${params.resolution}\n\n¿Tienes más preguntas? Contáctanos en soporte.evgreen.lat 💬`,
};
