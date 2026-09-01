import { describe, expect, it } from "vitest";
import { generateLetterEmailHTML } from "./spaces-router";

describe("plantilla móvil de carta de intención", () => {
  it("incluye CTA adaptable, enlace visible y la razón social legal correcta", () => {
    const html = generateLetterEmailHTML({
      submitterName: "Rafael Farfan",
      spaceName: "EDS Las Palmas",
      city: "Bogotá",
      address: "Calle 64",
      spaceType: "Estación de servicio",
      code: "SPE-2026-0001",
      acceptUrl: "https://app.evgreen.lat/carta-intencion/token-seguro",
    });

    expect(html).toContain("@media only screen and (max-width: 620px)");
    expect(html).toContain('class="cta-link"');
    expect(html).toContain('class="acceptance-url"');
    expect(html).toContain("Green House Project SAS");
    expect(html).toContain("NIT 901.447.678-0");
    expect(html).not.toContain("901.856.696-1");
  });
});
