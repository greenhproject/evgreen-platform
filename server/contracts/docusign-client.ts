import crypto from "crypto";
import { SignJWT, importPKCS8 } from "jose";
import { decryptDocusignSecret } from "./docusign-crypto";

export type DocusignSettings = {
  docusignEnvironment: "SANDBOX" | "PRODUCTION";
  docusignEnabled: number;
  docusignIntegrationKey?: string | null;
  docusignUserId?: string | null;
  docusignAccountId?: string | null;
  docusignBaseUri?: string | null;
  docusignConsentRedirectUri?: string | null;
  docusignPrivateKeyEncrypted?: string | null;
  docusignWebhookSecretEncrypted?: string | null;
};

type AuthResult = { accessToken: string; authBase: string; accountId: string; baseUri: string };

function authBase(environment: "SANDBOX" | "PRODUCTION"): string {
  return environment === "PRODUCTION" ? "https://account.docusign.com" : "https://account-d.docusign.com";
}

function requireSetting(value: string | null | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`Falta ${label} en la configuración de DocuSign.`);
  return value.trim();
}

async function getAccessToken(settings: DocusignSettings): Promise<{ accessToken: string; authBase: string }> {
  const integrationKey = requireSetting(settings.docusignIntegrationKey, "Integration Key");
  const userId = requireSetting(settings.docusignUserId, "User ID");
  const privateKey = decryptDocusignSecret(requireSetting(settings.docusignPrivateKeyEncrypted, "clave privada RSA"));
  const base = authBase(settings.docusignEnvironment);
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({ scope: "signature impersonation" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(integrationKey)
    .setSubject(userId)
    .setAudience(new URL(base).host)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
  const response = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(body.error_description || body.error || "DocuSign no otorgó un token de acceso.");
  return { accessToken: body.access_token as string, authBase: base };
}

export async function testDocusignConnection(settings: DocusignSettings): Promise<{ accountId: string; baseUri: string; accountName: string }> {
  const auth = await getAccessToken(settings);
  const response = await fetch(`${auth.authBase}/oauth/userinfo`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(body.accounts)) throw new Error(body.message || "DocuSign no devolvió información de cuenta.");
  const configuredId = settings.docusignAccountId?.trim();
  const account = body.accounts.find((item: any) => item.account_id === configuredId) || body.accounts.find((item: any) => item.is_default) || body.accounts[0];
  if (!account?.account_id || !account?.base_uri) throw new Error("No se encontró una cuenta DocuSign utilizable.");
  return { accountId: account.account_id, baseUri: account.base_uri, accountName: account.account_name || "Cuenta DocuSign" };
}

async function authenticateForApi(settings: DocusignSettings): Promise<AuthResult> {
  const { accessToken, authBase } = await getAccessToken(settings);
  const accountId = requireSetting(settings.docusignAccountId, "Account ID");
  const baseUri = requireSetting(settings.docusignBaseUri, "Base URI").replace(/\/+$/, "");
  return { accessToken, authBase, accountId, baseUri };
}

export async function sendDocusignEnvelope(input: {
  settings: DocusignSettings;
  contractNumber: string;
  pdfBuffer: Buffer;
  ally: { name: string; email: string; order: number };
  operator: { name: string; email: string; order: number };
}): Promise<{ envelopeId: string; status: string }> {
  const auth = await authenticateForApi(input.settings);
  const payload = {
    status: "sent",
    emailSubject: `Contrato de concesión ${input.contractNumber} | EVGreen`,
    emailBlurb: "Revise y firme el contrato de concesión. Este documento corresponde a una versión congelada del expediente EVGreen.",
    documents: [{ documentId: "1", name: `${input.contractNumber}.pdf`, fileExtension: "pdf", documentBase64: input.pdfBuffer.toString("base64") }],
    recipients: {
      signers: [
        {
          email: input.ally.email, name: input.ally.name, recipientId: "1", routingOrder: String(input.ally.order),
          tabs: { signHereTabs: [{ documentId: "1", anchorString: "EVG_ALLY_SIGN_HERE", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "-8" }] },
        },
        {
          email: input.operator.email, name: input.operator.name, recipientId: "2", routingOrder: String(input.operator.order),
          tabs: { signHereTabs: [{ documentId: "1", anchorString: "EVG_OPERATOR_SIGN_HERE", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "-8" }] },
        },
      ],
    },
  };
  const response = await fetch(`${auth.baseUri}/restapi/v2.1/accounts/${encodeURIComponent(auth.accountId)}/envelopes`, {
    method: "POST", headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.envelopeId) throw new Error(body.message || "DocuSign no pudo enviar el sobre.");
  return { envelopeId: body.envelopeId as string, status: body.status || "sent" };
}

export async function downloadDocusignArtifacts(settings: DocusignSettings, envelopeId: string): Promise<{ combinedPdf: Buffer; certificatePdf: Buffer }> {
  const auth = await authenticateForApi(settings);
  const root = `${auth.baseUri}/restapi/v2.1/accounts/${encodeURIComponent(auth.accountId)}/envelopes/${encodeURIComponent(envelopeId)}/documents`;
  const [combined, certificate] = await Promise.all([
    fetch(`${root}/combined`, { headers: { Authorization: `Bearer ${auth.accessToken}` } }),
    fetch(`${root}/certificate`, { headers: { Authorization: `Bearer ${auth.accessToken}` } }),
  ]);
  if (!combined.ok || !certificate.ok) throw new Error("DocuSign no permitió descargar el documento firmado o su certificado.");
  return { combinedPdf: Buffer.from(await combined.arrayBuffer()), certificatePdf: Buffer.from(await certificate.arrayBuffer()) };
}

export async function voidDocusignEnvelope(settings: DocusignSettings, envelopeId: string, reason: string): Promise<void> {
  const auth = await authenticateForApi(settings);
  const response = await fetch(`${auth.baseUri}/restapi/v2.1/accounts/${encodeURIComponent(auth.accountId)}/envelopes/${encodeURIComponent(envelopeId)}`, {
    method: "PUT", headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "voided", voidedReason: reason }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "DocuSign no pudo anular el sobre.");
  }
}

export function buildDocusignConsentUrl(settings: DocusignSettings): string | null {
  if (!settings.docusignIntegrationKey || !settings.docusignConsentRedirectUri) return null;
  const url = new URL(`${authBase(settings.docusignEnvironment)}/oauth/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "signature impersonation");
  url.searchParams.set("client_id", settings.docusignIntegrationKey);
  url.searchParams.set("redirect_uri", settings.docusignConsentRedirectUri);
  return url.toString();
}

export function validateDocusignWebhookSignature(secret: string, rawBody: string, signatureValues: string[]): boolean {
  if (!secret || signatureValues.length === 0) return false;
  const expected = crypto.createHmac("sha256", secret.replace(/"/g, "")).update(rawBody, "utf8").digest("base64");
  const expectedBuffer = Buffer.from(expected);
  return signatureValues.some(value => {
    const provided = Buffer.from(value);
    return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
  });
}
