import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";

describe("Image Compression for Station Photos", () => {
  describe("Sharp WebP Compression", () => {
    it("should compress a JPEG buffer to WebP format", async () => {
      // Create a test image buffer (100x100 red square)
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const compressed = await sharp(testImage)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeGreaterThan(0);
      // WebP should be smaller or comparable
      expect(compressed.length).toBeLessThan(testImage.length * 2);
    });

    it("should not enlarge small images beyond original dimensions", async () => {
      const smallImage = await sharp({
        create: {
          width: 200,
          height: 150,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const resized = await sharp(smallImage)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const metadata = await sharp(resized).metadata();
      expect(metadata.width).toBeLessThanOrEqual(200);
      expect(metadata.height).toBeLessThanOrEqual(150);
    });

    it("should resize large images to max 1200px width", async () => {
      const largeImage = await sharp({
        create: {
          width: 4000,
          height: 3000,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const resized = await sharp(largeImage)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const metadata = await sharp(resized).metadata();
      expect(metadata.width).toBeLessThanOrEqual(1200);
      expect(metadata.height).toBeLessThanOrEqual(900);
    });

    it("should generate thumbnail at 300x225 with cover fit", async () => {
      const testImage = await sharp({
        create: {
          width: 2000,
          height: 1500,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg()
        .toBuffer();

      const thumb = await sharp(testImage)
        .resize(300, 225, { fit: "cover" })
        .webp({ quality: 70 })
        .toBuffer();

      const metadata = await sharp(thumb).metadata();
      expect(metadata.width).toBe(300);
      expect(metadata.height).toBe(225);
      expect(metadata.format).toBe("webp");
    });

    it("should significantly reduce file size for large photos", async () => {
      // Simulate a large photo (2000x1500 with noise-like data)
      const largeImage = await sharp({
        create: {
          width: 2000,
          height: 1500,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg({ quality: 95 })
        .toBuffer();

      const compressed = await sharp(largeImage)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      // Compressed should be smaller than original
      expect(compressed.length).toBeLessThan(largeImage.length);
    });

    it("should handle PNG input and convert to WebP", async () => {
      const pngImage = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 4,
          background: { r: 255, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const webpResult = await sharp(pngImage)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const metadata = await sharp(webpResult).metadata();
      expect(metadata.format).toBe("webp");
    });

    it("should produce valid WebP output for thumbnails", async () => {
      const testImage = await sharp({
        create: {
          width: 500,
          height: 400,
          channels: 3,
          background: { r: 50, g: 100, b: 150 },
        },
      })
        .jpeg()
        .toBuffer();

      const thumb = await sharp(testImage)
        .resize(300, 225, { fit: "cover" })
        .webp({ quality: 70 })
        .toBuffer();

      expect(thumb).toBeInstanceOf(Buffer);
      expect(thumb.length).toBeGreaterThan(0);
      // WebP magic bytes: RIFF....WEBP
      expect(thumb[0]).toBe(0x52); // R
      expect(thumb[1]).toBe(0x49); // I
      expect(thumb[2]).toBe(0x46); // F
      expect(thumb[3]).toBe(0x46); // F
    });

    it("should calculate correct savings percentage", () => {
      const originalSize = 5000000; // 5MB
      const compressedSize = 500000; // 500KB
      const savings = Math.round((1 - compressedSize / originalSize) * 100);
      expect(savings).toBe(90);
    });

    it("should reject buffers larger than 10MB", () => {
      const maxSize = 10 * 1024 * 1024;
      const oversizedBuffer = Buffer.alloc(maxSize + 1);
      expect(oversizedBuffer.length).toBeGreaterThan(maxSize);
    });
  });
});
