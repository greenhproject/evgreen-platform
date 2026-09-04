import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contractPdfChromiumArgs, resolveContractPdfExecutablePath } from "./contracts/contract-pdf-service";

const originalExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

afterEach(() => {
  if (originalExecutablePath === undefined) delete process.env.PUPPETEER_EXECUTABLE_PATH;
  else process.env.PUPPETEER_EXECUTABLE_PATH = originalExecutablePath;
});

describe("runtime del generador PDF contractual", () => {
  it("prioriza el Chromium instalado por el entorno de producción", async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/usr/bin/chromium";
    await expect(resolveContractPdfExecutablePath()).resolves.toBe("/usr/bin/chromium");
  });

  it("incluye los argumentos obligatorios para un contenedor limitado", () => {
    expect(contractPdfChromiumArgs()).toEqual(expect.arrayContaining([
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ]));
  });

  it("instala Chromium en el Dockerfile y ejecuta el build completo", () => {
    const dockerfile = fs.readFileSync(path.resolve(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toContain("chromium");
    expect(dockerfile).toContain("PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium");
    expect(dockerfile).toContain("pnpm build");
    expect(dockerfile).toContain('CMD ["node", "dist/index.js"]');
  });
});
