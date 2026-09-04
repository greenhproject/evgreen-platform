import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import mysql from "mysql2/promise";

const sourcePath = process.env.CONTRACT_TEMPLATE_FILE || "/home/ubuntu/green-ev-platform/docs/Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx";
const templateName = "Contrato de alianza comercial para cesión de sitio";
const templateVersion = process.env.CONTRACT_TEMPLATE_VERSION || "2.3-dinamica";
const createdBy = Number(process.env.CONTRACT_TEMPLATE_CREATED_BY || "1");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function getStorageUrl() {
  const baseUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Faltan credenciales de almacenamiento administrado.");
  return { baseUrl: baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`, apiKey };
}

async function uploadOriginal(buffer, key) {
  const { baseUrl, apiKey } = getStorageUrl();
  const url = new URL("v1/storage/upload", baseUrl);
  url.searchParams.set("path", key);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), path.basename(sourcePath));
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  if (!response.ok) throw new Error(`No fue posible almacenar el DOCX (${response.status}): ${await response.text()}`);
  return response.json();
}

function sanitize(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .trim();
}

async function loadAllowedContractVariables() {
  const sharedSource = await readFile(new URL("../shared/site-contracts.ts", import.meta.url), "utf8");
  const catalog = sharedSource.match(/export const DEFAULT_CONTRACT_VARIABLES = \[([\s\S]*?)\] as const;/)?.[1];
  if (!catalog) throw new Error("No fue posible leer el catálogo contractual compartido.");
  return new Set(Array.from(catalog.matchAll(/"([A-Z0-9_]+)"/g), match => match[1]));
}

async function main() {
  const source = await readFile(sourcePath);
  const converted = await mammoth.convertToHtml({ buffer: source });
  const htmlContent = sanitize(converted.value);
  if (!htmlContent) throw new Error("La conversión del DOCX no produjo contenido contractual.");
  const markerTokens = Array.from(htmlContent.matchAll(/{{\s*([^{}]*?)\s*}}/g), match => match[1].trim());
  const malformedMarkers = [...new Set(markerTokens.filter(marker => !/^[A-Za-z0-9_]+$/.test(marker)))];
  if (malformedMarkers.length) throw new Error(`La plantilla contiene marcadores mal formados: ${malformedMarkers.join(", ")}`);
  const variables = [...new Set(markerTokens.map(marker => marker.toUpperCase()))].sort();
  if (variables.length === 0) throw new Error("La plantilla dinámica no contiene marcadores {{VARIABLE}}.");
  const allowedVariables = await loadAllowedContractVariables();
  const unknownMarkers = variables.filter(marker => !allowedVariables.has(marker));
  if (unknownMarkers.length) throw new Error(`La plantilla contiene marcadores no permitidos: ${unknownMarkers.join(", ")}`);

  const sourceHash = sha256(source);
  const sourceFileKey = `contracts/templates/${sourceHash.slice(0, 20)}-${path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const uploaded = await uploadOriginal(source, sourceFileKey);
  const pool = await mysql.createPool(process.env.DATABASE_URL);
  const variableSchema = JSON.stringify({
    variables,
    required: variables,
    source: path.basename(sourcePath),
    mappedAt: new Date().toISOString(),
  });
  const reviewNote = "Plantilla dinámica generada a partir del DOCX suministrado. Los campos de partes, sitio y firma están marcados con {{VARIABLE}}. Requiere aprobación jurídica antes de activarse para emisión.";

  try {
    await pool.execute(
      `INSERT INTO contract_templates
        (name, version, status, source_filename, source_mime_type, source_file_url, source_file_key, html_content, variable_schema, content_hash, legal_review_note, created_by)
       VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [templateName, templateVersion, path.basename(sourcePath), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", uploaded.url, sourceFileKey, htmlContent, variableSchema, sourceHash, reviewNote, createdBy],
    );
    const [rows] = await pool.execute(
      "SELECT id, name, version, status, source_filename, CHAR_LENGTH(html_content) AS html_length, JSON_LENGTH(variable_schema, '$.variables') AS mapped_variables FROM contract_templates WHERE name = ? AND version = ?",
      [templateName, templateVersion],
    );
    console.log(JSON.stringify({ template: rows[0], conversionWarnings: converted.messages.map((message) => message.message) }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
