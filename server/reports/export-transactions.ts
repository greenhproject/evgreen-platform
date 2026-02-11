import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface TransactionData {
  id: number;
  stationId: number;
  stationName?: string;
  startTime: Date | string;
  kwhConsumed: string | null;
  totalCost: string | null;
  investorShare: string | null;
  status: string;
}

interface ExportOptions {
  investorName: string;
  investorPercentage: number;
  platformFeePercentage: number;
  startDate?: Date;
  endDate?: Date;
}

const formatCurrency = (amount: string | number | null): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(num);
};

const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    COMPLETED: "Completada",
    IN_PROGRESS: "En progreso",
    PENDING: "Pendiente",
    FAILED: "Fallida",
    CANCELLED: "Cancelada",
  };
  return labels[status] || status;
};

export function generateExcelReport(
  transactions: TransactionData[],
  options: ExportOptions
): Buffer {
  // Calcular totales
  const completedTransactions = transactions.filter(t => t.status === "COMPLETED");
  const totalRevenue = completedTransactions.reduce((sum, t) => sum + parseFloat(t.totalCost || "0"), 0);
  const totalEnergy = completedTransactions.reduce((sum, t) => sum + parseFloat(t.kwhConsumed || "0"), 0);
  const investorShare = totalRevenue * (options.investorPercentage / 100);

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Hoja de resumen
  const summaryData = [
    ["REPORTE DE TRANSACCIONES - EVGREEN"],
    [""],
    ["Inversionista:", options.investorName],
    ["Fecha de generación:", new Date().toLocaleDateString("es-CO")],
    ["Período:", options.startDate && options.endDate 
      ? `${formatDate(options.startDate)} - ${formatDate(options.endDate)}`
      : "Todas las transacciones"],
    [""],
    ["RESUMEN FINANCIERO"],
    [""],
    ["Total de transacciones:", transactions.length],
    ["Transacciones completadas:", completedTransactions.length],
    ["Energía total vendida:", `${totalEnergy.toFixed(2)} kWh`],
    ["Ingresos brutos:", formatCurrency(totalRevenue)],
    [`Participación inversionista (${options.investorPercentage}%):`, formatCurrency(investorShare)],
    [`Comisión plataforma (${options.platformFeePercentage}%):`, formatCurrency(totalRevenue - investorShare)],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

  // Hoja de transacciones
  const transactionsHeader = [
    "ID",
    "Estación",
    "Fecha",
    "Energía (kWh)",
    "Monto Bruto (COP)",
    `Mi Parte ${options.investorPercentage}% (COP)`,
    "Estado",
  ];

  const transactionsData = transactions.map(t => [
    t.id,
    t.stationName || `Estación ${t.stationId}`,
    formatDate(t.startTime),
    parseFloat(t.kwhConsumed || "0").toFixed(2),
    formatCurrency(t.totalCost || 0),
    formatCurrency(parseFloat(t.totalCost || "0") * (options.investorPercentage / 100)),
    getStatusLabel(t.status),
  ]);

  const wsTransactions = XLSX.utils.aoa_to_sheet([transactionsHeader, ...transactionsData]);
  wsTransactions["!cols"] = [
    { wch: 10 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, wsTransactions, "Transacciones");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buffer;
}

export function generatePDFReport(
  transactions: TransactionData[],
  options: ExportOptions
): Buffer {
  // Calcular totales
  const completedTransactions = transactions.filter(t => t.status === "COMPLETED");
  const totalRevenue = completedTransactions.reduce((sum, t) => sum + parseFloat(t.totalCost || "0"), 0);
  const totalEnergy = completedTransactions.reduce((sum, t) => sum + parseFloat(t.kwhConsumed || "0"), 0);
  const investorShare = totalRevenue * (options.investorPercentage / 100);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Colores de la marca
  const primaryGreen = [16, 185, 129];
  const darkGreen = [5, 150, 105];
  const lightGray = [243, 244, 246];

  // Header con fondo verde
  doc.setFillColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("EVGreen", margin, 20);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Reporte de Transacciones", margin, 30);

  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CO")}`, pageWidth - margin - 50, 20);

  // Información del inversionista
  let yPos = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Información del Inversionista", margin, yPos);

  yPos += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${options.investorName}`, margin, yPos);
  
  yPos += 7;
  doc.text(`Período: ${options.startDate && options.endDate 
    ? `${formatDate(options.startDate)} - ${formatDate(options.endDate)}`
    : "Todas las transacciones"}`, margin, yPos);

  // Resumen financiero con cajas
  yPos += 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen Financiero", margin, yPos);

  yPos += 8;
  const boxWidth = (pageWidth - margin * 2 - 10) / 2;
  const boxHeight = 25;

  // Caja 1: Ingresos brutos
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.roundedRect(margin, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Ingresos Brutos", margin + 5, yPos + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(totalRevenue), margin + 5, yPos + 18);

  // Caja 2: Mi participación
  doc.setFillColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.roundedRect(margin + boxWidth + 10, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`Mi Participación (${options.investorPercentage}%)`, margin + boxWidth + 15, yPos + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(investorShare), margin + boxWidth + 15, yPos + 18);

  yPos += boxHeight + 8;

  // Caja 3: Energía vendida
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.roundedRect(margin, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Energía Vendida", margin + 5, yPos + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${totalEnergy.toFixed(2)} kWh`, margin + 5, yPos + 18);

  // Caja 4: Total transacciones
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.roundedRect(margin + boxWidth + 10, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Total Transacciones", margin + boxWidth + 15, yPos + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${completedTransactions.length} completadas`, margin + boxWidth + 15, yPos + 18);

  // Tabla de transacciones
  yPos += boxHeight + 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Detalle de Transacciones", margin, yPos);

  yPos += 5;

  const tableData = transactions.map((t) => [
    t.id.toString(),
    t.stationName || `Est. ${t.stationId}`,
    formatDate(t.startTime),
    `${parseFloat(t.kwhConsumed || "0").toFixed(2)} kWh`,
    formatCurrency(t.totalCost || 0),
    formatCurrency(parseFloat(t.totalCost || "0") * (options.investorPercentage / 100)),
    getStatusLabel(t.status),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["ID", "Estación", "Fecha", "Energía", "Monto Bruto", "Mi Parte", "Estado"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [primaryGreen[0], primaryGreen[1], primaryGreen[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 30 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
      6: { cellWidth: 22 },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
      doc.rect(0, pageHeight - 15, pageWidth, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text("EVGreen - Plataforma de Carga para Vehículos Eléctricos", margin, pageHeight - 6);
      doc.text(`Página ${data.pageNumber}`, pageWidth - margin - 20, pageHeight - 6);
    },
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return pdfBuffer;
}
