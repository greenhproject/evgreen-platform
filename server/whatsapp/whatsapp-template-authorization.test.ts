import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const serviceSource = fs.readFileSync(path.join(root, "server/whatsapp/whatsapp-service.ts"), "utf8");
const csmsSource = fs.readFileSync(path.join(root, "server/ocpp/csms-dual.ts"), "utf8");
const webhookSource = fs.readFileSync(path.join(root, "server/whatsapp/webhook.ts"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");

describe("WhatsApp template authorization contract", () => {
  it("declares a dedicated Utility template for every operational offline alert", () => {
    expect(serviceSource).toContain('charger_offline: "evgreen_cargador_fuera_de_servicio_v1"');
    expect(serviceSource).toContain("createChargerOfflineTemplate");
    expect(serviceSource).toContain('category: "UTILITY"');
  });

  it("never sends the charger-offline event as free text", () => {
    const offlineBranch = csmsSource.slice(
      csmsSource.indexOf("// WhatsApp: notificar cargador desconectado"),
      csmsSource.indexOf("} catch (waOfflineErr)", csmsSource.indexOf("// WhatsApp: notificar cargador desconectado")),
    );
    expect(offlineBranch).toContain("getConfiguredChargerOfflineTemplate");
    expect(offlineBranch).toContain("sendWhatsAppTemplate");
    expect(offlineBranch).not.toContain("sendWhatsAppMessage");
  });

  it("accepts delivery states only through Meta's signed callback", () => {
    expect(webhookSource).toContain("x-hub-signature-256");
    expect(webhookSource).toContain("crypto.timingSafeEqual");
    expect(webhookSource).toContain("eq(whatsappNotificationLog.wamid, statusPayload.id)");
  });

  it("sends the administrative test through an approved template, not free text", () => {
    const testProcedure = routerSource.slice(routerSource.indexOf("sendTest: adminProcedure"), routerSource.indexOf("getLogs: adminProcedure", routerSource.indexOf("sendTest: adminProcedure")));
    expect(testProcedure).toContain("sendWhatsAppTemplate");
    expect(testProcedure).toContain("WA_TEMPLATE_NAMES.inicio_carga");
    expect(testProcedure).not.toContain("sendWhatsAppMessage");
  });
});
