/**
 * EVGreen Platform - Notificaciones de Backup
 * 
 * Envía emails de notificación cuando un backup se completa o falla.
 * Usa Resend con el dominio evgreen.lat
 * 
 * @author Green House Project | @version 1.0.0 (Abril 2026)
 */

import { getResendClient } from "../email/resend-client";
import { buildEmailParams } from "../utils/email-helper";

const FROM_EMAIL = "EVGreen Backup <backup@evgreen.lat>";
const ADMIN_EMAIL = "gerencia@greenhproject.com";


interface BackupResult {
  backupId: number;
  status: "COMPLETED" | "FAILED" | "PARTIAL";
  tablesBackedUp: string[];
  tablesFailed: string[];
  totalRows: number;
  totalSizeBytes: number;
  s3Url: string | null;
  duration: number;
  errors: Record<string, string>;
}

/**
 * Envía notificación por email sobre el resultado de un backup.
 */
export async function sendBackupNotification(result: BackupResult): Promise<boolean> {
  try {
    const statusEmoji = result.status === "COMPLETED" ? "✅" : result.status === "PARTIAL" ? "⚠️" : "❌";
    const statusText = result.status === "COMPLETED" ? "Completado" : result.status === "PARTIAL" ? "Parcial" : "Fallido";
    const sizeFormatted = formatBytes(result.totalSizeBytes);
    const durationFormatted = formatDuration(result.duration);
    const timestamp = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0d1117 0%,#161b22 100%);border-radius:12px;padding:30px;border:1px solid ${result.status === "COMPLETED" ? "#22c55e33" : "#ef444433"};margin-bottom:20px;">
      <div style="text-align:center;">
        <div style="font-size:48px;margin-bottom:10px;">${statusEmoji}</div>
        <h1 style="color:#f0f0f0;margin:0;font-size:22px;">Backup ${statusText}</h1>
        <p style="color:#8b949e;margin:5px 0 0;font-size:14px;">${timestamp} (COL)</p>
      </div>
    </div>
    
    <!-- Resumen -->
    <div style="background:#161b22;border-radius:12px;padding:24px;border:1px solid #30363d;margin-bottom:20px;">
      <h2 style="color:#f0f0f0;margin:0 0 16px;font-size:16px;">Resumen del Backup #${result.backupId}</h2>
      
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#8b949e;font-size:14px;">Estado</td>
          <td style="padding:8px 0;color:${result.status === "COMPLETED" ? "#22c55e" : result.status === "PARTIAL" ? "#f59e0b" : "#ef4444"};font-size:14px;text-align:right;font-weight:600;">${statusText}</td>
        </tr>
        <tr style="border-top:1px solid #21262d;">
          <td style="padding:8px 0;color:#8b949e;font-size:14px;">Tablas respaldadas</td>
          <td style="padding:8px 0;color:#f0f0f0;font-size:14px;text-align:right;">${result.tablesBackedUp.length}</td>
        </tr>
        <tr style="border-top:1px solid #21262d;">
          <td style="padding:8px 0;color:#8b949e;font-size:14px;">Filas totales</td>
          <td style="padding:8px 0;color:#f0f0f0;font-size:14px;text-align:right;">${result.totalRows.toLocaleString("es-CO")}</td>
        </tr>
        <tr style="border-top:1px solid #21262d;">
          <td style="padding:8px 0;color:#8b949e;font-size:14px;">Tamano comprimido</td>
          <td style="padding:8px 0;color:#f0f0f0;font-size:14px;text-align:right;">${sizeFormatted}</td>
        </tr>
        <tr style="border-top:1px solid #21262d;">
          <td style="padding:8px 0;color:#8b949e;font-size:14px;">Duracion</td>
          <td style="padding:8px 0;color:#f0f0f0;font-size:14px;text-align:right;">${durationFormatted}</td>
        </tr>
      </table>
    </div>
    
    ${result.tablesFailed.length > 0 ? `
    <!-- Errores -->
    <div style="background:#161b22;border-radius:12px;padding:24px;border:1px solid #ef444433;margin-bottom:20px;">
      <h2 style="color:#ef4444;margin:0 0 12px;font-size:16px;">Tablas con errores (${result.tablesFailed.length})</h2>
      ${result.tablesFailed.map(t => `
        <div style="padding:6px 12px;background:#1c1c1c;border-radius:6px;margin-bottom:6px;">
          <span style="color:#f0f0f0;font-size:13px;font-family:monospace;">${t}</span>
          <span style="color:#ef4444;font-size:12px;display:block;">${result.errors[t] || "Error desconocido"}</span>
        </div>
      `).join("")}
    </div>
    ` : ""}
    
    <!-- Tablas respaldadas -->
    <div style="background:#161b22;border-radius:12px;padding:24px;border:1px solid #30363d;margin-bottom:20px;">
      <h2 style="color:#f0f0f0;margin:0 0 12px;font-size:16px;">Tablas respaldadas (${result.tablesBackedUp.length})</h2>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${result.tablesBackedUp.map(t => `<span style="padding:4px 10px;background:#22c55e15;color:#22c55e;border-radius:20px;font-size:12px;font-family:monospace;">${t}</span>`).join("")}
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;">
      <p style="color:#484f58;font-size:12px;margin:0;">EVGreen Platform - Sistema de Backup Automatizado</p>
      <p style="color:#484f58;font-size:11px;margin:4px 0 0;">Este es un email automatico. No responder.</p>
    </div>
  </div>
</body>
</html>`;
    
    const subject = `${statusEmoji} Backup EVGreen ${statusText} - ${result.tablesBackedUp.length} tablas, ${sizeFormatted}`;
    
    const emailParams = buildEmailParams({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
    });
    
    await (await getResendClient()).emails.send(emailParams);
    console.log(`[Backup Notification] Email enviado a ${ADMIN_EMAIL}`);
    return true;
  } catch (error: any) {
    console.error("[Backup Notification] Error enviando email:", error.message);
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
