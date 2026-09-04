import { createHash } from "crypto";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

let sharedBrowserPromise: Promise<Browser> | null = null;
let pdfQueue: Promise<void> = Promise.resolve();

export async function resolveContractPdfExecutablePath(): Promise<string> {
  return process.env.PUPPETEER_EXECUTABLE_PATH || chromium.executablePath();
}

export function contractPdfChromiumArgs(): string[] {
  return Array.from(new Set([
    ...chromium.args,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
  ]));
}

async function getContractPdfBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = puppeteer.launch({
      args: contractPdfChromiumArgs(),
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await resolveContractPdfExecutablePath(),
      headless: true,
    }).then(browser => {
      browser.on("disconnected", () => {
        sharedBrowserPromise = null;
      });
      return browser;
    }).catch(error => {
      sharedBrowserPromise = null;
      throw error;
    });
  }
  return sharedBrowserPromise;
}

function serializePdfGeneration<T>(operation: () => Promise<T>): Promise<T> {
  const result = pdfQueue.then(operation, operation);
  pdfQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function sanitizeContractHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "");
}

export function appendContractSignatureBlocks(contractHtml: string, params: {
  allyName: string;
  allyRepresentative: string;
  allyDocument: string;
  operatorName: string;
  operatorRepresentative: string;
  operatorDocument: string;
}): string {
  const signatureBlocks = `<section class="signature-section" aria-label="Bloques de firma">
      <p class="signature-heading">FIRMAS</p>
      <p class="signature-intro">Las partes declaran que han leído y aceptado el contenido íntegro del presente contrato.</p>
      <div class="signature-grid">
        <section class="signature-card">
          <p class="party-label">POR EL ALIADO / EDS</p>
          <div class="signature-line"><span class="docusign-anchor">EVG_ALLY_SIGN_HERE</span></div>
          <p><strong>${escapeHtml(params.allyRepresentative)}</strong></p>
          <p>Documento: ${escapeHtml(params.allyDocument)}</p>
          <p>En representación de: ${escapeHtml(params.allyName)}</p>
          <p>Fecha: ______________________________</p>
        </section>
        <section class="signature-card">
          <p class="party-label">POR GREEN HOUSE PROJECT SAS</p>
          <div class="signature-line"><span class="docusign-anchor">EVG_OPERATOR_SIGN_HERE</span></div>
          <p><strong>${escapeHtml(params.operatorRepresentative)}</strong></p>
          <p>Documento: ${escapeHtml(params.operatorDocument)}</p>
          <p>En representación de: ${escapeHtml(params.operatorName)}</p>
          <p>Fecha: ______________________________</p>
        </section>
      </div>
    </section>`;
  const safeHtml = sanitizeContractHtml(contractHtml);
  const anchorPattern = /<p[^>]*>\s*EVG_SIGNATURE_BLOCK_HERE\s*<\/p>/i;
  return anchorPattern.test(safeHtml)
    ? safeHtml.replace(anchorPattern, signatureBlocks)
    : `${safeHtml}${signatureBlocks}`;
}

export function buildContractPdfHtml(contractHtml: string, contractNumber: string, contentHash: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 19mm 16mm 20mm; }
      * { box-sizing: border-box; }
      body { color:#15201b; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.55; }
      h1, h2, h3 { color:#0d5e3f; line-height:1.2; }
      h1 { font-size:16pt; text-align:center; margin:0 0 18px; }
      h2 { font-size:12pt; margin:20px 0 8px; }
      h3 { font-size:11pt; margin:16px 0 7px; }
      p { margin:0 0 9px; text-align:justify; }
      table { width:100%; border-collapse:collapse; margin:12px 0; }
      td, th { border:1px solid #b8c8bf; padding:7px; vertical-align:top; }
      .signature-section { break-inside: avoid; margin-top:36px; page-break-inside:avoid; }
      .signature-heading { font-weight:700; color:#0d5e3f; text-align:left; margin-bottom:6px; }
      .signature-intro { font-size:9.5pt; }
      .signature-grid { display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:24px; }
      .signature-card { min-height:180px; }
      .party-label { font-size:9pt; font-weight:700; text-align:left; }
      .signature-card p { font-size:9pt; text-align:left; margin-bottom:4px; }
      .signature-line { border-bottom:1px solid #213c30; height:72px; margin:10px 0 10px; position:relative; }
      .docusign-anchor { color:transparent; font-size:1px; user-select:none; }
      footer { margin-top:24px; break-inside:avoid; color:#66756d; font-size:7.5pt; border-top:1px solid #d7e1db; padding-top:4px; }
    </style></head><body>${contractHtml}<footer>Contrato ${escapeHtml(contractNumber)} · Integridad SHA-256: ${escapeHtml(contentHash)} · Green House Project SAS</footer></body></html>`;
}

export async function generateContractPdf(input: { contractHtml: string; contractNumber: string; contentHash: string }): Promise<Buffer> {
  return serializePdfGeneration(async () => {
    const browser = await getContractPdfBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(buildContractPdfHtml(input.contractHtml, input.contractNumber, input.contentHash), { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  });
}

export function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}
