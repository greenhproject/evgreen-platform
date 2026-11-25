import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignedLetterDownload } from "../../client/src/components/spaces/SignedLetterDownload";
import { prepareStoredPdfDownload } from "../../client/src/lib/stored-pdf-download";

const mocks = vi.hoisted(() => ({ save: vi.fn(), rpc: vi.fn() }));
vi.mock("../../client/src/lib/pdf-download", () => ({ saveBlobCrossPlatform: mocks.save }));
vi.mock("@/lib/trpc", () => ({ trpc: { spaces: { admin: { downloadSignedLetterPdf: { useMutation: () => ({ mutateAsync: mocks.rpc }) } } } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const pdf = "%PDF-1.7\nOriginal firmado\nHash: ABC123\n2026-11-25T14:38:38Z\n%%EOF";
const base64 = Buffer.from(pdf).toString("base64");
const open = vi.fn();
const createObjectURL = vi.fn((_blob: Blob) => "blob:qa-pdf");
const revokeObjectURL = vi.fn();
function browser(userAgent = "Mozilla/5.0 Android Chrome/130", platform = "Linux", maxTouchPoints = 0) {
  vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
  vi.stubGlobal("window", { open, atob: (value: string) => Buffer.from(value, "base64").toString("binary") });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
}
function viewer() {
  return { opener: {}, document: { title: "", body: { textContent: "" } }, closed: false, location: { replace: vi.fn() }, close: vi.fn() };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.stubGlobal("React", React); browser(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Carta firmada: estados visibles sin emitir ni cambiar el expediente", () => {
  it("no anuncia una firma inexistente", () => {
    expect(renderToStaticMarkup(createElement(SignedLetterDownload, { spaceId: 20, acceptedAt: null, hasStoredPdf: false }))).toBe("");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("ofrece una descarga explícita del PDF original", () => {
    const html = renderToStaticMarkup(createElement(SignedLetterDownload, { spaceId: 20, acceptedAt: new Date("2026-11-25T14:38:38Z"), hasStoredPdf: true }));
    expect(html).toContain("Descargar carta firmada");
    expect(html).toContain("No se vuelve a emitir");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("href=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("explica una firma aceptada sin archivo y no genera un sustituto", () => {
    const html = renderToStaticMarkup(createElement(SignedLetterDownload, { spaceId: 20, acceptedAt: "2026-11-25T14:38:38Z", hasStoredPdf: false }));
    expect(html).toContain('disabled=""');
    expect(html).toContain("no conserva un PDF firmado");
    expect(html).toContain("ni se generará otro documento automáticamente");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("Descarga de PDF existente en Android/iOS/Safari", () => {
  it("Android descarga los bytes originales con nombre determinista, sin popup", async () => {
    const download = prepareStoredPdfDownload();
    download.save(base64, "Carta-Intencion-Firmada-SPE-2026-0020.pdf");
    expect(open).not.toHaveBeenCalled();
    expect(download.opensViewer).toBe(false);
    const [blob, fileName] = mocks.save.mock.calls[0];
    expect(blob.type).toBe("application/pdf");
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(Buffer.from(pdf));
    expect(fileName).toBe("Carta-Intencion-Firmada-SPE-2026-0020.pdf");
  });
  it.each([
    ["Mozilla/5.0 iPhone Version/18 Safari/605", "iPhone", 1],
    ["Mozilla/5.0 Macintosh Version/18 Safari/605", "MacIntel", 0],
    ["Mozilla/5.0 Macintosh Chrome/130", "MacIntel", 5],
  ] as const)("reserva el visor durante el clic para %s", async (agent, platform, touch) => {
    browser(agent, platform, touch);
    const popup = viewer();
    open.mockReturnValueOnce(popup);
    const download = prepareStoredPdfDownload();
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(popup.opener).toBeNull();
    expect(popup.location.replace).not.toHaveBeenCalled();
    download.save(base64, "carta.pdf");
    expect(popup.location.replace).toHaveBeenCalledWith("blob:qa-pdf");
    expect(mocks.save).not.toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0][0];
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(Buffer.from(pdf));
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:qa-pdf");
  });
  it("ofrece un error accionable si Safari bloquea el visor", () => {
    browser("Mozilla/5.0 iPhone Safari/605", "iPhone", 1);
    open.mockReturnValueOnce(null);
    expect(() => prepareStoredPdfDownload()).toThrow("Permite abrir una pestaña");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("cierra el visor reservado si la RPC falla", () => {
    browser("Mozilla/5.0 iPhone Safari/605", "iPhone", 1);
    const popup = viewer(); open.mockReturnValueOnce(popup);
    prepareStoredPdfDownload().cancel();
    expect(popup.close).toHaveBeenCalledOnce();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
  it("rechaza contenido no PDF sin descargarlo", () => {
    const download = prepareStoredPdfDownload();
    expect(() => download.save(Buffer.from("<html>Error</html>").toString("base64"), "carta.pdf")).toThrow("PDF válido");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("no intenta navegar un visor que el usuario cerró", () => {
    browser("Mozilla/5.0 iPhone Safari/605", "iPhone", 1);
    const popup = viewer(); open.mockReturnValueOnce(popup);
    const download = prepareStoredPdfDownload(); popup.closed = true;
    expect(() => download.save(base64, "carta.pdf")).toThrow("pestaña del PDF se cerró");
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
