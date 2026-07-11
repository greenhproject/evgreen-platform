/**
 * weekly-report-email.ts
 * Servicio de reporte semanal de consumo de energía para usuarios de EVGreen.
 * Se ejecuta cada lunes a las 8:00am (hora Colombia) vía node-cron.
 * Solo envía a usuarios con emailNotifyWeeklyReport = true y que hayan tenido
 * al menos una sesión de carga en los últimos 7 días.
 */

import { getResendClient, getEmailFrom } from "./resend-client";
import {
  getAllUsers,
  getTransactionsByUserId,
  getWalletByUserId,
  getChargingStationById,
} from "../db";

const FROM_EMAIL = "EVGreen <admin@greenhproject.com>";
const BCC_EMAIL = "admin@greenhproject.com";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatKwh(kwh: number): string {
  return `${kwh.toFixed(2)} kWh`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export type WeekRangeMode = "last_week" | "last_7_days";

function getWeekRange(mode: WeekRangeMode = "last_week"): { start: Date; end: Date; label: string } {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };

  if (mode === "last_7_days") {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const label = `${start.toLocaleDateString("es-CO", opts)} – ${end.toLocaleDateString("es-CO", opts)}`;
    return { start, end, label };
  }

  // Semana pasada: lunes 00:00 a domingo 23:59
  const dayOfWeek = now.getDay(); // 0=dom, 1=lun ... 6=sab
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday - 7);
  lastMonday.setHours(0, 0, 0, 0);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  const label = `${lastMonday.toLocaleDateString("es-CO", opts)} – ${lastSunday.toLocaleDateString("es-CO", opts)}`;
  return { start: lastMonday, end: lastSunday, label };
}

// ─── Template HTML ───────────────────────────────────────────────────────────

interface WeeklyReportData {
  userName: string;
  userEmail: string;
  weekLabel: string;
  totalSessions: number;
  totalKwh: number;
  totalCost: number;
  totalDurationMinutes: number;
  walletBalance: number;
  sessions: Array<{
    date: string;
    stationName: string;
    kwh: number;
    cost: number;
    durationMinutes: number;
  }>;
  avgCostPerKwh: number;
}

function buildWeeklyReportHTML(data: WeeklyReportData): string {
  const sessionRows = data.sessions
    .map(
      (s) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;">${s.date}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:13px;">${s.stationName}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#22d3ee;font-size:13px;text-align:right;">${formatKwh(s.kwh)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#4ade80;font-size:13px;text-align:right;">${formatCOP(s.cost)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;text-align:right;">${formatDuration(s.durationMinutes)}</td>
      </tr>`
    )
    .join("");

  const co2Saved = (data.totalKwh * 0.136).toFixed(1); // kg CO₂ ahorrado vs combustión
  const kmEquivalent = Math.round(data.totalKwh * 6.5); // ~6.5 km/kWh promedio EV

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte Semanal EVGreen</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1e;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488,#0891b2);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="font-size:28px;margin-bottom:4px;">⚡</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Reporte Semanal de Carga</h1>
              <p style="margin:8px 0 0;color:#ccfbf1;font-size:14px;">${data.weekLabel}</p>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="background:#0f172a;padding:28px 40px 20px;">
              <p style="margin:0;color:#e2e8f0;font-size:15px;">Hola <strong style="color:#22d3ee;">${data.userName}</strong>,</p>
              <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;line-height:1.6;">
                Aquí tienes el resumen de tu actividad de carga durante la semana pasada.
              </p>
            </td>
          </tr>

          <!-- Métricas principales -->
          <tr>
            <td style="background:#0f172a;padding:0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#1e293b;border-radius:12px;padding:20px 16px;text-align:center;">
                      <div style="font-size:22px;margin-bottom:4px;">⚡</div>
                      <div style="color:#22d3ee;font-size:20px;font-weight:700;">${formatKwh(data.totalKwh)}</div>
                      <div style="color:#64748b;font-size:11px;margin-top:4px;">Energía cargada</div>
                    </div>
                  </td>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#1e293b;border-radius:12px;padding:20px 16px;text-align:center;">
                      <div style="font-size:22px;margin-bottom:4px;">💰</div>
                      <div style="color:#4ade80;font-size:18px;font-weight:700;">${formatCOP(data.totalCost)}</div>
                      <div style="color:#64748b;font-size:11px;margin-top:4px;">Gasto total</div>
                    </div>
                  </td>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#1e293b;border-radius:12px;padding:20px 16px;text-align:center;">
                      <div style="font-size:22px;margin-bottom:4px;">🔌</div>
                      <div style="color:#a78bfa;font-size:20px;font-weight:700;">${data.totalSessions}</div>
                      <div style="color:#64748b;font-size:11px;margin-top:4px;">Sesiones</div>
                    </div>
                  </td>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#1e293b;border-radius:12px;padding:20px 16px;text-align:center;">
                      <div style="font-size:22px;margin-bottom:4px;">⏱</div>
                      <div style="color:#fb923c;font-size:18px;font-weight:700;">${formatDuration(data.totalDurationMinutes)}</div>
                      <div style="color:#64748b;font-size:11px;margin-top:4px;">Tiempo total</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Impacto ambiental -->
          <tr>
            <td style="background:#0f172a;padding:0 40px 28px;">
              <div style="background:linear-gradient(135deg,#052e16,#064e3b);border-radius:12px;padding:20px 24px;border:1px solid #166534;">
                <h3 style="margin:0 0 12px;color:#4ade80;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🌱 Impacto Ambiental</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#86efac;font-size:14px;">CO₂ evitado vs combustión:</td>
                    <td style="color:#4ade80;font-size:16px;font-weight:700;text-align:right;">${co2Saved} kg</td>
                  </tr>
                  <tr>
                    <td style="color:#86efac;font-size:14px;padding-top:8px;">Kilómetros recorridos:</td>
                    <td style="color:#4ade80;font-size:16px;font-weight:700;text-align:right;padding-top:8px;">~${kmEquivalent} km</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Detalle de sesiones -->
          ${
            data.sessions.length > 0
              ? `<tr>
            <td style="background:#0f172a;padding:0 40px 28px;">
              <h3 style="margin:0 0 16px;color:#e2e8f0;font-size:15px;font-weight:600;">Detalle de sesiones</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #1e293b;">
                <thead>
                  <tr style="background:#1e293b;">
                    <th style="padding:10px 12px;color:#64748b;font-size:11px;text-align:left;font-weight:600;text-transform:uppercase;">Fecha</th>
                    <th style="padding:10px 12px;color:#64748b;font-size:11px;text-align:left;font-weight:600;text-transform:uppercase;">Estación</th>
                    <th style="padding:10px 12px;color:#64748b;font-size:11px;text-align:right;font-weight:600;text-transform:uppercase;">kWh</th>
                    <th style="padding:10px 12px;color:#64748b;font-size:11px;text-align:right;font-weight:600;text-transform:uppercase;">Costo</th>
                    <th style="padding:10px 12px;color:#64748b;font-size:11px;text-align:right;font-weight:600;text-transform:uppercase;">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessionRows}
                </tbody>
              </table>
            </td>
          </tr>`
              : ""
          }

          <!-- Saldo billetera -->
          <tr>
            <td style="background:#0f172a;padding:0 40px 28px;">
              <div style="background:#1e293b;border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="color:#94a3b8;font-size:13px;">💳 Saldo actual en billetera</div>
                  <div style="color:#4ade80;font-size:24px;font-weight:700;margin-top:4px;">${formatCOP(data.walletBalance)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="color:#64748b;font-size:12px;">Precio promedio</div>
                  <div style="color:#22d3ee;font-size:16px;font-weight:600;margin-top:4px;">${formatCOP(data.avgCostPerKwh)}/kWh</div>
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#0f172a;padding:0 40px 32px;text-align:center;">
              <a href="https://evgreen.lat" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0891b2);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                Ver mi historial completo →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#020617;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#334155;font-size:12px;line-height:1.6;">
                Recibiste este correo porque tienes activado el reporte semanal en tu cuenta EVGreen.<br/>
                <a href="https://evgreen.lat/profile/notifications" style="color:#0d9488;text-decoration:none;">Gestionar preferencias de notificación</a>
                &nbsp;·&nbsp;
                <a href="https://evgreen.lat" style="color:#0d9488;text-decoration:none;">evgreen.lat</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Función principal de envío ──────────────────────────────────────────────

export async function sendWeeklyReportToUser(userId: number, mode: WeekRangeMode = "last_week"): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { start, end, label } = getWeekRange(mode);

    // Obtener transacciones de la semana pasada
    const allTxs = await getTransactionsByUserId(userId, 200);
    const weekTxs = allTxs.filter((tx) => {
      const txDate = new Date(tx.startTime);
      return txDate >= start && txDate <= end && tx.status === "COMPLETED";
    });

    if (weekTxs.length === 0) {
      return { sent: false, reason: "no_sessions_this_week" };
    }

    // Obtener datos del usuario
    const { getAllUsers } = await import("../db");
    const allUsers = await getAllUsers("user");
    const user = allUsers.find((u) => u.id === userId);
    if (!user?.email) return { sent: false, reason: "no_email" };
    if (!user.emailNotifyWeeklyReport) return { sent: false, reason: "preference_disabled" };

    // Obtener saldo de billetera
    const wallet = await getWalletByUserId(userId);
    const walletBalance = parseFloat(wallet?.balance?.toString() ?? "0");

    // Calcular métricas
    let totalKwh = 0;
    let totalCost = 0;
    let totalDurationMinutes = 0;
    const sessions: WeeklyReportData["sessions"] = [];

    for (const tx of weekTxs) {
      const kwh = parseFloat(tx.kwhConsumed?.toString() ?? "0");
      const cost = parseFloat(tx.totalCost?.toString() ?? "0");
      const durationMs = tx.endTime
        ? new Date(tx.endTime).getTime() - new Date(tx.startTime).getTime()
        : 0;
      const durationMin = durationMs / 60000;

      totalKwh += kwh;
      totalCost += cost;
      totalDurationMinutes += durationMin;

      // Nombre de la estación
      let stationName = `Estación #${tx.stationId}`;
      try {
        const station = await getChargingStationById(tx.stationId);
        if (station?.name) stationName = station.name;
      } catch {}

      sessions.push({
        date: new Date(tx.startTime).toLocaleDateString("es-CO", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        stationName,
        kwh,
        cost,
        durationMinutes: durationMin,
      });
    }

    const avgCostPerKwh = totalKwh > 0 ? totalCost / totalKwh : 0;

    const reportData: WeeklyReportData = {
      userName: user.name ?? user.email.split("@")[0],
      userEmail: user.email,
      weekLabel: label,
      totalSessions: weekTxs.length,
      totalKwh,
      totalCost,
      totalDurationMinutes,
      walletBalance,
      sessions,
      avgCostPerKwh,
    };

    const html = buildWeeklyReportHTML(reportData);
    const resend = await getResendClient();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      bcc: BCC_EMAIL,
      subject: `📊 Tu resumen semanal EVGreen — ${label}`,
      html,
    });

    if (result.error) {
      console.error(`[WeeklyReport] Resend error for user=${userId}:`, result.error);
      return { sent: false, reason: result.error.message };
    }

    console.log(`[WeeklyReport] Sent to ${user.email} (userId=${userId}), emailId=${result.data?.id}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[WeeklyReport] Error for userId=${userId}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Envía el reporte semanal a TODOS los usuarios que lo tienen habilitado
 * y tuvieron al menos una sesión en el rango indicado.
 * @param mode "last_week" = semana pasada lunes-domingo (para cron automático)
 *             "last_7_days" = últimos 7 días (para trigger manual)
 */
export async function runWeeklyReportJob(mode: WeekRangeMode = "last_week"): Promise<{ sent: number; skipped: number; errors: number; eligible: number }> {
  console.log(`[WeeklyReport] Starting weekly report job (mode=${mode})...`);
  try {
    const allUsers = await getAllUsers("user");
    const eligible = allUsers.filter((u) => u.emailNotifyWeeklyReport && u.email);

    console.log(`[WeeklyReport] ${eligible.length} users with weekly report enabled`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of eligible) {
      const result = await sendWeeklyReportToUser(user.id, mode);
      if (result.sent) sent++;
      else if (result.reason === "no_sessions_this_week") skipped++;
      else errors++;

      // Pequeña pausa para no saturar la API de Resend
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`[WeeklyReport] Job complete — sent=${sent}, skipped=${skipped}, errors=${errors}`);
    return { sent, skipped, errors, eligible: eligible.length };
  } catch (err: any) {
    console.error("[WeeklyReport] Job failed:", err.message);
    return { sent: 0, skipped: 0, errors: 1, eligible: 0 };
  }
}
