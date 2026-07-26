/**
 * EVGreen by Green House Project
 * Servicio de generación de Prospecto de Inversión PDF v2.0
 *
 * Diseño: portada IA impactante, fondo blanco en páginas internas,
 * acentos verde EVGreen, estilo prospecto financiero profesional.
 * Optimizado para impresión en papel carta/A4.
 * Enfoque narrativo: el lector es el INVERSIONISTA.
 */
// jsPDF 4.x ESM compatible import for Node.js
import jsPDFModule from "jspdf";
import autoTable from "jspdf-autotable";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsPDF = ((jsPDFModule as any).jsPDF ?? (jsPDFModule as any).default?.jsPDF ?? (jsPDFModule as any).default ?? jsPDFModule) as typeof import("jspdf").jsPDF;
import axios from "axios";

// ============================================================
// ASSETS ESTÁTICOS (CDN público — disponible en el servidor)
// ============================================================
const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/XXADhbJOsjLOaeVi.png";
const COVER_BG_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/WYwUkpexDtndNYrd.jpg";

// ============================================================
// TIPOS
// ============================================================
export interface ProspectoPdfData {
  code: string;
  spaceName: string;
  spaceType: string;
  spaceTypeOther?: string | null;
  address: string;
  city: string;
  department?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  // Características técnicas
  availableAreaM2?: number | null;
  parkingSpots?: number | null;
  transformerCapacityKva?: number | null;
  hasElectricalPanel?: boolean | null;
  electricalDistance?: number | null;
  hasInternet?: boolean | null;
  operatingHoursStart?: string | null;
  operatingHoursEnd?: string | null;
  is24Hours?: boolean | null;
  estimatedDailyVehicles?: number | null;
  estimatedEvPercent?: number | null;
  nearbyAttractions?: string | null;
  socioeconomicStratum?: number | null;
  // Análisis IA
  aiScore?: number | null;
  aiAnalysis?: string | null;
  // Financiero
  estimatedInvestmentCop?: number | null;
  estimatedPowerKw?: number | null;
  estimatedChargerCount?: number | null;
  // Configuración dinámica del prospecto
  allySharePercent: number;
  investorSharePercent: number;
  platformSharePercent: number;
  // Modelo financiero por potencia instalada
  installedPowerKw?: number;
  tarifaKwhCop?: number;
  // Fotos del espacio
  photos: Array<{ url: string; caption?: string | null }>;
  generatedAt: Date;
}

// ============================================================
// COLORES MARCA
// ============================================================
const C = {
  green:      [16, 185, 129] as [number, number, number],
  greenDark:  [5, 150, 105] as [number, number, number],
  greenLight: [236, 253, 245] as [number, number, number],
  greenMid:   [167, 243, 208] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  black:      [20, 20, 20] as [number, number, number],
  gray900:    [30, 30, 30] as [number, number, number],
  gray700:    [75, 85, 99] as [number, number, number],
  gray500:    [107, 114, 128] as [number, number, number],
  gray200:    [229, 231, 235] as [number, number, number],
  gray100:    [243, 244, 246] as [number, number, number],
  amber:      [245, 158, 11] as [number, number, number],
  blue:       [59, 130, 246] as [number, number, number],
  navy:       [15, 23, 42] as [number, number, number],
};

// ============================================================
// HELPERS
// ============================================================
function setColor(doc: InstanceType<typeof jsPDF>, color: [number, number, number], type: "fill" | "text" | "draw" = "text") {
  if (type === "fill") doc.setFillColor(color[0], color[1], color[2]);
  else if (type === "text") doc.setTextColor(color[0], color[1], color[2]);
  else doc.setDrawColor(color[0], color[1], color[2]);
}

function formatCOP(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-CO");
}

function formatScore(score: number): string {
  if (score >= 80) return "ALTO";
  if (score >= 60) return "MEDIO-ALTO";
  if (score >= 40) return "MEDIO";
  return "BAJO";
}

function spaceTypeLabel(type: string, other?: string | null): string {
  const map: Record<string, string> = {
    parking: "Parqueadero", mall: "Centro Comercial", gas_station: "Estación de Servicio",
    hotel: "Hotel", restaurant: "Restaurante", office_building: "Edificio de Oficinas",
    residential: "Conjunto Residencial", supermarket: "Supermercado", hospital: "Hospital / Clínica",
    university: "Universidad", airport: "Aeropuerto", highway_rest: "Área de Descanso Vial",
    other: other || "Otro",
  };
  return map[type] || type;
}

async function downloadImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer", timeout: 10000,
      headers: { "User-Agent": "EVGreen-PDF-Generator/2.0" },
    });
    const contentType = response.headers["content-type"] || "image/jpeg";
    const format = contentType.includes("png") ? "PNG" : "JPEG";
    const base64 = Buffer.from(response.data).toString("base64");
    return { data: `data:${contentType};base64,${base64}`, format };
  } catch { return null; }
}

function drawSectionTitle(doc: InstanceType<typeof jsPDF>, title: string, x: number, y: number, width: number): number {
  setColor(doc, C.green, "fill");
  doc.rect(x, y - 1, 4, 8, "F");
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  setColor(doc, C.gray900, "text");
  doc.text(title, x + 7, y + 5);
  setColor(doc, C.gray200, "draw");
  doc.setLineWidth(0.3);
  doc.line(x, y + 9, x + width, y + 9);
  return y + 14;
}

function addPageHeader(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  PW: number, M: number,
  logoImg: { data: string; format: string } | null,
): number {
  setColor(doc, C.green, "fill");
  doc.rect(0, 0, PW, 14, "F");
  if (logoImg) {
    try { doc.addImage(logoImg.data, logoImg.format, M, 2, 28, 10); } catch { /* skip */ }
  } else {
    setColor(doc, C.white, "text");
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("EVGreen", M, 10);
  }
  setColor(doc, C.white, "text");
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text(`${data.spaceName}  ·  ${data.code}`, PW - M, 9, { align: "right" });
  return 22;
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================
export async function generateProspectoPdf(data: ProspectoPdfData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = PW - M * 2;

  const [logoImg, coverBgImg, ...photoImgs] = await Promise.all([
    downloadImageAsBase64(LOGO_URL),
    downloadImageAsBase64(COVER_BG_URL),
    ...data.photos.map(p => downloadImageAsBase64(p.url)),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiData: any = null;
  if (data.aiAnalysis) {
    try { aiData = JSON.parse(data.aiAnalysis); } catch { /* ignore */ }
  }

  // PÁGINA 1 — PORTADA IMPACTANTE
  addPortada(doc, data, PW, PH, M, CW, logoImg, coverBgImg, photoImgs[0]);

  // PÁGINA 2 — RESUMEN EJECUTIVO
  doc.addPage();
  let y = addPageHeader(doc, data, PW, M, logoImg);
  y = addResumenEjecutivo(doc, data, aiData, y, M, CW, PW, PH);

  // PÁGINA 3 — DATOS TÉCNICOS + FOTOS
  doc.addPage();
  y = addPageHeader(doc, data, PW, M, logoImg);
  y = addDatosTecnicos(doc, data, y, M, CW, PW, PH);
  // Fotos: primera en portada, resto en página 3 y páginas adicionales si es necesario
  const remainingPhotos = photoImgs.slice(1);
  const remainingPhotoData = data.photos.slice(1);
  y = addFotos(doc, remainingPhotos, remainingPhotoData, y, M, CW, PW, PH, doc, logoImg);

  // PÁGINA 4 — PROYECCIÓN FINANCIERA POR ESCENARIOS
  doc.addPage();
  y = addPageHeader(doc, data, PW, M, logoImg);
  y = addProyeccionFinanciera(doc, data, y, M, CW, PW, PH);

  // PÁGINA 5 — MAPA + CIERRE
  doc.addPage();
  y = addPageHeader(doc, data, PW, M, logoImg);
  y = await addMapa(doc, data, y, M, CW, PW, PH);
  addCierre(doc, data, PW, PH, M, CW);

  // Numerar páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i === 1) continue; // portada no lleva numeración
    setColor(doc, C.gray500, "text");
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${totalPages}  ·  Prospecto de Inversión EVGreen  ·  ${data.code}`, PW / 2, PH - 7, { align: "center" });
    setColor(doc, C.gray200, "draw");
    doc.setLineWidth(0.3);
    doc.line(M, PH - 10, PW - M, PH - 10);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ============================================================
// PORTADA — DISEÑO IMPACTANTE CON IMAGEN IA
// ============================================================
function addPortada(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  PW: number, PH: number, M: number, CW: number,
  logoImg: { data: string; format: string } | null,
  coverBgImg: { data: string; format: string } | null,
  spaceImg: { data: string; format: string } | null,
) {
  // Imagen de fondo IA (portada completa)
  if (coverBgImg) {
    try { doc.addImage(coverBgImg.data, coverBgImg.format, 0, 0, PW, PH, undefined, "FAST"); } catch { /* skip */ }
  } else {
    setColor(doc, C.navy, "fill");
    doc.rect(0, 0, PW, PH, "F");
  }

  // Overlay oscuro en la parte superior (para logo)
  setColor(doc, C.navy, "fill");
  doc.setGState(new (doc as any).GState({ opacity: 0.78 }));
  doc.rect(0, 0, PW, 42, "F");
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Overlay oscuro en la parte inferior (para texto)
  setColor(doc, C.navy, "fill");
  doc.setGState(new (doc as any).GState({ opacity: 0.85 }));
  doc.rect(0, PH - 138, PW, 138, "F");
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Logo EVGreen
  if (logoImg) {
    try { doc.addImage(logoImg.data, logoImg.format, M, 8, 54, 21); } catch { /* skip */ }
  } else {
    setColor(doc, C.white, "text");
    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text("EVGreen", M, 24);
  }

  // "by Green House Project"
  setColor(doc, C.greenMid, "text");
  doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
  doc.text("by Green House Project", M, 34);

  // Badge "PROSPECTO DE INVERSIÓN"
  setColor(doc, C.green, "fill");
  doc.roundedRect(PW - M - 60, 11, 60, 11, 2, 2, "F");
  setColor(doc, C.white, "text");
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("PROSPECTO DE INVERSIÓN", PW - M - 30, 18, { align: "center" });

  // Línea decorativa verde
  const textY = PH - 128;
  setColor(doc, C.green, "draw");
  doc.setLineWidth(2);
  doc.line(M, textY, M + 28, textY);

  // Nombre del espacio
  setColor(doc, C.white, "text");
  doc.setFontSize(26); doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(data.spaceName.toUpperCase(), CW);
  doc.text(nameLines.slice(0, 2), M, textY + 14);

  // Ciudad y tipo
  setColor(doc, C.greenMid, "text");
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(`${data.city}${data.department ? ", " + data.department : ""}  ·  ${spaceTypeLabel(data.spaceType, data.spaceTypeOther)}`, M, textY + 30);

  // Separador
  setColor(doc, C.green, "fill");
  doc.setGState(new (doc as any).GState({ opacity: 0.35 }));
  doc.rect(M, textY + 35, CW, 0.5, "F");
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Métricas clave en 3 columnas
  const metricsY = textY + 46;
  const colW = CW / 3;
  const inv = data.estimatedInvestmentCop || 0;
  const powerKw = data.installedPowerKw || data.estimatedPowerKw || 0;
  const chargers = data.estimatedChargerCount || 0;
  const score = data.aiScore || 0;

  const metrics = [
    { label: "INVERSIÓN REQUERIDA", value: inv > 0 ? formatCOP(inv) : "A definir", sub: "Capital total" },
    { label: "POTENCIA INSTALADA", value: powerKw > 0 ? `${powerKw} kW` : "A definir", sub: chargers > 0 ? `${chargers} cargadores` : "Cargadores EV" },
    { label: "VIABILIDAD IA", value: score > 0 ? `${score}/100` : "—", sub: score > 0 ? formatScore(score) : "Pendiente" },
  ];

  metrics.forEach((m, i) => {
    const mx = M + i * colW;
    setColor(doc, C.greenMid, "text");
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text(m.label, mx, metricsY);
    setColor(doc, C.white, "text");
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text(m.value, mx, metricsY + 10);
    setColor(doc, C.gray200, "text");
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text(m.sub, mx, metricsY + 17);
  });

  // Código y fecha
  setColor(doc, C.gray500, "text");
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text(
    `${data.code}  ·  ${data.generatedAt.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}  ·  Confidencial`,
    PW / 2, PH - 12, { align: "center" }
  );
}

// ============================================================
// RESUMEN EJECUTIVO — ENFOCADO AL INVERSIONISTA
// ============================================================
function addResumenEjecutivo(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiData: any,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "OPORTUNIDAD DE INVERSIÓN", M, y, CW);

  setColor(doc, C.gray700, "text");
  doc.setFontSize(9.5); doc.setFont("helvetica", "normal");
  const intro = `EVGreen by Green House Project le presenta esta oportunidad de inversión en infraestructura de carga para vehículos eléctricos en ${data.spaceName}, ubicado en ${data.city}. Este punto ha sido evaluado por nuestro sistema de inteligencia artificial, considerando factores de tráfico, acceso eléctrico, demanda EV y retorno financiero proyectado.`;
  const introLines = doc.splitTextToSize(intro, CW);
  doc.text(introLines, M, y);
  y += introLines.length * 5 + 8;

  if (data.aiScore) {
    const scoreColor: [number, number, number] = data.aiScore >= 70 ? C.green : data.aiScore >= 50 ? C.amber : [239, 68, 68];
    setColor(doc, scoreColor, "fill");
    doc.roundedRect(M, y, CW, 18, 3, 3, "F");
    setColor(doc, C.white, "text");
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`Score de Viabilidad: ${data.aiScore}/100 — ${formatScore(data.aiScore)}`, M + 6, y + 7);
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    const scoreDesc = data.aiScore >= 70
      ? "Este punto presenta condiciones favorables para una inversión con alto potencial de retorno."
      : data.aiScore >= 50
        ? "Este punto presenta condiciones moderadas con oportunidades de mejora identificadas."
        : "Este punto requiere inversión adicional en infraestructura para optimizar el retorno.";
    doc.text(scoreDesc, M + 6, y + 13);
    y += 24;
  }

  if (aiData) {
    const strengths: string[] = aiData.strengths || aiData.fortalezas || [];
    const weaknesses: string[] = aiData.weaknesses || aiData.debilidades || [];
    const recommendation: string = aiData.recommendation || aiData.recomendacion || "";

    if (strengths.length > 0) {
      y = drawSectionTitle(doc, "FACTORES FAVORABLES PARA EL INVERSIONISTA", M, y, CW);
      strengths.slice(0, 4).forEach((s: string) => {
        setColor(doc, C.green, "fill");
        doc.circle(M + 2.5, y + 1.5, 1.5, "F");
        setColor(doc, C.gray700, "text");
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(s, CW - 8);
        doc.text(lines, M + 7, y + 3);
        y += lines.length * 4.8 + 2;
      });
      y += 4;
    }

    if (weaknesses.length > 0) {
      y = drawSectionTitle(doc, "ASPECTOS A CONSIDERAR", M, y, CW);
      weaknesses.slice(0, 3).forEach((w: string) => {
        setColor(doc, C.amber, "fill");
        doc.circle(M + 2.5, y + 1.5, 1.5, "F");
        setColor(doc, C.gray700, "text");
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(w, CW - 8);
        doc.text(lines, M + 7, y + 3);
        y += lines.length * 4.8 + 2;
      });
      y += 4;
    }

    if (recommendation) {
      y = drawSectionTitle(doc, "RECOMENDACIÓN TÉCNICA", M, y, CW);
      const recLines = doc.splitTextToSize(recommendation, CW - 8);
      const recH = recLines.length * 5 + 8;
      setColor(doc, C.greenLight, "fill");
      doc.roundedRect(M, y, CW, recH, 2, 2, "F");
      setColor(doc, C.greenDark, "text");
      doc.setFontSize(9); doc.setFont("helvetica", "italic");
      doc.text(recLines, M + 4, y + 6);
      y += recH + 6;
    }
  }

  return y;
}

// ============================================================
// DATOS TÉCNICOS DEL ESPACIO
// ============================================================
function addDatosTecnicos(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "CARACTERÍSTICAS DEL PUNTO DE CARGA", M, y, CW);

  const rows: [string, string][] = [
    ["Nombre del punto", data.spaceName],
    ["Tipo de espacio", spaceTypeLabel(data.spaceType, data.spaceTypeOther)],
    ["Dirección", data.address],
    ["Ciudad / Departamento", `${data.city}${data.department ? ", " + data.department : ""}`],
    ...(data.availableAreaM2 ? [["Área disponible", `${data.availableAreaM2} m²`] as [string, string]] : []),
    ...(data.parkingSpots ? [["Parqueos disponibles", `${data.parkingSpots} espacios`] as [string, string]] : []),
    ...(data.estimatedChargerCount ? [["Cargadores proyectados", `${data.estimatedChargerCount} unidades`] as [string, string]] : []),
    ...((data.installedPowerKw || data.estimatedPowerKw) ? [["Potencia instalada", `${data.installedPowerKw || data.estimatedPowerKw} kW`] as [string, string]] : []),
    ...(data.transformerCapacityKva ? [["Capacidad transformador", `${data.transformerCapacityKva} kVA`] as [string, string]] : []),
    ["Tablero eléctrico", data.hasElectricalPanel ? "Disponible" : "Requiere instalación"],
    ...(data.electricalDistance ? [["Distancia al tablero", `${data.electricalDistance} metros`] as [string, string]] : []),
    ["Conectividad", data.hasInternet ? "Internet disponible" : "Sin internet"],
    ["Horario de operación", data.is24Hours ? "24 horas / 7 días" : `${data.operatingHoursStart || "—"} a ${data.operatingHoursEnd || "—"}`],
    ...(data.estimatedDailyVehicles ? [["Vehículos/día estimados", `${data.estimatedDailyVehicles}`] as [string, string]] : []),
    ...(data.estimatedEvPercent ? [["% vehículos eléctricos", `${data.estimatedEvPercent}%`] as [string, string]] : []),
    ...(data.nearbyAttractions ? [["Puntos de interés cercanos", data.nearbyAttractions] as [string, string]] : []),
    ...(data.estimatedInvestmentCop ? [["Inversión estimada", formatCOP(data.estimatedInvestmentCop)] as [string, string]] : []),
  ];

  const colW1 = CW * 0.38;
  rows.forEach((row, i) => {
    if (y > PH - 30) return;
    const rowY = y + i * 8;
    setColor(doc, i % 2 === 0 ? C.gray100 : C.white, "fill");
    doc.rect(M, rowY - 1, CW, 8, "F");
    setColor(doc, C.gray500, "text");
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
    doc.text(row[0], M + 3, rowY + 4.5);
    setColor(doc, C.gray900, "text");
    doc.setFont("helvetica", "normal");
    const valLines = doc.splitTextToSize(row[1], CW - colW1 - 6);
    doc.text(valLines[0], M + colW1 + 3, rowY + 4.5);
  });

  return y + rows.length * 8 + 10;
}

// ============================================================
// GALERÍA DE FOTOS (con soporte de páginas adicionales)
// ============================================================
function addFotos(
  doc: InstanceType<typeof jsPDF>,
  photoImgs: (({ data: string; format: string } | null))[],
  photos: Array<{ url: string; caption?: string | null }>,
  y: number, M: number, CW: number, PW: number, PH: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _docRef?: InstanceType<typeof jsPDF>,
  logoImg?: { data: string; format: string } | null,
): number {
  const validPhotos = photoImgs.filter(Boolean) as { data: string; format: string }[];
  if (validPhotos.length === 0) return y;

  const photoW = (CW - 6) / 2;
  const photoH = 45;
  const pageMarginBottom = 20;

  // Dividir fotos en grupos de 4 por página
  const PHOTOS_PER_PAGE = 4;
  const groups: { data: string; format: string }[][] = [];
  for (let i = 0; i < validPhotos.length; i += PHOTOS_PER_PAGE) {
    groups.push(validPhotos.slice(i, i + PHOTOS_PER_PAGE));
  }

  groups.forEach((group, groupIdx) => {
    if (groupIdx === 0) {
      // Primera página de fotos: usar y actual
      y = drawSectionTitle(doc, `GALERÍA DEL ESPACIO (${validPhotos.length} fotos)`, M, y, CW);
    } else {
      // Páginas adicionales de fotos
      doc.addPage();
      if (logoImg !== undefined) {
        // Redibujar header en página adicional
        setColor(doc, C.green, "fill");
        doc.rect(0, 0, PW, 14, "F");
        if (logoImg) {
          try { doc.addImage(logoImg.data, logoImg.format, M, 2, 28, 10); } catch { /* skip */ }
        }
        setColor(doc, C.white, "text");
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
        doc.text("Galería de Fotos (continuación)", PW - M, 9, { align: "right" });
      }
      y = 22;
      y = drawSectionTitle(doc, `GALERÍA DEL ESPACIO — Página ${groupIdx + 1}`, M, y, CW);
    }

    group.forEach((img, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const px = M + col * (photoW + 6);
      const py = y + row * (photoH + 8);
      if (py + photoH > PH - pageMarginBottom) return;
      try {
        doc.addImage(img.data, img.format, px, py, photoW, photoH, undefined, "FAST");
        setColor(doc, C.gray200, "draw");
        doc.setLineWidth(0.3);
        doc.rect(px, py, photoW, photoH);
        // Caption si existe
        const photoIdx = groupIdx * PHOTOS_PER_PAGE + i;
        const caption = photos[photoIdx]?.caption;
        if (caption) {
          setColor(doc, C.gray500, "text");
          doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
          doc.text(caption.substring(0, 40), px + photoW / 2, py + photoH + 4, { align: "center" });
        }
      } catch { /* skip */ }
    });

    const rows = Math.ceil(group.length / 2);
    y = y + rows * (photoH + 8) + 6;
  });

  return y;
}

// ============================================================
// PROYECCIÓN FINANCIERA — MODELO POR POTENCIA Y ESCENARIOS
// ============================================================
function addProyeccionFinanciera(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "PROYECCIÓN FINANCIERA PARA EL INVERSIONISTA", M, y, CW);

  const inv = data.estimatedInvestmentCop || 0;
  const powerKw = data.installedPowerKw || data.estimatedPowerKw || 0;
  const tarifaKwh = data.tarifaKwhCop || 1800;

  // Modelo de reparto
  const allyPct = data.allySharePercent;
  const netPct = 100 - allyPct;
  const investorNetPct = data.investorSharePercent;
  const platformNetPct = data.platformSharePercent;
  const investorEffective = (investorNetPct / 100) * netPct;
  const platformEffective = (platformNetPct / 100) * netPct;

  // Barra de reparto visual (solo inversor y EVGreen visible)
  setColor(doc, C.greenLight, "fill");
  doc.roundedRect(M, y, CW, 26, 3, 3, "F");
  setColor(doc, C.greenDark, "text");
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("DISTRIBUCIÓN DE INGRESOS PARA EL INVERSIONISTA", M + 4, y + 6);

  const barY = y + 11;
  const barW = CW - 8;
  const barH = 7;
  const investorW = barW * (investorEffective / 100);
  const platformW = barW - investorW;

  setColor(doc, C.green, "fill");
  doc.roundedRect(M + 4, barY, investorW, barH, 1, 1, "F");
  setColor(doc, C.gray500, "fill");
  doc.rect(M + 4 + investorW, barY, platformW, barH, "F");

  setColor(doc, C.white, "text");
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  if (investorW > 20) doc.text(`Inversor ${investorEffective.toFixed(0)}%`, M + 4 + investorW / 2, barY + 5, { align: "center" });
  if (platformW > 20) doc.text(`EVGreen ${platformEffective.toFixed(0)}%`, M + 4 + investorW + platformW / 2, barY + 5, { align: "center" });

  setColor(doc, C.gray700, "text");
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text(`Inversor: ${investorNetPct}% del neto (${investorEffective.toFixed(0)}% del bruto)  ·  EVGreen: ${platformNetPct}% del neto (${platformEffective.toFixed(0)}% del bruto)`, M + 4, barY + 14);
  y += 32;

  if (powerKw > 0) {
    y = drawSectionTitle(doc, `ESCENARIOS DE OPERACIÓN — ${powerKw} kW INSTALADOS  ·  Tarifa: ${formatCOP(tarifaKwh)}/kWh`, M, y, CW);

    const scenarios = [
      { name: "PESIMISTA", hours: 4, color: C.amber },
      { name: "REALISTA", hours: 6, color: C.green },
      { name: "OPTIMISTA", hours: 9, color: C.greenDark },
    ];

    const scenarioData = scenarios.map(s => {
      const kwhDay = powerKw * s.hours;
      const kwhMonth = kwhDay * 30;
      const grossMonth = kwhMonth * tarifaKwh;
      const allyMonth = grossMonth * (allyPct / 100);
      const netMonth = grossMonth - allyMonth;
      const investorMonth = netMonth * (investorNetPct / 100);
      const platformMonth = netMonth * (platformNetPct / 100);
      const investorYear = investorMonth * 12;
      const roi = inv > 0 ? (investorYear / inv * 100) : 0;
      const payback = inv > 0 && investorMonth > 0 ? inv / investorMonth : 0;
      return { ...s, kwhDay, kwhMonth, grossMonth, investorMonth, investorYear, roi, payback, platformMonth };
    });

    // Tarjetas de escenario (3 columnas)
    const cardW = (CW - 8) / 3;
    const cardH = 68;
    scenarioData.forEach((s, i) => {
      const cx = M + i * (cardW + 4);
      const cy = y;

      setColor(doc, C.gray100, "fill");
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, "F");

      setColor(doc, s.color, "fill");
      doc.roundedRect(cx, cy, cardW, 13, 3, 3, "F");
      doc.rect(cx, cy + 7, cardW, 6, "F");

      setColor(doc, C.white, "text");
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(s.name, cx + cardW / 2, cy + 9, { align: "center" });

      setColor(doc, C.gray500, "text");
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(`${s.hours} horas/día de operación`, cx + cardW / 2, cy + 18, { align: "center" });

      const items = [
        { label: "kWh/mes", value: `${Math.round(s.kwhMonth).toLocaleString("es-CO")} kWh`, highlight: false },
        { label: "Ingreso bruto/mes", value: formatCOP(s.grossMonth), highlight: false },
        { label: "Tu retorno/mes", value: formatCOP(s.investorMonth), highlight: true },
        { label: "Tu retorno/año", value: formatCOP(s.investorYear), highlight: true },
        ...(inv > 0 ? [{ label: "ROI anual", value: `${s.roi.toFixed(1)}%`, highlight: false }] : []),
        ...(inv > 0 && s.payback > 0 ? [{ label: "Recuperación", value: s.payback <= 12 ? `${s.payback.toFixed(1)} meses` : `${(s.payback / 12).toFixed(1)} años`, highlight: false }] : []),
      ];

      items.forEach((item, j) => {
        const iy = cy + 24 + j * 7;
        setColor(doc, C.gray500, "text");
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
        doc.text(item.label, cx + 4, iy);
        setColor(doc, item.highlight ? s.color : C.gray900, "text");
        doc.setFontSize(item.highlight ? 8 : 7.5);
        doc.setFont("helvetica", item.highlight ? "bold" : "normal");
        doc.text(item.value, cx + cardW - 4, iy, { align: "right" });
      });
    });

    y += cardH + 10;

    // Nota metodológica
    setColor(doc, C.gray500, "text");
    doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
    const nota = `* Proyecciones basadas en ${powerKw} kW instalados × horas de operación diaria × 30 días × ${formatCOP(tarifaKwh)}/kWh. El inversor recibe el ${investorNetPct}% del ingreso neto. Las cifras son estimaciones orientativas basadas en condiciones actuales del mercado colombiano de movilidad eléctrica.`;
    const notaLines = doc.splitTextToSize(nota, CW);
    doc.text(notaLines, M, y);
    y += notaLines.length * 4.5 + 6;

  } else {
    setColor(doc, C.amber, "fill");
    doc.roundedRect(M, y, CW, 14, 2, 2, "F");
    setColor(doc, C.white, "text");
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Configure la potencia instalada en el modal para ver la proyeccion financiera detallada.", M + 4, y + 9);
    y += 20;
  }

  return y;
}

// ============================================================
// MAPA DE UBICACIÓN
// ============================================================
async function addMapa(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  y: number, M: number, CW: number, PW: number, PH: number,
): Promise<number> {
  y = drawSectionTitle(doc, "UBICACIÓN GEOGRÁFICA DEL PUNTO", M, y, CW);

  if (data.latitude && data.longitude) {
    // Usar el proxy de Forge para Google Static Maps (no requiere API key pública)
    const forgeApiUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
    const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY || "";
    const mapUrl = forgeApiUrl && forgeApiKey
      ? `${forgeApiUrl}/v1/maps/proxy/maps/api/staticmap?center=${data.latitude},${data.longitude}&zoom=15&size=600x300&maptype=roadmap&markers=color:green%7Clabel:EV%7C${data.latitude},${data.longitude}&key=${forgeApiKey}`
      : `https://maps.googleapis.com/maps/api/staticmap?center=${data.latitude},${data.longitude}&zoom=15&size=600x300&maptype=roadmap&markers=color:green%7Clabel:EV%7C${data.latitude},${data.longitude}`;
    const mapImg = await downloadImageAsBase64(mapUrl);
    if (mapImg) {
      try {
        doc.addImage(mapImg.data, mapImg.format, M, y, CW, 60, undefined, "FAST");
        setColor(doc, C.gray200, "draw");
        doc.setLineWidth(0.3);
        doc.rect(M, y, CW, 60);
        y += 64;
      } catch { y += 4; }
    }
    setColor(doc, C.gray700, "text");
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    doc.text(`Coordenadas: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`, M, y);
    y += 6;
    setColor(doc, C.green, "text");
    doc.text(`Ver en Google Maps: maps.google.com/?q=${data.latitude},${data.longitude}`, M, y);
    y += 10;
  } else {
    setColor(doc, C.gray500, "text");
    doc.setFontSize(9);
    doc.text("Coordenadas GPS no disponibles para este espacio.", M, y + 6);
    y += 14;
  }

  setColor(doc, C.gray700, "text");
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("Dirección:", M, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.address}, ${data.city}${data.department ? ", " + data.department : ""}`, M + 22, y);
  y += 10;

  return y;
}

// ============================================================
// CIERRE — LLAMADO A LA ACCIÓN PARA EL INVERSIONISTA
// ============================================================
function addCierre(doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData, PW: number, PH: number, M: number, CW: number) {
  const cierreY = PH - 65;

  setColor(doc, C.green, "draw");
  doc.setLineWidth(0.8);
  doc.line(M, cierreY, PW - M, cierreY);

  setColor(doc, C.green, "fill");
  doc.rect(0, cierreY + 4, PW, 38, "F");

  setColor(doc, C.white, "text");
  doc.setFontSize(15); doc.setFont("helvetica", "bold");
  doc.text("¿Listo para invertir en movilidad eléctrica?", PW / 2, cierreY + 16, { align: "center" });

  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Contáctenos: inversiones@evgreen.lat  ·  www.evgreen.lat  ·  NIT: 901.447.678-0", PW / 2, cierreY + 24, { align: "center" });

  setColor(doc, C.greenMid, "text");
  doc.setFontSize(8); doc.setFont("helvetica", "italic");
  doc.text("EVGreen by Green House Project — Infraestructura de carga para la movilidad del futuro", PW / 2, cierreY + 32, { align: "center" });

  setColor(doc, C.gray500, "text");
  doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
  doc.text(
    `Documento generado el ${data.generatedAt.toLocaleString("es-CO")}  ·  Confidencial  ·  Uso exclusivo del destinatario`,
    PW / 2, cierreY + 50, { align: "center" }
  );
}
