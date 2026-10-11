/**
 * EVGreen by Green House Project
 * Ficha técnica y comercial del aliado del espacio.
 *
 * Este documento está deliberadamente separado del prospecto de inversión:
 * no recibe ni renderiza CAPEX, meta de inversión, ROI, payback, waterfall,
 * participación del inversionista ni porcentaje económico del aliado.
 */
import jsPDFModule from "jspdf";
import axios from "axios";
import { getPhotoMarkerLabel, getPhotoTypeLabel } from "../../shared/photo-type-labels";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsPDF = ((jsPDFModule as any).jsPDF ?? (jsPDFModule as any).default?.jsPDF ?? (jsPDFModule as any).default ?? jsPDFModule) as typeof import("jspdf").jsPDF;

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/FYcGXNchDiULWNfV.png";
const COVER_BG_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/WYwUkpexDtndNYrd.jpg";

export interface AllySpacePdfData {
  code: string;
  spaceName: string;
  spaceType: string;
  spaceTypeOther?: string | null;
  address: string;
  city: string;
  department?: string | null;
  country?: string | null;
  status?: string | null;
  submitterName?: string | null;
  submitterCompany?: string | null;
  availableAreaM2?: number | null;
  parkingSpots?: number | null;
  transformerCapacityKva?: number | null;
  hasElectricalPanel?: boolean | null;
  hasSolarPanels?: boolean | null;
  electricalDistance?: number | null;
  hasInternet?: boolean | null;
  operatingHoursStart?: string | null;
  operatingHoursEnd?: string | null;
  is24Hours?: boolean | null;
  estimatedDailyVehicles?: number | null;
  estimatedEvPercent?: number | null;
  nearbyAttractions?: string | null;
  socioeconomicStratum?: number | null;
  electricalViability?: string | null;
  estimatedPowerKw?: number | null;
  estimatedChargerCount?: number | null;
  recommendedChargerType?: string | null;
  technicalCondition?: string | null;
  photos: Array<{
    url: string;
    type?: string | null;
    caption?: string | null;
    isCover?: boolean;
    isConceptual?: boolean;
  }>;
  generatedAt: Date;
}

export interface AllyPdfContent {
  coverSubtitle: string;
  statusLabel: string;
  profileRows: Array<[string, string]>;
  technicalRows: Array<[string, string]>;
  operatingRows: Array<[string, string]>;
  allyResponsibilities: string[];
  evgreenResponsibilities: string[];
  nextSteps: string[];
  legalNote: string;
}

const COLORS = {
  green: [16, 185, 129] as [number, number, number],
  greenDark: [5, 150, 105] as [number, number, number],
  greenLight: [236, 253, 245] as [number, number, number],
  greenMid: [167, 243, 208] as [number, number, number],
  navy: [11, 19, 34] as [number, number, number],
  navyCard: [18, 28, 48] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray900: [30, 30, 30] as [number, number, number],
  gray700: [75, 85, 99] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
};

function setColor(doc: InstanceType<typeof jsPDF>, color: [number, number, number], type: "fill" | "text" | "draw" = "text") {
  if (type === "fill") doc.setFillColor(color[0], color[1], color[2]);
  else if (type === "text") doc.setTextColor(color[0], color[1], color[2]);
  else doc.setDrawColor(color[0], color[1], color[2]);
}

function spaceTypeLabel(type: string, other?: string | null): string {
  const labels: Record<string, string> = {
    parking: "Parqueadero",
    mall: "Centro comercial",
    gas_station: "Estación de servicio",
    hotel: "Hotel",
    restaurant: "Restaurante",
    office_building: "Edificio de oficinas",
    residential: "Conjunto residencial",
    supermarket: "Supermercado",
    hospital: "Hospital / clínica",
    university: "Universidad",
    airport: "Aeropuerto",
    highway_rest: "Área de descanso vial",
    other: other || "Otro",
  };
  return labels[type] || other || type || "No especificado";
}

function statusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    pending: "En evaluación",
    under_review: "En revisión técnica",
    approved: "Aprobado para avanzar",
    rejected: "Requiere revisión",
    letter_sent: "Carta enviada",
    letter_accepted: "Carta aceptada",
    published: "Publicado para financiación",
    funded: "Fondeado",
    in_construction: "En construcción",
    operational: "Operativo",
  };
  return labels[status || ""] || "En proceso de evaluación";
}

function electricalViabilityLabel(value?: string | null): string {
  if (value === "viable") return "Viable según información registrada";
  if (value === "requires_upgrade") return "Requiere ampliación o validación de red";
  if (value === "not_viable") return "No viable con la configuración registrada";
  return "Pendiente de validación técnica";
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Por confirmar";
  return `${Number(value).toLocaleString("es-CO")}${suffix}`;
}

function formatBoolean(value: boolean | null | undefined, yes = "Sí", no = "No informado"): string {
  return value ? yes : no;
}

function spaceTypeDescription(data: AllySpacePdfData): string {
  return `${spaceTypeLabel(data.spaceType, data.spaceTypeOther)} ubicado en ${data.city}${data.department ? `, ${data.department}` : ""}.`;
}

/**
 * Fuente única del texto que se permite en la ficha del aliado.
 * Al mantenerla separada del modelo financiero, el endpoint no puede enviar
 * accidentalmente campos de inversión al documento.
 */
export function buildAllySpacePdfContent(data: AllySpacePdfData): AllyPdfContent {
  const chargerText = data.estimatedChargerCount
    ? `${formatNumber(data.estimatedChargerCount)} cargador${Number(data.estimatedChargerCount) === 1 ? "" : "es"}`
    : "La cantidad de cargadores se definirá en la ingeniería de detalle";
  const powerText = data.estimatedPowerKw ? `${formatNumber(data.estimatedPowerKw, " kW")} DC` : "Por definir mediante ingeniería de detalle";

  return {
    coverSubtitle: `Documento técnico y comercial para el aliado que aporta el espacio. ${spaceTypeDescription(data)}`,
    statusLabel: statusLabel(data.status),
    profileRows: [
      ["Nombre del espacio", data.spaceName || "No informado"],
      ["Tipo de ubicación", spaceTypeLabel(data.spaceType, data.spaceTypeOther)],
      ["Dirección", data.address || "No informada"],
      ["Ciudad / departamento", `${data.city || "No informado"}${data.department ? `, ${data.department}` : ""}`],
      ...(data.submitterName ? [["Aliado registrado", data.submitterName] as [string, string]] : []),
      ...(data.submitterCompany ? [["Empresa / establecimiento", data.submitterCompany] as [string, string]] : []),
      ...(data.availableAreaM2 ? [["Área disponible", formatNumber(data.availableAreaM2, " m²")] as [string, string]] : []),
      ...(data.parkingSpots ? [["Puestos de parqueo", formatNumber(data.parkingSpots)] as [string, string]] : []),
      ...(data.nearbyAttractions ? [["Puntos de interés cercanos", data.nearbyAttractions] as [string, string]] : []),
    ],
    technicalRows: [
      ["Configuración preliminar", chargerText],
      ["Potencia proyectada", powerText],
      ["Tipo de cargador", data.recommendedChargerType || "Carga rápida DC / por confirmar"],
      ["Viabilidad eléctrica", electricalViabilityLabel(data.electricalViability)],
      ["Transformador existente", data.transformerCapacityKva ? formatNumber(data.transformerCapacityKva, " kVA") : "Por confirmar"],
      ["Tablero eléctrico", formatBoolean(data.hasElectricalPanel, "Disponible", "Por confirmar")],
      ["Distancia al tablero", data.electricalDistance ? formatNumber(data.electricalDistance, " m") : "Por confirmar"],
      ["Internet en el punto", formatBoolean(data.hasInternet)],
      ["Alcance solar", data.hasSolarPanels ? "Considerado en la información registrada" : "No informado / fuera del alcance actual"],
    ],
    operatingRows: [
      ["Horario", data.is24Hours ? "24 horas / 7 días" : `${data.operatingHoursStart || "Por confirmar"} a ${data.operatingHoursEnd || "Por confirmar"}`],
      ["Vehículos por día", data.estimatedDailyVehicles ? formatNumber(data.estimatedDailyVehicles) : "Por confirmar"],
      ["Participación EV estimada", data.estimatedEvPercent ? formatNumber(data.estimatedEvPercent, "%") : "Por confirmar"],
      ["Estrato socioeconómico", data.socioeconomicStratum ? formatNumber(data.socioeconomicStratum) : "Por confirmar"],
      ["Estado de la oportunidad", statusLabel(data.status)],
    ],
    allyResponsibilities: [
      "Acreditar la autorización para disponer del espacio y mantener actualizada la información suministrada.",
      "Facilitar el acceso para visitas técnicas, levantamientos, instalación y actividades de mantenimiento.",
      "Apoyar la coordinación de permisos internos, horarios de acceso y condiciones de seguridad del establecimiento.",
      "Revisar y formalizar en contrato separado las condiciones operativas y económicas aplicables al punto.",
    ],
    evgreenResponsibilities: [
      "Realizar la evaluación técnica y definir la configuración final de la infraestructura.",
      "Coordinar, según el alcance aprobado, la instalación, operación, mantenimiento y soporte de los equipos.",
      "Acompañar al aliado durante la puesta en marcha y la coordinación operativa del punto.",
      "Presentar el contrato definitivo con las responsabilidades y condiciones acordadas antes de instalar.",
    ],
    nextSteps: [
      "Validar en sitio la información técnica, eléctrica y de acceso.",
      "Definir la ingeniería de detalle, permisos y alcance de obra.",
      "Acordar el cronograma de implementación y la coordinación con el establecimiento.",
      "Formalizar el contrato específico antes de cualquier instalación o puesta en operación.",
    ],
    legalNote: "Esta ficha es informativa y no constituye contrato, oferta financiera ni garantía de instalación. La configuración, el cronograma, las responsabilidades y cualquier condición económica se definirán en documentos contractuales separados y quedarán sujetos a validación técnica, permisos y disponibilidad de recursos.",
  };
}

async function downloadImageAsBase64(url: string): Promise<{ data: string; format: string; width: number; height: number; aspect: number } | null> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: { "User-Agent": "EVGreen-Ally-PDF-Generator/1.0" },
    });
    const sharp = (await import("sharp")).default;
    const buffer = Buffer.from(response.data);
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 800;
    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    const isPng = contentType.includes("png") || url.toLowerCase().endsWith(".png");
    if (isPng) {
      const compressed = await sharp(buffer).resize({ width: 900, height: 700, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      return { data: `data:image/png;base64,${compressed.toString("base64")}`, format: "PNG", width, height, aspect: width / height };
    }
    const compressed = await sharp(buffer).resize({ width: 1200, height: 900, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    return { data: `data:image/jpeg;base64,${compressed.toString("base64")}`, format: "JPEG", width, height, aspect: width / height };
  } catch {
    return null;
  }
}

function drawSectionTitle(doc: InstanceType<typeof jsPDF>, title: string, x: number, y: number, width: number): number {
  setColor(doc, COLORS.green, "fill");
  doc.rect(x, y - 1, 4, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setColor(doc, COLORS.gray900);
  doc.text(title, x + 7, y + 5);
  setColor(doc, COLORS.gray200, "draw");
  doc.setLineWidth(0.3);
  doc.line(x, y + 9, x + width, y + 9);
  return y + 14;
}

function drawFooter(doc: InstanceType<typeof jsPDF>, code: string, page: number, totalPages: number, width: number, height: number, margin: number) {
  setColor(doc, COLORS.gray500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);
  doc.text(`Página ${page} de ${totalPages} · Ficha del Aliado EVGreen · ${code}`, width / 2, height - 7, { align: "center" });
  setColor(doc, COLORS.gray200, "draw");
  doc.setLineWidth(0.3);
  doc.line(margin, height - 10, width - margin, height - 10);
}

function drawRows(doc: InstanceType<typeof jsPDF>, rows: Array<[string, string]>, x: number, y: number, width: number, labelWidth = 53): number {
  rows.forEach(([label, value], index) => {
    const rowHeight = 9;
    setColor(doc, index % 2 === 0 ? COLORS.gray100 : COLORS.white, "fill");
    doc.rect(x, y - 1, width, rowHeight, "F");
    setColor(doc, COLORS.gray500);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(label, x + 3, y + 4.5);
    setColor(doc, COLORS.gray900);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, width - labelWidth - 7);
    doc.text(lines.slice(0, 2), x + labelWidth + 3, y + 4.5);
    y += rowHeight;
  });
  return y;
}

function drawBulletList(doc: InstanceType<typeof jsPDF>, items: string[], x: number, y: number, width: number, color: [number, number, number]): number {
  setColor(doc, color);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, width - 9);
    doc.circle(x + 2, y + 1.5, 1.2, "F");
    doc.text(lines, x + 7, y + 3);
    y += lines.length * 4.5 + 3;
  }
  return y;
}

function drawFitImage(doc: InstanceType<typeof jsPDF>, image: { data: string; format: string; aspect: number } | null, x: number, y: number, width: number, height: number, background = COLORS.navyCard) {
  setColor(doc, background, "fill");
  doc.rect(x, y, width, height, "F");
  if (!image) return;
  const sourceAspect = image.aspect > 0 ? image.aspect : width / height;
  let drawWidth = width;
  let drawHeight = width / sourceAspect;
  if (drawHeight > height) {
    drawHeight = height;
    drawWidth = height * sourceAspect;
  }
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  try { doc.addImage(image.data, image.format, drawX, drawY, drawWidth, drawHeight, undefined, "FAST"); } catch { /* image unavailable */ }
  setColor(doc, COLORS.green, "draw");
  doc.setLineWidth(0.35);
  doc.rect(x, y, width, height);
}

function addHeader(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, logo: { data: string; format: string } | null, width: number, margin: number) {
  setColor(doc, COLORS.green, "fill");
  doc.rect(0, 0, width, 14, "F");
  if (logo) {
    try { doc.addImage(logo.data, logo.format, margin, 2, 28, 10); } catch { /* skip */ }
  } else {
    setColor(doc, COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("EVGreen", margin, 10);
  }
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`${data.spaceName} · ${data.code}`, width - margin, 9, { align: "right" });
}

function addCover(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, content: AllyPdfContent, logo: { data: string; format: string } | null, cover: { data: string; format: string; aspect: number } | null, coverPhoto: AllySpacePdfData["photos"][number] | null, width: number, height: number, margin: number) {
  setColor(doc, COLORS.navy, "fill");
  doc.rect(0, 0, width, height, "F");
  if (logo) {
    try { doc.addImage(logo.data, logo.format, margin, 10, 48, 15); } catch { /* skip */ }
  } else {
    setColor(doc, COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("EVGreen", margin, 22);
  }

  setColor(doc, COLORS.green, "fill");
  doc.roundedRect(width - margin - 55, 10, 55, 7.5, 2, 2, "F");
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.text("FICHA DEL ALIADO", width - margin - 27.5, 15.2, { align: "center" });

  const heroY = 32;
  const heroH = 112;
  drawFitImage(doc, cover, margin, heroY, width - margin * 2, heroH);
  if (coverPhoto) {
    setColor(doc, COLORS.gray200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(getPhotoMarkerLabel(coverPhoto.type, coverPhoto.caption), width - margin, heroY + heroH + 5, { align: "right" });
    if (coverPhoto.isConceptual) {
      setColor(doc, COLORS.amber, "text");
      doc.setFont("helvetica", "bold");
      doc.text("RENDER CONCEPTUAL", margin, heroY + heroH + 5);
    }
  }

  const titleY = heroY + heroH + 18;
  setColor(doc, COLORS.green, "draw");
  doc.setLineWidth(2.5);
  doc.line(margin, titleY, margin + 28, titleY);
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  const nameLines = doc.splitTextToSize(data.spaceName.toUpperCase(), width - margin * 2);
  doc.text(nameLines.slice(0, 2), margin, titleY + 12);
  setColor(doc, COLORS.greenMid);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`${data.city}${data.department ? `, ${data.department}` : ""} · ${spaceTypeLabel(data.spaceType, data.spaceTypeOther)}`, margin, titleY + 23);

  setColor(doc, COLORS.navyCard, "fill");
  doc.roundedRect(margin, titleY + 31, width - margin * 2, 47, 3, 3, "F");
  setColor(doc, COLORS.greenMid);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PROPÓSITO DEL DOCUMENTO", margin + 7, titleY + 41);
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const subtitleLines = doc.splitTextToSize(content.coverSubtitle, width - margin * 2 - 14);
  doc.text(subtitleLines.slice(0, 3), margin + 7, titleY + 49);
  setColor(doc, COLORS.greenMid);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`Estado: ${content.statusLabel}`, margin + 7, titleY + 68);
  setColor(doc, COLORS.gray200);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("La configuración definitiva se confirma mediante validación técnica y contrato específico.", margin + 7, titleY + 73);

  setColor(doc, COLORS.gray500);
  doc.setFontSize(7.2);
  doc.text(`${data.code} · ${data.generatedAt.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })} · Documento confidencial para el aliado`, width / 2, height - 11, { align: "center" });
}

function addProfilePage(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, content: AllyPdfContent, logo: { data: string; format: string } | null, width: number, height: number, margin: number) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 23;
  y = drawSectionTitle(doc, "PERFIL DEL ESPACIO", margin, y, contentWidth);
  y = drawRows(doc, content.profileRows, margin, y, contentWidth, 54) + 9;
  y = drawSectionTitle(doc, "ESPECIFICACIONES TÉCNICAS PRELIMINARES", margin, y, contentWidth);
  y = drawRows(doc, content.technicalRows, margin, y, contentWidth, 57) + 9;
  y = drawSectionTitle(doc, "OPERACIÓN Y DEMANDA DEL PUNTO", margin, y, contentWidth);
  drawRows(doc, content.operatingRows, margin, y, contentWidth, 54);
}

function addResponsibilitiesPage(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, content: AllyPdfContent, logo: { data: string; format: string } | null, width: number, height: number, margin: number) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 25;
  y = drawSectionTitle(doc, "MODELO DE COLABORACIÓN", margin, y, contentWidth);
  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const intro = doc.splitTextToSize("EVGreen y el aliado coordinan la habilitación de un punto de carga rápida en el espacio postulado. Este documento resume responsabilidades operativas y próximos pasos; no reemplaza el contrato definitivo.", contentWidth);
  doc.text(intro, margin, y);
  y += intro.length * 5 + 10;

  const gap = 6;
  const colW = (contentWidth - gap) / 2;
  const cardY = y;
  const cardH = 86;
  setColor(doc, COLORS.greenLight, "fill");
  doc.roundedRect(margin, cardY, colW, cardH, 3, 3, "F");
  setColor(doc, COLORS.greenDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Responsabilidades del aliado", margin + 6, cardY + 10);
  drawBulletList(doc, content.allyResponsibilities, margin + 6, cardY + 16, colW - 12, COLORS.gray700);

  setColor(doc, [239, 246, 255], "fill");
  doc.roundedRect(margin + colW + gap, cardY, colW, cardH, 3, 3, "F");
  setColor(doc, COLORS.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Responsabilidades de EVGreen", margin + colW + gap + 6, cardY + 10);
  drawBulletList(doc, content.evgreenResponsibilities, margin + colW + gap + 6, cardY + 16, colW - 12, COLORS.gray700);

  y = cardY + cardH + 14;
  y = drawSectionTitle(doc, "PRÓXIMOS PASOS", margin, y, contentWidth);
  y = drawBulletList(doc, content.nextSteps, margin + 4, y, contentWidth - 8, COLORS.greenDark) + 8;

  setColor(doc, [255, 251, 235], "fill");
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, "F");
  setColor(doc, [146, 64, 14]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("NOTA IMPORTANTE", margin + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  const legalLines = doc.splitTextToSize(content.legalNote, contentWidth - 12);
  doc.text(legalLines.slice(0, 4), margin + 6, y + 16);
}

function addGalleryPages(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, logo: { data: string; format: string } | null, photoImages: Array<{ image: { data: string; format: string; aspect: number } | null; photo: AllySpacePdfData["photos"][number] }>, width: number, height: number, margin: number): void {
  const contentWidth = width - margin * 2;
  const photoW = (contentWidth - 6) / 2;
  const photoH = 48;
  const rowGap = 23;
  const perPage = 4;
  const groups: typeof photoImages[] = [];
  for (let i = 0; i < photoImages.length; i += perPage) groups.push(photoImages.slice(i, i + perPage));
  if (groups.length === 0) groups.push([]);

  groups.forEach((group, groupIndex) => {
    doc.addPage();
    addHeader(doc, data, logo, width, margin);
    let y = 24;
    y = drawSectionTitle(doc, groupIndex === 0 ? `GALERÍA DEL ESPACIO (${photoImages.length} fotos)` : `GALERÍA DEL ESPACIO · CONTINUACIÓN ${groupIndex + 1}`, margin, y, contentWidth);
    if (group.length === 0) {
      setColor(doc, COLORS.gray500);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("No hay fotografías disponibles para este espacio.", margin, y + 10);
    }
    group.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + col * (photoW + 6);
      const py = y + row * (photoH + rowGap);
      drawFitImage(doc, item.image, x, py, photoW, photoH, COLORS.gray100);
      const labelY = py + photoH + 4;
      setColor(doc, COLORS.greenDark, "fill");
      doc.roundedRect(x + 2, labelY - 2.5, photoW - 4, 6, 1.5, 1.5, "F");
      setColor(doc, COLORS.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.text(getPhotoTypeLabel(item.photo.type), x + photoW / 2, labelY + 1.2, { align: "center" });
      setColor(doc, item.photo.isConceptual ? COLORS.amber : COLORS.gray500);
      doc.setFont("helvetica", item.photo.isConceptual ? "bold" : "normal");
      doc.setFontSize(5.8);
      const state = [item.photo.isCover ? "Portada" : null, item.photo.isConceptual ? "Render conceptual" : "Fotografía del sitio"].filter(Boolean).join(" · ");
      doc.text(state, x + photoW / 2, labelY + 6.5, { align: "center" });
      if (item.photo.caption?.trim()) {
        setColor(doc, COLORS.gray700);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(5.8);
        doc.text(item.photo.caption.trim().substring(0, 62), x + photoW / 2, labelY + 11, { align: "center" });
      }
    });
  });
}

export async function generateAllySpacePdf(data: AllySpacePdfData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 18;
  const content = buildAllySpacePdfContent(data);
  const coverIndex = data.photos.findIndex((photo) => Boolean(photo.isCover));
  const fallbackIndex = coverIndex >= 0 ? coverIndex : (data.photos.length > 0 ? 0 : -1);
  const coverPhoto = fallbackIndex >= 0 ? data.photos[fallbackIndex] : null;
  const [logo, defaultCover, ...photoImages] = await Promise.all([
    downloadImageAsBase64(LOGO_URL),
    downloadImageAsBase64(COVER_BG_URL),
    ...data.photos.map((photo) => downloadImageAsBase64(photo.url)),
  ]);
  const coverImage = fallbackIndex >= 0 ? photoImages[fallbackIndex] || defaultCover : defaultCover;

  addCover(doc, data, content, logo, coverImage, coverPhoto, width, height, margin);
  doc.addPage();
  addProfilePage(doc, data, content, logo, width, height, margin);
  doc.addPage();
  addResponsibilitiesPage(doc, data, content, logo, width, height, margin);

  const galleryPhotos = data.photos
    .map((photo, index) => ({ photo, image: photoImages[index] || null }))
    .filter((item) => !item.photo.isCover);
  addGalleryPages(doc, data, logo, galleryPhotos, width, height, margin);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let page = 2; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFooter(doc, data.code, page, totalPages, width, height, margin);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
