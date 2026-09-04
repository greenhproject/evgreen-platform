import { describe, expect, it } from "vitest";
import { buildContractPdfHtml, CONTRACT_BRAND_ASSET_PATHS } from "./contracts/contract-pdf-service";

const assets = {
  evgreenLight: "data:image/png;base64,EVGREEN_LIGHT",
  evgreenDark: "data:image/png;base64,EVGREEN_DARK",
  ghp: "data:image/png;base64,GHP",
};

describe("identidad editorial del PDF contractual", () => {
  it("crea una portada A4 completa con identidad EVGreen y metadatos del contrato", () => {
    const html = buildContractPdfHtml("<h1>Contenido legal</h1>", "EVG-CON-2026-001", "abcdef1234567890", assets, {
      templateName: "Contrato de concesión de sitio",
      templateVersion: "3.0",
    });
    expect(html).toContain('aria-label="Portada contractual"');
    expect(html).toContain("Contrato de concesión de sitio");
    expect(html).toContain("EVG-CON-2026-001");
    expect(html).toContain("Versión");
    expect(html).toContain("3.0");
    expect(html).toContain("width:210mm");
    expect(html).toContain("min-height:297mm");
    expect(html).toContain("page-break-after:always");
  });

  it("integra logos oficiales diferenciados para portada, interior y operador legal", () => {
    const html = buildContractPdfHtml("<p>Texto</p>", "EVG-1", "hash", assets);
    expect(html).toContain(assets.evgreenLight);
    expect(html).toContain(assets.ghp);
    expect(CONTRACT_BRAND_ASSET_PATHS.evgreenLight).toMatch(/^\/manus-storage\//);
    expect(CONTRACT_BRAND_ASSET_PATHS.evgreenDark).toMatch(/^\/manus-storage\//);
    expect(CONTRACT_BRAND_ASSET_PATHS.ghp).toMatch(/^\/manus-storage\//);
  });

  it("preserva el contenido legal y añade el sistema editorial de tablas y firmas", () => {
    const legal = "<h2>CLÁUSULA PRIMERA</h2><table><tr><td>Dato legal</td></tr></table>";
    const html = buildContractPdfHtml(legal, "EVG-1", "hash", assets);
    expect(html).toContain(legal);
    expect(html).toContain(".document-body table");
    expect(html).toContain(".signature-section");
    expect(html).toContain(".document-body");
  });

  it("inicia la identificación de las partes como sección editorial sin cambiar su texto legal", () => {
    const legalHtml = `<p>Preámbulo</p><p><strong>CLÁUSULA SEGUNDA: IDENTIFICACIÓN DE LAS PARTES</strong></p><p><strong>EL OPERADOR:</strong></p>`;
    const html = buildContractPdfHtml(legalHtml, "EVG-1", "hash", assets);
    expect(html).toContain("class=\"editorial-section-start\"");
    expect(html).toContain("class=\"party-heading\"");
    expect(html).toContain("CLÁUSULA SEGUNDA: IDENTIFICACIÓN DE LAS PARTES");
    expect(html).toContain("break-before:page");
  });
});
