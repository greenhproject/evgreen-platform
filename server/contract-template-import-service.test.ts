import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_PDF_MIME,
  analyzeContractTemplateSource,
  buildMappedContractPdf,
  buildContractTemplateMappingPreview,
  decodeContractTemplateUpload,
  mappingFingerprint,
  parseGoogleContractDocumentUrl,
} from "./contracts/template-import-service";

describe("importación híbrida de plantillas contractuales", () => {
  it("solo acepta enlaces reconocidos de Google Docs o Drive", () => {
    expect(parseGoogleContractDocumentUrl("https://docs.google.com/document/d/abc_DEF-123/edit").downloadUrl).toContain("/export?format=docx");
    expect(parseGoogleContractDocumentUrl("https://drive.google.com/file/d/file_ABC-123/view").downloadUrl).toContain("id=file_ABC-123");
    expect(() => parseGoogleContractDocumentUrl("http://docs.google.com/document/d/abc/edit")).toThrow("HTTPS");
    expect(() => parseGoogleContractDocumentUrl("https://example.com/document/d/abc/edit")).toThrow("formato reconocido");
  });

  it("rechaza archivos que solo declaran PDF pero no tienen su firma binaria", () => {
    expect(() => decodeContractTemplateUpload({
      filename: "falso.pdf",
      contentType: CONTRACT_PDF_MIME,
      fileBase64: Buffer.from("no es pdf").toString("base64"),
    })).toThrow("DOCX o PDF válido");
  });

  it("exige AcroForm de texto para usar un PDF como plantilla dinámica", async () => {
    const flat = await PDFDocument.create();
    flat.addPage();
    const source = decodeContractTemplateUpload({ filename: "plano.pdf", contentType: CONTRACT_PDF_MIME, fileBase64: Buffer.from(await flat.save()).toString("base64") });
    await expect(analyzeContractTemplateSource(source)).rejects.toThrow("AcroForm");
  });

  it("detecta y previsualiza campos de texto PDF mapeados", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 300]);
    const field = pdf.getForm().createTextField("Nit-aliado");
    field.addToPage(page, { x: 40, y: 200, width: 200, height: 24 });
    const source = decodeContractTemplateUpload({ filename: "formulario.pdf", contentType: CONTRACT_PDF_MIME, fileBase64: Buffer.from(await pdf.save()).toString("base64") });
    const analysis = await analyzeContractTemplateSource(source);
    expect(analysis.markers[0]).toMatchObject({ rawName: "Nit-aliado", suggestedVariable: "ALIADO_NIT" });
    const preview = await buildContractTemplateMappingPreview(source, analysis, { "Nit-aliado": "ALIADO_NIT" });
    expect(Buffer.from(preview.previewPdfBase64!, "base64").subarray(0, 4).toString()).toBe("%PDF");
  });

  it("congela el PDF rellenable y agrega la página de firmas para ambas modalidades", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 300]);
    const field = pdf.getForm().createTextField("Nit-aliado");
    field.addToPage(page, { x: 40, y: 200, width: 200, height: 24 });
    const output = await buildMappedContractPdf({
      sourcePdf: Buffer.from(await pdf.save()),
      mappings: { "Nit-aliado": "ALIADO_NIT" },
      values: { ALIADO_NIT: "900.123.456-7" },
      contractNumber: "EVG-CON-QA",
      contentHash: "a".repeat(64),
      allyName: "Aliado QA SAS",
      allyRepresentative: "Representante aliado",
      allyDocument: "1000000000",
      operatorName: "Green House Project SAS",
      operatorRepresentative: "Representante GHP",
      operatorDocument: "1015418125",
    });
    const frozen = await PDFDocument.load(output);
    expect(frozen.getPageCount()).toBe(2);
    expect(frozen.getForm().getFields()).toHaveLength(0);
  });

  it("genera una huella estable para exigir que la vista previa corresponda al mapeo guardado", () => {
    expect(mappingFingerprint("abc", { Aliado: "ALIADO_RAZON_SOCIAL", "Nit-aliado": "ALIADO_NIT" }))
      .toBe(mappingFingerprint("abc", { "Nit-aliado": "aliado_nit", Aliado: "ALIADO_RAZON_SOCIAL" }));
  });
});
