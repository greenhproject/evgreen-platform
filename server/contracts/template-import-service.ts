import * as mammoth from "mammoth";
import { PDFDocument, PDFTextField, StandardFonts, rgb } from "pdf-lib";
import {
  CONTRACT_VARIABLE_CATALOG,
  type ContractVariableName,
  detectContractTemplateMarkers,
  normalizeContractTemplateMarkerMappings,
  renderContractTemplate,
} from "../../shared/site-contracts";
import { sanitizeContractHtml, sha256 } from "./contract-pdf-service";

export const CONTRACT_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const CONTRACT_PDF_MIME = "application/pdf";
export const CONTRACT_TEMPLATE_MAX_BYTES = 10 * 1024 * 1024;

export type ContractTemplateSourceFormat = "DOCX" | "PDF_ACROFORM";

export type ContractTemplateSource = {
  buffer: Buffer;
  filename: string;
  contentType: typeof CONTRACT_DOCX_MIME | typeof CONTRACT_PDF_MIME;
  origin: "UPLOAD" | "GOOGLE_DRIVE";
  sourceUrl?: string;
};

export type ContractTemplateAnalysis = {
  sourceFormat: ContractTemplateSourceFormat;
  filename: string;
  contentType: string;
  sourceHash: string;
  htmlContent: string | null;
  pageCount: number | null;
  markers: ReturnType<typeof detectContractTemplateMarkers>;
  warnings: string[];
};

function ensureFileSize(buffer: Buffer) {
  if (!buffer.length || buffer.length > CONTRACT_TEMPLATE_MAX_BYTES) {
    throw new Error("El archivo debe tener un tamaño entre 1 byte y 10 MB.");
  }
}

function filenameFromDisposition(disposition: string | null): string | null {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded.replace(/["']/g, ""));
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] || null;
}

export function parseGoogleContractDocumentUrl(input: string): { downloadUrl: string; fallbackFilename: string } {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("El enlace de Google debe usar HTTPS.");
  const host = url.hostname.toLowerCase();
  const documentMatch = host === "docs.google.com" ? url.pathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)/) : null;
  if (documentMatch) {
    return {
      downloadUrl: `https://docs.google.com/document/d/${documentMatch[1]}/export?format=docx`,
      fallbackFilename: `google-doc-${documentMatch[1]}.docx`,
    };
  }
  const driveFileMatch = host === "drive.google.com" ? url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/) : null;
  const openId = host === "drive.google.com" && url.pathname === "/open" ? url.searchParams.get("id") : null;
  const fileId = driveFileMatch?.[1] || openId;
  if (fileId && /^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return {
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      fallbackFilename: `google-drive-${fileId}`,
    };
  }
  throw new Error("Use un enlace de Google Docs o Google Drive con formato reconocido y acceso de lectura habilitado.");
}

export async function downloadGoogleContractTemplate(input: string): Promise<ContractTemplateSource> {
  const parsed = parseGoogleContractDocumentUrl(input);
  const response = await fetch(parsed.downloadUrl, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Google no permitió descargar el archivo (${response.status}). Compártalo con acceso de lectura mediante el enlace.`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > CONTRACT_TEMPLATE_MAX_BYTES) throw new Error("El archivo de Google supera el máximo de 10 MB.");
  const buffer = Buffer.from(await response.arrayBuffer());
  ensureFileSize(buffer);
  const headerType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const isDocx = buffer.subarray(0, 2).toString("utf8") === "PK";
  const isPdf = buffer.subarray(0, 4).toString("utf8") === "%PDF";
  if (!isDocx && !isPdf) {
    if (headerType.includes("text/html")) throw new Error("El enlace de Google requiere iniciar sesión o no tiene acceso público de lectura.");
    throw new Error("Google Drive no devolvió un DOCX ni un PDF compatible.");
  }
  const contentType = isDocx ? CONTRACT_DOCX_MIME : CONTRACT_PDF_MIME;
  const extension = isDocx ? ".docx" : ".pdf";
  const dispositionName = filenameFromDisposition(response.headers.get("content-disposition"));
  const rawName = dispositionName || parsed.fallbackFilename;
  const filename = rawName.toLowerCase().endsWith(extension) ? rawName : `${rawName}${extension}`;
  return { buffer, filename, contentType, origin: "GOOGLE_DRIVE", sourceUrl: input };
}

export function decodeContractTemplateUpload(input: { fileBase64: string; filename: string; contentType: string }): ContractTemplateSource {
  const normalized = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(normalized, "base64");
  ensureFileSize(buffer);
  const isDocx = buffer.subarray(0, 2).toString("utf8") === "PK";
  const isPdf = buffer.subarray(0, 4).toString("utf8") === "%PDF";
  if (!isDocx && !isPdf) throw new Error("Seleccione un archivo DOCX o PDF válido.");
  return {
    buffer,
    filename: input.filename,
    contentType: isDocx ? CONTRACT_DOCX_MIME : CONTRACT_PDF_MIME,
    origin: "UPLOAD",
  };
}

export async function analyzeContractTemplateSource(source: ContractTemplateSource): Promise<ContractTemplateAnalysis> {
  if (source.contentType === CONTRACT_DOCX_MIME) {
    const converted = await mammoth.convertToHtml({ buffer: source.buffer });
    const htmlContent = sanitizeContractHtml(converted.value).trim();
    if (!htmlContent) throw new Error("No fue posible extraer contenido de la plantilla DOCX.");
    const markers = detectContractTemplateMarkers(htmlContent);
    if (!markers.length) throw new Error("No se encontraron campos dinámicos con formato {{campo}} en el DOCX.");
    return {
      sourceFormat: "DOCX",
      filename: source.filename,
      contentType: source.contentType,
      sourceHash: sha256(source.buffer),
      htmlContent,
      pageCount: null,
      markers,
      warnings: converted.messages.map(message => message.message),
    };
  }

  const pdf = await PDFDocument.load(source.buffer, { ignoreEncryption: false, updateMetadata: false });
  const textFields = pdf.getForm().getFields().filter((field): field is PDFTextField => field instanceof PDFTextField);
  if (!textFields.length) {
    throw new Error("El PDF no contiene campos de formulario de texto (AcroForm). Para una plantilla dinámica use DOCX/Google Docs o agregue campos rellenables al PDF; un PDF plano puede cargarse después como contrato firmado manualmente.");
  }
  const markerHtml = textFields.map(field => `{{${field.getName()}}}`).join("\n");
  return {
    sourceFormat: "PDF_ACROFORM",
    filename: source.filename,
    contentType: source.contentType,
    sourceHash: sha256(source.buffer),
    htmlContent: null,
    pageCount: pdf.getPageCount(),
    markers: detectContractTemplateMarkers(markerHtml),
    warnings: pdf.getForm().getFields().length === textFields.length ? [] : ["Los campos PDF que no son de texto se conservarán, pero no se mapearán como variables contractuales."],
  };
}

function sampleValues(): Record<ContractVariableName, string> {
  return Object.fromEntries(CONTRACT_VARIABLE_CATALOG.map(variable => [variable.name, variable.sampleValue])) as Record<ContractVariableName, string>;
}

export async function buildContractTemplateMappingPreview(
  source: ContractTemplateSource,
  analysis: ContractTemplateAnalysis,
  mappings: Record<string, string>,
): Promise<{ normalizedHtml: string | null; previewHtml: string | null; previewPdfBase64: string | null; variables: ContractVariableName[] }> {
  const values = sampleValues();
  if (analysis.sourceFormat === "DOCX" && analysis.htmlContent) {
    const normalized = normalizeContractTemplateMarkerMappings(analysis.htmlContent, mappings);
    return {
      normalizedHtml: normalized.htmlContent,
      previewHtml: renderContractTemplate(normalized.htmlContent, values),
      previewPdfBase64: null,
      variables: normalized.variables,
    };
  }

  const normalized = normalizeContractTemplateMarkerMappings(
    analysis.markers.map(marker => `{{${marker.rawName}}}`).join(" "),
    mappings,
  );
  const bytes = await fillMappedPdfTemplate(source.buffer, mappings, values, false);
  return {
    normalizedHtml: normalized.htmlContent,
    previewHtml: null,
    previewPdfBase64: Buffer.from(bytes).toString("base64"),
    variables: normalized.variables,
  };
}

export async function fillMappedPdfTemplate(
  sourcePdf: Buffer,
  mappings: Record<string, string>,
  values: Record<string, string>,
  flatten = true,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(sourcePdf, { ignoreEncryption: false, updateMetadata: false });
  const form = pdf.getForm();
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const variable = mappings[field.getName()]?.trim().toUpperCase();
    if (variable) field.setText(values[variable] || "");
  }
  form.updateFieldAppearances();
  if (flatten) form.flatten();
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

export async function buildMappedContractPdf(input: {
  sourcePdf: Buffer;
  mappings: Record<string, string>;
  values: Record<string, string>;
  contractNumber: string;
  contentHash: string;
  allyName: string;
  allyRepresentative: string;
  allyDocument: string;
  operatorName: string;
  operatorRepresentative: string;
  operatorDocument: string;
}): Promise<Buffer> {
  const filled = await fillMappedPdfTemplate(input.sourcePdf, input.mappings, input.values, false);
  const pdf = await PDFDocument.load(filled, { ignoreEncryption: false, updateMetadata: false });
  pdf.getForm().flatten();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const color = rgb(0.08, 0.12, 0.14);
  const muted = rgb(0.35, 0.4, 0.43);
  const draw = (text: string, x: number, y: number, size = 10, font = regular, textColor = color) => {
    page.drawText(text.slice(0, 95), { x, y, size, font, color: textColor });
  };

  draw("FIRMAS DEL CONTRATO", 54, 720, 16, bold);
  draw(`Contrato: ${input.contractNumber}`, 54, 695, 10, regular, muted);
  draw("Las partes declaran haber revisado y aceptado el documento completo y sus anexos.", 54, 665, 10);

  draw("POR EL ALIADO / EDS", 54, 610, 11, bold);
  page.drawLine({ start: { x: 54, y: 530 }, end: { x: 278, y: 530 }, thickness: 1, color });
  draw("EVG_ALLY_SIGN_HERE", 56, 536, 1, regular, rgb(1, 1, 1));
  draw(input.allyRepresentative, 54, 512, 10, bold);
  draw(`Documento: ${input.allyDocument}`, 54, 494, 9);
  draw(`En representacion de: ${input.allyName}`, 54, 476, 9);
  draw("Fecha: ______________________________", 54, 442, 9);

  draw("POR GREEN HOUSE PROJECT SAS", 334, 610, 11, bold);
  page.drawLine({ start: { x: 334, y: 530 }, end: { x: 558, y: 530 }, thickness: 1, color });
  draw("EVG_OPERATOR_SIGN_HERE", 336, 536, 1, regular, rgb(1, 1, 1));
  draw(input.operatorRepresentative, 334, 512, 10, bold);
  draw(`Documento: ${input.operatorDocument}`, 334, 494, 9);
  draw(`En representacion de: ${input.operatorName}`, 334, 476, 9);
  draw("Fecha: ______________________________", 334, 442, 9);

  page.drawLine({ start: { x: 54, y: 110 }, end: { x: 558, y: 110 }, thickness: 0.5, color: muted });
  draw("VERIFICACION DE INTEGRIDAD", 54, 88, 8, bold, muted);
  draw(`SHA-256 logico: ${input.contentHash}`, 54, 72, 7, regular, muted);
  draw("Documento generado desde una plantilla versionada por EVGreen.", 54, 56, 7, regular, muted);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

export function mappingFingerprint(sourceHash: string, mappings: Record<string, string>): string {
  const stableMappings = Object.entries(mappings)
    .map(([raw, variable]) => [raw.trim(), variable.trim().toUpperCase()] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return sha256(`${sourceHash}:${JSON.stringify(stableMappings)}`);
}
