import { describe, expect, it } from "vitest";
import { parseBillingError } from "../client/src/lib/billing-error";

describe("parseBillingError", () => {
  it("explica paso a paso cómo corregir FAB05c en el portal DIAN", () => {
    const detail = parseBillingError(
      'Alegra API error (400): {"message":"Regla: FAB05c, Rechazo: El identificador del software no corresponde al rango de numeración informado. Regla: RUT01, Notificación informativa.","invoice":{"numberTemplate":{"prefix":"FV"}}}',
      1140026,
    );

    expect(detail.codes).toEqual(["FAB05c", "RUT01"]);
    expect(detail.title).toContain("FAB05c");
    expect(detail.summary).toContain("Rango FV");
    expect(detail.guidance).toContain("no puede realizar esta asociación por API");
    expect(detail.portalUrl).toBe("https://catalogo-vpfe.dian.gov.co/User/Login");
    expect(detail.steps).toHaveLength(6);
    expect(detail.steps?.join(" ")).toContain("Asociar Rangos de numeración");
    expect(detail.steps?.join(" ")).toContain("Soluciones Alegra S.A.S.");
    expect(detail.transactionId).toBe(1140026);
  });
});
