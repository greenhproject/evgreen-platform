import { createHash } from "crypto";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ENV } from "../_core/env";

export const CONTRACT_BRAND_ASSET_PATHS = {
  evgreenLight: "/manus-storage/evgreen-logo-light-print_122b9904.png",
  evgreenDark: "/manus-storage/evgreen-logo-dark-print_be36a802.png",
  ghp: "/manus-storage/ghp-logo_50fd2673.png",
} as const;

export type ContractPdfBrandAssets = {
  evgreenLight: string;
  evgreenDark: string;
  ghp: string;
};

type ContractPdfMetadata = {
  templateName?: string;
  templateVersion?: string;
};

let sharedBrowserPromise: Promise<Browser> | null = null;
let pdfQueue: Promise<void> = Promise.resolve();
let brandAssetsPromise: Promise<ContractPdfBrandAssets> | null = null;

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
      <div class="signature-title-row"><p class="signature-kicker">FORMALIZACIÓN</p><p class="signature-heading">Firmas de las partes</p></div>
      <p class="signature-intro">Las partes declaran que han leído y aceptado el contenido íntegro del presente contrato y sus anexos.</p>
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
  if (anchorPattern.test(safeHtml)) return safeHtml.replace(anchorPattern, signatureBlocks);
  const upperHtml = safeHtml.toUpperCase();
  const operatorLabelIndex = upperHtml.lastIndexOf("EL OPERADOR:");
  const allyLabelIndex = upperHtml.lastIndexOf("EL ALIADO COMERCIAL:");
  const finalQuarterStart = Math.floor(safeHtml.length * 0.75);
  if (operatorLabelIndex >= finalQuarterStart && allyLabelIndex > operatorLabelIndex) {
    const signatureStart = safeHtml.lastIndexOf("<p", operatorLabelIndex);
    if (signatureStart >= finalQuarterStart) return `${safeHtml.slice(0, signatureStart)}${signatureBlocks}`;
  }
  return `${safeHtml}${signatureBlocks}`;
}

function contractCoverHtml(input: {
  contractNumber: string;
  contentHash: string;
  metadata: ContractPdfMetadata;
  assets: ContractPdfBrandAssets;
}): string {
  const title = input.metadata.templateName?.trim() || "Contrato de alianza comercial";
  const version = input.metadata.templateVersion?.trim() || "Versión contractual";
  return `<section class="contract-cover" aria-label="Portada contractual">
      <div class="cover-grid" aria-hidden="true"></div>
      <div class="cover-orbit cover-orbit-one" aria-hidden="true"></div>
      <div class="cover-orbit cover-orbit-two" aria-hidden="true"></div>
      <div class="cover-energy" aria-hidden="true"><span></span><span></span><span></span></div>
      <header class="cover-header">
        ${input.assets.evgreenLight ? `<img class="cover-logo" src="${input.assets.evgreenLight}" alt="EVGreen" />` : `<p class="cover-wordmark">EVGreen</p>`}
        <p class="cover-classification">DOCUMENTO CONTRACTUAL · CONFIDENCIAL</p>
      </header>
      <div class="cover-main">
        <p class="cover-eyebrow">INFRAESTRUCTURA DE CARGA ELÉCTRICA</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="cover-subtitle">Alianza comercial para concesión de sitio, instalación y operación de estaciones de carga EVGreen</p>
        <div class="cover-rule"><span></span></div>
        <dl class="cover-meta">
          <div><dt>Número de contrato</dt><dd>${escapeHtml(input.contractNumber)}</dd></div>
          <div><dt>Versión</dt><dd>${escapeHtml(version)}</dd></div>
          <div><dt>Integridad</dt><dd>${escapeHtml(input.contentHash.slice(0, 20))}…</dd></div>
        </dl>
      </div>
      <footer class="cover-footer">
        <div><p>Operado por</p>${input.assets.ghp ? `<img class="cover-ghp-logo" src="${input.assets.ghp}" alt="Green House Project SAS" />` : `<strong>Green House Project SAS</strong>`}</div>
        <p class="cover-country">COLOMBIA · 2026</p>
      </footer>
    </section>`;
}

function addContractEditorialSectionBreaks(contractHtml: string): string {
  const partiesClause = /(?=<p[^>]*>\s*<strong[^>]*>\s*CL[ÁA]USULA\s+SEGUNDA\s*:\s*IDENTIFICACI[ÓO]N\s+DE\s+LAS\s+PARTES[\s\S]*?<\/strong>\s*<\/p>)/i;
  const withSection = partiesClause.test(contractHtml)
    ? contractHtml.replace(
        partiesClause,
        `<div class="editorial-section-start" aria-hidden="true"><span>02</span><div><p>SECCIÓN CONTRACTUAL</p><strong>Identificación de las partes</strong></div></div>`,
      )
    : contractHtml;
  return withSection.replace(
    /<p>(\s*<strong[^>]*>\s*EL\s+(?:OPERADOR|ALIADO\s+COMERCIAL)\s*:?\s*<\/strong>\s*)<\/p>/gi,
    `<p class="party-heading">$1</p>`,
  );
}

export function buildContractPdfHtml(
  contractHtml: string,
  contractNumber: string,
  contentHash: string,
  assets: ContractPdfBrandAssets = { evgreenLight: "", evgreenDark: "", ghp: "" },
  metadata: ContractPdfMetadata = {},
): string {
  const safeContractHtml = addContractEditorialSectionBreaks(sanitizeContractHtml(contractHtml));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 22mm 18mm 21mm; }
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; }
      body { color:#17231e; font-family:"DejaVu Sans", Arial, Helvetica, sans-serif; font-size:9.6pt; line-height:1.58; background:#fff; }
      .contract-cover { position:relative; width:210mm; min-height:297mm; margin:-22mm -18mm -21mm; overflow:hidden; page-break-after:always; color:#f5fff9; background:radial-gradient(circle at 18% 13%,rgba(44,255,144,.19),transparent 27%),radial-gradient(circle at 84% 80%,rgba(0,178,122,.26),transparent 35%),linear-gradient(145deg,#020b0a 0%,#061712 52%,#03100d 100%); }
      .contract-cover::before { content:""; position:absolute; inset:0; background:linear-gradient(120deg,transparent 0 53%,rgba(54,255,150,.08) 53.2% 53.7%,transparent 54% 100%); }
      .contract-cover::after { content:""; position:absolute; right:-38mm; bottom:-62mm; width:165mm; height:165mm; border-radius:50%; border:1px solid rgba(90,255,171,.22); box-shadow:0 0 0 15mm rgba(28,227,128,.025),0 0 0 32mm rgba(28,227,128,.02); }
      .cover-grid { position:absolute; inset:0; opacity:.13; background-image:linear-gradient(rgba(126,255,190,.28) 1px,transparent 1px),linear-gradient(90deg,rgba(126,255,190,.28) 1px,transparent 1px); background-size:16mm 16mm; mask-image:linear-gradient(to bottom,rgba(0,0,0,.8),transparent 72%); }
      .cover-orbit { position:absolute; border:1px solid rgba(112,255,187,.24); border-radius:50%; }
      .cover-orbit-one { width:104mm; height:104mm; right:-34mm; top:45mm; }
      .cover-orbit-two { width:62mm; height:62mm; right:-8mm; top:67mm; }
      .cover-energy { position:absolute; right:20mm; top:118mm; width:62mm; transform:rotate(-8deg); display:grid; gap:5mm; opacity:.72; }
      .cover-energy span { display:block; height:1.2mm; background:linear-gradient(90deg,transparent,#42f394 24%,#11b873); border-radius:99px; box-shadow:0 0 8mm rgba(42,238,141,.4); }
      .cover-energy span:nth-child(2){ width:76%; margin-left:24%; } .cover-energy span:nth-child(3){ width:48%; margin-left:52%; }
      .cover-header { position:relative; z-index:2; display:flex; justify-content:space-between; align-items:flex-start; padding:22mm 19mm 0; }
      .cover-logo { width:72mm; height:26mm; object-fit:contain; object-position:left center; }
      .cover-wordmark { margin:0; color:#35e98a; font-size:28pt; font-weight:800; letter-spacing:-1.5px; }
      .cover-classification { max-width:55mm; margin:4mm 0 0; color:rgba(236,255,246,.72); font-size:6.6pt; font-weight:700; letter-spacing:1.1px; text-align:right; }
      .cover-main { position:relative; z-index:2; width:138mm; margin:46mm 0 0 19mm; }
      .cover-eyebrow { margin:0 0 6mm; color:#45ef9a; font-size:7.8pt; font-weight:800; letter-spacing:2px; text-align:left; }
      .cover-main h1 { max-width:132mm; margin:0; color:#fff; font-size:28pt; line-height:1.12; letter-spacing:-.7px; text-align:left; text-transform:none; }
      .cover-subtitle { max-width:116mm; margin:7mm 0 0; color:rgba(232,247,239,.76); font-size:11pt; line-height:1.55; text-align:left; }
      .cover-rule { width:84mm; height:1px; margin:11mm 0 8mm; background:rgba(255,255,255,.18); } .cover-rule span { display:block; width:27mm; height:1mm; transform:translateY(-.5mm); background:#37eb8f; }
      .cover-meta { width:126mm; margin:0; display:grid; grid-template-columns:1.35fr .8fr; gap:5mm 8mm; }
      .cover-meta div:last-child { grid-column:1 / -1; }
      .cover-meta dt { color:rgba(220,244,231,.55); font-size:6.7pt; font-weight:700; letter-spacing:.9px; text-transform:uppercase; }
      .cover-meta dd { margin:1.5mm 0 0; color:#fff; font-size:9.3pt; font-weight:700; letter-spacing:.15px; }
      .cover-footer { position:absolute; z-index:2; left:19mm; right:19mm; bottom:18mm; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,.15); padding-top:6mm; }
      .cover-footer p { margin:0 0 2mm; color:rgba(221,246,233,.55); font-size:6.8pt; letter-spacing:.8px; text-align:left; text-transform:uppercase; }
      .cover-ghp-logo { width:54mm; max-height:14mm; object-fit:contain; object-position:left center; }
      .cover-country { margin:0!important; color:rgba(229,248,238,.7)!important; font-weight:700; }
      .document-body { position:relative; z-index:0; }
      .editorial-section-start { break-before:page; page-break-before:always; display:flex; align-items:center; gap:5mm; margin:0 0 8mm; padding:5mm 0 4mm; border-bottom:1px solid #c7ddd1; }
      .editorial-section-start > span { display:flex; align-items:center; justify-content:center; width:14mm; height:14mm; border:1px solid #0e9f64; border-radius:50%; color:#087047; font-size:13pt; font-weight:800; }
      .editorial-section-start p { margin:0 0 1mm!important; color:#6a7d73!important; font-size:6.2pt!important; font-weight:800; letter-spacing:1.4px; text-align:left!important; }
      .editorial-section-start strong { color:#073d2a; font-size:15pt; font-weight:800; }
      .party-heading { break-after:avoid; page-break-after:avoid; margin-bottom:2.5mm!important; }
      .party-heading + table { break-before:avoid; page-break-before:avoid; }
      .document-body h1, .document-body h2, .document-body h3 { color:#0b6f48; line-height:1.22; break-after:avoid; page-break-after:avoid; }
      .document-body h1 { font-size:17pt; text-align:left; margin:0 0 7mm; letter-spacing:-.2px; }
      .document-body h2 { font-size:11.2pt; margin:6mm 0 2.6mm; padding-bottom:1.7mm; border-bottom:1px solid #cfe4d8; }
      .document-body h3 { font-size:9.8pt; margin:4.5mm 0 2mm; }
      .document-body p { margin:0 0 2.6mm; text-align:justify; orphans:3; widows:3; }
      .document-body strong { color:#12221b; }
      .document-body table { width:100%; border-collapse:separate; border-spacing:0; margin:4mm 0 5mm; border:1px solid #b8d1c4; border-radius:2.3mm; overflow:hidden; break-inside:avoid; page-break-inside:avoid; }
      .document-body td, .document-body th { border:0; border-right:1px solid #d5e3db; border-bottom:1px solid #d5e3db; padding:2.8mm 3.2mm; vertical-align:top; }
      .document-body tr:last-child td, .document-body tr:last-child th { border-bottom:0; }
      .document-body td:last-child, .document-body th:last-child { border-right:0; }
      .document-body th, .document-body tr:first-child td { background:#eaf6ef; color:#0d593c; font-weight:800; }
      .signature-section { break-inside:avoid; page-break-inside:avoid; margin-top:10mm; padding:8mm; border:1px solid #b9d7c7; border-radius:3mm; background:linear-gradient(150deg,#f7fcf9,#edf8f2); }
      .signature-title-row { border-left:1.2mm solid #1bd77a; padding-left:4mm; margin-bottom:3mm; }
      .signature-kicker { margin:0 0 1mm!important; color:#4f7462; font-size:6.5pt!important; font-weight:800; letter-spacing:1.2px; text-align:left!important; }
      .signature-heading { margin:0!important; color:#075b3a; font-size:15pt!important; font-weight:800; text-align:left!important; }
      .signature-intro { color:#53655c; font-size:8.5pt; text-align:left!important; }
      .signature-grid { display:grid; grid-template-columns:1fr 1fr; gap:10mm; margin-top:6mm; }
      .signature-card { min-height:52mm; padding-top:1mm; }
      .party-label { color:#0a5e3d; font-size:7.4pt!important; font-weight:800; letter-spacing:.55px; text-align:left!important; }
      .signature-card p { font-size:8pt; text-align:left; margin-bottom:1.5mm; }
      .signature-line { position:relative; height:21mm; margin:2mm 0 3mm; border-bottom:1px solid #204d38; }
      .docusign-anchor { color:transparent; font-size:1px; user-select:none; }
    </style></head><body>
      ${contractCoverHtml({ contractNumber, contentHash, metadata, assets })}
      <main class="document-body">${safeContractHtml}</main>
    </body></html>`;
}

async function forgeStorageDataUrl(storagePath: string): Promise<string> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return "";
  const key = storagePath.replace(/^\/manus-storage\//, "");
  const presignUrl = new URL("v1/storage/presign/get", `${ENV.forgeApiUrl.replace(/\/+$/, "")}/`);
  presignUrl.searchParams.set("path", key);
  const presignResponse = await fetch(presignUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }, signal: AbortSignal.timeout(15_000) });
  if (!presignResponse.ok) throw new Error(`No fue posible obtener el activo corporativo ${key}.`);
  const { url } = await presignResponse.json() as { url?: string };
  if (!url) throw new Error(`El activo corporativo ${key} no devolvió una URL firmada.`);
  const assetResponse = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!assetResponse.ok) throw new Error(`No fue posible descargar el activo corporativo ${key}.`);
  const contentType = assetResponse.headers.get("content-type") || "image/png";
  return `data:${contentType};base64,${Buffer.from(await assetResponse.arrayBuffer()).toString("base64")}`;
}

export async function resolveContractPdfBrandAssets(): Promise<ContractPdfBrandAssets> {
  if (!brandAssetsPromise) {
    brandAssetsPromise = Promise.all([
      forgeStorageDataUrl(CONTRACT_BRAND_ASSET_PATHS.evgreenLight),
      forgeStorageDataUrl(CONTRACT_BRAND_ASSET_PATHS.evgreenDark),
      forgeStorageDataUrl(CONTRACT_BRAND_ASSET_PATHS.ghp),
    ]).then(([evgreenLight, evgreenDark, ghp]) => ({ evgreenLight, evgreenDark, ghp })).catch(error => {
      brandAssetsPromise = null;
      console.error("[ContractPDF] No fue posible cargar la identidad visual:", error instanceof Error ? error.message : error);
      return { evgreenLight: "", evgreenDark: "", ghp: "" };
    });
  }
  return brandAssetsPromise;
}

function imageBytesFromDataUrl(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/);
  return match ? Buffer.from(match[1], "base64") : null;
}

async function addContractPageIntegrity(pdfBuffer: Buffer, contractNumber: string, contentHash: string, assets: ContractPdfBrandAssets): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const darkLogoBytes = imageBytesFromDataUrl(assets.evgreenDark);
  const darkLogo = darkLogoBytes ? await pdf.embedPng(darkLogoBytes) : null;
  const pages = pdf.getPages();
  pages.slice(1).forEach((page, index) => {
    const { width, height } = page.getSize();
    const headerLineY = height - 45;
    if (darkLogo) {
      const logoWidth = 76;
      const logoHeight = logoWidth * (darkLogo.height / darkLogo.width);
      page.drawImage(darkLogo, { x: 51, y: height - 36, width: logoWidth, height: logoHeight });
    } else {
      page.drawText("EVGreen", { x: 51, y: height - 30, size: 9, font, color: rgb(0.04, 0.43, 0.27) });
    }
    const headerText = "GREEN HOUSE PROJECT SAS  ·  DOCUMENTO CONTRACTUAL";
    const headerWidth = font.widthOfTextAtSize(headerText, 6.2);
    page.drawText(headerText, { x: width - 51 - headerWidth, y: height - 30, size: 6.2, font, color: rgb(0.31, 0.43, 0.37) });
    page.drawLine({ start: { x: 51, y: headerLineY }, end: { x: width - 51, y: headerLineY }, thickness: 0.55, color: rgb(0.77, 0.87, 0.81) });
    const y = 19;
    page.drawLine({ start: { x: 51, y: y + 10 }, end: { x: width - 51, y: y + 10 }, thickness: 0.45, color: rgb(0.78, 0.86, 0.81) });
    page.drawText(`Contrato ${contractNumber} · SHA-256 ${contentHash.slice(0, 16)}…`, { x: 51, y, size: 6.5, font, color: rgb(0.31, 0.41, 0.36) });
    const pageText = `${index + 2} / ${pages.length}`;
    const pageWidth = font.widthOfTextAtSize(pageText, 6.5);
    page.drawText(pageText, { x: width - 51 - pageWidth, y, size: 6.5, font, color: rgb(0.08, 0.48, 0.3) });
  });
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

export async function generateContractPdf(input: { contractHtml: string; contractNumber: string; contentHash: string; templateName?: string; templateVersion?: string }): Promise<Buffer> {
  return serializePdfGeneration(async () => {
    const browser = await getContractPdfBrowser();
    const page = await browser.newPage();
    try {
      const assets = await resolveContractPdfBrandAssets();
      await page.setContent(buildContractPdfHtml(input.contractHtml, input.contractNumber, input.contentHash, assets, input), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
      return addContractPageIntegrity(pdf, input.contractNumber, input.contentHash, assets);
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
