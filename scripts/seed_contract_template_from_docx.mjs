import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import mysql from "mysql2/promise";

const sourcePath = process.env.CONTRACT_TEMPLATE_FILE || "/home/ubuntu/upload/Contrato_Aliado_Comercial_EVGreen_V2.docx";
const templateName = "Contrato de alianza comercial para cesión de sitio";
const templateVersion = "2.0";
const createdBy = Number(process.env.CONTRACT_TEMPLATE_CREATED_BY || "1");

const variables = [
  "GHP_RAZON_SOCIAL", "GHP_NIT", "GHP_REPRESENTANTE", "GHP_DOCUMENTO_REPRESENTANTE", "GHP_CARGO_REPRESENTANTE",
  "GHP_DOMICILIO", "GHP_DIRECCION", "GHP_CORREO_NOTIFICACIONES", "GHP_TELEFONO", "MARCA_COMERCIAL",
  "ALIADO_RAZON_SOCIAL", "ALIADO_NIT", "ALIADO_REPRESENTANTE", "ALIADO_DOCUMENTO_REPRESENTANTE", "ALIADO_CALIDAD_TENENCIA",
  "ALIADO_DOMICILIO", "ALIADO_DIRECCION_NOTIFICACIONES", "ALIADO_CORREO_NOTIFICACIONES", "ALIADO_TELEFONO", "AUTORIZACION_PROPIETARIO_URL",
  "SITIO_NOMBRE", "SITIO_DIRECCION", "SITIO_CIUDAD", "SITIO_DEPARTAMENTO", "SITIO_TIPO", "AREA_CEDIDA_M2", "PUESTOS_PARQUEO", "PLANO_ANEXO_URL",
  "PARTICIPACION_ALIADO_PORCENTAJE", "PLAZO_INICIAL_ANOS", "PRORROGA_ANOS", "PLAZO_PAGO_DIAS_HABILES", "FECHA_CIERRE_LIQUIDACION",
  "VERSION_PLANTILLA", "HASH_DOCUMENTO", "FECHA_ENVIO", "FECHA_EXPIRACION", "FIRMANTE_EDS", "FIRMANTE_GHP",
];

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

async function main() {
  const source = await readFile(sourcePath);
  const converted = await mammoth.convertToHtml({ buffer: source });
  const htmlContent = sanitize(converted.value);
  if (!htmlContent) throw new Error("La conversión del DOCX no produjo contenido contractual.");

  const sourceHash = sha256(source);
  const sourceFileKey = `contracts/templates/${sourceHash.slice(0, 20)}-${path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const uploaded = await uploadOriginal(source, sourceFileKey);
  const pool = await mysql.createPool(process.env.DATABASE_URL);
  const variableSchema = JSON.stringify({
    variables,
    required: variables,
    source: "Contrato_Aliado_Comercial_EVGreen_V2.docx",
    mappedAt: new Date().toISOString(),
  });
  const reviewNote = "Plantilla inicial cargada desde el DOCX suministrado. Variables de partes, sitio, plazo, participación y firma catalogadas. Requiere aprobación jurídica antes de activarse para emisión.";

  try {
    await pool.execute(
      `INSERT INTO contract_templates
        (name, version, status, source_filename, source_mime_type, source_file_url, source_file_key, html_content, variable_schema, content_hash, legal_review_note, created_by)
       VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         source_filename = VALUES(source_filename), source_mime_type = VALUES(source_mime_type),
         source_file_url = VALUES(source_file_url), source_file_key = VALUES(source_file_key),
         html_content = VALUES(html_content), variable_schema = VALUES(variable_schema), content_hash = VALUES(content_hash),
         legal_review_note = VALUES(legal_review_note), updated_at = CURRENT_TIMESTAMP`,
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
