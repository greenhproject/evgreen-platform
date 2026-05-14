/**
 * EVGreen - Servicio de generación de PDF para Carta de Intención firmada
 * Genera un PDF profesional como constancia legal de la firma digital
 * con todos los datos del firmante, fecha/hora, IP y user-agent.
 */
import jsPDF from "jspdf";
import "jspdf-autotable";

interface LetterPdfData {
  // Datos del espacio
  spaceName: string;
  spaceType: string;
  city: string;
  department: string;
  address: string;
  code: string;

  // Datos del firmante
  signerName: string;
  signerDocument: string;
  signerIp: string;
  signerUserAgent: string;

  // Datos de la firma
  signedAt: Date;

  // Datos del postulante original
  submitterName: string;
  submitterEmail: string;
  submitterPhone: string;
}

/**
 * Genera un PDF profesional con la constancia de firma de la carta de intención.
 * Retorna un Buffer con el contenido del PDF.
 */
export function generateSignedLetterPdf(data: LetterPdfData): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // ============================================================
  // HEADER - Franja verde con logo texto
  // ============================================================
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setFillColor(5, 150, 105); // emerald-600
  doc.rect(0, 32, pageWidth, 3, "F");

  // Logo texto
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("EVGreen", margin, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Green House Project S.A.S. | NIT: 901.856.696-1", margin, 26);

  y = 45;

  // ============================================================
  // TÍTULO DEL DOCUMENTO
  // ============================================================
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("CONSTANCIA DE FIRMA DIGITAL", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Carta de Intención - Aliado Comercial", pageWidth / 2, y, { align: "center" });
  y += 5;

  // Línea separadora
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================================
  // INFORMACIÓN DEL DOCUMENTO
  // ============================================================
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");

  const signedDate = data.signedAt;
  const dateStr = signedDate.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });
  const timeStr = signedDate.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Bogota",
  });

  doc.text(`Documento generado el ${dateStr} a las ${timeStr} (hora Colombia)`, pageWidth / 2, y, { align: "center" });
  doc.text(`Código de postulación: ${data.code}`, pageWidth / 2, y + 5, { align: "center" });
  y += 14;

  // ============================================================
  // SECCIÓN 1: DATOS DEL ESPACIO
  // ============================================================
  y = drawSectionTitle(doc, "1. DATOS DEL ESPACIO POSTULADO", margin, y, contentWidth);

  const spaceData = [
    ["Nombre del espacio", data.spaceName],
    ["Tipo de espacio", data.spaceType],
    ["Ciudad", data.city],
    ["Departamento", data.department],
    ["Dirección", data.address],
    ["Código de postulación", data.code],
  ];

  (doc as any).autoTable({
    startY: y,
    head: [],
    body: spaceData,
    theme: "plain",
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [50, 50, 50], fontSize: 9 },
      1: { textColor: [30, 30, 30], fontSize: 9 },
    },
    styles: {
      cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
      lineColor: [230, 230, 230],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ============================================================
  // SECCIÓN 2: DATOS DEL POSTULANTE
  // ============================================================
  y = drawSectionTitle(doc, "2. DATOS DEL POSTULANTE", margin, y, contentWidth);

  const submitterData = [
    ["Nombre", data.submitterName],
    ["Correo electrónico", data.submitterEmail],
    ["Teléfono", data.submitterPhone || "No proporcionado"],
  ];

  (doc as any).autoTable({
    startY: y,
    head: [],
    body: submitterData,
    theme: "plain",
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [50, 50, 50], fontSize: 9 },
      1: { textColor: [30, 30, 30], fontSize: 9 },
    },
    styles: {
      cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
      lineColor: [230, 230, 230],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ============================================================
  // SECCIÓN 3: CONTENIDO DE LA CARTA DE INTENCIÓN
  // ============================================================
  y = drawSectionTitle(doc, "3. CONTENIDO DE LA CARTA DE INTENCIÓN", margin, y, contentWidth);

  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");

  const letterParagraphs = [
    `Por medio de la presente, manifiesto mi interés y voluntad de participar como Aliado Comercial en la red de infraestructura de carga para vehículos eléctricos de EVGreen, una marca de Green House Project S.A.S. (NIT 901.856.696-1).`,
    `Declaro que soy el propietario, representante legal o persona autorizada para disponer del espacio postulado, y que:`,
  ];

  for (const para of letterParagraphs) {
    const lines = doc.splitTextToSize(para, contentWidth);
    if (y + lines.length * 4 > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }

  // Compromisos del aliado
  const aliadoItems = [
    "Autorizo a EVGreen a realizar los estudios técnicos necesarios para evaluar la viabilidad de instalación de cargadores de vehículos eléctricos en mi espacio.",
    "Autorizo la publicación de la información del espacio en la plataforma de inversión de EVGreen para atraer capital que financie la instalación.",
    "Me comprometo a facilitar el acceso al espacio para las visitas técnicas y la eventual instalación de los equipos.",
    "Entiendo que esta carta de intención no constituye un contrato vinculante, sino una manifestación de interés mutuo que será formalizada mediante un contrato específico una vez se asegure el financiamiento.",
  ];

  for (const item of aliadoItems) {
    const bulletText = `  •  ${item}`;
    const lines = doc.splitTextToSize(bulletText, contentWidth - 4);
    if (y + lines.length * 4 > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 4 + 1;
  }

  y += 3;

  const evgreenIntro = "EVGreen se compromete a:";
  doc.text(evgreenIntro, margin, y);
  y += 5;

  const evgreenItems = [
    "Realizar la inversión necesaria para la instalación de los cargadores sin costo para el aliado comercial.",
    "Encargarse de la operación, mantenimiento y soporte técnico de los equipos.",
    "Compartir un porcentaje de los ingresos generados por las cargas realizadas en el espacio, según los términos que se acuerden en el contrato definitivo.",
  ];

  for (const item of evgreenItems) {
    const bulletText = `  •  ${item}`;
    const lines = doc.splitTextToSize(bulletText, contentWidth - 4);
    if (y + lines.length * 4 > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 4 + 1;
  }

  y += 4;

  // Nota legal
  doc.setFillColor(255, 250, 230);
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.5);
  const notaText = "Nota legal: Esta carta de intención es un documento preliminar que expresa la voluntad de las partes. Los términos definitivos serán establecidos en un contrato formal que será negociado y firmado por ambas partes antes de cualquier instalación.";
  const notaLines = doc.splitTextToSize(notaText, contentWidth - 10);
  const notaHeight = notaLines.length * 4 + 6;

  if (y + notaHeight > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = 20;
  }

  doc.roundedRect(margin, y - 2, contentWidth, notaHeight, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(120, 80, 0);
  doc.text(notaLines, margin + 5, y + 3);
  y += notaHeight + 8;

  // ============================================================
  // SECCIÓN 4: DATOS DE LA FIRMA DIGITAL
  // ============================================================
  if (y + 60 > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    y = 20;
  }

  y = drawSectionTitle(doc, "4. CONSTANCIA DE FIRMA DIGITAL", margin, y, contentWidth);

  // Recuadro verde de firma
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y - 2, contentWidth, 52, 3, 3, "FD");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(5, 150, 105);
  doc.text("FIRMADO DIGITALMENTE", margin + 5, y + 5);

  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");

  const signerInfo = [
    [`Firmante: ${data.signerName}`],
    [`Documento: ${data.signerDocument}`],
    [`Fecha y hora: ${dateStr} a las ${timeStr}`],
    [`Dirección IP: ${data.signerIp}`],
  ];

  let sigY = y + 12;
  for (const [line] of signerInfo) {
    doc.text(line, margin + 5, sigY);
    sigY += 5.5;
  }

  // User-Agent (truncado si es muy largo)
  const uaTruncated = data.signerUserAgent.length > 100
    ? data.signerUserAgent.substring(0, 100) + "..."
    : data.signerUserAgent;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(`Navegador: ${uaTruncated}`, margin + 5, sigY + 2);

  y += 60;

  // ============================================================
  // SECCIÓN 5: HASH DE VERIFICACIÓN
  // ============================================================
  y += 5;
  doc.setFillColor(243, 244, 246); // gray-100
  doc.setDrawColor(209, 213, 219); // gray-300
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y - 2, contentWidth, 18, 2, 2, "FD");

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("Verificación de integridad del documento", margin + 5, y + 3);

  // Generar un hash simple basado en los datos de la firma
  const hashInput = `${data.code}|${data.signerName}|${data.signerDocument}|${data.signedAt.toISOString()}|${data.signerIp}`;
  const hashHex = simpleHash(hashInput);

  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`SHA-256: ${hashHex}`, margin + 5, y + 9);
  doc.text(`Timestamp: ${data.signedAt.toISOString()}`, margin + 5, y + 13);

  // ============================================================
  // FOOTER
  // ============================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();

    // Línea de footer
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 15, pageWidth - margin, pageH - 15);

    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont("helvetica", "normal");
    doc.text(
      "EVGreen - Green House Project S.A.S. | www.evgreen.lat | Documento generado automáticamente",
      margin,
      pageH - 10
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageH - 10, { align: "right" });
  }

  // Retornar como Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// ============================================================
// HELPERS
// ============================================================

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, width: number): number {
  doc.setFillColor(16, 185, 129);
  doc.rect(x, y - 1, 3, 7, "F");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, x + 6, y + 4);

  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(x, y + 7, x + width, y + 7);

  return y + 12;
}

/**
 * Hash simple para verificación de integridad.
 * En producción se usaría crypto.createHash('sha256'), pero jsPDF
 * corre en contexto server donde crypto está disponible.
 */
function simpleHash(input: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(input).digest("hex");
}
