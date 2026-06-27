/**
 * WhatsApp Business Cloud API — Servicio de Notificaciones EVGreen
 * Basado en la integración probada en producción del CRM GHP (sales.ghp.center)
 * Phone Number ID: 1169338359590445 | WABA ID: 590534007472553
 */
import { getDb } from "../db";
import { whatsappConfig, whatsappNotificationLog } from "../../drizzle/schema";
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
  | "monthly_summary";

export interface SendWhatsAppOptions {
  toPhone: string;           // Número en formato internacional sin + (ej: 573229587443)
  message: string;
  eventType: WaEventType;
  userId?: number;
  referenceId?: number;
  referenceType?: string;
}

// ─── Obtener configuración activa ─────────────────────────────────────────────

export async function getWhatsAppConfig() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(whatsappConfig).where(eq(whatsappConfig.id, 1)).limit(1);
  return rows[0] ?? null;
}

// ─── Enviar mensaje de texto ──────────────────────────────────────────────────

export async function sendWhatsAppMessage(opts: SendWhatsAppOptions): Promise<boolean> {
  const cfg = await getWhatsAppConfig();

  if (!cfg || !cfg.enabled || !cfg.phoneNumberId || !cfg.accessToken) {
    console.log("[WhatsApp] Servicio deshabilitado o sin credenciales — omitiendo notificación");
    return false;
  }

  // Verificar que el tipo de notificación esté habilitado
  const notifKey = eventTypeToConfigKey(opts.eventType);
  if (notifKey && !(cfg as Record<string, unknown>)[notifKey]) {
    console.log(`[WhatsApp] Notificación tipo '${opts.eventType}' deshabilitada — omitiendo`);
    return false;
  }

  // Normalizar número (quitar +, espacios, guiones)
  const toPhone = opts.toPhone.replace(/[\s\-\+]/g, "");

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
};
