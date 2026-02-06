/**
 * Event Data Export Module
 * Exportación de invitados y pagos del evento a Excel (XLSX) y PDF
 */

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================================
// TIPOS
// ============================================================================

interface GuestExportData {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  investmentPackage: string | null;
  investmentAmount: number | null;
  founderSlot: number | null;
  status: string;
  qrCode: string;
  invitationSentAt: Date | string | null;
  checkedInAt: Date | string | null;
  createdAt: Date | string | null;
}

interface PaymentExportData {
  id: number;
  guestName: string | null;
  guestEmail: string | null;
  guestCompany: string | null;
  founderSlot: number | null;
  amount: number;
  selectedPackage: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string;
  paidAt: Date | string | null;
  createdAt: Date | string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const PACKAGE_NAMES: Record<string, string> = {
  AC: "AC Básico ($8.5M)",
  DC_INDIVIDUAL: "DC Individual 120kW ($85M)",
  COLECTIVO: "Estación Premium Colectiva ($200M)",
};

const STATUS_NAMES: Record<string, string> = {
  INVITED: "Invitado",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Registrado",
  NO_SHOW: "No asistió",
  CANCELLED: "Cancelado",
};

const PAYMENT_STATUS_NAMES: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  PARTIAL: "Parcial",
  REFUNDED: "Reembolsado",
};

const PAYMENT_METHOD_NAMES: Record<string, string> = {
  WOMPI: "Wompi",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  NEQUI: "Nequi",
};

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "$0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// EXPORTAR INVITADOS A EXCEL
// ============================================================================

export async function exportGuestsToExcel(guests: GuestExportData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EVGreen Platform";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Invitados Evento", {
    properties: { tabColor: { argb: "22C55E" } },
  });

  // Título
  sheet.mergeCells("A1:L1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "EVGreen - Lista de Invitados del Evento de Lanzamiento";
  titleCell.font = { size: 16, bold: true, color: { argb: "166534" } };
  titleCell.alignment = { horizontal: "center" };

  // Fecha de generación
  sheet.mergeCells("A2:L2");
  const dateCell = sheet.getCell("A2");
  dateCell.value = `Generado: ${new Date().toLocaleDateString("es-CO", { dateStyle: "full" })}`;
  dateCell.font = { size: 10, italic: true, color: { argb: "666666" } };
  dateCell.alignment = { horizontal: "center" };

  // Estadísticas rápidas
  sheet.mergeCells("A3:L3");
  const statsCell = sheet.getCell("A3");
  const checkedIn = guests.filter((g) => g.status === "CHECKED_IN").length;
  const confirmed = guests.filter((g) => g.status === "CONFIRMED").length;
  statsCell.value = `Total: ${guests.length} | Registrados: ${checkedIn} | Confirmados: ${confirmed}`;
  statsCell.font = { size: 11, bold: true };
  statsCell.alignment = { horizontal: "center" };

  // Encabezados
  const headers = [
    "Cupo #",
    "Nombre Completo",
    "Email",
    "Teléfono",
    "Empresa",
    "Cargo",
    "Paquete de Inversión",
    "Monto Inversión",
    "Estado",
    "Invitación Enviada",
    "Check-in",
    "Código QR",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "166534" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "22C55E" } },
    };
  });

  // Datos
  guests.forEach((guest) => {
    const row = sheet.addRow([
      guest.founderSlot ? `#${guest.founderSlot}` : "—",
      guest.fullName,
      guest.email,
      guest.phone || "—",
      guest.company || "—",
      guest.position || "—",
      guest.investmentPackage ? PACKAGE_NAMES[guest.investmentPackage] || guest.investmentPackage : "—",
      guest.investmentAmount ? formatCurrency(guest.investmentAmount) : "—",
      STATUS_NAMES[guest.status] || guest.status,
      formatDate(guest.invitationSentAt),
      formatDate(guest.checkedInAt),
      guest.qrCode,
    ]);

    // Colorear según estado
    const statusCell = row.getCell(9);
    if (guest.status === "CHECKED_IN") {
      statusCell.font = { color: { argb: "166534" }, bold: true };
    } else if (guest.status === "CANCELLED") {
      statusCell.font = { color: { argb: "DC2626" }, bold: true };
    } else if (guest.status === "CONFIRMED") {
      statusCell.font = { color: { argb: "2563EB" }, bold: true };
    }
  });

  // Ajustar anchos de columna
  sheet.columns.forEach((col: Partial<ExcelJS.Column>) => {
    let maxLength = 10;
    (col as ExcelJS.Column).eachCell?.({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLength) maxLength = Math.min(len, 40);
    });
    col.width = maxLength + 4;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// EXPORTAR PAGOS A EXCEL
// ============================================================================

export async function exportPaymentsToExcel(payments: PaymentExportData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EVGreen Platform";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Pagos Evento", {
    properties: { tabColor: { argb: "22C55E" } },
  });

  // Título
  sheet.mergeCells("A1:J1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "EVGreen - Registro de Pagos del Evento de Lanzamiento";
  titleCell.font = { size: 16, bold: true, color: { argb: "166534" } };
  titleCell.alignment = { horizontal: "center" };

  // Fecha
  sheet.mergeCells("A2:J2");
  const dateCell = sheet.getCell("A2");
  dateCell.value = `Generado: ${new Date().toLocaleDateString("es-CO", { dateStyle: "full" })}`;
  dateCell.font = { size: 10, italic: true, color: { argb: "666666" } };
  dateCell.alignment = { horizontal: "center" };

  // Estadísticas
  const totalPaid = payments.filter((p) => p.paymentStatus === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter((p) => p.paymentStatus === "PENDING").reduce((sum, p) => sum + p.amount, 0);
  sheet.mergeCells("A3:J3");
  const statsCell = sheet.getCell("A3");
  statsCell.value = `Total Recaudado: ${formatCurrency(totalPaid)} | Pendiente: ${formatCurrency(totalPending)} | Pagos: ${payments.length}`;
  statsCell.font = { size: 11, bold: true };
  statsCell.alignment = { horizontal: "center" };

  // Encabezados
  const headers = [
    "Cupo #",
    "Inversionista",
    "Email",
    "Empresa",
    "Paquete",
    "Monto",
    "Estado",
    "Método",
    "Referencia",
    "Fecha Pago",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "166534" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "22C55E" } },
    };
  });

  // Datos
  payments.forEach((payment) => {
    const row = sheet.addRow([
      payment.founderSlot ? `#${payment.founderSlot}` : "—",
      payment.guestName || "—",
      payment.guestEmail || "—",
      payment.guestCompany || "—",
      payment.selectedPackage ? PACKAGE_NAMES[payment.selectedPackage] || payment.selectedPackage : "—",
      formatCurrency(payment.amount),
      PAYMENT_STATUS_NAMES[payment.paymentStatus] || payment.paymentStatus,
      payment.paymentMethod ? PAYMENT_METHOD_NAMES[payment.paymentMethod] || payment.paymentMethod : "—",
      payment.paymentReference,
      formatDate(payment.paidAt),
    ]);

    const statusCell = row.getCell(7);
    if (payment.paymentStatus === "PAID") {
      statusCell.font = { color: { argb: "166534" }, bold: true };
    } else if (payment.paymentStatus === "PENDING") {
      statusCell.font = { color: { argb: "D97706" }, bold: true };
    }
  });

  // Fila de totales
  sheet.addRow([]);
  const totalRow = sheet.addRow([
    "",
    "",
    "",
    "",
    "TOTAL RECAUDADO:",
    formatCurrency(totalPaid),
    "",
    "",
    "",
    "",
  ]);
  totalRow.getCell(5).font = { bold: true, size: 12 };
  totalRow.getCell(6).font = { bold: true, size: 12, color: { argb: "166534" } };

  // Ajustar anchos
  sheet.columns.forEach((col: Partial<ExcelJS.Column>) => {
    let maxLength = 10;
    (col as ExcelJS.Column).eachCell?.({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLength) maxLength = Math.min(len, 40);
    });
    col.width = maxLength + 4;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// EXPORTAR INVITADOS A PDF
// ============================================================================

export function exportGuestsToPDF(guests: GuestExportData[]): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Título
  doc.setFontSize(18);
  doc.setTextColor(22, 101, 52);
  doc.text("EVGreen - Lista de Invitados del Evento", doc.internal.pageSize.width / 2, 15, { align: "center" });

  // Subtítulo
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CO", { dateStyle: "full" })}`, doc.internal.pageSize.width / 2, 22, { align: "center" });

  // Stats
  const checkedIn = guests.filter((g) => g.status === "CHECKED_IN").length;
  const confirmed = guests.filter((g) => g.status === "CONFIRMED").length;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total: ${guests.length} | Registrados: ${checkedIn} | Confirmados: ${confirmed}`, doc.internal.pageSize.width / 2, 28, { align: "center" });

  // Tabla
  const tableData = guests.map((g) => [
    g.founderSlot ? `#${g.founderSlot}` : "—",
    g.fullName,
    g.email,
    g.phone || "—",
    g.company || "—",
    g.investmentPackage ? PACKAGE_NAMES[g.investmentPackage] || g.investmentPackage : "—",
    STATUS_NAMES[g.status] || g.status,
    formatDate(g.checkedInAt),
  ]);

  autoTable(doc, {
    startY: 33,
    head: [["Cupo", "Nombre", "Email", "Teléfono", "Empresa", "Paquete", "Estado", "Check-in"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
    columnStyles: {
      0: { cellWidth: 15, halign: "center" },
      1: { cellWidth: 40 },
      2: { cellWidth: 50 },
      3: { cellWidth: 30 },
      4: { cellWidth: 35 },
      5: { cellWidth: 45 },
      6: { cellWidth: 25, halign: "center" },
      7: { cellWidth: 35 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const val = String(data.cell.raw);
        if (val === "Registrado") {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Cancelado") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `EVGreen - Green House Project S.A.S. | Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 5,
      { align: "center" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ============================================================================
// EXPORTAR PAGOS A PDF
// ============================================================================

export function exportPaymentsToPDF(payments: PaymentExportData[]): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Título
  doc.setFontSize(18);
  doc.setTextColor(22, 101, 52);
  doc.text("EVGreen - Registro de Pagos del Evento", doc.internal.pageSize.width / 2, 15, { align: "center" });

  // Subtítulo
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CO", { dateStyle: "full" })}`, doc.internal.pageSize.width / 2, 22, { align: "center" });

  // Stats
  const totalPaid = payments.filter((p) => p.paymentStatus === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter((p) => p.paymentStatus === "PENDING").reduce((sum, p) => sum + p.amount, 0);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total Recaudado: ${formatCurrency(totalPaid)} | Pendiente: ${formatCurrency(totalPending)} | Pagos: ${payments.length}`, doc.internal.pageSize.width / 2, 28, { align: "center" });

  // Tabla
  const tableData = payments.map((p) => [
    p.founderSlot ? `#${p.founderSlot}` : "—",
    p.guestName || "—",
    p.guestEmail || "—",
    p.selectedPackage ? PACKAGE_NAMES[p.selectedPackage] || p.selectedPackage : "—",
    formatCurrency(p.amount),
    PAYMENT_STATUS_NAMES[p.paymentStatus] || p.paymentStatus,
    p.paymentMethod ? PAYMENT_METHOD_NAMES[p.paymentMethod] || p.paymentMethod : "—",
    p.paymentReference,
    formatDate(p.paidAt),
  ]);

  autoTable(doc, {
    startY: 33,
    head: [["Cupo", "Inversionista", "Email", "Paquete", "Monto", "Estado", "Método", "Referencia", "Fecha"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
    columnStyles: {
      0: { cellWidth: 15, halign: "center" },
      1: { cellWidth: 35 },
      2: { cellWidth: 45 },
      3: { cellWidth: 40 },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 22, halign: "center" },
      6: { cellWidth: 25 },
      7: { cellWidth: 30 },
      8: { cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const val = String(data.cell.raw);
        if (val === "Pagado") {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Pendiente") {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Fila de total
  const finalY = (doc as any).lastAutoTable?.finalY || 50;
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text(`TOTAL RECAUDADO: ${formatCurrency(totalPaid)}`, doc.internal.pageSize.width - 15, finalY + 10, { align: "right" });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `EVGreen - Green House Project S.A.S. | Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 5,
      { align: "center" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}
