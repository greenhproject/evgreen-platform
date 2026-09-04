import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";
import { getDb } from "../server/db";

const baseUrl = process.env.CONTRACT_BASE_URL || "http://127.0.0.1:3000";

async function request(pathname: string, token: string, input?: unknown, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}`, {
    method: input ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    body: input ? JSON.stringify({ json: input }) : undefined,
  });
  const payload = await response.json();
  const message = payload?.error?.json?.message || null;
  if (response.status !== expectedStatus) throw new Error(`${pathname} respondió ${response.status}, esperado ${expectedStatus}: ${message || JSON.stringify(payload)}`);
  return { status: response.status, message, data: payload?.result?.data?.json ?? payload?.result?.data };
}

function variablesFor(space: any) {
  return {
    PARTICIPACION_ALIADO_PORCENTAJE: "10",
    PLAZO_INICIAL_ANOS: "10",
    PRORROGA_ANOS: "5",
    PLAZO_PAGO_DIAS_HABILES: "15",
    FECHA_CIERRE_LIQUIDACION: "Último día calendario de cada mes",
    AREA_CEDIDA_M2: space.availableAreaM2?.toString() || "Por definir en Anexo 1",
    PUESTOS_PARQUEO: space.parkingSpots?.toString() || "Por definir en Anexo 1",
    PLANO_ANEXO_URL: "Anexo técnico pendiente de incorporar",
    MARCA_COMERCIAL: "EVGreen",
  };
}

function allyFor(space: any, representativeDocument = "") {
  return {
    legalName: space.submitterCompany?.trim() || `${space.spaceName} SAS`,
    taxId: "NIT pendiente de verificación",
    representativeName: "",
    representativeDocument,
    representativeTitle: "Representante legal",
    email: space.submitterEmail,
    phone: space.submitterPhone || "",
    notificationAddress: space.address,
    domicile: [space.city, space.country].filter(Boolean).join(", "),
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("La base activa no está disponible.");
  const [admin] = await db.select({ openId: users.openId, name: users.name }).from(users).where(eq(users.role, "admin")).orderBy(users.id).limit(1);
  if (!admin?.openId) throw new Error("No existe una cuenta Admin para la validación.");
  const token = await sdk.createSessionToken(admin.openId, { name: admin.name || "QA Admin", expiresInMs: 5 * 60 * 1000 });
  const [{ data: templates }, { data: spaces }, { data: contractsBefore }] = await Promise.all([
    request("contracts.listTemplates", token),
    request("contracts.listEligibleSpaces", token),
    request("contracts.listContracts", token),
  ]);
  const template = templates.find((item: any) => item.version === "3.0" && item.status !== "RETIRED") || templates.find((item: any) => item.status !== "RETIRED");
  const digital = spaces.find((item: any) => item.code === "SPE-2026-13A2AE");
  const manual = spaces.find((item: any) => item.code === "SPE-2026-60BFB6");
  if (!template || !digital || !manual) throw new Error("No están disponibles la plantilla o los dos espacios de control requeridos.");
  if (digital.allyPrefill?.representativeDocument !== "19318145") throw new Error("La carta digital no precargó el documento verificado del firmante.");

  const digitalPreview = await request("contracts.previewContractPdf", token, {
    submissionId: Number(digital.id), templateId: Number(template.id), variables: variablesFor(digital), ally: allyFor(digital),
  });
  const digitalPdf = Buffer.from(digitalPreview.data.pdfBase64, "base64");
  if (digitalPdf.subarray(0, 4).toString("utf8") !== "%PDF") throw new Error("La carta digital no produjo un PDF válido usando la precarga.");

  const missingDocument = await request("contracts.previewContractPdf", token, {
    submissionId: Number(manual.id), templateId: Number(template.id), variables: variablesFor(manual), ally: allyFor(manual),
  }, 400);
  if (!missingDocument.message?.includes("Documento del representante") || missingDocument.message.includes("too_small") || missingDocument.message.startsWith("[")) {
    throw new Error(`El mensaje de documento faltante no es legible: ${missingDocument.message}`);
  }

  const manualPreview = await request("contracts.previewContractPdf", token, {
    submissionId: Number(manual.id), templateId: Number(template.id), variables: variablesFor(manual), ally: allyFor(manual, "DOCUMENTO-QA-NO-PERSISTIDO"),
  });
  const manualPdf = Buffer.from(manualPreview.data.pdfBase64, "base64");
  if (manualPdf.subarray(0, 4).toString("utf8") !== "%PDF") throw new Error("La formalización manual no produjo un PDF válido al completar el dato.");

  const { data: contractsAfter } = await request("contracts.listContracts", token);
  if (contractsAfter.length !== contractsBefore.length) throw new Error("Las vistas previas alteraron el número de expedientes.");
  console.log(JSON.stringify({
    baseUrl,
    template: { id: template.id, version: template.version, status: template.status },
    digitalLetter: { code: digital.code, sourceDocument: digital.allyPrefill.representativeDocument, pdfBytes: digitalPdf.length },
    manualFormalization: { code: manual.code, missingDocumentStatus: missingDocument.status, message: missingDocument.message, completedPreviewBytes: manualPdf.length },
    contractCountBefore: contractsBefore.length,
    contractCountAfter: contractsAfter.length,
  }, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
