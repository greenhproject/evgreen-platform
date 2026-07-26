/**
 * EVGreen - Servicio de generación de Prospecto de Inversión PDF
 * Genera un documento profesional para presentar a inversionistas
 * sobre un espacio postulado para instalar cargadores EV.
 *
 * Diseño: fondo blanco, acentos verde EVGreen, estilo prospecto financiero
 * Optimizado para impresión en papel carta/A4.
 */
// jsPDF 4.x ESM compatible import for Node.js
import jsPDFModule from "jspdf";
import "jspdf-autotable";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsPDF = ((jsPDFModule as any).jsPDF ?? (jsPDFModule as any).default?.jsPDF ?? (jsPDFModule as any).default ?? jsPDFModule) as typeof import("jspdf").jsPDF;
import axios from "axios";

// ============================================================
// TIPOS
// ============================================================
export interface ProspectoPdfData {
  // Datos del espacio
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

  // Propietario
  submitterName: string;
  submitterEmail: string;
  submitterPhone: string;
  submitterCompany?: string | null;

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
  aiAnalysis?: string | null; // JSON string

  // Financiero
  estimatedInvestmentCop?: number | null;
  estimatedPowerKw?: number | null;
  estimatedChargerCount?: number | null;

  // Configuración dinámica del prospecto
  // Modelo Opción A: aliado recibe 10% del bruto, inversor y EVGreen se reparten el 90% restante
  allySharePercent: number;       // ej: 10 (fijo, del bruto)
  investorSharePercent: number;   // ej: 70 (sobre el 90% restante)
  platformSharePercent: number;   // ej: 30 (sobre el 90% restante)
  projectedMonthlySessionsYear1?: number; // sesiones/mes estimadas año 1
  avgSessionRevenueCop?: number;  // ingreso promedio por sesión en COP

  // Fotos del espacio
  photos: Array<{ url: string; caption?: string | null }>;

  // Fecha de generación
  generatedAt: Date;
}

// ============================================================
// COLORES MARCA
// ============================================================
const C = {
  green:       [16, 185, 129] as [number, number, number],   // EVGreen principal
  greenDark:   [5, 150, 105] as [number, number, number],    // EVGreen oscuro
  greenLight:  [236, 253, 245] as [number, number, number],  // EVGreen muy suave (fondo)
  greenMid:    [167, 243, 208] as [number, number, number],  // EVGreen medio
  white:       [255, 255, 255] as [number, number, number],
  black:       [20, 20, 20] as [number, number, number],
  gray900:     [30, 30, 30] as [number, number, number],
  gray700:     [75, 85, 99] as [number, number, number],
  gray500:     [107, 114, 128] as [number, number, number],
  gray200:     [229, 231, 235] as [number, number, number],
  gray100:     [243, 244, 246] as [number, number, number],
  amber:       [245, 158, 11] as [number, number, number],
  blue:        [59, 130, 246] as [number, number, number],
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
  return "$" + value.toLocaleString("es-CO");
}

function formatScore(score: number): string {
  if (score >= 80) return "ALTO";
  if (score >= 60) return "MEDIO-ALTO";
  if (score >= 40) return "MEDIO";
  return "BAJO";
}

function spaceTypeLabel(type: string, other?: string | null): string {
  const map: Record<string, string> = {
    parking: "Parqueadero",
    mall: "Centro Comercial",
    gas_station: "Estación de Servicio",
    hotel: "Hotel",
    restaurant: "Restaurante",
    office_building: "Edificio de Oficinas",
    residential: "Conjunto Residencial",
    supermarket: "Supermercado",
    hospital: "Hospital / Clínica",
    university: "Universidad",
    airport: "Aeropuerto",
    highway_rest: "Área de Descanso Vial",
    other: other || "Otro",
  };
  return map[type] || type;
}

async function downloadImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 8000,
      headers: { "User-Agent": "EVGreen-PDF-Generator/1.0" },
    });
    const contentType = response.headers["content-type"] || "image/jpeg";
    const format = contentType.includes("png") ? "PNG" : "JPEG";
    const base64 = Buffer.from(response.data).toString("base64");
    return { data: `data:${contentType};base64,${base64}`, format };
  } catch {
    return null;
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================
export async function generateProspectoPdf(data: ProspectoPdfData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();   // 215.9mm
  const PH = doc.internal.pageSize.getHeight();  // 279.4mm
  const M = 18; // margen
  const CW = PW - M * 2; // ancho de contenido

  // Descargar logo EVGreen y fotos en paralelo
  const logoUrl = "https://evgreen.lat/logo-evgreen.png";
  const [logoImg, ...photoImgs] = await Promise.all([
    downloadImageAsBase64(logoUrl),
    ...data.photos.slice(0, 4).map(p => downloadImageAsBase64(p.url)),
  ]);

  // Parsear análisis IA
  let aiData: any = null;
  if (data.aiAnalysis) {
    try { aiData = JSON.parse(data.aiAnalysis); } catch { /* ignore */ }
  }

  // ============================================================
  // PÁGINA 1 — PORTADA
  // ============================================================
  addPortada(doc, data, PW, PH, M, CW, logoImg, photoImgs[0]);

  // ============================================================
  // PÁGINA 2 — RESUMEN EJECUTIVO + ANÁLISIS DE VIABILIDAD
  // ============================================================
  doc.addPage();
  let y = addPageHeader(doc, data, PW, M, logoImg, 2);
  y = addResumenEjecutivo(doc, data, aiData, y, M, CW, PW, PH);

  // ============================================================
  // PÁGINA 3 — DATOS TÉCNICOS + FOTOS
  // ============================================================
  doc.addPage();
  y = addPageHeader(doc, data, PW, M, logoImg, 3);
  y = addDatosTecnicos(doc, data, y, M, CW, PW, PH);
  y = addFotos(doc, photoImgs.slice(1), data.photos.slice(1), y, M, CW, PW, PH);

  // ============================================================
  // PÁGINA 4 — PROYECCIÓN FINANCIERA
  // ============================================================
  doc.addPage();
  y = addPageHeader(doc, data, PW, M, logoImg, 4);
  y = addProyeccionFinanciera(doc, data, y, M, CW, PW, PH);

  // ============================================================
  // PÁGINA 5 — MAPA + DATOS PROPIETARIO + CIERRE
  // ============================================================
  doc.addPage();
  y = addPageHeader(doc, data, PW, M, logoImg, 5);
  y = addMapaYPropietario(doc, data, y, M, CW, PW, PH);
  addCierre(doc, data, PW, PH, M, CW);

  // Numerar páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setColor(doc, C.gray500, "text");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${totalPages}  ·  Prospecto de Inversión EVGreen  ·  ${data.code}`, PW / 2, PH - 8, { align: "center" });
    // Línea inferior
    setColor(doc, C.gray200, "draw");
    doc.setLineWidth(0.3);
    doc.line(M, PH - 11, PW - M, PH - 11);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ============================================================
// PORTADA
// ============================================================
function addPortada(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  PW: number, PH: number, M: number, CW: number,
  logoImg: { data: string; format: string } | null,
  heroImg: { data: string; format: string } | null,
) {
  // Franja superior verde
  setColor(doc, C.green, "fill");
  doc.rect(0, 0, PW, 52, "F");
  setColor(doc, C.greenDark, "fill");
  doc.rect(0, 49, PW, 3, "F");

  // Logo en portada
  if (logoImg) {
    try { doc.addImage(logoImg.data, logoImg.format, M, 10, 45, 18); } catch { /* skip */ }
  } else {
    setColor(doc, C.white, "text");
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("EVGreen", M, 26);
  }

  // Tag "PROSPECTO DE INVERSIÓN" en portada
  setColor(doc, C.white, "text");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("PROSPECTO DE INVERSIÓN", PW - M, 18, { align: "right" });
  doc.setFontSize(8);
  doc.text(`Código: ${data.code}  ·  ${data.generatedAt.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}`, PW - M, 24, { align: "right" });

  // Imagen hero del espacio
  const heroY = 55;
  const heroH = 70;
  if (heroImg) {
    try {
      doc.addImage(heroImg.data, heroImg.format, 0, heroY, PW, heroH, undefined, "FAST");
      // Overlay semitransparente sobre la imagen
      setColor(doc, C.black, "fill");
      doc.setGState(new (doc as any).GState({ opacity: 0.35 }));
      doc.rect(0, heroY, PW, heroH, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    } catch { /* skip */ }
  } else {
    setColor(doc, C.gray100, "fill");
    doc.rect(0, heroY, PW, heroH, "F");
  }

  // Nombre del espacio sobre la imagen
  setColor(doc, C.white, "text");
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(data.spaceName.toUpperCase(), CW);
  doc.text(nameLines.slice(0, 2), M, heroY + 22);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.city}, ${data.department}  ·  ${spaceTypeLabel(data.spaceType, data.spaceTypeOther)}`, M, heroY + 38);

  // Score badge
  if (data.aiScore) {
    const scoreColor = data.aiScore >= 70 ? C.green : data.aiScore >= 50 ? C.amber : [239, 68, 68] as [number, number, number];
    setColor(doc, scoreColor, "fill");
    doc.roundedRect(PW - M - 32, heroY + 10, 32, 22, 3, 3, "F");
    setColor(doc, C.white, "text");
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.aiScore}`, PW - M - 16, heroY + 20, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("SCORE IA", PW - M - 16, heroY + 27, { align: "center" });
  }

  // Sección de métricas clave (fondo blanco)
  const metricsY = heroY + heroH + 8;
  setColor(doc, C.gray100, "fill");
  doc.roundedRect(M, metricsY, CW, 32, 3, 3, "F");

  const metrics = [
    { label: "INVERSIÓN REQUERIDA", value: data.estimatedInvestmentCop ? formatCOP(data.estimatedInvestmentCop) : "Por definir" },
    { label: "CARGADORES ESTIMADOS", value: data.estimatedChargerCount ? `${data.estimatedChargerCount} unidades` : "Por definir" },
    { label: "POTENCIA TOTAL", value: data.estimatedPowerKw ? `${data.estimatedPowerKw} kW` : "Por definir" },
    { label: "REPARTO INVERSOR", value: `${data.investorSharePercent}%` },
  ];

  const colW = CW / metrics.length;
  metrics.forEach((m, i) => {
    const cx = M + colW * i + colW / 2;
    setColor(doc, C.green, "text");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(m.value, cx, metricsY + 14, { align: "center" });
    setColor(doc, C.gray500, "text");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(m.label, cx, metricsY + 22, { align: "center" });
    // Separador vertical
    if (i < metrics.length - 1) {
      setColor(doc, C.gray200, "draw");
      doc.setLineWidth(0.3);
      doc.line(M + colW * (i + 1), metricsY + 5, M + colW * (i + 1), metricsY + 27);
    }
  });

  // Descripción breve
  const descY = metricsY + 40;
  setColor(doc, C.gray900, "text");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("OPORTUNIDAD DE INVERSIÓN", M, descY);
  setColor(doc, C.green, "draw");
  doc.setLineWidth(0.5);
  doc.line(M, descY + 2, M + 55, descY + 2);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  setColor(doc, C.gray700, "text");
  const introText = `Este prospecto presenta la oportunidad de inversión en la instalación de infraestructura de carga para vehículos eléctricos en ${data.spaceName}, ubicado en ${data.city}, ${data.department}. La plataforma EVGreen ha evaluado este espacio con un score de viabilidad de ${data.aiScore ?? "N/A"}/100, calificado como ${data.aiScore ? formatScore(data.aiScore) : "pendiente"}.`;
  const introLines = doc.splitTextToSize(introText, CW);
  doc.text(introLines, M, descY + 10);

  // Disclaimer
  setColor(doc, C.gray500, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  const disclaimer = "Este documento es confidencial y ha sido preparado exclusivamente para fines informativos. Las proyecciones financieras son estimaciones basadas en datos históricos del sector y no constituyen garantía de rendimiento futuro.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, CW);
  doc.text(disclaimerLines, M, PH - 22);
}

// ============================================================
// ENCABEZADO DE PÁGINA (páginas 2-5)
// ============================================================
function addPageHeader(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  PW: number, M: number,
  logoImg: { data: string; format: string } | null,
  pageNum: number,
): number {
  // Franja verde delgada
  setColor(doc, C.green, "fill");
  doc.rect(0, 0, PW, 16, "F");

  if (logoImg) {
    try { doc.addImage(logoImg.data, logoImg.format, M, 2, 28, 11); } catch { /* skip */ }
  } else {
    setColor(doc, C.white, "text");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("EVGreen", M, 11);
  }

  setColor(doc, C.white, "text");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.spaceName}  ·  ${data.code}`, PW - M, 10, { align: "right" });

  return 24; // y inicial después del header
}

// ============================================================
// RESUMEN EJECUTIVO
// ============================================================
function addResumenEjecutivo(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData, aiData: any,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "RESUMEN EJECUTIVO", M, y, CW);

  // Párrafo de resumen
  setColor(doc, C.gray700, "text");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  const summary = aiData?.summary || `El espacio ${data.spaceName} en ${data.city} presenta condiciones favorables para la instalación de infraestructura de carga EV. Con ${data.estimatedChargerCount || "varios"} cargadores de ${data.estimatedPowerKw || "N/A"} kW de potencia total, este punto ofrece una oportunidad de inversión en el creciente mercado de movilidad eléctrica en Colombia.`;
  const summaryLines = doc.splitTextToSize(summary, CW);
  doc.text(summaryLines, M, y);
  y += summaryLines.length * 5 + 6;

  // Score visual
  if (data.aiScore) {
    y = addScoreVisual(doc, data.aiScore, y, M, CW, PW);
    y += 8;
  }

  // Fortalezas y debilidades en dos columnas
  if (aiData?.strengths?.length || aiData?.weaknesses?.length) {
    const colW = (CW - 6) / 2;

    // Fortalezas
    setColor(doc, C.greenLight, "fill");
    doc.roundedRect(M, y, colW, 4, 1, 1, "F");
    setColor(doc, C.greenDark, "text");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("✓  FORTALEZAS", M + 4, y + 3);
    y += 7;

    const strengths: string[] = (aiData?.strengths || []).slice(0, 4);
    strengths.forEach(s => {
      const lines = doc.splitTextToSize(`• ${s}`, colW - 4);
      setColor(doc, C.gray700, "text");
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(lines, M + 2, y);
      y += lines.length * 4.5 + 2;
    });

    // Debilidades (columna derecha, volver al y inicial de esta sección)
    const weakY = y - (strengths.reduce((acc, s) => {
      const lines = doc.splitTextToSize(`• ${s}`, colW - 4);
      return acc + lines.length * 4.5 + 2;
    }, 0)) - 7;

    const colX2 = M + colW + 6;
    setColor(doc, [255, 251, 235] as [number, number, number], "fill");
    doc.roundedRect(colX2, weakY, colW, 4, 1, 1, "F");
    setColor(doc, C.amber, "text");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("⚠  ASPECTOS A EVALUAR", colX2 + 4, weakY + 3);

    let weakYCur = weakY + 7;
    const weaknesses: string[] = (aiData?.weaknesses || []).slice(0, 4);
    weaknesses.forEach(w => {
      const lines = doc.splitTextToSize(`• ${w}`, colW - 4);
      setColor(doc, C.gray700, "text");
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(lines, colX2 + 2, weakYCur);
      weakYCur += lines.length * 4.5 + 2;
    });

    y = Math.max(y, weakYCur) + 6;
  }

  // Recomendación IA
  if (aiData?.recommendation) {
    setColor(doc, C.greenLight, "fill");
    doc.roundedRect(M, y, CW, 5, 1, 1, "F");
    setColor(doc, C.greenDark, "text");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("RECOMENDACIÓN TÉCNICA EVGreen", M + 4, y + 3.5);
    y += 8;
    const recLines = doc.splitTextToSize(aiData.recommendation, CW - 4);
    setColor(doc, C.gray700, "text");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(recLines, M + 2, y);
    y += recLines.length * 5 + 6;
  }

  return y;
}

function addScoreVisual(doc: InstanceType<typeof jsPDF>, score: number, y: number, M: number, CW: number, PW: number): number {
  // Barra de score
  const barW = CW;
  const barH = 8;
  setColor(doc, C.gray200, "fill");
  doc.roundedRect(M, y, barW, barH, 2, 2, "F");
  const fillW = (score / 100) * barW;
  const scoreColor = score >= 70 ? C.green : score >= 50 ? C.amber : [239, 68, 68] as [number, number, number];
  setColor(doc, scoreColor, "fill");
  doc.roundedRect(M, y, fillW, barH, 2, 2, "F");

  // Etiquetas de escala
  setColor(doc, C.gray500, "text");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("0", M, y + barH + 4);
  doc.text("50", M + barW / 2, y + barH + 4, { align: "center" });
  doc.text("100", M + barW, y + barH + 4, { align: "right" });

  // Score actual
  setColor(doc, scoreColor, "text");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${score}/100 — Viabilidad ${formatScore(score)}`, M + fillW + 2, y + 6);

  return y + barH + 8;
}

// ============================================================
// DATOS TÉCNICOS
// ============================================================
function addDatosTecnicos(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "CARACTERÍSTICAS TÉCNICAS DEL ESPACIO", M, y, CW);

  const rows: [string, string][] = [
    ["Tipo de espacio", spaceTypeLabel(data.spaceType, data.spaceTypeOther)],
    ["Dirección", data.address],
    ["Ciudad / Departamento", `${data.city}, ${data.department}`],
    ["Área disponible", data.availableAreaM2 ? `${data.availableAreaM2} m²` : "No especificado"],
    ["Puestos de parqueo", data.parkingSpots ? `${data.parkingSpots} puestos` : "No especificado"],
    ["Capacidad transformador", data.transformerCapacityKva ? `${data.transformerCapacityKva} kVA` : "No especificado"],
    ["Tablero eléctrico", data.hasElectricalPanel ? "Disponible" : "No disponible"],
    ["Distancia al tablero", data.electricalDistance ? `${data.electricalDistance} m` : "No especificado"],
    ["Conectividad internet", data.hasInternet ? "Disponible" : "No disponible"],
    ["Horario de operación", data.is24Hours ? "24 horas / 7 días" : (data.operatingHoursStart && data.operatingHoursEnd ? `${data.operatingHoursStart} – ${data.operatingHoursEnd}` : "No especificado")],
    ["Vehículos diarios estimados", data.estimatedDailyVehicles ? `${data.estimatedDailyVehicles.toLocaleString("es-CO")}` : "No especificado"],
    ["Porcentaje EV estimado", data.estimatedEvPercent ? `${data.estimatedEvPercent}%` : "No especificado"],
    ["Estrato socioeconómico", data.socioeconomicStratum ? `Estrato ${data.socioeconomicStratum}` : "No especificado"],
  ];

  if (data.nearbyAttractions) {
    rows.push(["Puntos de interés cercanos", data.nearbyAttractions]);
  }

  const colW1 = CW * 0.38;
  const colW2 = CW * 0.62;

  rows.forEach((row, i) => {
    const rowY = y + i * 8;
    if (rowY > PH - 30) return; // evitar overflow
    setColor(doc, i % 2 === 0 ? C.gray100 : C.white, "fill");
    doc.rect(M, rowY - 1, CW, 8, "F");

    setColor(doc, C.gray500, "text");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(row[0], M + 3, rowY + 4.5);

    setColor(doc, C.gray900, "text");
    doc.setFont("helvetica", "normal");
    const valLines = doc.splitTextToSize(row[1], colW2 - 4);
    doc.text(valLines[0], M + colW1 + 3, rowY + 4.5);
  });

  return y + rows.length * 8 + 8;
}

// ============================================================
// FOTOS
// ============================================================
function addFotos(
  doc: InstanceType<typeof jsPDF>,
  photoImgs: Array<{ data: string; format: string } | null>,
  photoData: Array<{ url: string; caption?: string | null }>,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  const validPhotos = photoImgs.filter(p => p !== null);
  if (validPhotos.length === 0) return y;

  y = drawSectionTitle(doc, "FOTOGRAFÍAS DEL ESPACIO", M, y, CW);

  const cols = 2;
  const photoW = (CW - 6) / cols;
  const photoH = photoW * 0.65;

  validPhotos.slice(0, 4).forEach((img, i) => {
    if (!img) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = M + col * (photoW + 6);
    const py = y + row * (photoH + 10);

    if (py + photoH > PH - 20) return; // overflow

    try {
      doc.addImage(img.data, img.format, px, py, photoW, photoH, undefined, "FAST");
      // Borde sutil
      setColor(doc, C.gray200, "draw");
      doc.setLineWidth(0.3);
      doc.rect(px, py, photoW, photoH);
    } catch { /* skip */ }

    // Caption
    if (photoData[i]?.caption) {
      setColor(doc, C.gray500, "text");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.text(photoData[i].caption!, px, py + photoH + 4);
    }
  });

  const rows = Math.ceil(validPhotos.length / cols);
  return y + rows * (photoH + 10) + 6;
}

// ============================================================
// PROYECCIÓN FINANCIERA
// ============================================================
function addProyeccionFinanciera(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "PROYECCIÓN FINANCIERA", M, y, CW);

  const inv = data.estimatedInvestmentCop || 0;
  const sessions = data.projectedMonthlySessionsYear1 || (data.estimatedDailyVehicles ? Math.round(data.estimatedDailyVehicles * (data.estimatedEvPercent || 5) / 100 * 30 * 0.6) : 120);
  const avgRev = data.avgSessionRevenueCop || 8500;
  const monthlyGross = sessions * avgRev;
  // Modelo Opción A: aliado 10% del bruto, inversor y EVGreen sobre el 90% restante
  const allySharePct = data.allySharePercent / 100;
  const netAfterAlly = monthlyGross * (1 - allySharePct);
  const investorShare = data.investorSharePercent / 100; // sobre el neto
  const platformShare = data.platformSharePercent / 100; // sobre el neto
  const monthlyAlly = monthlyGross * allySharePct;
  const monthlyInvestor = netAfterAlly * investorShare;
  const monthlyPlatform = netAfterAlly * platformShare;

  // Modelo de reparto (3 partes)
  const allyPct = data.allySharePercent;       // % del bruto para el aliado
  const netPct = 100 - allyPct;               // % restante para inversor + EVGreen
  const investorNetPct = data.investorSharePercent; // % del neto para inversor
  const platformNetPct = data.platformSharePercent; // % del neto para EVGreen
  // Porcentajes efectivos sobre el bruto
  const investorEffective = (investorNetPct / 100) * netPct;
  const platformEffective = (platformNetPct / 100) * netPct;

  setColor(doc, C.greenLight, "fill");
  doc.roundedRect(M, y, CW, 28, 3, 3, "F");

  setColor(doc, C.greenDark, "text");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("MODELO DE REPARTO DE INGRESOS (sobre ingreso bruto)", M + 4, y + 6);

  // Barra de reparto visual (3 segmentos)
  const barY = y + 11;
  const barW = CW - 8;
  const barH = 7;
  const allyW = barW * (allyPct / 100);
  const investorW = barW * (investorEffective / 100);
  const platformW = barW - allyW - investorW;

  // Aliado (azul)
  setColor(doc, C.blue, "fill");
  doc.roundedRect(M + 4, barY, allyW, barH, 1, 1, "F");
  // Inversor (verde)
  setColor(doc, C.green, "fill");
  doc.rect(M + 4 + allyW, barY, investorW, barH, "F");
  // EVGreen (gris)
  setColor(doc, C.gray500, "fill");
  doc.rect(M + 4 + allyW + investorW, barY, platformW, barH, "F");

  setColor(doc, C.white, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  if (allyW > 18) doc.text(`Aliado ${allyPct}%`, M + 4 + allyW / 2, barY + 5, { align: "center" });
  if (investorW > 18) doc.text(`Inversor ${investorEffective.toFixed(0)}%`, M + 4 + allyW + investorW / 2, barY + 5, { align: "center" });
  if (platformW > 18) doc.text(`EVGreen ${platformEffective.toFixed(0)}%`, M + 4 + allyW + investorW + platformW / 2, barY + 5, { align: "center" });

  // Leyenda detallada
  setColor(doc, C.gray700, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Aliado dueño del espacio: ${allyPct}% del bruto  ·  Inversor: ${investorNetPct}% del neto (${investorEffective.toFixed(0)}% bruto)  ·  EVGreen: ${platformNetPct}% del neto (${platformEffective.toFixed(0)}% bruto)`, M + 4, barY + 14);

  y += 34;

  // Tabla de proyección a 3 años
  const years = [1, 2, 3];
  const growthRates = [1.0, 1.15, 1.30]; // 0%, 15%, 30% de crecimiento

  const tableHeaders = ["Indicador", "Año 1", "Año 2 (+15%)", "Año 3 (+30%)"];
  const tableRows = [
    ["Sesiones/mes estimadas", ...years.map((_, i) => `${Math.round(sessions * growthRates[i]).toLocaleString("es-CO")}`)],
    ["Ingreso bruto mensual", ...years.map((_, i) => formatCOP(Math.round(monthlyGross * growthRates[i])))],
    ["Ingreso bruto anual", ...years.map((_, i) => formatCOP(Math.round(monthlyGross * growthRates[i] * 12)))],
    [`Pago aliado (${data.allySharePercent}% bruto) mensual`, ...years.map((_, i) => formatCOP(Math.round(monthlyAlly * growthRates[i])))],
    [`Retorno inversor (${data.investorSharePercent}% neto) mensual`, ...years.map((_, i) => formatCOP(Math.round(monthlyInvestor * growthRates[i])))],
    [`Retorno inversor anual`, ...years.map((_, i) => formatCOP(Math.round(monthlyInvestor * growthRates[i] * 12)))],
    [`EVGreen (${data.platformSharePercent}% neto) mensual`, ...years.map((_, i) => formatCOP(Math.round(monthlyPlatform * growthRates[i])))],
    ...(inv > 0 ? [["ROI estimado (sobre inversión)", ...years.map((_, i) => `${((monthlyInvestor * growthRates[i] * 12) / inv * 100).toFixed(1)}% anual`)]] : []),
    ...(inv > 0 ? [["Recuperación de inversión", ...years.map((_, i) => {
      const months = inv / (monthlyInvestor * growthRates[i]);
      return months <= 12 ? `${months.toFixed(1)} meses` : `${(months / 12).toFixed(1)} años`;
    })]] : []),
  ];

  (doc as any).autoTable({
    startY: y,
    head: [tableHeaders],
    body: tableRows,
    margin: { left: M, right: M },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 30, 30] },
    headStyles: { fillColor: C.green, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: C.gray100 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: CW * 0.38 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Nota aclaratoria
  setColor(doc, C.gray500, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  const nota = `* Proyecciones basadas en ${sessions} sesiones/mes (Año 1), ingreso promedio de ${formatCOP(avgRev)}/sesión. Modelo: aliado ${data.allySharePercent}% del bruto; inversor ${data.investorSharePercent}% y EVGreen ${data.platformSharePercent}% del neto restante. Las cifras son estimaciones orientativas.`;
  const notaLines = doc.splitTextToSize(nota, CW);
  doc.text(notaLines, M, y);
  y += notaLines.length * 4.5 + 6;

  return y;
}

// ============================================================
// MAPA + PROPIETARIO
// ============================================================
function addMapaYPropietario(
  doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData,
  y: number, M: number, CW: number, PW: number, PH: number,
): number {
  y = drawSectionTitle(doc, "UBICACIÓN GEOGRÁFICA", M, y, CW);

  if (data.latitude && data.longitude) {
    // URL del mapa estático de Google Maps
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${data.latitude},${data.longitude}&zoom=15&size=600x300&maptype=roadmap&markers=color:green%7Clabel:EV%7C${data.latitude},${data.longitude}&key=${process.env.VITE_GOOGLE_MAPS_API_KEY || ""}`;

    // Intentar cargar el mapa
    downloadImageAsBase64(mapUrl).then(mapImg => {
      if (mapImg) {
        try {
          doc.addImage(mapImg.data, mapImg.format, M, y, CW, 55, undefined, "FAST");
          setColor(doc, C.gray200, "draw");
          doc.setLineWidth(0.3);
          doc.rect(M, y, CW, 55);
        } catch { /* skip */ }
      }
    }).catch(() => { /* skip */ });

    // Coordenadas textuales (siempre visibles)
    setColor(doc, C.gray700, "text");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`📍 Coordenadas: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`, M, y + 60);
    doc.text(`🔗 Ver en Google Maps: maps.google.com/?q=${data.latitude},${data.longitude}`, M, y + 66);
    y += 72;
  } else {
    setColor(doc, C.gray500, "text");
    doc.setFontSize(9);
    doc.text("Coordenadas GPS no disponibles para este espacio.", M, y + 6);
    y += 14;
  }

  // Datos del propietario
  y = drawSectionTitle(doc, "DATOS DEL PROPIETARIO DEL ESPACIO", M, y, CW);

  const propRows: [string, string][] = [
    ["Nombre / Razón social", data.submitterName],
    ["Empresa", data.submitterCompany || "No especificado"],
    ["Email de contacto", data.submitterEmail],
    ["Teléfono", data.submitterPhone],
    ["Ciudad", `${data.city}, ${data.department}`],
  ];

  const colW1 = CW * 0.35;
  propRows.forEach((row, i) => {
    const rowY = y + i * 8;
    setColor(doc, i % 2 === 0 ? C.gray100 : C.white, "fill");
    doc.rect(M, rowY - 1, CW, 8, "F");
    setColor(doc, C.gray500, "text");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(row[0], M + 3, rowY + 4.5);
    setColor(doc, C.gray900, "text");
    doc.setFont("helvetica", "normal");
    doc.text(row[1], M + colW1 + 3, rowY + 4.5);
  });

  return y + propRows.length * 8 + 8;
}

// ============================================================
// CIERRE
// ============================================================
function addCierre(doc: InstanceType<typeof jsPDF>, data: ProspectoPdfData, PW: number, PH: number, M: number, CW: number) {
  const cierreY = PH - 55;

  // Línea divisora
  setColor(doc, C.green, "draw");
  doc.setLineWidth(0.8);
  doc.line(M, cierreY, PW - M, cierreY);

  // Franja verde de cierre
  setColor(doc, C.green, "fill");
  doc.rect(0, cierreY + 4, PW, 30, "F");

  setColor(doc, C.white, "text");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("¿Listo para invertir en movilidad eléctrica?", PW / 2, cierreY + 16, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Contáctenos: inversiones@evgreen.lat  ·  www.evgreen.lat  ·  NIT: 901.447.678-0", PW / 2, cierreY + 24, { align: "center" });

  // Fecha de generación
  setColor(doc, C.gray500, "text");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.text(`Documento generado el ${data.generatedAt.toLocaleString("es-CO")}  ·  Confidencial`, PW / 2, cierreY + 38, { align: "center" });
}

// ============================================================
// HELPER: TÍTULO DE SECCIÓN
// ============================================================
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
