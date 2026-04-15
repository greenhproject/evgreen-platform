/**
 * ============================================================================
 * EVGreen Platform - Maintenance Fund Export (PDF & Excel)
 * ============================================================================
 * Genera reportes del fondo de mantenimiento por estación:
 * - Resumen del fondo (balance, depósitos, retiros)
 * - Historial completo de movimientos
 *
 * @author Green House Project
 * @version 1.0.0 (Abril 2026)
 * ============================================================================
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================================
// TYPES
// ============================================================================

export interface FundRecord {
  id: number;
  type: string; // 'deposit' | 'withdrawal'
  amount: number;
  description: string;
  maintenanceType?: string | null;
  maintenanceDetail?: string | null;
  technicianName?: string | null;
  invoiceNumber?: string | null;
  settlementId?: number | null;
  balanceAfter: number;
  creatorName?: string | null;
  createdAt: string | Date | null;
}

export interface FundSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  currentBalance: number;
  depositCount: number;
  withdrawalCount: number;
}

export interface ExportMaintenanceFundOptions {
  stationName: string;
  stationId: number;
  summary: FundSummary;
  records: FundRecord[];
}

// ============================================================================
// HELPERS
// ============================================================================

const formatCOP = (amount: number | string | null): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(num);
};

const formatDate = (ts: string | Date | null): string => {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatDateTime = (ts: string | Date | null): string => {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ============================================================================
// EXCEL EXPORT
// ============================================================================

export function generateMaintenanceFundExcel(options: ExportMaintenanceFundOptions): Buffer {
  const { stationName, stationId, summary, records } = options;
  const wb = XLSX.utils.book_new();

  // ---- HOJA 1: RESUMEN DEL FONDO ----
  const summaryData = [
    ["FONDO DE MANTENIMIENTO — EVGREEN"],
    ["Green House Project®"],
    [""],
    ["Estación:", stationName],
    ["ID Estación:", String(stationId)],
    ["Fecha de generación:", new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })],
    [""],
    ["═══════════════════════════════════════"],
    ["RESUMEN DEL FONDO"],
    ["═══════════════════════════════════════"],
    [""],
    ["Concepto", "Valor"],
    ["Balance Actual", formatCOP(summary.currentBalance)],
    ["Total Depósitos Acumulados", formatCOP(summary.totalDeposits)],
    ["Total Retiros (Mantenimientos)", formatCOP(summary.totalWithdrawals)],
    [""],
    ["Número de Depósitos", String(summary.depositCount)],
    ["Número de Retiros", String(summary.withdrawalCount)],
    ["Total de Movimientos", String(summary.depositCount + summary.withdrawalCount)],
    [""],
    ["Uso del Fondo (%)", summary.totalDeposits > 0 ? `${((summary.totalWithdrawals / summary.totalDeposits) * 100).toFixed(1)}%` : "0%"],
    ["Disponibilidad (%)", summary.totalDeposits > 0 ? `${((summary.currentBalance / summary.totalDeposits) * 100).toFixed(1)}%` : "100%"],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(summaryData);
  wsResumen["!cols"] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Fondo");

  // ---- HOJA 2: HISTORIAL DE MOVIMIENTOS ----
  const recordRows = records.map((r) => [
    formatDateTime(r.createdAt),
    r.type === "deposit" ? "Depósito" : "Retiro",
    r.type === "deposit" ? formatCOP(r.amount) : "",
    r.type === "withdrawal" ? formatCOP(r.amount) : "",
    formatCOP(r.balanceAfter),
    r.description,
    r.maintenanceType ? (r.maintenanceType === "preventivo" ? "Preventivo" : "Correctivo") : "—",
    r.technicianName || "—",
    r.invoiceNumber || "—",
    r.settlementId ? `#${r.settlementId}` : "—",
    r.creatorName || "—",
  ]);

  const historyData = [
    ["HISTORIAL DE MOVIMIENTOS — FONDO DE MANTENIMIENTO"],
    [`Estación: ${stationName}`],
    [""],
    [
      "Fecha",
      "Tipo",
      "Depósito",
      "Retiro",
      "Balance",
      "Descripción",
      "Tipo Mant.",
      "Técnico",
      "Factura",
      "Liquidación",
      "Registrado por",
    ],
    ...recordRows,
  ];

  const wsHistorial = XLSX.utils.aoa_to_sheet(historyData);
  wsHistorial["!cols"] = [
    { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 40 }, { wch: 12 }, { wch: 18 },
    { wch: 16 }, { wch: 12 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsHistorial, "Historial Movimientos");

  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export function generateMaintenanceFundPDF(options: ExportMaintenanceFundOptions): Buffer {
  const { stationName, stationId, summary, records } = options;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // ---- HEADER ----
  doc.setFillColor(22, 163, 74); // EVGreen green
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("EVGreen — Fondo de Mantenimiento", margin, 16);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Estación: ${stationName} (ID: ${stationId})`, margin, 24);
  doc.text(
    `Generado: ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    31
  );

  // ---- RESUMEN ----
  let y = 45;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen del Fondo", margin, y);
  y += 8;

  const usePct = summary.totalDeposits > 0 ? ((summary.totalWithdrawals / summary.totalDeposits) * 100).toFixed(1) : "0";

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Concepto", "Valor"]],
    body: [
      ["Balance Actual", formatCOP(summary.currentBalance)],
      ["Total Depósitos", formatCOP(summary.totalDeposits)],
      ["Total Retiros", formatCOP(summary.totalWithdrawals)],
      ["Depósitos (#)", String(summary.depositCount)],
      ["Retiros (#)", String(summary.withdrawalCount)],
      ["Uso del Fondo", `${usePct}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 50, halign: "right" } },
  });

  // ---- HISTORIAL ----
  y = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Historial de Movimientos", margin, y);
  y += 6;

  const tableBody = records.map((r) => [
    formatDateTime(r.createdAt),
    r.type === "deposit" ? "Depósito" : "Retiro",
    r.type === "deposit" ? formatCOP(r.amount) : "",
    r.type === "withdrawal" ? formatCOP(r.amount) : "",
    formatCOP(r.balanceAfter),
    r.description.length > 50 ? r.description.substring(0, 47) + "..." : r.description,
    r.maintenanceType ? (r.maintenanceType === "preventivo" ? "Prev." : "Corr.") : "—",
    r.technicianName || "—",
    r.invoiceNumber || "—",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Fecha", "Tipo", "Depósito", "Retiro", "Balance", "Descripción", "Tipo Mant.", "Técnico", "Factura"]],
    body: tableBody,
    theme: "striped",
    headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 18 },
      2: { cellWidth: 25, halign: "right" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 65 },
      6: { cellWidth: 18 },
      7: { cellWidth: 28 },
      8: { cellWidth: 25 },
    },
    didDrawPage: () => {
      // Footer on every page
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "EVGreen — Green House Project® — Documento generado automáticamente",
        margin,
        pageHeight - 8
      );
      doc.text(
        `Página ${doc.getCurrentPageInfo().pageNumber}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: "right" }
      );
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
