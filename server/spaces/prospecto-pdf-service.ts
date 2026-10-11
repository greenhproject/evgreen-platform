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
import {
  buildProspectoFinancialScenario,
  type ProspectoTechnicalCondition,
} from "../../shared/prospecto-financial-scenario";
import { getPhotoMarkerLabel, getPhotoTypeLabel } from "../../shared/photo-type-labels";
import { buildSpaceTrafficProjection, calculateSolarBlendedEnergyCost } from "../../shared/space-traffic-financial-projection";

// ============================================================
// ASSETS ESTÁTICOS (CDN público — disponible en el servidor)
// ============================================================
const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/FYcGXNchDiULWNfV.png";
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
  hasSolarPanels?: boolean | null;
  solarCoveragePercent?: number | null;
  solarEnergyCostPerKwh?: number | null;
  // Configuración dinámica del prospecto
  allySharePercent: number;
  investorSharePercent: number;
  platformSharePercent: number;
  // Modelo financiero por potencia instalada
  installedPowerKw?: number;
  tarifaKwhCop?: number;
  energyCostPerKwhCop?: number;
  efficiencyPercent?: number;
  fixedMonthlyExpensesCop?: number;
  technicalCondition: ProspectoTechnicalCondition;
  capexIncludesGridUpgrade: boolean;
  technicalConditionNote?: string | null;
  // Fotos del espacio
  photos: Array<{ url: string; type?: string | null; caption?: string | null; isCover?: boolean; isConceptual?: boolean }>;
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

function formatCompactCOP(value: number): string {
  const amount = Math.abs(value);
  if (amount >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  }
  if (amount >= 1_000) {
    return `$${(value / 1_000).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  }
  return formatCOP(value);
}

function getOperatingHoursPerDay(data: Pick<ProspectoPdfData, "operatingHoursStart" | "operatingHoursEnd" | "is24Hours">): number {
  if (data.is24Hours) return 24;
  const toMinutes = (value: string | null | undefined) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const start = toMinutes(data.operatingHoursStart);
  const end = toMinutes(data.operatingHoursEnd);
  if (start === null || end === null) return 16;
  const duration = end > start ? end - start : (24 * 60 - start) + end;
  return duration > 0 ? duration / 60 : 16;
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

function buildTechnicalRecommendation(data: ProspectoPdfData): string {
  const chargerCount = Number(data.estimatedChargerCount || 0);
  const powerKw = Number(data.installedPowerKw || data.estimatedPowerKw || 0);
  const chargerText = chargerCount > 0 ? `${chargerCount} cargador${chargerCount === 1 ? "" : "es"}` : "la infraestructura de carga";
  const powerText = powerKw > 0 ? `con una potencia proyectada de ${powerKw} kW` : "con potencia por definir";

  if (data.technicalCondition.requiresGridUpgrade) {
    return `Se recomienda estructurar ${chargerText} ${powerText} únicamente después de formalizar la ampliación eléctrica requerida, confirmar la potencia disponible mediante estudio técnico y asegurar que el CAPEX total incorpora esa intervención. La puesta en servicio se programará tras la aprobación del operador de red.`;
  }

  return `Se recomienda estructurar ${chargerText} ${powerText}, sujeto a la validación final de protecciones, capacidad disponible, diseño de acometida y aprobación del operador de red. La configuración definitiva debe responder al perfil de demanda, el tiempo de permanencia y la operación comercial del punto.`;
}

async function downloadImageAsBase64(url: string): Promise<{ data: string; format: string; width: number; height: number; aspect: number } | null> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer", timeout: 10000,
      headers: { "User-Agent": "EVGreen-PDF-Generator/2.0" },
    });
    // Compress and resize images to keep PDF under 5MB
    const sharp = (await import("sharp")).default;
    const imgBuffer = Buffer.from(response.data);
    const meta = await sharp(imgBuffer).metadata();
    const rawW = meta.width || 1200;
    const rawH = meta.height || 800;
    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    const isPng = contentType.includes("png") || url.toLowerCase().endsWith(".png");
    if (isPng) {
      // Preserve PNG transparency (for logos), just resize
      const compressed = await sharp(imgBuffer)
        .resize({ width: 600, height: 400, fit: "inside", withoutEnlargement: true })
        .png({ quality: 70, compressionLevel: 9 })
        .toBuffer();
      const base64 = compressed.toString("base64");
      return { data: `data:image/png;base64,${base64}`, format: "PNG", width: rawW, height: rawH, aspect: rawW / rawH };
    } else {
      // Convert to JPEG for photos (smaller size)
      const compressed = await sharp(imgBuffer)
        .resize({ width: 800, height: 600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 60, mozjpeg: true })
        .toBuffer();
      const base64 = compressed.toString("base64");
      return { data: `data:image/jpeg;base64,${base64}`, format: "JPEG", width: rawW, height: rawH, aspect: rawW / rawH };
    }
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

  // Identificar si existe una foto marcada explícitamente como portada del espacio
  const coverIndex = data.photos.findIndex(p => Boolean(p.isCover));
  const activeCoverPhoto = coverIndex >= 0 ? data.photos[coverIndex] : null;
  const activeCoverImg = coverIndex >= 0 ? photoImgs[coverIndex] : null;
  const primaryCoverBg = activeCoverImg || coverBgImg;

  // PÁGINA 1 — PORTADA IMPACTANTE
  addPortada(doc, data, PW, PH, M, CW, logoImg, primaryCoverBg, activeCoverPhoto);

  // PÁGINA 2 — RESUMEN EJECUTIVO
  doc.addPage();
  let y = addPageHeader(doc, data, PW, M, logoImg);
  y = addResumenEjecutivo(doc, data, aiData, y, M, CW, PW, PH);

  // PÁGINA 3 — DATOS TÉCNICOS + FOTOS
  doc.addPage();
  y = addPageHeader(doc, data, PW, M, logoImg);
  y = addDatosTecnicos(doc, data, y, M, CW, PW, PH);
  // Si la portada usó una foto específica del espacio, omitirla del grid interno para no duplicar
  const remainingPhotos = coverIndex >= 0
    ? photoImgs.filter((_, idx) => idx !== coverIndex)
    : photoImgs.slice(1);
  const remainingPhotoData = coverIndex >= 0
    ? data.photos.filter((_, idx) => idx !== coverIndex)
    : data.photos.slice(1);
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
  coverPhotoMeta: { type?: string | null; caption?: string | null; isConceptual?: boolean } | null,
) {
  // Fondo principal Navy oscuro elegante (#0b1322)
  setColor(doc, [11, 19, 34], "fill");
  doc.rect(0, 0, PW, PH, "F");

  // Logo EVGreen oficial
  if (logoImg) {
    try { doc.addImage(logoImg.data, logoImg.format, M, 10, 48, 15); } catch { /* skip */ }
  } else {
    setColor(doc, C.white, "text");
    doc.setFontSize(22); doc.setFont("helvetica", "bold");
    doc.text("EVGreen", M, 21);
    setColor(doc, C.greenMid, "text");
    doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
    doc.text("by Green House Project", M, 27);
  }

  // Badge "PROSPECTO DE INVERSIÓN"
  setColor(doc, C.green, "fill");
  doc.roundedRect(PW - M - 64, 10, 64, 7.5, 2, 2, "F");
  setColor(doc, C.white, "text");
  doc.setFontSize(6.8); doc.setFont("helvetica", "bold");
  doc.text("PROSPECTO DE INVERSIÓN", PW - M - 32, 15.2, { align: "center" });

  // Badge opcional de Render / Ilustración Conceptual en la portada
  if (coverPhotoMeta?.isConceptual) {
    setColor(doc, [11, 19, 34], "fill");
    doc.roundedRect(PW - M - 64, 19.5, 64, 7, 2, 2, "F");
    setColor(doc, C.amber, "draw");
    doc.setLineWidth(0.4);
    doc.roundedRect(PW - M - 64, 19.5, 64, 7, 2, 2, "S");
    setColor(doc, C.amber, "text");
    doc.setFontSize(6.2); doc.setFont("helvetica", "bold");
    doc.text("RENDER CONCEPTUAL", PW - M - 32, 24.4, { align: "center" });
  }

  // VENTANA HERO AUTOREDIMENSIONADA Y PROPORCIONAL
  // Mantiene intacta la relación de aspecto real de la foto/render sin deformar ni estirar
  const heroY = 30;
  const heroW = CW;
  const aspect = (coverBgImg as any)?.aspect && (coverBgImg as any).aspect > 0 ? (coverBgImg as any).aspect : 1.77;
  const maxHeroH = 105;
  const heroH = Math.min(maxHeroH, heroW / aspect);

  if (coverBgImg) {
    try {
      doc.addImage(coverBgImg.data, coverBgImg.format, M, heroY, heroW, heroH, undefined, "FAST");
      setColor(doc, C.green, "draw");
      doc.setLineWidth(0.4);
      doc.rect(M, heroY, heroW, heroH);
    } catch { /* skip */ }
  } else {
    setColor(doc, [18, 28, 48], "fill");
    doc.rect(M, heroY, heroW, heroH, "F");
  }

  // Título y datos debajo del hero
  const textY = heroY + heroH + 11;
  if (coverPhotoMeta) {
    setColor(doc, C.gray500, "text");
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    doc.text(getPhotoMarkerLabel(coverPhotoMeta.type, coverPhotoMeta.caption), PW - M, textY - 3.5, { align: "right" });
  }
  setColor(doc, C.green, "draw");
  doc.setLineWidth(2.5);
  doc.line(M, textY, M + 28, textY);

  // Nombre del espacio
  setColor(doc, C.white, "text");
  doc.setFontSize(26); doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(data.spaceName.toUpperCase(), CW);
  doc.text(nameLines.slice(0, 2), M, textY + 11);

  // Ciudad y tipo
  setColor(doc, C.greenMid, "text");
  doc.setFontSize(10.5); doc.setFont("helvetica", "normal");
  doc.text(`${data.city}${data.department ? ", " + data.department : ""}  ·  ${spaceTypeLabel(data.spaceType, data.spaceTypeOther)}`, M, textY + 20);

  // Métricas clave en 3 tarjetas tipo dark card
  const metricsY = textY + 28;
  const colGap = 5;
  const cardW = (CW - colGap * 2) / 3;
  const cardH = 35;
  const inv = data.estimatedInvestmentCop || 0;
  const powerKw = data.installedPowerKw || data.estimatedPowerKw || 0;
  const chargers = data.estimatedChargerCount || 0;
  const score = data.aiScore || 0;

  const metrics = [
    { label: "INVERSIÓN REQUERIDA", value: inv > 0 ? formatCOP(inv) : "A definir", sub: "Capital total" },
    {
      label: "POTENCIA PROYECTADA",
      value: powerKw > 0 ? `${powerKw} kW` : "A definir",
      sub: data.technicalCondition.requiresGridUpgrade
        ? "Sujeta a ampliación de red"
        : chargers > 0 ? `${chargers} cargadores` : "Cargadores EV",
    },
    { label: "VIABILIDAD IA", value: score > 0 ? `${score}/100` : "—", sub: score > 0 ? formatScore(score) : "Pendiente" },
  ];

  metrics.forEach((m, i) => {
    const mx = M + i * (cardW + colGap);
    setColor(doc, [18, 28, 48], "fill");
    doc.roundedRect(mx, metricsY, cardW, cardH, 3, 3, "F");
    setColor(doc, [38, 54, 82], "draw");
    doc.setLineWidth(0.3);
    doc.roundedRect(mx, metricsY, cardW, cardH, 3, 3, "S");

    setColor(doc, C.greenMid, "text");
    doc.setFontSize(6.8); doc.setFont("helvetica", "bold");
    doc.text(m.label, mx + cardW / 2, metricsY + 8.5, { align: "center" });
    setColor(doc, C.white, "text");
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(m.value, mx + cardW / 2, metricsY + 19.5, { align: "center" });
    setColor(doc, C.gray200, "text");
    doc.setFontSize(7.2); doc.setFont("helvetica", "normal");
    doc.text(m.sub, mx + cardW / 2, metricsY + 27.5, { align: "center" });
  });

  // Tarjeta resumen inferior con detalles de prefactibilidad
  const summaryY = metricsY + cardH + 8;
  const summaryH = 26;
  setColor(doc, [15, 25, 42], "fill");
  doc.roundedRect(M, summaryY, CW, summaryH, 3, 3, "F");
  setColor(doc, [24, 38, 62], "draw");
  doc.setLineWidth(0.3);
  doc.roundedRect(M, summaryY, CW, summaryH, 3, 3, "S");

  setColor(doc, C.green, "text");
  doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
  doc.text("RESUMEN DE PREFACTIBILIDAD TÉCNICA Y COMERCIAL", M + 6, summaryY + 7.5);
  setColor(doc, [209, 213, 219], "text");
  doc.setFontSize(7.3); doc.setFont("helvetica", "normal");
  const summaryText = "Punto estratégico evaluado para despliegue de infraestructura de carga rápida DC. Cuenta con análisis preliminar de acometida eléctrica, estimación de tráfico vehicular y modelo financiero parametrizado para retorno sobre inversión.";
  const summaryLines = doc.splitTextToSize(summaryText, CW - 12);
  doc.text(summaryLines, M + 6, summaryY + 14);

  // Código y fecha
  setColor(doc, C.gray500, "text");
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text(
    `${data.code}  ·  ${data.generatedAt.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}  ·  Documento Confidencial de Preinversión`,
    PW / 2, PH - 11, { align: "center" }
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

  }

  const recommendation = buildTechnicalRecommendation(data);
  y = drawSectionTitle(doc, "RECOMENDACIÓN TÉCNICA", M, y, CW);
  const recLines = doc.splitTextToSize(recommendation, CW - 8);
  const recH = recLines.length * 5 + 8;
  setColor(doc, data.technicalCondition.requiresGridUpgrade ? [255, 247, 237] : C.greenLight, "fill");
  doc.roundedRect(M, y, CW, recH, 2, 2, "F");
  setColor(doc, data.technicalCondition.requiresGridUpgrade ? [154, 52, 18] : C.greenDark, "text");
  doc.setFontSize(9); doc.setFont("helvetica", "italic");
  doc.text(recLines, M + 4, y + 6);
  y += recH + 6;

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
    ...((data.installedPowerKw || data.estimatedPowerKw) ? [["Potencia proyectada", `${data.installedPowerKw || data.estimatedPowerKw} kW`] as [string, string]] : []),
    ...(data.transformerCapacityKva ? [["Capacidad transformador", `${data.transformerCapacityKva} kVA`] as [string, string]] : []),
    ["Transformador dedicado requerido", `${data.technicalCondition.requiredTransformerKva} kVA mínimo (FP ${data.technicalCondition.transformerPowerFactor})`],
    ["Viabilidad eléctrica", data.technicalCondition.requiresGridUpgrade ? "Condicionada a ampliación de red y aprobación del operador" : "Sin condicionante reportado"],
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
  photos: Array<{ url: string; type?: string | null; caption?: string | null; isCover?: boolean; isConceptual?: boolean }>,
  y: number, M: number, CW: number, PW: number, PH: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _docRef?: InstanceType<typeof jsPDF>,
  logoImg?: { data: string; format: string } | null,
): number {
  if (!photoImgs.some(Boolean)) return y;

  const photoW = (CW - 6) / 2;
  const photoH = 45;
  const photoRowGap = 22;
  const pageMarginBottom = 20;

  // Dividir fotos en grupos de 4 por página
  const PHOTOS_PER_PAGE = 4;
  const groups: Array<Array<{ img: { data: string; format: string }; photoIndex: number }>> = [];
  for (let i = 0; i < photoImgs.length; i += PHOTOS_PER_PAGE) {
    const group = photoImgs.slice(i, i + PHOTOS_PER_PAGE)
      .map((img, offset) => img ? { img, photoIndex: i + offset } : null)
      .filter(Boolean) as Array<{ img: { data: string; format: string }; photoIndex: number }>;
    if (group.length > 0) groups.push(group);
  }

  const startContinuationPage = () => {
    doc.addPage();
    if (logoImg !== undefined) {
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
  };

  groups.forEach((group, groupIdx) => {
    if (groupIdx === 0) {
      // Si los datos técnicos dejaron poco espacio, mover el título con la primera fila.
      if (y + 14 + photoH + 18 > PH - pageMarginBottom) startContinuationPage();
      y = drawSectionTitle(doc, `GALERÍA DEL ESPACIO (${photoImgs.filter(Boolean).length} fotos)`, M, y, CW);
    } else {
      // Páginas adicionales de fotos
      startContinuationPage();
      y = drawSectionTitle(doc, `GALERÍA DEL ESPACIO — Página ${groupIdx + 1}`, M, y, CW);
    }

    group.forEach((item, i) => {
      const img = item.img;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const px = M + col * (photoW + 6);
      const py = y + row * (photoH + photoRowGap);
      if (py + photoH + 18 > PH - pageMarginBottom) return;
      try {
        doc.addImage(img.data, img.format, px, py, photoW, photoH, undefined, "FAST");
        setColor(doc, C.gray200, "draw");
        doc.setLineWidth(0.3);
        doc.rect(px, py, photoW, photoH);
        // Caption si existe
        const photoIdx = item.photoIndex;
        const photoMeta = photos[photoIdx];
        const labelY = py + photoH + 4;
        setColor(doc, C.greenDark, "fill");
        doc.roundedRect(px + 2, labelY - 2.5, photoW - 4, 6, 1.5, 1.5, "F");
        setColor(doc, C.white, "text");
        doc.setFontSize(6.2); doc.setFont("helvetica", "bold");
        doc.text(getPhotoTypeLabel(photoMeta?.type), px + photoW / 2, labelY + 1.2, { align: "center" });

        const flags = [
          photoMeta?.isCover ? "Portada" : null,
          photoMeta?.isConceptual ? "Render conceptual" : "Fotografía del sitio",
        ].filter(Boolean).join(" · ");
        setColor(doc, C.gray500, "text");
        doc.setFontSize(5.8); doc.setFont("helvetica", "normal");
        doc.text(flags, px + photoW / 2, labelY + 6.5, { align: "center" });
        if (photoMeta?.caption?.trim()) {
          doc.setFontSize(5.8); doc.setFont("helvetica", "italic");
          doc.text(photoMeta.caption.trim().substring(0, 50), px + photoW / 2, labelY + 11, { align: "center" });
        }
      } catch { /* skip */ }
    });

    const rows = Math.ceil(group.length / 2);
    y = y + rows * (photoH + photoRowGap) + 6;
  });

  return y;
}

// ============================================================
// PROYECCIÓN FINANCIERA — DEMANDA DEL PREDIO Y ESCENARIOS
// ============================================================
function addProyeccionFinanciera(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "PROYECCIÓN FINANCIERA PARA EL INVERSIONISTA", M, y, CW);

  const inv = data.estimatedInvestmentCop || 0;
  const powerKw = data.installedPowerKw || data.estimatedPowerKw || 0;
  const tarifaKwh = data.tarifaKwhCop || 1800;
  const energyCostPerKwh = data.energyCostPerKwhCop ?? 850;
  const efficiencyPercent = data.efficiencyPercent ?? 92;
  const fixedMonthlyExpenses = data.fixedMonthlyExpensesCop ?? 0;
  const solarEnergy = calculateSolarBlendedEnergyCost({
    gridEnergyCostPerKwh: energyCostPerKwh,
    hasSolarPanels: data.hasSolarPanels,
    solarCoveragePercent: data.solarCoveragePercent,
    solarEnergyCostPerKwh: data.solarEnergyCostPerKwh,
  });

  // Modelo de reparto: el aliado recibe una participación del margen bruto
  // y EVGreen + Inversionista se reparten exclusivamente el margen neto.
  const allyPct = data.allySharePercent;
  const investorNetPct = data.investorSharePercent;
  const platformNetPct = data.platformSharePercent;

  // Barra de reparto visual: solo representa la distribución del neto.
  const energyCostLabel = solarEnergy.solarCostApplied
    ? `energía efectiva (${formatCOP(solarEnergy.effectiveEnergyCostPerKwh)}/kWh; solar ${solarEnergy.solarCoveragePercent}% a ${formatCOP(solarEnergy.solarEnergyCostPerKwh ?? 0)}/kWh, red ${formatCOP(energyCostPerKwh)}/kWh)`
    : `energía (${formatCOP(energyCostPerKwh)}/kWh)`;
  const operatingCostCopy = fixedMonthlyExpenses > 0
    ? `Ingreso bruto − ${energyCostLabel} − gastos fijos (${formatCompactCOP(fixedMonthlyExpenses)}/mes) = margen base de reparto`
    : `Ingreso bruto − ${energyCostLabel} = margen base de reparto`;
  doc.setFontSize(7.2); doc.setFont("helvetica", "normal");
  const operatingCostLines = doc.splitTextToSize(operatingCostCopy, CW - 8);
  const waterfallH = Math.max(32, 29 + operatingCostLines.length * 3.4);
  setColor(doc, C.greenLight, "fill");
  doc.roundedRect(M, y, CW, waterfallH, 3, 3, "F");
  setColor(doc, C.greenDark, "text");
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("WATERFALL Y DISTRIBUCIÓN DEL MARGEN NETO", M + 4, y + 6);

  const barY = y + 11;
  const barW = CW - 8;
  const barH = 7;
  const investorW = barW * (investorNetPct / 100);
  const platformW = barW - investorW;

  setColor(doc, C.green, "fill");
  doc.roundedRect(M + 4, barY, investorW, barH, 1, 1, "F");
  setColor(doc, C.gray500, "fill");
  doc.rect(M + 4 + investorW, barY, platformW, barH, "F");

  setColor(doc, C.white, "text");
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  if (investorW > 20) doc.text(`Inversor ${investorNetPct.toFixed(0)}%`, M + 4 + investorW / 2, barY + 5, { align: "center" });
  if (platformW > 20) doc.text(`EVGreen ${platformNetPct.toFixed(0)}%`, M + 4 + investorW + platformW / 2, barY + 5, { align: "center" });

  setColor(doc, C.gray700, "text");
  doc.text(operatingCostLines, M + 4, barY + 14);
  const operatingCostEndY = barY + 14 + (operatingCostLines.length - 1) * 3.4;
  doc.text(`Aliado: ${allyPct}% del margen bruto`, M + 4, operatingCostEndY + 4);
  doc.text(`Margen neto distribuible: Inversor ${investorNetPct}%  ·  EVGreen ${platformNetPct}%`, M + 4, operatingCostEndY + 8);
  y += waterfallH + 6;

  if (data.technicalCondition.requiresGridUpgrade) {
    setColor(doc, C.amber, "fill");
    const conditionCopy = [
      data.technicalCondition.reason,
      `CAPEX total declarado: ${data.capexIncludesGridUpgrade ? "incluye la ampliación" : "pendiente de confirmar"}.`,
      data.technicalConditionNote || "",
    ].filter(Boolean).join(" ");
    const conditionLines = doc.splitTextToSize(conditionCopy, CW - 8);
    const conditionH = Math.max(20, 11 + conditionLines.length * 3.8);
    doc.roundedRect(M, y, CW, conditionH, 2.5, 2.5, "F");
    setColor(doc, C.navy, "text");
    doc.setFontSize(8.2); doc.setFont("helvetica", "bold");
    doc.text("CONDICIÓN TÉCNICA PREVIA: AMPLIACIÓN ELÉCTRICA", M + 4, y + 6);
    doc.setFontSize(7.3); doc.setFont("helvetica", "normal");
    doc.text(conditionLines, M + 4, y + 11);
    y += conditionH + 5;
  }

  if (powerKw > 0 && inv > 0) {
      const powerStatus = data.technicalCondition.requiresGridUpgrade ? "PROYECTADOS" : "INSTALADOS";
      const dailyVehicles = Number(data.estimatedDailyVehicles ?? 0);
      const evPercent = Number(data.estimatedEvPercent ?? 0);
	      const chargerCount = Math.max(1, Number(data.estimatedChargerCount ?? 1));
	      const operatingHoursPerDay = getOperatingHoursPerDay(data);
	      const hasSolarPanels = Boolean(data.hasSolarPanels);
	      const solarCoveragePercent = Number(data.solarCoveragePercent ?? 0);
	      const solarEnergyCostPerKwh = data.solarEnergyCostPerKwh ?? null;
	      const hasTrafficDemandInputs = dailyVehicles > 0 && evPercent > 0;

	    y = drawSectionTitle(
        doc,
        hasTrafficDemandInputs
          ? `ESCENARIOS POR DEMANDA DEL PREDIO — ${powerKw} kW ${powerStatus}  ·  Tarifa: ${formatCOP(tarifaKwh)}/kWh`
          : `ESCENARIOS DE OPERACIÓN — ${powerKw} kW ${powerStatus}  ·  Tarifa: ${formatCOP(tarifaKwh)}/kWh`,
        M,
        y,
        CW,
      );

	    const scenarios = [
	      { key: "PESSIMISTIC" as const, name: "PESIMISTA", color: C.amber },
	      { key: "REALISTIC" as const, name: "REALISTA", color: C.green },
	      { key: "OPTIMISTIC" as const, name: "OPTIMISTA", color: C.greenDark },
	    ];
      const fallbackProjection = hasTrafficDemandInputs ? null : buildProspectoFinancialScenario({
        investmentCop: inv,
        totalPowerKw: powerKw,
        salePricePerKwh: tarifaKwh,
        energyCostPerKwh,
        hostSharePercent: allyPct,
        investorSharePercent: investorNetPct,
        evgreenSharePercent: platformNetPct,
        efficiencyPercent,
        fixedMonthlyExpenses,
        transformerCapacityKva: data.transformerCapacityKva,
        electricalViability: data.technicalCondition.requiresGridUpgrade ? "requires_upgrade" : "viable",
	      hasSolarPanels,
	      solarCoveragePercent,
	      solarEnergyCostPerKwh,
      }).projection;
      const trafficProjection = hasTrafficDemandInputs ? buildSpaceTrafficProjection({
        investmentCop: inv,
        estimatedDailyVehicles: dailyVehicles,
        estimatedEvPercent: evPercent,
        chargerCount,
        totalPowerKw: powerKw,
        operatingHoursPerDay,
        efficiencyPercent,
	      hasSolarPanels,
	      solarCoveragePercent,
	      solarEnergyCostPerKwh,
        spaceType: data.spaceType,
        salePricePerKwh: tarifaKwh,
        energyCostPerKwh,
        hostSharePercent: allyPct,
        fixedMonthlyExpenses,
      }) : null;
      const scenarioData = scenarios.map(({ key, name, color }) => {
        if (trafficProjection) {
          const result = trafficProjection.scenarios[key];
          return {
            name,
            color,
            operationalSummary: `${result.sessionsPerDay.toLocaleString("es-CO")} sesiones/día`,
            operationalDetail: `Cap.: ${result.capacitySessionsPerDay.toLocaleString("es-CO")} /día · límite: ${result.capacityConstraint === "POWER" ? "potencia" : result.capacityConstraint === "CONNECTORS" ? "mangueras" : "ambos"}${result.capacityLimited ? "*" : ""}`,
            kwhMonth: result.energyKwhPerMonth,
            investorMonth: result.investorMonthlyCashflow,
            investorYear: result.investorAnnualCashflow,
            roi: result.roiAnnualPercent,
            payback: result.paybackMonths,
            waterfall: result.waterfall,
          };
        }
        const result = fallbackProjection!.scenarios[key];
        return {
          name,
          color,
          operationalSummary: `${result.hoursPerDay} h equivalentes/día`,
          operationalDetail: `${powerKw} kW × ${efficiencyPercent}% eficiencia`,
          kwhMonth: result.energyKwhPerMonth,
          investorMonth: result.investorMonthlyCashflow,
          investorYear: result.investorAnnualCashflow,
          roi: result.roiAnnualPercent,
          payback: result.paybackMonths,
          waterfall: result.waterfall,
        };
      });

    setColor(doc, C.gray500, "text");
    doc.setFontSize(7.2); doc.setFont("helvetica", "normal");
    doc.text(
      hasTrafficDemandInputs
        ? `Demanda basada en ${dailyVehicles.toLocaleString("es-CO")} vehículos/día y ${evPercent.toLocaleString("es-CO")}% EV declarado · Cifras monetarias en millones de COP`
        : "Horas equivalentes de entrega a potencia proyectada · Cifras monetarias en millones de COP",
      M,
      y - 3,
    );

    // Tarjetas de escenario: resumen legible con importes compactos.
    const cardW = (CW - 8) / 3;
    const cardH = fixedMonthlyExpenses > 0 ? 107 : 101;
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
      doc.setFontSize(7.1); doc.setFont("helvetica", "normal");
      doc.text(s.operationalSummary, cx + cardW / 2, cy + 18, { align: "center" });
      doc.setFontSize(5.7);
      doc.text(s.operationalDetail, cx + cardW / 2, cy + 22, { align: "center" });

      const items = [
        { label: "kWh/mes", value: `${Math.round(s.kwhMonth).toLocaleString("es-CO")} kWh`, highlight: false },
        { label: "Ingreso bruto", value: formatCompactCOP(s.waterfall.grossRevenue), highlight: false },
        { label: "Costo energía", value: `- ${formatCompactCOP(s.waterfall.energyCost)}`, highlight: false },
        ...(s.waterfall.fixedExpenses > 0 ? [{ label: "Gastos fijos", value: `- ${formatCompactCOP(s.waterfall.fixedExpenses)}`, highlight: false }] : []),
        { label: "Margen base", value: formatCompactCOP(s.waterfall.grossMargin), highlight: false },
        { label: `Aliado (${allyPct}% base)`, value: `- ${formatCompactCOP(s.waterfall.hostPayout)}`, highlight: false },
        { label: "Margen neto", value: formatCompactCOP(s.waterfall.netDistributableMargin), highlight: false },
        { label: "Retorno inv./mes", value: formatCompactCOP(s.investorMonth), highlight: true },
        { label: "Retorno inv./año", value: formatCompactCOP(s.investorYear), highlight: true },
        ...(inv > 0 ? [{ label: "ROI anual simple*", value: `${s.roi.toFixed(1)}%`, highlight: false }] : []),
        ...(inv > 0 && s.payback > 0 ? [{ label: "Recuperación simple*", value: s.payback <= 12 ? `${s.payback.toFixed(1)} meses` : `${(s.payback / 12).toFixed(1)} años`, highlight: false }] : []),
      ];

      items.forEach((item, j) => {
        const iy = cy + 27 + j * 7;
        setColor(doc, C.gray500, "text");
        doc.setFontSize(6.7); doc.setFont("helvetica", "normal");
        doc.text(item.label, cx + 4, iy);
        setColor(doc, item.highlight ? s.color : C.gray900, "text");
        doc.setFontSize(item.highlight ? 8 : 7.2);
        doc.setFont("helvetica", item.highlight ? "bold" : "normal");
        doc.text(item.value, cx + cardW - 4, iy, { align: "right" });
      });
    });

    y += cardH + 10;

    // Nota metodológica
    setColor(doc, C.gray500, "text");
    doc.setFontSize(7.8); doc.setFont("helvetica", "italic");
    const nota = hasTrafficDemandInputs
      ? `Base de demanda: flujo del predio (${dailyVehicles.toLocaleString("es-CO")} vehículos/día) × participación EV/sesiones declarada (${evPercent.toLocaleString("es-CO")}% en el escenario realista) × ${trafficProjection!.assumptions.benchmarkKwhPerSession.toLocaleString("es-CO")} kWh/sesión × 30 días. Pesimista y optimista aplican 50% y 150% de esa participación. Capacidad efectiva = menor entre mangueras (${chargerCount} cargador${chargerCount === 1 ? "" : "es"} × 2 × ${trafficProjection!.assumptions.benchmarkSessionsPerConnectorPerDay.toLocaleString("es-CO")} sesiones/manguera/día) y potencia (${powerKw} kW × ${operatingHoursPerDay} h/día × ${efficiencyPercent}% ÷ ${trafficProjection!.assumptions.benchmarkKwhPerSession.toLocaleString("es-CO")} kWh/sesión). * indica una demanda limitada por capacidad. Tarifa: ${formatCOP(tarifaKwh)}/kWh; energía: ${formatCOP(energyCostPerKwh)}/kWh${fixedMonthlyExpenses > 0 ? `; gastos fijos: ${formatCOP(fixedMonthlyExpenses)}/mes` : "; gastos fijos: no incluidos"}. El aliado recibe ${allyPct}% del margen bruto; el retorno corresponde al ${investorNetPct}% del margen neto distribuible. *ROI anual simple = retorno anual estimado ÷ inversión; recuperación simple = inversión ÷ retorno mensual estimado. No son TIR ni garantía de rentabilidad. La participación EV y la conversión efectiva a sesiones deben validarse con aforos, histórico de recargas y operación real. Rubros no incorporados como gastos fijos, incluidos impuestos, seguros, fiducia, financiación y depreciación, deben validarse antes de invertir. ${data.technicalCondition.requiresGridUpgrade ? "Resultado condicionado a la ampliación eléctrica y al CAPEX total declarado." : "Cifras orientativas; no constituyen garantía de rentabilidad."}`
      : `Base alternativa sin datos de tráfico: ${powerKw} kW de potencia proyectada × horas equivalentes/día × ${efficiencyPercent}% de eficiencia × 30 días. Tarifa: ${formatCOP(tarifaKwh)}/kWh; energía: ${formatCOP(energyCostPerKwh)}/kWh${fixedMonthlyExpenses > 0 ? `; gastos fijos: ${formatCOP(fixedMonthlyExpenses)}/mes` : "; gastos fijos: no incluidos"}. El retorno corresponde al ${investorNetPct}% del margen neto después de energía, gastos fijos y aliado. *ROI anual simple = retorno anual estimado ÷ inversión; recuperación simple = inversión ÷ retorno mensual estimado. No son TIR ni garantía de rentabilidad. Rubros no incorporados como gastos fijos, incluidos impuestos, seguros, fiducia, financiación y depreciación, deben validarse antes de invertir. ${data.technicalCondition.requiresGridUpgrade ? "Resultado condicionado a la ampliación eléctrica y al CAPEX total declarado." : "Cifras orientativas; no constituyen garantía de rentabilidad."}`;
    const notaLines = doc.splitTextToSize(nota, CW);
    doc.text(notaLines, M, y);
    y += notaLines.length * 4.5 + 6;

  } else {
    setColor(doc, C.amber, "fill");
    doc.roundedRect(M, y, CW, 14, 2, 2, "F");
    setColor(doc, C.white, "text");
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
	    doc.text("Configure inversión y potencia instalada para ver la proyección financiera detallada.", M + 4, y + 9);
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
