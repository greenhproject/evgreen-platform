import { jsPDF } from "jspdf";

export type ReservationReceiptStatus =
  | "ACTIVE"
  | "FULFILLED"
  | "CANCELLED"
  | "EXPIRED"
  | "NO_SHOW"
  | "SERVICE_UNAVAILABLE";

export interface ReservationReceiptPdfData {
  reservationId: number;
  status: ReservationReceiptStatus | string;
  customerName: string;
  stationName: string;
  stationAddress?: string | null;
  stationTimezone?: string | null;
  connectorLabel?: string | null;
  connectorType?: string | null;
  chargeType?: string | null;
  powerKw?: number | string | null;
  startTime: Date | string;
  endTime: Date | string;
  createdAt?: Date | string | null;
  reservationFee?: number | string | null;
  noShowPenalty?: number | string | null;
  lockedPricePerKwh?: number | string | null;
  lockedConnectionFee?: number | string | null;
  priceLockedAt?: Date | string | null;
  serviceIssueCode?: string | null;
  transaction?: {
    status?: string | null;
    transactionStatus?: string | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
    kwhConsumed?: number | string | null;
    appliedPricePerKwh?: number | string | null;
    energyCost?: number | string | null;
    timeCost?: number | string | null;
    sessionCost?: number | string | null;
    overstayCost?: number | string | null;
    totalCost?: number | string | null;
  } | null;
}

const CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function asFiniteNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number | string | null | undefined): string {
  return CURRENCY.format(asFiniteNumber(value));
}

function formatDateTime(value: Date | string | null | undefined, timezone?: string | null): string {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone || "America/Bogota",
  }).format(date);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: "Reserva activa",
    FULFILLED: "Reserva utilizada",
    CANCELLED: "Reserva cancelada",
    EXPIRED: "Reserva vencida",
    NO_SHOW: "No asistió",
    SERVICE_UNAVAILABLE: "Afectada por disponibilidad",
  };
  return labels[status.toUpperCase()] || status;
}

function connectorDescription(data: ReservationReceiptPdfData): string {
  const name = data.connectorLabel?.trim() || "Conector";
  const type = data.connectorType?.replaceAll("_", " ") || "";
  const power = asFiniteNumber(data.powerKw);
  return [name, type, power > 0 ? `${power.toLocaleString("es-CO")} kW` : ""].filter(Boolean).join(" · ");
}

function addLine(doc: jsPDF, label: string, value: string, y: number, width: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(92, 104, 122);
  doc.text(label, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  const lines = doc.splitTextToSize(value, 86);
  doc.text(lines, width - 20, y, { align: "right" });
  return y + Math.max(7, lines.length * 4.2 + 2);
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setDrawColor(209, 250, 229);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(16, y - 5, 184, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text(title, 20, y + 1.5);
  return y + 13;
}

/**
 * Genera un comprobante informativo de reserva en memoria. No es una factura
 * electrónica ni cambia el estado, valores o titularidad de la reserva.
 */
export function generateReservationReceiptPdf(data: ReservationReceiptPdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(4, 120, 87);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setFillColor(20, 184, 166);
  doc.circle(pageWidth - 18, 13, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text("EVGreen", 16, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(209, 250, 229);
  doc.text("Comprobante informativo de reserva", 16, 27);
  doc.setTextColor(236, 253, 245);
  doc.text(`Reserva #${data.reservationId}`, 16, 34);

  let y = 54;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text(statusLabel(data.status), 16, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text("Documento generado desde la aplicación. Conserva las condiciones aceptadas de la reserva.", 16, y);
  y += 12;

  y = addSectionTitle(doc, "Detalle de la reserva", y);
  y = addLine(doc, "Titular", data.customerName || "Usuario EVGreen", y, pageWidth);
  y = addLine(doc, "Estación", data.stationName, y, pageWidth);
  y = addLine(doc, "Dirección", data.stationAddress || "No registrada", y, pageWidth);
  y = addLine(doc, "Conector", connectorDescription(data), y, pageWidth);
  y = addLine(doc, "Horario reservado", `${formatDateTime(data.startTime, data.stationTimezone)} — ${formatDateTime(data.endTime, data.stationTimezone)}`, y, pageWidth);
  y += 5;

  y = addSectionTitle(doc, "Condiciones económicas confirmadas", y);
  y = addLine(doc, "Tarifa de energía bloqueada", `${formatCurrency(data.lockedPricePerKwh)} por kWh`, y, pageWidth);
  y = addLine(doc, "Cargo de conexión bloqueado", formatCurrency(data.lockedConnectionFee), y, pageWidth);
  y = addLine(doc, "Tarifa de reserva", formatCurrency(data.reservationFee), y, pageWidth);
  y = addLine(doc, "Penalidad máxima por no asistencia", formatCurrency(data.noShowPenalty), y, pageWidth);
  y = addLine(doc, "Precio confirmado", formatDateTime(data.priceLockedAt || data.createdAt, data.stationTimezone), y, pageWidth);
  y += 5;

  if (data.status.toUpperCase() === "SERVICE_UNAVAILABLE") {
    y = addSectionTitle(doc, "Incidencia operativa", y);
    y = addLine(doc, "Estado", "No se aplicará penalidad ni se registrará una no presentación.", y, pageWidth);
    if (data.serviceIssueCode) {
      y = addLine(doc, "Referencia operativa", data.serviceIssueCode, y, pageWidth);
    }
    y += 5;
  }

  const transactionCompleted = Boolean(data.transaction?.endTime)
    && [data.transaction?.status, data.transaction?.transactionStatus]
      .some((status) => String(status || "").toUpperCase() === "COMPLETED");
  if (transactionCompleted && y < pageHeight - 66) {
    y = addSectionTitle(doc, "Carga realizada", y);
    y = addLine(doc, "Energía entregada", `${asFiniteNumber(data.transaction?.kwhConsumed).toLocaleString("es-CO", { maximumFractionDigits: 2 })} kWh`, y, pageWidth);
    y = addLine(doc, "Tarifa aplicada", `${formatCurrency(data.transaction?.appliedPricePerKwh)} por kWh`, y, pageWidth);
    y = addLine(doc, "Total de la sesión", formatCurrency(data.transaction?.totalCost), y, pageWidth);
  } else {
    y = addSectionTitle(doc, "Estado de la carga", y);
    y = addLine(doc, "Información", "La energía y el valor final se generan únicamente al finalizar una sesión física confirmada por el cargador.", y, pageWidth);
  }

  const footerY = pageHeight - 17;
  doc.setDrawColor(229, 231, 235);
  doc.line(16, footerY - 5, pageWidth - 16, footerY - 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text("EVGreen · Green House Project S.A.S. · Este comprobante no reemplaza una factura electrónica.", 16, footerY);
  doc.text(`Generado: ${formatDateTime(new Date(), data.stationTimezone)}`, pageWidth - 16, footerY, { align: "right" });

  return Buffer.from(doc.output("arraybuffer"));
}
