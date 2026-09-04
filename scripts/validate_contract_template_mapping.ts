import fs from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { eq } from "drizzle-orm";
import { contractTemplates, users } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";
import { getDb } from "../server/db";
import { downloadGoogleContractTemplate } from "../server/contracts/template-import-service";
import { generateContractPdf } from "../server/contracts/contract-pdf-service";

const baseUrl = process.env.CONTRACT_BASE_URL || "http://127.0.0.1:3000";
const docxPath = process.env.CONTRACT_TEMPLATE_PATH || "/home/ubuntu/upload/10.ContratoAliadoComercialEVGreenVers.3.0EDS26plantilla.docx";
const googleDocsUrl = process.env.CONTRACT_GOOGLE_DOCS_URL || "https://docs.google.com/document/d/16-aP7qrHbiOgsTgm_98H8I6YlZNPhLLf/edit?usp=drivesdk";

async function request(pathname: string, token: string, input: unknown) {
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const payload = await response.json();
  return {
    status: response.status,
    data: payload?.result?.data?.json ?? payload?.result?.data,
    message: payload?.error?.json?.message || null,
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("La base activa no está disponible.");
  const accounts = await db.select({ openId: users.openId, name: users.name, role: users.role }).from(users).limit(200);
  const admin = accounts.find(account => account.role === "admin" && account.openId);
  if (!admin?.openId) throw new Error("No existe una cuenta Admin para la validación.");
  const token = await sdk.createSessionToken(admin.openId, { name: admin.name || "QA Admin", expiresInMs: 5 * 60 * 1000 });
  const file = await fs.readFile(docxPath);
  const source = {
    kind: "UPLOAD" as const,
    filename: "10.ContratoAliadoComercialEVGreenVers.3.0EDS26plantilla.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
    fileBase64: file.toString("base64"),
  };

  const analysis = await request("contracts.analyzeTemplateSource", token, { source });
  if (analysis.status !== 200) throw new Error(`El análisis falló: HTTP ${analysis.status} ${analysis.message || ""}`);
  if (analysis.data.markers.length !== 8) throw new Error(`Se esperaban 8 marcadores y se detectaron ${analysis.data.markers.length}.`);
  const unresolvedSuggestions = analysis.data.markers.filter((marker: any) => !marker.suggestedVariable);
  if (unresolvedSuggestions.length) throw new Error(`Quedaron sugerencias sin resolver: ${unresolvedSuggestions.map((marker: any) => marker.rawName).join(", ")}.`);
  const mappings = Object.fromEntries(analysis.data.markers.map((marker: any) => [marker.rawName, marker.suggestedVariable]));

  const preview = await request("contracts.previewTemplateMapping", token, {
    source,
    expectedSourceHash: analysis.data.sourceHash,
    mappings,
  });
  if (preview.status !== 200) throw new Error(`La vista previa falló: HTTP ${preview.status} ${preview.message || ""}`);
  if (!preview.data.previewHtml?.includes("900.123.456-7") || preview.data.previewHtml.includes("{{Nit-aliado}}")) {
    throw new Error("La vista previa no sustituyó correctamente el NIT del aliado.");
  }
  const previewPdf = await generateContractPdf({
    contractHtml: preview.data.previewHtml,
    contractNumber: "EVG-PREV-MAPEO-V3",
    contentHash: preview.data.fingerprint,
  });
  const previewPdfPath = "/home/ubuntu/contract-template-validation/contrato-v3-mapeo-preview.pdf";
  await fs.mkdir("/home/ubuntu/contract-template-validation", { recursive: true });
  await fs.writeFile(previewPdfPath, previewPdf);

  const blockedSave = await request("contracts.createTemplateFromMappedSource", token, {
    name: "QA bloqueo de guardado",
    version: `qa-${Date.now()}`,
    source,
    expectedSourceHash: analysis.data.sourceHash,
    previewFingerprint: "0".repeat(64),
    mappings,
  });
  if (blockedSave.status !== 412) throw new Error(`El guardado sin la vista previa correspondiente no fue bloqueado: HTTP ${blockedSave.status}.`);

  let googleDocsExport: Record<string, unknown> | null = null;
  let pdfAcroForm: Record<string, unknown> | null = null;
  if (process.env.CONTRACT_SKIP_AUXILIARY !== "1") {
    const googleSource = await downloadGoogleContractTemplate(googleDocsUrl);
    if (googleSource.origin !== "GOOGLE_DRIVE" || googleSource.contentType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      throw new Error("El enlace real de Google Docs no se exportó como DOCX.");
    }
    googleDocsExport = { contentType: googleSource.contentType, bytes: googleSource.buffer.length, origin: googleSource.origin };

    const pdf = await PDFDocument.create();
    const pdfPage = pdf.addPage([420, 300]);
    const pdfField = pdf.getForm().createTextField("Nit-aliado");
    pdfField.addToPage(pdfPage, { x: 40, y: 200, width: 220, height: 26 });
    const pdfBytes = Buffer.from(await pdf.save());
    const pdfSource = {
      kind: "UPLOAD" as const,
      filename: "qa-contrato-rellenable.pdf",
      contentType: "application/pdf" as const,
      fileBase64: pdfBytes.toString("base64"),
    };
    const pdfAnalysis = await request("contracts.analyzeTemplateSource", token, { source: pdfSource });
    if (pdfAnalysis.status !== 200 || pdfAnalysis.data.sourceFormat !== "PDF_ACROFORM") {
      throw new Error(`El análisis PDF falló: HTTP ${pdfAnalysis.status} ${pdfAnalysis.message || ""}`);
    }
    const pdfMappings = { "Nit-aliado": "ALIADO_NIT" };
    const pdfPreview = await request("contracts.previewTemplateMapping", token, {
      source: pdfSource,
      expectedSourceHash: pdfAnalysis.data.sourceHash,
      mappings: pdfMappings,
    });
    if (pdfPreview.status !== 200 || Buffer.from(pdfPreview.data.previewPdfBase64, "base64").subarray(0, 4).toString() !== "%PDF") {
      throw new Error(`La vista previa PDF falló: HTTP ${pdfPreview.status} ${pdfPreview.message || ""}`);
    }
    pdfAcroForm = { markers: pdfAnalysis.data.markers.map((marker: any) => marker.rawName), previewBytes: Buffer.from(pdfPreview.data.previewPdfBase64, "base64").length };
  }

  let savedTemplate: Record<string, unknown> | null = null;
  if (process.env.CONTRACT_SAVE_DRAFT === "1") {
    const saved = await request("contracts.createTemplateFromMappedSource", token, {
      name: process.env.CONTRACT_TEMPLATE_NAME || "Contrato de concesión de sitio EDS",
      version: process.env.CONTRACT_TEMPLATE_VERSION || "3.0",
      source,
      expectedSourceHash: analysis.data.sourceHash,
      previewFingerprint: preview.data.fingerprint,
      mappings,
    });
    if (saved.status !== 200) throw new Error(`El guardado DRAFT falló: HTTP ${saved.status} ${saved.message || ""}`);
    const [persisted] = await db.select({
      id: contractTemplates.id,
      name: contractTemplates.name,
      version: contractTemplates.version,
      status: contractTemplates.status,
      contentHash: contractTemplates.contentHash,
      variableSchema: contractTemplates.variableSchema,
    }).from(contractTemplates).where(eq(contractTemplates.id, Number(saved.data.templateId))).limit(1);
    if (!persisted || persisted.status !== "DRAFT" || persisted.contentHash !== analysis.data.sourceHash) {
      throw new Error("La plantilla guardada no conserva el estado DRAFT o el hash esperado.");
    }
    savedTemplate = persisted;
  }

  console.log(JSON.stringify({
    baseUrl,
    filename: analysis.data.filename,
    sourceFormat: analysis.data.sourceFormat,
    sourceHash: analysis.data.sourceHash,
    detectedMarkers: analysis.data.markers.map((marker: any) => marker.rawName),
    automaticMappings: mappings,
    previewVariables: preview.data.variables,
    previewFingerprint: preview.data.fingerprint,
    previewPdf: { path: previewPdfPath, bytes: previewPdf.length },
    invalidPreviewSaveStatus: blockedSave.status,
    googleDocsExport,
    pdfAcroForm,
    recordsCreated: savedTemplate ? 1 : 0,
    savedTemplate,
  }, null, 2));
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
