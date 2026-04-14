/**
 * ============================================================================
 * EVGreen Platform - Financial Report Export
 * ============================================================================
 * Genera reportes financieros en PDF y Excel:
 * - P&L simplificado
 * - Waterfall de liquidaciones
 * - Distribución por inversionista
 * - Indicadores financieros
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

export interface SettlementData {
  id: number;
  stationId: number;
  stationName?: string;
  periodType: string;
  periodStart: number;
  periodEnd: number;
  grossRevenue: number;
  totalExpenses: number;
  netRevenue: number;
  investorTotalAmount: number;
  platformAmount: number;
  status: string;
  expenseLines?: Array<{
    category: string;
    description: string;
    amount: number;
  }>;
}

export interface FinancialSummary {
  totalInvested: number;
  totalDistributed: number;
  pendingBalance: number;
  totalSettlements: number;
  roiAccumulated: number;
  monthlyReturnPct: number;
  annualizedReturn: number;
  recoveryMonths: number;
}

export interface ExportFinancialOptions {
  investorName: string;
  settlements: SettlementData[];
  summary: FinancialSummary;
  investorShares?: Array<{
    settlementId: number;
    amount: number;
    ownershipPercent: number;
    status: string;
  }>;
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

const formatDate = (ts: number | string | null): string => {
  if (!ts) return "—";
  return new Date(Number(ts)).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

// ============================================================================
// EXCEL EXPORT
// ============================================================================

export function generateFinancialExcel(options: ExportFinancialOptions): Buffer {
  const { investorName, settlements, summary } = options;
  const wb = XLSX.utils.book_new();

  // ---- HOJA 1: RESUMEN FINANCIERO (P&L) ----
  const plData = [
    ["REPORTE FINANCIERO — EVGREEN"],
    ["Green House Project®"],
    [""],
    ["Inversionista:", investorName],
    ["Fecha de generación:", new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })],
    [""],
    ["═══════════════════════════════════════"],
    ["ESTADO DE PÉRDIDAS Y GANANCIAS (P&L)"],
    ["═══════════════════════════════════════"],
    [""],
    ["Concepto", "Valor"],
    ["Capital Invertido", formatCOP(summary.totalInvested)],
    ["Total Distribuido (Ingresos)", formatCOP(summary.totalDistributed)],
    ["Saldo Pendiente por Recuperar", formatCOP(summary.pendingBalance)],
    ["Ganancia/Pérdida Neta", formatCOP(summary.totalDistributed - summary.totalInvested)],
    [""],
    ["═══════════════════════════════════════"],
    ["INDICADORES FINANCIEROS"],
    ["═══════════════════════════════════════"],
    [""],
    ["Indicador", "Valor"],
    ["ROI Acumulado", formatPercent(summary.roiAccumulated)],
    ["Rentabilidad Mensual Promedio", formatPercent(summary.monthlyReturnPct)],
    ["Rentabilidad Anualizada (Est.)", formatPercent(summary.annualizedReturn)],
    ["Tiempo Est. de Recuperación", `${summary.recoveryMonths} meses`],
    ["Total de Liquidaciones", String(summary.totalSettlements)],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(plData);
  wsResumen["!cols"] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen P&L");

  // ---- HOJA 2: HISTORIAL DE LIQUIDACIONES ----
  const settlementRows = settlements.map((s) => [
    s.stationName || `Estación #${s.stationId}`,
    s.periodType,
    formatDate(s.periodStart),
    formatDate(s.periodEnd),
    formatCOP(s.grossRevenue),
    formatCOP(s.totalExpenses),
    formatCOP(s.netRevenue),
    formatCOP(s.investorTotalAmount),
    formatCOP(s.platformAmount),
    s.status === "DISTRIBUTED" ? "Pagado" : s.status === "APPROVED" ? "Aprobado" : "Pendiente",
  ]);

  const settlementData = [
    ["HISTORIAL DE LIQUIDACIONES — WATERFALL"],
    [""],
    [
      "Estación",
      "Período",
      "Inicio",
      "Fin",
      "Ingreso Bruto",
      "Total Gastos",
      "Ingreso Neto",
      "Inversionistas (70%)",
      "Gestor GHP (30%)",
      "Estado",
    ],
    ...settlementRows,
  ];

  const wsLiquidaciones = XLSX.utils.aoa_to_sheet(settlementData);
  wsLiquidaciones["!cols"] = [
    { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
    { wch: 18 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLiquidaciones, "Liquidaciones");

  // ---- HOJA 3: DETALLE DE GASTOS POR LIQUIDACIÓN ----
  const expenseRows: any[][] = [
    ["DETALLE DE GASTOS POR LIQUIDACIÓN"],
    [""],
    ["Liquidación", "Período", "Categoría", "Descripción", "Monto"],
  ];

  settlements.forEach((s) => {
    if (s.expenseLines && s.expenseLines.length > 0) {
      s.expenseLines.forEach((line) => {
        expenseRows.push([
          `#${s.id}`,
          `${formatDate(s.periodStart)} - ${formatDate(s.periodEnd)}`,
          line.category,
          line.description,
          formatCOP(line.amount),
        ]);
      });
    }
  });

  const wsGastos = XLSX.utils.aoa_to_sheet(expenseRows);
  wsGastos["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsGastos, "Detalle Gastos");

  // ---- HOJA 4: MI DISTRIBUCIÓN ----
  if (options.investorShares && options.investorShares.length > 0) {
    const shareRows = options.investorShares.map((share) => {
      const settlement = settlements.find((s) => s.id === share.settlementId);
      return [
        `#${share.settlementId}`,
        settlement ? `${formatDate(settlement.periodStart)} - ${formatDate(settlement.periodEnd)}` : "—",
        `${share.ownershipPercent.toFixed(1)}%`,
        formatCOP(share.amount),
        share.status === "DISTRIBUTED" ? "Pagado" : share.status === "APPROVED" ? "Aprobado" : "Pendiente",
      ];
    });

    const shareData = [
      ["MI DISTRIBUCIÓN POR LIQUIDACIÓN"],
      [""],
      ["Liquidación", "Período", "% Participación", "Mi Monto", "Estado"],
      ...shareRows,
    ];

    const wsDistribucion = XLSX.utils.aoa_to_sheet(shareData);
    wsDistribucion["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsDistribucion, "Mi Distribución");
  }

  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export function generateFinancialPDF(options: ExportFinancialOptions): Buffer {
  const { investorName, settlements, summary } = options;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ---- HEADER ----
  doc.setFillColor(17, 24, 39); // Dark bg
  doc.rect(0, 0, pageWidth, 45, "F");

  doc.setTextColor(16, 185, 129); // Emerald
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("EVGreen", margin, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Reporte Financiero", margin, 28);

  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(`Inversionista: ${investorName}`, margin, 36);
  doc.text(
    `Generado: ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}`,
    margin, 42
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("Green House Project®", pageWidth - margin, 18, { align: "right" });

  let yPos = 55;

  // ---- P&L SECTION ----
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Estado de Pérdidas y Ganancias", margin, yPos);
  yPos += 3;

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 8;

  const plItems = [
    ["Capital Invertido", formatCOP(summary.totalInvested), [59, 130, 246]], // Blue
    ["Total Distribuido (Ingresos)", `+ ${formatCOP(summary.totalDistributed)}`, [16, 185, 129]], // Green
    ["Saldo Pendiente", formatCOP(summary.pendingBalance), [245, 158, 11]], // Amber
    ["Ganancia/Pérdida Neta", formatCOP(summary.totalDistributed - summary.totalInvested),
      summary.totalDistributed - summary.totalInvested >= 0 ? [16, 185, 129] : [239, 68, 68]],
  ];

  plItems.forEach(([label, value, color]) => {
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(label as string, margin + 2, yPos);

    doc.setTextColor(...(color as [number, number, number]));
    doc.setFont("helvetica", "bold");
    doc.text(value as string, pageWidth - margin - 2, yPos, { align: "right" });
    yPos += 7;
  });

  yPos += 5;

  // ---- FINANCIAL INDICATORS ----
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores Financieros", margin, yPos);
  yPos += 3;

  doc.setDrawColor(16, 185, 129);
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 8;

  const indicators = [
    ["ROI Acumulado", formatPercent(summary.roiAccumulated)],
    ["Rentabilidad Mensual", formatPercent(summary.monthlyReturnPct)],
    ["Rentabilidad Anualizada", formatPercent(summary.annualizedReturn)],
    ["Tiempo Est. Recuperación", `${summary.recoveryMonths} meses`],
    ["Total Liquidaciones", String(summary.totalSettlements)],
  ];

  // Draw indicators in a 2-column grid
  const colWidth = contentWidth / 2;
  indicators.forEach(([label, value], idx) => {
    const col = idx % 2;
    const x = margin + col * colWidth;

    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, yPos - 4, colWidth - 4, 14, 2, 2, "F");

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, x + 4, yPos + 1);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 4, yPos + 8);

    if (col === 1) yPos += 17;
  });

  if (indicators.length % 2 !== 0) yPos += 17;
  yPos += 5;

  // ---- WATERFALL TABLE ----
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Historial de Liquidaciones (Waterfall)", margin, yPos);
  yPos += 3;

  doc.setDrawColor(16, 185, 129);
  doc.line(margin, yPos, margin + 90, yPos);
  yPos += 5;

  if (settlements.length > 0) {
    const tableBody = settlements.map((s) => [
      s.stationName || `Est. #${s.stationId}`,
      `${formatDate(s.periodStart)} - ${formatDate(s.periodEnd)}`,
      formatCOP(s.grossRevenue),
      formatCOP(s.totalExpenses),
      formatCOP(s.netRevenue),
      formatCOP(s.investorTotalAmount),
      s.status === "DISTRIBUTED" ? "Pagado" : s.status,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Estación", "Período", "Bruto", "Gastos", "Neto", "Inv. (70%)", "Estado"]],
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [16, 185, 129],
        fontSize: 7,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [55, 65, 81],
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 32 },
        2: { cellWidth: 22, halign: "right" },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 25, halign: "right" },
        6: { cellWidth: 18, halign: "center" },
      },
    });
  }

  // ---- FOOTER ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(249, 250, 251);
    doc.rect(0, pageHeight - 15, pageWidth, 15, "F");

    doc.setTextColor(156, 163, 175);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("EVGreen — Green House Project® | Documento confidencial", margin, pageHeight - 6);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
