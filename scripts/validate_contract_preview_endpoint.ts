import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";
import { getDb } from "../server/db";

const baseUrl = process.env.CONTRACT_BASE_URL || "http://127.0.0.1:3000";
const outputPath = process.env.CONTRACT_PREVIEW_OUTPUT || "/home/ubuntu/contract-template-validation/preview-contract-endpoint.pdf";

async function request(pathname: string, token: string, input?: unknown) {
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}`, {
    method: input ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    body: input ? JSON.stringify({ json: input }) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.json?.message || JSON.stringify(payload);
    throw new Error(`${pathname} respondió ${response.status}: ${message}`);
  }
  return payload?.result?.data?.json ?? payload?.result?.data;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("La base activa no está disponible.");
  const [admin] = await db.select({ openId: users.openId, name: users.name })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(users.id)
    .limit(1);
  if (!admin?.openId) throw new Error("No existe una cuenta Admin para la validación.");
  const token = await sdk.createSessionToken(admin.openId, { name: admin.name || "QA Admin", expiresInMs: 5 * 60 * 1000 });

  const [templates, spaces, contractsBefore] = await Promise.all([
    request("contracts.listTemplates", token),
    request("contracts.listEligibleSpaces", token),
    request("contracts.listContracts", token),
  ]);
  const template = templates.find((item: any) => item.version === "2.3-dinamica" && item.status === "DRAFT");
  const space = spaces[0];
  if (!template) throw new Error("La plantilla v2.3-dinamica DRAFT no está disponible en el endpoint.");
  if (!space) throw new Error("No existe un espacio con carta aceptada para la vista previa.");

  const allyName = space.submitterCompany || "EDS de validación S.A.S.";
  const result = await request("contracts.previewContractPdf", token, {
    submissionId: Number(space.id),
    templateId: Number(template.id),
    variables: {
      PARTICIPACION_ALIADO_PORCENTAJE: "10",
      PLAZO_INICIAL_ANOS: "10",
      PRORROGA_ANOS: "5",
      PLAZO_PAGO_DIAS_HABILES: "15",
      FECHA_CIERRE_LIQUIDACION: "Último día calendario de cada mes",
      AREA_CEDIDA_M2: space.availableAreaM2?.toString() || "Por definir en Anexo 1",
      PUESTOS_PARQUEO: space.parkingSpots?.toString() || "Por definir en Anexo 1",
      PLANO_ANEXO_URL: "Anexo técnico pendiente de incorporar",
      MARCA_COMERCIAL: "EVGreen",
    },
    ally: {
      legalName: allyName.length >= 3 ? allyName : "EDS de validación S.A.S.",
      taxId: "900.000.000-1",
      representativeName: space.submitterName || "Representante EDS de validación",
      representativeDocument: space.submitterDocument || "80.000.000",
      representativeTitle: "Representante legal",
      email: space.submitterEmail || "legal@eds-validacion.test",
      phone: space.submitterPhone || "+57 300 000 0000",
      notificationAddress: space.address || "Dirección de validación",
      domicile: space.city || "Bogotá D.C.",
    },
    operator: {
      legalName: "Green House Project SAS",
      taxId: "901.447.678-0",
      representativeName: "Representante Legal de Validación",
      representativeDocument: "1.000.000.000",
      representativeTitle: "Representante legal",
      email: "legal@greenhproject.com",
      phone: "+57 300 000 0000",
      notificationAddress: "Dirección corporativa de validación",
      domicile: "Colombia",
    },
  });

  const pdf = Buffer.from(result.pdfBase64, "base64");
  if (pdf.subarray(0, 4).toString("utf8") !== "%PDF") throw new Error("La vista previa no devolvió un PDF válido.");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, pdf);
  const contractsAfter = await request("contracts.listContracts", token);
  if (contractsAfter.length !== contractsBefore.length) throw new Error("La vista previa alteró el número de expedientes contractuales.");

  console.log(JSON.stringify({
    baseUrl,
    template: { id: template.id, version: result.templateVersion, status: template.status },
    space: { id: space.id, name: space.spaceName },
    contractCountBefore: contractsBefore.length,
    contractCountAfter: contractsAfter.length,
    pdfBytes: pdf.length,
    contentHash: result.contentHash,
    contractNumber: result.contractNumber,
    outputPath,
  }, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
