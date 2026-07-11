/**
 * Banner Campaign Export Module
 * Exportación de reportes de campaña publicitaria a Excel (XLSX) y PDF
 * Branding EVGreen - Green House Project
 */

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================================
// TIPOS
// ============================================================================

export interface CampaignSummary {
  impressions: number;
  clicks: number;
  ctr: number;
  reach: number;
  frequency: number;
  avgDwellSeconds: number;
  totalDwellMinutes: number;
}

export interface BannerInfo {
  id: number;
  title: string;
  type: string;
  status: string;
  advertiserName?: string | null;
  advertiserContact?: string | null;
  campaignId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
}

export interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
  uniqueViews: number;
  avgDwellSeconds: number;
  ctr: number;
}

export interface AudienceProfile {
  byHour: { hour: number; views: number }[];
  byCity: { city: string; views: number; clicks: number }[];
  byVehicle: { vehicleType: string; views: number }[];
  byDevice: { deviceType: string; views: number }[];
}

// ============================================================================
// HELPERS
// ============================================================================

const EVGREEN_GREEN = "10B981";
const EVGREEN_DARK = "0F172A";
const EVGREEN_GRAY = "6B7280";
const EVGREEN_LIGHT = "F0FDF4";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`
);

// ============================================================================
// EXPORTAR EXCEL
// ============================================================================

export async function exportCampaignExcel(
  banner: BannerInfo,
  summary: CampaignSummary,
  dailyStats: DailyStat[],
  audience: AudienceProfile
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EVGreen Platform";
  workbook.created = new Date();

  // ── Hoja 1: Resumen de campaña ──────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Resumen de Campaña");
  summarySheet.columns = [
    { key: "label", width: 30 },
    { key: "value", width: 30 },
  ];

  // Encabezado
  const titleRow = summarySheet.addRow(["REPORTE DE CAMPAÑA PUBLICITARIA", ""]);
  summarySheet.mergeCells(`A1:B1`);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: `FF${EVGREEN_GREEN}` } };
  titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_DARK}` } };
  titleRow.getCell(1).alignment = { horizontal: "center" };
  titleRow.height = 28;

  const subtitleRow = summarySheet.addRow(["EVGreen - Green House Project", ""]);
  summarySheet.mergeCells("A2:B2");
  subtitleRow.getCell(1).font = { size: 11, color: { argb: `FF${EVGREEN_GRAY}` } };
  subtitleRow.getCell(1).alignment = { horizontal: "center" };

  summarySheet.addRow([]);

  // Info de campaña
  const infoHeader = summarySheet.addRow(["INFORMACIÓN DE CAMPAÑA", ""]);
  infoHeader.getCell(1).font = { bold: true, size: 11, color: { argb: `FF${EVGREEN_GREEN}` } };

  const infoRows = [
    ["Nombre del banner", banner.title],
    ["Tipo", banner.type],
    ["Estado", banner.status],
    ["Anunciante", banner.advertiserName || "—"],
    ["Contacto", banner.advertiserContact || "—"],
    ["ID de campaña", banner.campaignId || "—"],
    ["Fecha inicio", formatDate(banner.startDate)],
    ["Fecha fin", formatDate(banner.endDate)],
    ["Generado el", formatDate(new Date())],
  ];

  infoRows.forEach(([label, value]) => {
    const row = summarySheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_LIGHT}` } };
  });

  summarySheet.addRow([]);

  // Métricas clave
  const metricsHeader = summarySheet.addRow(["MÉTRICAS CLAVE", ""]);
  metricsHeader.getCell(1).font = { bold: true, size: 11, color: { argb: `FF${EVGREEN_GREEN}` } };

  const metricsRows = [
    ["Impresiones totales", summary.impressions.toLocaleString("es-CO")],
    ["Clics totales", summary.clicks.toLocaleString("es-CO")],
    ["CTR (Click-Through Rate)", `${summary.ctr}%`],
    ["Alcance (usuarios únicos)", summary.reach.toLocaleString("es-CO")],
    ["Frecuencia promedio", `${summary.frequency} vistas/usuario`],
    ["Dwell Time promedio", formatDuration(summary.avgDwellSeconds)],
    ["Tiempo total de exposición", `${summary.totalDwellMinutes} minutos`],
  ];

  metricsRows.forEach(([label, value]) => {
    const row = summarySheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true, color: { argb: `FF${EVGREEN_GREEN}` } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_LIGHT}` } };
  });

  // ── Hoja 2: Estadísticas diarias ────────────────────────────────────────
  const dailySheet = workbook.addWorksheet("Estadísticas Diarias");
  dailySheet.columns = [
    { header: "Fecha", key: "date", width: 16 },
    { header: "Impresiones", key: "impressions", width: 16 },
    { header: "Clics", key: "clicks", width: 12 },
    { header: "CTR (%)", key: "ctr", width: 12 },
    { header: "Vistas Únicas", key: "uniqueViews", width: 16 },
    { header: "Dwell Time Prom. (s)", key: "avgDwellSeconds", width: 22 },
  ];

  const dailyHeaderRow = dailySheet.getRow(1);
  dailyHeaderRow.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_GREEN}` } };
    cell.alignment = { horizontal: "center" };
  });

  dailyStats.forEach((stat) => {
    dailySheet.addRow({
      date: stat.date,
      impressions: stat.impressions,
      clicks: stat.clicks,
      ctr: stat.ctr,
      uniqueViews: stat.uniqueViews,
      avgDwellSeconds: stat.avgDwellSeconds,
    });
  });

  // Totals row
  const totalRow = dailySheet.addRow({
    date: "TOTAL",
    impressions: dailyStats.reduce((s, d) => s + d.impressions, 0),
    clicks: dailyStats.reduce((s, d) => s + d.clicks, 0),
    ctr: summary.ctr,
    uniqueViews: dailyStats.reduce((s, d) => s + d.uniqueViews, 0),
    avgDwellSeconds: summary.avgDwellSeconds,
  });
  totalRow.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_LIGHT}` } };
  });

  // ── Hoja 3: Perfil de audiencia ─────────────────────────────────────────
  const audienceSheet = workbook.addWorksheet("Perfil de Audiencia");

  // Ciudades
  audienceSheet.addRow(["TOP CIUDADES"]).getCell(1).font = { bold: true, color: { argb: `FF${EVGREEN_GREEN}` } };
  audienceSheet.addRow(["Ciudad", "Vistas", "Clics", "CTR (%)"]).eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_GREEN}` } };
  });
  audience.byCity.forEach((c) => {
    const ctr = c.views > 0 ? Math.round((c.clicks / c.views) * 10000) / 100 : 0;
    audienceSheet.addRow([c.city, c.views, c.clicks, ctr]);
  });

  audienceSheet.addRow([]);

  // Vehículos
  audienceSheet.addRow(["TIPOS DE VEHÍCULO"]).getCell(1).font = { bold: true, color: { argb: `FF${EVGREEN_GREEN}` } };
  audienceSheet.addRow(["Vehículo", "Vistas"]).eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_GREEN}` } };
  });
  audience.byVehicle.forEach((v) => audienceSheet.addRow([v.vehicleType, v.views]));

  audienceSheet.addRow([]);

  // Horas pico
  audienceSheet.addRow(["DISTRIBUCIÓN POR HORA"]).getCell(1).font = { bold: true, color: { argb: `FF${EVGREEN_GREEN}` } };
  audienceSheet.addRow(["Hora", "Vistas"]).eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EVGREEN_GREEN}` } };
  });
  const hourData = Array(24).fill(0);
  audience.byHour.forEach((h) => { hourData[h.hour] = h.views; });
  hourData.forEach((views, hour) => audienceSheet.addRow([HOUR_LABELS[hour], views]));

  audienceSheet.columns.forEach((col: Partial<ExcelJS.Column>) => {
    if (col.width === undefined) (col as ExcelJS.Column).width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// EXPORTAR PDF
// ============================================================================

export function exportCampaignPdf(
  banner: BannerInfo,
  summary: CampaignSummary,
  dailyStats: DailyStat[],
  audience: AudienceProfile
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // ── Encabezado ──────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // dark bg
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setTextColor(16, 185, 129); // emerald
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("EVGreen", margin, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Reporte de Campaña Publicitaria", margin, 22);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.text(`Generado el ${formatDate(new Date())}`, pageWidth - margin, 22, { align: "right" });

  y = 40;

  // ── Info de campaña ──────────────────────────────────────────────────────
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("INFORMACIÓN DE CAMPAÑA", margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [],
    body: [
      ["Banner", banner.title],
      ["Tipo", banner.type],
      ["Estado", banner.status],
      ["Anunciante", banner.advertiserName || "—"],
      ["Contacto", banner.advertiserContact || "—"],
      ["ID Campaña", banner.campaignId || "—"],
      ["Período", `${formatDate(banner.startDate)} — ${formatDate(banner.endDate)}`],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40, fillColor: [240, 253, 244], textColor: [15, 23, 42] },
      1: { textColor: [15, 23, 42] },
    },
    theme: "plain",
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── KPIs ─────────────────────────────────────────────────────────────────
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("MÉTRICAS CLAVE", margin, y);
  y += 6;

  const kpiData = [
    ["Impresiones", summary.impressions.toLocaleString("es-CO"), "Clics", summary.clicks.toLocaleString("es-CO")],
    ["CTR", `${summary.ctr}%`, "Alcance", summary.reach.toLocaleString("es-CO")],
    ["Frecuencia", `${summary.frequency}x`, "Dwell Time Prom.", formatDuration(summary.avgDwellSeconds)],
    ["Tiempo total exposición", `${summary.totalDwellMinutes} min`, "", ""],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [],
    body: kpiData,
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, fillColor: [240, 253, 244], textColor: [15, 23, 42] },
      1: { fontStyle: "bold", textColor: [16, 185, 129], cellWidth: 40 },
      2: { fontStyle: "bold", cellWidth: 50, fillColor: [240, 253, 244], textColor: [15, 23, 42] },
      3: { fontStyle: "bold", textColor: [16, 185, 129], cellWidth: 40 },
    },
    theme: "plain",
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Estadísticas diarias ─────────────────────────────────────────────────
  if (dailyStats.length > 0) {
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("ESTADÍSTICAS DIARIAS", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Fecha", "Impresiones", "Clics", "CTR (%)", "Únicas", "Dwell (s)"]],
      body: dailyStats.map((d) => [
        d.date,
        d.impressions.toLocaleString("es-CO"),
        d.clicks.toLocaleString("es-CO"),
        `${d.ctr}%`,
        d.uniqueViews.toLocaleString("es-CO"),
        d.avgDwellSeconds,
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      theme: "striped",
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Perfil de audiencia ───────────────────────────────────────────────────
  if (doc.internal.pageSize.getHeight() - y < 60) {
    doc.addPage();
    y = margin;
  }

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PERFIL DE AUDIENCIA", margin, y);
  y += 6;

  // Ciudades
  if (audience.byCity.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Ciudad", "Vistas", "Clics", "CTR (%)"]],
      body: audience.byCity.map((c) => {
        const ctr = c.views > 0 ? Math.round((c.clicks / c.views) * 10000) / 100 : 0;
        return [c.city, c.views.toLocaleString("es-CO"), c.clicks.toLocaleString("es-CO"), `${ctr}%`];
      }),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [6, 182, 212], textColor: 255, fontStyle: "bold" },
      theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Dispositivos
  if (audience.byDevice.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Dispositivo", "Vistas"]],
      body: audience.byDevice.map((d) => [d.deviceType, d.views.toLocaleString("es-CO")]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: "bold" },
      theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Nota de valor ─────────────────────────────────────────────────────────
  if (doc.internal.pageSize.getHeight() - y < 30) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "F");
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Ventaja competitiva EVGreen", margin + 4, y + 7);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Dwell Time promedio de ${formatDuration(summary.avgDwellSeconds)} — el usuario estaba cautivo esperando que su vehículo cargara.`,
    margin + 4, y + 13,
    { maxWidth: pageWidth - margin * 2 - 8 }
  );
  doc.text(
    `${summary.totalDwellMinutes} minutos totales de exposición garantizada. Muy superior al promedio digital (3-5 segundos).`,
    margin + 4, y + 18,
    { maxWidth: pageWidth - margin * 2 - 8 }
  );

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageWidth, 10, "F");
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(7);
    doc.text("EVGreen — Green House Project | evgreen.lat", margin, doc.internal.pageSize.getHeight() - 4);
    doc.text(`Pág. ${i} / ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 4, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
