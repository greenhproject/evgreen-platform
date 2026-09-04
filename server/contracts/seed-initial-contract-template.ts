import crypto from "node:crypto";
import mammoth from "mammoth";
import { and, eq, sql } from "drizzle-orm";
import { contractTemplates } from "../../drizzle/schema";
import { analyzeContractTemplateMarkers } from "../../shared/site-contracts";
import { getDb } from "../db";

const TEMPLATE_NAME = "Contrato de alianza comercial para cesión de sitio";
const TEMPLATE_VERSION = "2.3-dinamica";
const TEMPLATE_FILENAME = "Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx";
const TEMPLATE_KEY = "contracts/templates/d616463e0134a605a170-Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx";
const TEMPLATE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/contracts/templates/d616463e0134a605a170-Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx";

let seedPromise: Promise<boolean> | null = null;
let seedChecked = false;

function sanitizeContractHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .trim();
}

function sha256(value: Buffer | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function rowsFrom(result: unknown): Array<{ id?: number }> {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] as Array<{ id?: number }> : [];
}

/**
 * Carga una única vez la plantilla que el usuario entregó para este módulo.
 * La deja en DRAFT: nunca se activa ni se envía a firma sin revisión jurídica
 * explícita desde Administración. Si ya existe, no reescribe la versión.
 */
export async function ensureInitialContractTemplate(): Promise<boolean> {
  if (seedChecked) return false;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const db = await getDb();
    if (!db) return false;

    const [existing] = await db.select({ id: contractTemplates.id })
      .from(contractTemplates)
      .where(and(eq(contractTemplates.name, TEMPLATE_NAME), eq(contractTemplates.version, TEMPLATE_VERSION)))
      .limit(1);
    if (existing) {
      seedChecked = true;
      return false;
    }

    const response = await fetch(TEMPLATE_URL);
    if (!response.ok) throw new Error(`No fue posible recuperar la plantilla inicial (${response.status}).`);
    const source = Buffer.from(await response.arrayBuffer());
    const converted = await mammoth.convertToHtml({ buffer: source });
    const htmlContent = sanitizeContractHtml(converted.value);
    if (!htmlContent) throw new Error("La plantilla inicial no produjo contenido contractual.");
    const markerAnalysis = analyzeContractTemplateMarkers(htmlContent);
    if (markerAnalysis.malformedMarkers.length) {
      throw new Error(`La plantilla inicial contiene marcadores mal formados: ${markerAnalysis.malformedMarkers.join(", ")}`);
    }
    if (markerAnalysis.unknownMarkers.length) {
      throw new Error(`La plantilla inicial contiene marcadores no permitidos: ${markerAnalysis.unknownMarkers.join(", ")}`);
    }
    if (!markerAnalysis.markers.length) throw new Error("La plantilla inicial no contiene marcadores {{VARIABLE}}.");

    const admins = rowsFrom(await db.execute(sql`SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`));
    const createdBy = admins[0]?.id;
    if (!createdBy) throw new Error("No existe una cuenta administradora para atribuir la plantilla inicial.");

    await db.insert(contractTemplates).values({
      name: TEMPLATE_NAME,
      version: TEMPLATE_VERSION,
      status: "DRAFT",
      sourceFilename: TEMPLATE_FILENAME,
      sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceFileUrl: TEMPLATE_URL,
      sourceFileKey: TEMPLATE_KEY,
      htmlContent,
      variableSchema: { variables: markerAnalysis.markers, required: markerAnalysis.markers, source: TEMPLATE_FILENAME },
      contentHash: sha256(source),
      legalReviewNote: "Plantilla dinámica generada desde el DOCX suministrado. Los campos de partes, sitio, condiciones comerciales, plazo y firma usan marcadores {{VARIABLE}}. Requiere aprobación jurídica antes de activarse.",
      createdBy,
    });

    seedChecked = true;
    console.log(`[Contracts] Initial template seeded: ${TEMPLATE_NAME} v${TEMPLATE_VERSION} (${htmlContent.length} chars)`);
    return true;
  })().catch((error) => {
    seedPromise = null;
    console.error("[Contracts] Initial template seeding failed", error);
    return false;
  });

  return seedPromise;
}
