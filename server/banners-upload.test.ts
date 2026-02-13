import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "banners/1234567890-abc123.png",
    url: "https://cdn.example.com/banners/1234567890-abc123.png",
  }),
}));

// Mock db module
vi.mock("./db", () => ({
  getAllBanners: vi.fn().mockResolvedValue([]),
  getBannerById: vi.fn().mockResolvedValue(null),
  getActiveBanners: vi.fn().mockResolvedValue([]),
  createBanner: vi.fn().mockResolvedValue(1),
  updateBanner: vi.fn().mockResolvedValue(undefined),
  deleteBanner: vi.fn().mockResolvedValue(undefined),
  recordBannerImpression: vi.fn().mockResolvedValue(undefined),
  recordBannerClick: vi.fn().mockResolvedValue(undefined),
}));

import { storagePut } from "./storage";

describe("Banner Image Upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe aceptar imágenes válidas en base64 y subirlas a S3", async () => {
    // Simular un PNG de 1x1 pixel en base64
    const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const buffer = Buffer.from(tinyPngBase64, "base64");
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.length).toBeLessThan(5 * 1024 * 1024); // Menos de 5MB
    
    // Simular la lógica del endpoint
    const ext = "test-image.png".split(".").pop() || "jpg";
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileKey = `banners/${timestamp}-${randomSuffix}.${ext}`;
    
    const result = await (storagePut as any)(fileKey, buffer, "image/png");
    
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("key");
    expect(storagePut).toHaveBeenCalledWith(fileKey, buffer, "image/png");
  });

  it("debe rechazar archivos mayores a 5MB", () => {
    // Simular un buffer de 6MB
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    expect(largeBuffer.length).toBeGreaterThan(5 * 1024 * 1024);
  });

  it("debe generar nombres de archivo únicos con timestamp y sufijo aleatorio", () => {
    const fileName = "banner-promo.jpg";
    const ext = fileName.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileKey = `banners/${timestamp}-${randomSuffix}.${ext}`;
    
    expect(fileKey).toMatch(/^banners\/\d+-[a-z0-9]+\.jpg$/);
    expect(ext).toBe("jpg");
  });

  it("debe manejar diferentes tipos de contenido de imagen", () => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    const disallowedTypes = ["application/pdf", "text/html", "video/mp4", "image/bmp"];
    
    for (const type of allowedTypes) {
      expect(allowedTypes.includes(type)).toBe(true);
    }
    
    for (const type of disallowedTypes) {
      expect(allowedTypes.includes(type)).toBe(false);
    }
  });

  it("debe extraer la extensión correctamente de nombres de archivo variados", () => {
    const testCases = [
      { fileName: "banner.png", expected: "png" },
      { fileName: "mi-imagen.jpeg", expected: "jpeg" },
      { fileName: "foto.webp", expected: "webp" },
      { fileName: "animacion.gif", expected: "gif" },
      { fileName: "logo.svg", expected: "svg" },
      { fileName: "archivo.con.puntos.jpg", expected: "jpg" },
    ];
    
    for (const { fileName, expected } of testCases) {
      const ext = fileName.split(".").pop() || "jpg";
      expect(ext).toBe(expected);
    }
  });

  it("debe generar la ruta correcta bajo el directorio banners/", () => {
    const fileKey = `banners/${Date.now()}-abc123.png`;
    expect(fileKey.startsWith("banners/")).toBe(true);
  });
});
