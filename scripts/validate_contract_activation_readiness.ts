import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { contractTemplates, platformSettings, users } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";
import { getDb } from "../server/db";

const baseUrl = process.env.CONTRACT_BASE_URL || "http://127.0.0.1:3000";

async function request(pathname: string, token: string, input?: unknown) {
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}`, {
    method: input ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    body: input ? JSON.stringify({ json: input }) : undefined,
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
  const accounts = await db.select({ id: users.id, openId: users.openId, name: users.name, role: users.role }).from(users).limit(200);
  const admin = accounts.find(account => account.role === "admin" && account.openId);
  if (!admin?.openId) throw new Error("No existe una cuenta Admin para la validación.");
  const token = await sdk.createSessionToken(admin.openId, { name: admin.name || "QA Admin", expiresInMs: 5 * 60 * 1000 });
  const [originalSettings] = await db.select().from(platformSettings).limit(1);
  if (!originalSettings) throw new Error("No existe la configuración global requerida para restaurar el perfil después del QA.");
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const htmlContent = `<article><h1>Plantilla QA de activación</h1><p>Operador: {{GHP_RAZON_SOCIAL}}</p><p>NIT: {{GHP_NIT}}</p><p>Representante: {{GHP_REPRESENTANTE}}</p><p>Aliado: {{ALIADO_RAZON_SOCIAL}}</p></article>`;
  let templateId = 0;

  try {
    const [insert] = await db.insert(contractTemplates).values({
      name: `QA activación guiada ${suffix}`,
      version: `qa-readiness-${suffix}`,
      status: "DRAFT",
      sourceFilename: "qa-activation.docx",
      sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceFileUrl: "https://invalid.local/qa-activation.docx",
      sourceFileKey: `contracts/templates/qa-activation-${suffix}.docx`,
      htmlContent,
      variableSchema: {
        variables: ["GHP_RAZON_SOCIAL", "GHP_NIT", "GHP_REPRESENTANTE", "ALIADO_RAZON_SOCIAL"],
        required: ["GHP_RAZON_SOCIAL", "GHP_NIT", "GHP_REPRESENTANTE", "ALIADO_RAZON_SOCIAL"],
        sourceFormat: "DOCX",
        mappings: { Operador: "GHP_RAZON_SOCIAL" },
        mappingFingerprint: "qa-preserved",
      },
      contentHash: crypto.createHash("sha256").update(htmlContent).digest("hex"),
      createdBy: admin.id,
    });
    templateId = Number(insert.insertId);

    const [profile, template] = await Promise.all([
      request("contracts.getContractOperatorProfile", token),
      request(`contracts.getTemplate?input=${encodeURIComponent(JSON.stringify({ json: { id: templateId } }))}`, token),
    ]);
    if (profile.status !== 200) throw new Error(`No se pudo consultar el perfil legal: ${profile.status} ${profile.message || ""}`);
    if (template.status !== 200 || !template.data?.markerValidation?.valid) throw new Error(`La plantilla QA no devolvió requisitos válidos: ${template.status} ${template.message || ""}`);

    const blockedActivation = await request("contracts.activateTemplate", token, {
      id: templateId,
      htmlContent,
      legalReviewNote: "Aprobación jurídica QA documentada para comprobar requisitos.",
    });
    if (!profile.data?.isVerified && (blockedActivation.status !== 412 || !blockedActivation.message?.includes("perfil legal"))) {
      throw new Error(`El perfil incompleto no bloqueó con un diagnóstico claro: ${blockedActivation.status} ${blockedActivation.message || ""}`);
    }

    const savedProfile = await request("contracts.saveContractOperatorProfile", token, {
      profile: {
        legalName: "Green House Project SAS",
        taxId: "901.447.678-0",
        representativeName: "Representante QA temporal",
        representativeDocument: "1.000.000.000",
        representativeTitle: "Representante legal",
        email: "qa-contracts@greenhproject.com",
        phone: "+57 300 000 0000",
        notificationAddress: "Dirección QA temporal",
        domicile: "Bogotá D.C., Colombia",
      },
      confirmCurrent: true,
    });
    if (savedProfile.status !== 200 || !savedProfile.data?.isVerified) throw new Error(`No fue posible confirmar temporalmente el perfil QA: ${savedProfile.status} ${savedProfile.message || ""}`);

    const activation = await request("contracts.activateTemplate", token, {
      id: templateId,
      htmlContent,
      legalReviewNote: "Aprobación jurídica QA documentada para comprobar requisitos.",
    });
    if (activation.status !== 200) throw new Error(`La activación con perfil verificado falló: ${activation.status} ${activation.message || ""}`);
    const [activated] = await db.select({ status: contractTemplates.status, variableSchema: contractTemplates.variableSchema }).from(contractTemplates).where(eq(contractTemplates.id, templateId)).limit(1);
    const activatedSchema = activated?.variableSchema as any;
    if (activated?.status !== "ACTIVE" || activatedSchema?.mappingFingerprint !== "qa-preserved" || activatedSchema?.mappings?.Operador !== "GHP_RAZON_SOCIAL") {
      throw new Error("La activación no preservó el estado ACTIVE y el mapeo fuente de la plantilla QA.");
    }

    console.log(JSON.stringify({
      baseUrl,
      profileComplete: profile.data?.isComplete,
      profileVerified: profile.data?.isVerified,
      missingFields: profile.data?.missingFields,
      markerValidation: template.data?.markerValidation,
      blockedActivationStatus: blockedActivation.status,
      blockedActivationMessage: blockedActivation.message,
      savedProfileVerified: savedProfile.data?.isVerified,
      activationStatus: activation.status,
      mappingPreserved: true,
    }, null, 2));
  } finally {
    if (templateId) await db.delete(contractTemplates).where(eq(contractTemplates.id, templateId));
    await db.update(platformSettings).set({
      contractOperatorLegalName: originalSettings.contractOperatorLegalName,
      contractOperatorTaxId: originalSettings.contractOperatorTaxId,
      contractOperatorRepresentativeName: originalSettings.contractOperatorRepresentativeName,
      contractOperatorRepresentativeDocument: originalSettings.contractOperatorRepresentativeDocument,
      contractOperatorRepresentativeTitle: originalSettings.contractOperatorRepresentativeTitle,
      contractOperatorEmail: originalSettings.contractOperatorEmail,
      contractOperatorPhone: originalSettings.contractOperatorPhone,
      contractOperatorNotificationAddress: originalSettings.contractOperatorNotificationAddress,
      contractOperatorDomicile: originalSettings.contractOperatorDomicile,
      contractOperatorVerifiedAt: originalSettings.contractOperatorVerifiedAt,
      contractOperatorVerifiedBy: originalSettings.contractOperatorVerifiedBy,
      updatedBy: originalSettings.updatedBy,
    } as any).where(eq(platformSettings.id, originalSettings.id));
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
