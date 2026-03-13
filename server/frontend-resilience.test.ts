import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tests to verify that the frontend handles server downtime gracefully
 * instead of showing an infinite "Cargando..." screen.
 */

describe("Service Worker v7 - 503 Recovery", () => {
  const swPath = path.resolve(__dirname, "../client/public/sw.js");
  let swCode: string;

  swCode = fs.readFileSync(swPath, "utf-8");

  it("should be version 7 or higher", () => {
    expect(swCode).toContain("SW_VERSION = 'v7'");
  });

  it("should detect 503 responses on navigation", () => {
    expect(swCode).toContain("response.status === 503");
    expect(swCode).toContain("response.status === 502");
  });

  it("should show recovery HTML instead of hosting 503 page", () => {
    expect(swCode).toContain("getRecoveryHTML");
    expect(swCode).toContain("Servicio en mantenimiento");
  });

  it("should have auto-retry in recovery HTML", () => {
    expect(swCode).toContain("autoRetry");
    expect(swCode).toContain("/api/health");
    expect(swCode).toContain("window.location.reload()");
  });

  it("should show offline page when network fails", () => {
    expect(swCode).toContain("Sin conexión a internet");
    expect(swCode).toContain("getRecoveryHTML('offline')");
  });

  it("should return 200 status for recovery HTML so browser renders it", () => {
    expect(swCode).toContain("status: 200");
  });

  it("should have no-cache headers on recovery responses", () => {
    expect(swCode).toContain("no-store, no-cache");
  });

  it("should have clear cache button in recovery UI", () => {
    expect(swCode).toContain("clearAndReload");
    expect(swCode).toContain("Limpiar caché");
  });

  it("should listen for online event to auto-retry", () => {
    expect(swCode).toContain("addEventListener('online'");
  });

  it("should NOT intercept non-navigation requests", () => {
    // Verify the SW only intercepts navigation, not API/JS/CSS
    expect(swCode).toContain("event.request.mode === 'navigate'");
    expect(swCode).toContain("Do NOT intercept");
  });
});

describe("LoadingGuard v2 - Server Down Detection", () => {
  const lgPath = path.resolve(__dirname, "../client/src/components/LoadingGuard.tsx");
  let lgCode: string;

  lgCode = fs.readFileSync(lgPath, "utf-8");

  it("should import checkServerHealth", () => {
    expect(lgCode).toContain("import { checkServerHealth }");
  });

  it("should have server-down state", () => {
    expect(lgCode).toContain("'server-down'");
    expect(lgCode).toContain("ServerState");
  });

  it("should check server health on timeout", () => {
    expect(lgCode).toContain("checkServerHealth().then");
  });

  it("should auto-retry when server is down", () => {
    expect(lgCode).toContain("startAutoRetry");
    expect(lgCode).toContain("setInterval");
  });

  it("should auto-reload when server comes back", () => {
    expect(lgCode).toContain("window.location.reload()");
    expect(lgCode).toContain("Servidor disponible de nuevo");
  });

  it("should show specific UI for server-down state", () => {
    expect(lgCode).toContain("Servidor en mantenimiento");
    expect(lgCode).toContain("se recargará automáticamente");
  });

  it("should show specific UI for offline state", () => {
    expect(lgCode).toContain("Sin conexión a internet");
    expect(lgCode).toContain("WifiOff");
  });

  it("should have hard reload option", () => {
    expect(lgCode).toContain("handleHardReload");
    expect(lgCode).toContain("Limpiar caché y recargar");
  });

  it("should use 8 second timeout by default (faster detection)", () => {
    expect(lgCode).toContain("timeoutMs = 8000");
  });
});

describe("App Health Check Module", () => {
  const healthPath = path.resolve(__dirname, "../client/src/lib/app-health-check.ts");
  let healthCode: string;

  healthCode = fs.readFileSync(healthPath, "utf-8");

  it("should export checkServerHealth function", () => {
    expect(healthCode).toContain("export async function checkServerHealth");
  });

  it("should call /api/health endpoint", () => {
    expect(healthCode).toContain("/api/health");
  });

  it("should have request timeout", () => {
    expect(healthCode).toContain("AbortController");
    expect(healthCode).toContain("8000");
  });

  it("should track consecutive failures", () => {
    expect(healthCode).toContain("consecutiveFailures");
  });

  it("should use no-store cache policy", () => {
    expect(healthCode).toContain("no-store");
  });

  it("should export startHealthMonitor function", () => {
    expect(healthCode).toContain("export function startHealthMonitor");
  });
});
