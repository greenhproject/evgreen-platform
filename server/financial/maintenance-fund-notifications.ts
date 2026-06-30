/**
 * ============================================================================
 * EVGreen Platform - Maintenance Fund Notification Service
 * ============================================================================
 * Envía notificaciones a inversionistas y admin cuando:
 * 1. Se aprueba una liquidación (depósito al fondo de mantenimiento)
 * 2. Se registra un cobro de mantenimiento (retiro del fondo)
 * 3. El balance del fondo baja del 10% del total acumulado (alerta)
 *
 * Canales: Push (Web Push / FCM), In-App, Email (Resend)
 * Incluye copia al admin para trazabilidad.
 *
 * @author Green House Project
 * @version 1.0.0 (Abril 2026)
 * ============================================================================
 */

import { Resend } from "resend";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { getStationInvestors, getMaintenanceFundSummary, getChargingStationById } from "../db";
import { sendUserPush, sendUserPushToMultiple } from "../push/unified-push";
import { buildEmailParams } from "../utils/email-helper";

const resend = new Resend(process.env.Resend ?? "");

// ============================================================================
// TYPES
// ============================================================================

interface FundDepositNotificationInput {
  stationId: number;
  stationName: string;
  depositAmount: number;
  newBalance: number;
  settlementId: number;
  periodDescription: string;
  adminUserId: number;
}

interface FundWithdrawalNotificationInput {
  stationId: number;
  stationName: string;
  withdrawalAmount: number;
  newBalance: number;
  description: string;
  maintenanceType: "preventivo" | "correctivo";
  technicianName?: string;
  adminUserId: number;
}

interface LowBalanceAlertInput {
  stationId: number;
  stationName: string;
  currentBalance: number;
  totalDeposits: number;
  percentRemaining: number;
  alertThresholdCOP?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Create in-app notification for a user
 */
async function createInAppNotification(userId: number, title: string, message: string, type: string, data?: Record<string, any>) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type: type as any,
      isRead: false,
      data: data ? JSON.stringify(data) : null,
    });
  } catch (err) {
    console.warn(`[MaintenanceFundNotif] Failed to create in-app notification for user ${userId}:`, err);
  }
}

/**
 * Send email via Resend (non-blocking)
 */
async function sendEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send(buildEmailParams({
      from: "EVGreen <notificaciones@evgreen.lat>",
      to,
      subject,
      html,
    }));
    return true;
  } catch (err) {
    console.warn(`[MaintenanceFundNotif] Email failed to ${to}:`, err);
    return false;
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function buildFundEmailTemplate(params: {
  userName: string;
  title: string;
  mainContent: string;
  accentColor: string;
  icon: string;
  ctaUrl?: string;
  ctaText?: string;
}): string {
  const { userName, title, mainContent, accentColor, icon, ctaUrl, ctaText } = params;
  const ctaButton = ctaUrl
    ? `<div style="text-align: center; margin-top: 30px;">
        <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaText || "Ver detalles"} →</a>
      </div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin: 0; padding: 0; font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a;">
  <tr><td style="background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}bb 100%); padding: 30px; text-align: center;">
    <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/evgreen/email-assets/logo-901183eb3111.png" alt="EVGreen" style="height: 40px; margin-bottom: 10px;">
    <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">${icon} ${title}</h1>
  </td></tr>
  <tr><td style="padding: 40px 30px;">
    <p style="color: #a0a0a0; font-size: 16px; margin: 0 0 20px 0;">Hola <strong style="color: #ffffff;">${userName}</strong>,</p>
    <div style="background-color: #252525; border-left: 4px solid ${accentColor}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      ${mainContent}
    </div>
    ${ctaButton}
  </td></tr>
  <tr><td style="background-color: #151515; padding: 25px 30px; border-top: 1px solid #2a2a2a;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="color: #666; font-size: 13px;">
          <p style="margin: 0 0 10px 0;"><strong style="color: #22c55e;">EVGreen</strong> - Carga el Futuro</p>
          <p style="margin: 0; color: #555;">Fondo de Mantenimiento - Notificación automática</p>
        </td>
        <td align="right" style="color: #666; font-size: 12px;">
          <a href="https://evgreen.lat" style="color: #22c55e; text-decoration: none;">evgreen.lat</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Notify investors when a settlement deposits funds into the maintenance fund
 */
export async function notifyFundDeposit(input: FundDepositNotificationInput): Promise<void> {
  const { stationId, stationName, depositAmount, newBalance, settlementId, periodDescription, adminUserId } = input;

  try {
    // Get investors for this station
    const investors = await getStationInvestors(stationId);
    if (investors.length === 0) {
      console.log(`[MaintenanceFundNotif] No investors found for station ${stationId}, skipping deposit notification`);
      return;
    }

    const title = `Depósito al Fondo de Mantenimiento`;
    const message = `Se depositaron ${formatCOP(depositAmount)} al fondo de mantenimiento de la estación "${stationName}" (Liquidación ${periodDescription}). Balance actual: ${formatCOP(newBalance)}.`;

    // 1. In-app notifications for all investors
    const inAppPromises = investors.map((inv: any) =>
      createInAppNotification(inv.investorId, title, message, "INFO", {
        type: "maintenance_fund_deposit",
        stationId,
        stationName,
        depositAmount,
        newBalance,
        settlementId,
      })
    );

    // 2. Push notifications
    const investorIds = investors.map((inv: any) => inv.investorId);
    const pushPromise = sendUserPushToMultiple(investorIds, {
      type: "system_alert",
      title: `💰 ${title}`,
      body: message,
      clickAction: "/investor/financial",
      data: { stationId: String(stationId), type: "maintenance_fund_deposit" },
    });

    // 3. Email notifications
    const emailPromises = investors
      .filter((inv: any) => inv.email)
      .map((inv: any) =>
        sendEmail(
          inv.email,
          `${title} - ${stationName}`,
          buildFundEmailTemplate({
            userName: inv.name,
            title,
            accentColor: "#22c55e",
            icon: "💰",
            mainContent: `
              <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
                Se ha realizado un depósito al fondo de mantenimiento de tu estación:
              </p>
              <table style="width: 100%; color: #e0e0e0; font-size: 14px;">
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Estación:</td><td style="padding: 6px 0; font-weight: 600;">${stationName}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Monto depositado:</td><td style="padding: 6px 0; font-weight: 600; color: #22c55e;">${formatCOP(depositAmount)}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Balance actual:</td><td style="padding: 6px 0; font-weight: 600;">${formatCOP(newBalance)}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Período:</td><td style="padding: 6px 0;">${periodDescription}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Liquidación #:</td><td style="padding: 6px 0;">${settlementId}</td></tr>
              </table>
              <p style="color: #888; font-size: 13px; margin: 16px 0 0 0;">
                Este depósito corresponde al 5% del share de EVGreen, reservado automáticamente para el mantenimiento de la estación.
              </p>
            `,
            ctaUrl: "https://evgreen.lat/investor/financial",
            ctaText: "Ver mis finanzas",
          })
        )
      );

    // 4. Admin copy (trazabilidad)
    const adminCopyPromise = createInAppNotification(
      adminUserId,
      `[Copia] ${title}`,
      `Notificación enviada a ${investors.length} inversionista(s): ${message}`,
      "INFO",
      { type: "maintenance_fund_deposit_copy", stationId, investorCount: investors.length }
    );

    // Execute all in parallel (non-blocking)
    await Promise.allSettled([...inAppPromises, pushPromise, ...emailPromises, adminCopyPromise]);

    console.log(`[MaintenanceFundNotif] Deposit notification sent to ${investors.length} investors for station ${stationId}`);
  } catch (err) {
    console.error(`[MaintenanceFundNotif] Error sending deposit notification:`, err);
  }
}

/**
 * Notify investors when a maintenance withdrawal is made from the fund
 */
export async function notifyFundWithdrawal(input: FundWithdrawalNotificationInput): Promise<void> {
  const { stationId, stationName, withdrawalAmount, newBalance, description, maintenanceType, technicianName, adminUserId } = input;

  try {
    const investors = await getStationInvestors(stationId);
    if (investors.length === 0) {
      console.log(`[MaintenanceFundNotif] No investors found for station ${stationId}, skipping withdrawal notification`);
      return;
    }

    const typeLabel = maintenanceType === "preventivo" ? "Preventivo" : "Correctivo";
    const title = `Cobro de Mantenimiento ${typeLabel}`;
    const message = `Se registró un cobro de mantenimiento ${typeLabel.toLowerCase()} de ${formatCOP(withdrawalAmount)} en la estación "${stationName}". ${description}. Balance restante: ${formatCOP(newBalance)}.`;

    // 1. In-app notifications
    const inAppPromises = investors.map((inv: any) =>
      createInAppNotification(inv.investorId, title, message, "WARNING", {
        type: "maintenance_fund_withdrawal",
        stationId,
        stationName,
        withdrawalAmount,
        newBalance,
        maintenanceType,
      })
    );

    // 2. Push notifications
    const investorIds = investors.map((inv: any) => inv.investorId);
    const pushPromise = sendUserPushToMultiple(investorIds, {
      type: "system_alert",
      title: `🔧 ${title}`,
      body: message,
      clickAction: "/investor/financial",
      data: { stationId: String(stationId), type: "maintenance_fund_withdrawal" },
    });

    // 3. Email notifications
    const emailPromises = investors
      .filter((inv: any) => inv.email)
      .map((inv: any) =>
        sendEmail(
          inv.email,
          `${title} - ${stationName}`,
          buildFundEmailTemplate({
            userName: inv.name,
            title,
            accentColor: "#f59e0b",
            icon: "🔧",
            mainContent: `
              <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
                Se ha registrado un cobro de mantenimiento contra el fondo de tu estación:
              </p>
              <table style="width: 100%; color: #e0e0e0; font-size: 14px;">
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Estación:</td><td style="padding: 6px 0; font-weight: 600;">${stationName}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Tipo:</td><td style="padding: 6px 0;"><span style="background: ${maintenanceType === "preventivo" ? "#3b82f6" : "#ef4444"}33; color: ${maintenanceType === "preventivo" ? "#60a5fa" : "#f87171"}; padding: 2px 8px; border-radius: 4px; font-size: 13px;">${typeLabel}</span></td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Monto:</td><td style="padding: 6px 0; font-weight: 600; color: #f59e0b;">${formatCOP(withdrawalAmount)}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Descripción:</td><td style="padding: 6px 0;">${description}</td></tr>
                ${technicianName ? `<tr><td style="padding: 6px 0; color: #a0a0a0;">Técnico:</td><td style="padding: 6px 0;">${technicianName}</td></tr>` : ""}
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Balance restante:</td><td style="padding: 6px 0; font-weight: 600;">${formatCOP(newBalance)}</td></tr>
              </table>
            `,
            ctaUrl: "https://evgreen.lat/investor/financial",
            ctaText: "Ver mis finanzas",
          })
        )
      );

    // 4. Admin copy
    const adminCopyPromise = createInAppNotification(
      adminUserId,
      `[Copia] ${title}`,
      `Notificación enviada a ${investors.length} inversionista(s): ${message}`,
      "WARNING",
      { type: "maintenance_fund_withdrawal_copy", stationId, investorCount: investors.length }
    );

    await Promise.allSettled([...inAppPromises, pushPromise, ...emailPromises, adminCopyPromise]);

    console.log(`[MaintenanceFundNotif] Withdrawal notification sent to ${investors.length} investors for station ${stationId}`);
  } catch (err) {
    console.error(`[MaintenanceFundNotif] Error sending withdrawal notification:`, err);
  }
}

/**
 * Send low-balance alert to admin when fund drops below 10% threshold
 */
export async function notifyLowBalance(input: LowBalanceAlertInput): Promise<void> {
  const { stationId, stationName, currentBalance, totalDeposits, percentRemaining } = input;

  try {
    // Get all admins
    const db = await getDb();
    if (!db) return;

    const { users: usersTable } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const admins = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.role, "admin" as any));

    if (admins.length === 0) return;

    const title = `⚠️ Fondo de Mantenimiento Bajo`;
    const message = `El fondo de mantenimiento de "${stationName}" está en ${percentRemaining.toFixed(1)}% (${formatCOP(currentBalance)} de ${formatCOP(totalDeposits)} acumulados). Se recomienda revisar los gastos o generar nuevas liquidaciones.`;

    // In-app + push for all admins
    const adminIds = admins.map((a) => a.id);

    const inAppPromises = admins.map((admin) =>
      createInAppNotification(admin.id, title, message, "ALERT", {
        type: "maintenance_fund_low_balance",
        stationId,
        stationName,
        currentBalance,
        totalDeposits,
        percentRemaining,
      })
    );

    const pushPromise = sendUserPushToMultiple(adminIds, {
      type: "system_alert",
      title,
      body: message,
      clickAction: "/admin/maintenance-fund",
      data: { stationId: String(stationId), type: "maintenance_fund_low_balance" },
    });

    // Email to admins
    const emailPromises = admins
      .filter((a) => a.email)
      .map((admin) =>
        sendEmail(
          admin.email!,
          `${title} - ${stationName}`,
          buildFundEmailTemplate({
            userName: admin.name || "Administrador",
            title: "Fondo de Mantenimiento Bajo",
            accentColor: "#ef4444",
            icon: "⚠️",
            mainContent: `
              <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
                El fondo de mantenimiento de una estación ha bajado del umbral mínimo configurado (${formatCOP(input.alertThresholdCOP || 500000)}):
              </p>
              <table style="width: 100%; color: #e0e0e0; font-size: 14px;">
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Estación:</td><td style="padding: 6px 0; font-weight: 600;">${stationName}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Balance actual:</td><td style="padding: 6px 0; font-weight: 600; color: #ef4444;">${formatCOP(currentBalance)}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Total acumulado:</td><td style="padding: 6px 0;">${formatCOP(totalDeposits)}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">Umbral configurado:</td><td style="padding: 6px 0; font-weight: 600;">${formatCOP(input.alertThresholdCOP || 500000)}</td></tr>
                <tr><td style="padding: 6px 0; color: #a0a0a0;">% Restante:</td><td style="padding: 6px 0; font-weight: 600; color: #ef4444;">${percentRemaining.toFixed(1)}%</td></tr>
              </table>
              <p style="color: #888; font-size: 13px; margin: 16px 0 0 0;">
                Se recomienda revisar los gastos de mantenimiento o generar nuevas liquidaciones para reponer el fondo. Puede ajustar el umbral de alerta desde la configuración de la estación.
              </p>
            `,
            ctaUrl: "https://evgreen.lat/admin/maintenance-fund",
            ctaText: "Gestionar fondo",
          })
        )
      );

    // Also notify investors about low balance
    const investors = await getStationInvestors(stationId);
    const investorInAppPromises = investors.map((inv: any) =>
      createInAppNotification(inv.investorId, title, message, "ALERT", {
        type: "maintenance_fund_low_balance",
        stationId,
        stationName,
        currentBalance,
        percentRemaining,
      })
    );

    const investorPushPromise = investors.length > 0
      ? sendUserPushToMultiple(
          investors.map((inv: any) => inv.investorId),
          {
            type: "system_alert",
            title,
            body: message,
            clickAction: "/investor/financial",
            data: { stationId: String(stationId), type: "maintenance_fund_low_balance" },
          }
        )
      : Promise.resolve({ success: 0, failure: 0 });

    await Promise.allSettled([
      ...inAppPromises,
      pushPromise,
      ...emailPromises,
      ...investorInAppPromises,
      investorPushPromise,
    ]);

    console.log(`[MaintenanceFundNotif] Low balance alert sent for station ${stationId} (${percentRemaining.toFixed(1)}%)`);
  } catch (err) {
    console.error(`[MaintenanceFundNotif] Error sending low balance alert:`, err);
  }
}

/**
 * Check if the fund balance is below threshold and trigger alert if needed.
 * Uses the configurable COP threshold per station (maintenanceFundAlertThreshold).
 * If no threshold is configured, defaults to $500,000 COP.
 * Called after each withdrawal.
 */
export async function checkAndAlertLowBalance(stationId: number): Promise<void> {
  try {
    const summary = await getMaintenanceFundSummary(stationId);
    if (!summary || summary.totalDeposits === 0) return;

    const station = await getChargingStationById(stationId);
    if (!station) return;

    // Use configurable COP threshold (default: $500,000 COP)
    const alertThresholdCOP = station.maintenanceFundAlertThreshold
      ? parseFloat(String(station.maintenanceFundAlertThreshold))
      : 500000;

    const percentRemaining = (summary.currentBalance / summary.totalDeposits) * 100;

    // Alert if balance is below the configured COP threshold
    if (summary.currentBalance < alertThresholdCOP) {
      await notifyLowBalance({
        stationId,
        stationName: station.name,
        currentBalance: summary.currentBalance,
        totalDeposits: summary.totalDeposits,
        percentRemaining,
        alertThresholdCOP,
      });
    }
  } catch (err) {
    console.error(`[MaintenanceFundNotif] Error checking low balance for station ${stationId}:`, err);
  }
}
