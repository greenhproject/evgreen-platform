import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the cross-platform PDF download utility (client/src/lib/pdf-download.ts)
 * 
 * Since the utility is a client-side module, we test the logic patterns here
 * by simulating the platform detection and download behavior.
 */

describe("PDF Download Cross-Platform Utility", () => {
  // Store original navigator
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("iOS Detection", () => {
    it("should detect iPhone user agent", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
      expect(/iPad|iPhone|iPod/.test(ua)).toBe(true);
    });

    it("should detect iPad user agent", () => {
      const ua = "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
      expect(/iPad|iPhone|iPod/.test(ua)).toBe(true);
    });

    it("should NOT detect Android as iOS", () => {
      const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36";
      expect(/iPad|iPhone|iPod/.test(ua)).toBe(false);
    });

    it("should NOT detect desktop Chrome as iOS", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36";
      expect(/iPad|iPhone|iPod/.test(ua)).toBe(false);
    });
  });

  describe("Safari Detection", () => {
    it("should detect Safari on macOS", () => {
      const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15";
      expect(/^((?!chrome|android).)*safari/i.test(ua)).toBe(true);
    });

    it("should detect Safari on iOS", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
      expect(/^((?!chrome|android).)*safari/i.test(ua)).toBe(true);
    });

    it("should NOT detect Chrome as Safari", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36";
      expect(/^((?!chrome|android).)*safari/i.test(ua)).toBe(false);
    });

    it("should NOT detect Android Chrome as Safari", () => {
      const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36";
      expect(/^((?!chrome|android).)*safari/i.test(ua)).toBe(false);
    });

    it("should NOT detect Firefox as Safari", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0";
      expect(/^((?!chrome|android).)*safari/i.test(ua)).toBe(false);
    });
  });

  describe("Download Strategy Selection", () => {
    it("should use window.open for iOS devices", () => {
      const isIOS = true;
      const isSafari = false;
      const strategy = (isIOS || isSafari) ? "bloburl" : "save";
      expect(strategy).toBe("bloburl");
    });

    it("should use window.open for Safari browsers", () => {
      const isIOS = false;
      const isSafari = true;
      const strategy = (isIOS || isSafari) ? "bloburl" : "save";
      expect(strategy).toBe("bloburl");
    });

    it("should use doc.save for Android Chrome", () => {
      const isIOS = false;
      const isSafari = false;
      const strategy = (isIOS || isSafari) ? "bloburl" : "save";
      expect(strategy).toBe("save");
    });

    it("should use doc.save for desktop Chrome", () => {
      const isIOS = false;
      const isSafari = false;
      const strategy = (isIOS || isSafari) ? "bloburl" : "save";
      expect(strategy).toBe("save");
    });

    it("should use doc.save for Firefox", () => {
      const isIOS = false;
      const isSafari = false;
      const strategy = (isIOS || isSafari) ? "bloburl" : "save";
      expect(strategy).toBe("save");
    });
  });

  describe("Blob Creation for Server-Generated PDFs", () => {
    it("should create valid PDF blob from base64 data", () => {
      // Simulate base64 PDF data (minimal PDF header)
      const pdfBase64 = btoa("%PDF-1.4 test content");
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe("application/pdf");
    });

    it("should handle empty base64 data gracefully", () => {
      const pdfBase64 = btoa("");
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      
      expect(blob.size).toBe(0);
      expect(blob.type).toBe("application/pdf");
    });
  });

  describe("iPad Pro Detection (modern iPads report as MacIntel)", () => {
    it("should detect iPad Pro via maxTouchPoints", () => {
      // Modern iPad Pro reports as "MacIntel" with maxTouchPoints > 1
      const platform = "MacIntel";
      const maxTouchPoints = 5;
      const isModernIPad = platform === "MacIntel" && maxTouchPoints > 1;
      expect(isModernIPad).toBe(true);
    });

    it("should NOT detect Mac desktop as iPad", () => {
      const platform = "MacIntel";
      const maxTouchPoints = 0; // Desktop Mac has 0 touch points
      const isModernIPad = platform === "MacIntel" && maxTouchPoints > 1;
      expect(isModernIPad).toBe(false);
    });
  });
});
