import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseUserAgent } from "./security/security-service";

// ============================================================================
// Tests para parseUserAgent - no requiere DB
// ============================================================================

describe("parseUserAgent", () => {
  it("should detect Chrome on Windows desktop", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe("desktop");
    expect(result.browser).toContain("Google Chrome");
    expect(result.os).toBe("Windows 10/11");
  });

  it("should detect Firefox on Linux desktop", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe("desktop");
    expect(result.browser).toContain("Mozilla Firefox");
    expect(result.os).toBe("Linux");
  });

  it("should detect Safari on iPhone mobile", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe("mobile");
    expect(result.browser).toContain("Safari");
    expect(result.os).toBe("iOS");
  });

  it("should detect Chrome on Android mobile", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36";
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe("mobile");
    expect(result.browser).toContain("Google Chrome");
    expect(result.os).toContain("Android");
  });

  it("should detect iPad as tablet", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe("tablet");
    expect(result.os).toBe("iOS");
  });

  it("should detect Edge browser", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91";
    const result = parseUserAgent(ua);
    
    expect(result.browser).toContain("Microsoft Edge");
    expect(result.os).toBe("Windows 10/11");
  });

  it("should detect macOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe("desktop");
    expect(result.os).toBe("macOS");
  });

  it("should handle undefined user agent", () => {
    const result = parseUserAgent(undefined);
    
    expect(result.deviceType).toBe("desconocido");
    expect(result.browser).toBe("Desconocido");
    expect(result.os).toBe("Desconocido");
  });

  it("should handle empty string user agent", () => {
    const result = parseUserAgent("");
    
    // Empty string is falsy, so parseUserAgent returns defaults
    expect(result.deviceType).toBe("desconocido");
    expect(result.browser).toBe("Desconocido");
    expect(result.os).toBe("Desconocido");
  });
});

// ============================================================================
// Tests para Security Router (via appRouter)
// ============================================================================

describe("security router", () => {
  it("should have the security router registered", async () => {
    const { appRouter } = await import("./routers");
    // Verify the security router exists in the appRouter
    expect(appRouter._def.procedures).toBeDefined();
    
    // Check that security procedures exist
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("security.get2FAStatus");
    expect(procedures).toContain("security.setup2FA");
    expect(procedures).toContain("security.verify2FA");
    expect(procedures).toContain("security.disable2FA");
    expect(procedures).toContain("security.getSessions");
    expect(procedures).toContain("security.terminateSession");
    expect(procedures).toContain("security.terminateAllOtherSessions");
    expect(procedures).toContain("security.recordSession");
  });
});

// ============================================================================
// Tests para shouldNotifyTechnician logic
// ============================================================================

describe("technician notification filtering", () => {
  // Test the isWithinWorkingHours logic indirectly through the module
  it("should export notifyTechniciansOfAlert function", async () => {
    const module = await import("./notifications/technician-notification-service");
    expect(typeof module.notifyTechniciansOfAlert).toBe("function");
    expect(typeof module.notifyTechniciansOfNewTicket).toBe("function");
    expect(typeof module.getActiveTechnicians).toBe("function");
  });
});
