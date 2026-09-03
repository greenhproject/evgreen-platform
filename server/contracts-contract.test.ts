import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  canIssueManualPdf,
  canSendToDocuSign,
  renderContractTemplate,
  unresolvedContractVariables,
} from "../shared/site-contracts";
import { validateDocusignWebhookSignature } from "./contracts/docusign-client";
import { extractDocusignEnvelopeEvent } from "./contracts/docusign-webhook";
import { createManualDownloadExpiry, hashManualDownloadToken } from "./contracts/manual-contract-download";

describe("expediente contractual de concesión", () => {
  it("solo habilita DocuSign para contratos congelados y listos", () => {
    expect(canSendToDocuSign("READY")).toBe(true);
    expect(canSendToDocuSign("DOCUSIGN_SENT")).toBe(false);
    expect(canSendToDocuSign("MANUAL_PDF_ISSUED")).toBe(false);
    expect(canSendToDocuSign("MANUAL_PDF_VERIFIED")).toBe(false);
  });

  it("solo emite PDF manual desde el contrato listo, no desde rutas finalizadas", () => {
    expect(canIssueManualPdf("READY")).toBe(true);
    expect(canIssueManualPdf("DOCUSIGN_SENT")).toBe(false);
    expect(canIssueManualPdf("DOCUSIGN_COMPLETED")).toBe(false);
    expect(canIssueManualPdf("MANUAL_PDF_VERIFIED")).toBe(false);
  });

  it("detecta variables faltantes y conserva un documento resuelto sin marcadores", () => {
    const template = "Entre {{ALIADO_RAZON_SOCIAL}} y {{GHP_RAZON_SOCIAL}} se firma {{NUMERO_CONTRATO}}.";
    expect(unresolvedContractVariables(template, { ALIADO_RAZON_SOCIAL: "EDS Aliada" })).toEqual(["GHP_RAZON_SOCIAL", "NUMERO_CONTRATO"]);
    expect(renderContractTemplate(template, { ALIADO_RAZON_SOCIAL: "EDS Aliada", GHP_RAZON_SOCIAL: "Green House Project SAS", NUMERO_CONTRATO: "EVG-CON-2026-0001" })).not.toContain("{{");
  });

  it("acepta únicamente firmas HMAC válidas de DocuSign", () => {
    const secret = "secreto-docusing-connect-para-pruebas";
    const body = JSON.stringify({ event: "envelope-completed", data: { envelopeId: "abc" } });
    const signature = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(validateDocusignWebhookSignature(secret, body, [signature])).toBe(true);
    expect(validateDocusignWebhookSignature(secret, `${body}x`, [signature])).toBe(false);
    expect(validateDocusignWebhookSignature(secret, body, ["firma-invalida"])).toBe(false);
  });

  it("extrae el sobre y estado de eventos Connect con estructura JSON", () => {
    expect(extractDocusignEnvelopeEvent({ event: "envelope-completed", data: { envelopeId: "envelope-123", envelopeSummary: { status: "completed" } } })).toEqual({ envelopeId: "envelope-123", status: "completed", eventType: "envelope-completed" });
    expect(extractDocusignEnvelopeEvent({ event: "envelope-completed" })).toBeNull();
  });

  it("almacena solo el hash de un enlace manual y le asigna una vigencia temporal", () => {
    expect(hashManualDownloadToken("enlace-opaco-de-prueba")).toHaveLength(64);
    expect(hashManualDownloadToken("enlace-opaco-de-prueba")).not.toContain("enlace-opaco");
    expect(new Date(createManualDownloadExpiry(1)).getTime()).toBeGreaterThan(Date.now() + 55 * 60 * 1000);
  });
});
