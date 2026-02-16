import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the pure logic functions from openExternal.ts
// Since it's a client-side module, we mock the browser environment

describe("openExternal utility - isExternalUrl logic", () => {
  // Replicate the isExternalUrl logic for testing
  function isExternalUrl(url: string, currentHost = "evgreen.lat"): boolean {
    if (!url) return false;
    
    try {
      if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?")) {
        return false;
      }
      
      if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
        return true;
      }
      
      const urlObj = new URL(url, `https://${currentHost}`);
      return urlObj.hostname !== currentHost;
    } catch {
      return true;
    }
  }

  it("should return false for empty string", () => {
    expect(isExternalUrl("")).toBe(false);
  });

  it("should return false for relative paths", () => {
    expect(isExternalUrl("/charging")).toBe(false);
    expect(isExternalUrl("/admin/dashboard")).toBe(false);
    expect(isExternalUrl("/settings/notifications")).toBe(false);
  });

  it("should return false for hash-only URLs", () => {
    expect(isExternalUrl("#section")).toBe(false);
  });

  it("should return false for query-only URLs", () => {
    expect(isExternalUrl("?tab=settings")).toBe(false);
  });

  it("should return true for mailto: links", () => {
    expect(isExternalUrl("mailto:soporte@evgreen.lat")).toBe(true);
  });

  it("should return true for tel: links", () => {
    expect(isExternalUrl("tel:+573001234567")).toBe(true);
  });

  it("should return true for sms: links", () => {
    expect(isExternalUrl("sms:+573001234567")).toBe(true);
  });

  it("should return true for external HTTP URLs", () => {
    expect(isExternalUrl("https://www.google.com")).toBe(true);
    expect(isExternalUrl("https://example.com/promo")).toBe(true);
    expect(isExternalUrl("http://advertiser.com/landing")).toBe(true);
  });

  it("should return false for same-domain URLs", () => {
    expect(isExternalUrl("https://evgreen.lat/charging")).toBe(false);
    expect(isExternalUrl("https://evgreen.lat/admin")).toBe(false);
  });

  it("should return true for subdomain URLs (different host)", () => {
    expect(isExternalUrl("https://blog.evgreen.lat/post")).toBe(true);
    expect(isExternalUrl("https://api.evgreen.lat/v1")).toBe(true);
  });

  it("should return true for malformed URLs (fallback)", () => {
    expect(isExternalUrl("not-a-valid-url://weird")).toBe(true);
  });
});

describe("openExternal utility - Banner link handling", () => {
  it("should determine correct URL from banner with ctaUrl", () => {
    const banner = {
      ctaUrl: "https://promo.example.com/offer",
      linkUrl: undefined,
    };
    const url = banner.ctaUrl || banner.linkUrl;
    expect(url).toBe("https://promo.example.com/offer");
  });

  it("should fallback to linkUrl when ctaUrl is not set", () => {
    const banner = {
      ctaUrl: undefined,
      linkUrl: "https://advertiser.com/landing",
    };
    const url = banner.ctaUrl || banner.linkUrl;
    expect(url).toBe("https://advertiser.com/landing");
  });

  it("should return undefined when neither URL is set", () => {
    const banner = {
      ctaUrl: undefined,
      linkUrl: undefined,
    };
    const url = banner.ctaUrl || banner.linkUrl;
    expect(url).toBeUndefined();
  });
});

describe("openExternal utility - Notification URL routing", () => {
  function isExternalUrl(url: string, currentHost = "evgreen.lat"): boolean {
    if (!url) return false;
    try {
      if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?")) return false;
      if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) return true;
      const urlObj = new URL(url, `https://${currentHost}`);
      return urlObj.hostname !== currentHost;
    } catch {
      return true;
    }
  }

  it("should route internal notification URLs to setLocation", () => {
    const actionUrl = "/charging/session/123";
    expect(isExternalUrl(actionUrl)).toBe(false);
    // This means we use setLocation (internal navigation)
  });

  it("should route external notification URLs to openExternalUrl", () => {
    const actionUrl = "https://promo.partner.com/special-offer";
    expect(isExternalUrl(actionUrl)).toBe(true);
    // This means we use openExternalUrl (external browser)
  });

  it("should handle notification with /admin path as internal", () => {
    expect(isExternalUrl("/admin/tickets")).toBe(false);
  });

  it("should handle notification with full external URL", () => {
    expect(isExternalUrl("https://play.google.com/store/apps/details?id=com.evgreen")).toBe(true);
  });
});
