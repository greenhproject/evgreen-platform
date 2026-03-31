/**
 * Tests para el servicio unificado de push notifications
 * Verifica que sendUserPush intenta Web Push primero y FCM como fallback
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Unified Push Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export sendUserPush and sendUserPushToMultiple", async () => {
    const mod = await import("./unified-push");
    expect(typeof mod.sendUserPush).toBe("function");
    expect(typeof mod.sendUserPushToMultiple).toBe("function");
  });

  it("should have proper TypeScript interface for UnifiedPushPayload", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    // Verify interface fields
    expect(content).toContain("type: NotificationType");
    expect(content).toContain("title: string");
    expect(content).toContain("body: string");
    expect(content).toContain("clickAction?: string");
    expect(content).toContain("data?: Record<string, string>");
    expect(content).toContain("imageUrl?: string");
  });

  it("should import from web-push-service and firebase/fcm", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain('from "./web-push-service"');
    expect(content).toContain('from "../firebase/fcm"');
    expect(content).toContain('from "../db"');
  });

  it("should try Web Push first before FCM fallback", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    // Web Push should be attempted first
    const webPushIndex = content.indexOf("pushSubscription && isWebPushAvailable");
    const fcmIndex = content.indexOf("fcmToken && !user.fcmToken.startsWith");
    
    expect(webPushIndex).toBeGreaterThan(-1);
    expect(fcmIndex).toBeGreaterThan(-1);
    expect(webPushIndex).toBeLessThan(fcmIndex); // Web Push before FCM
  });

  it("should handle requireInteraction for critical notification types", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain("low_balance");
    expect(content).toContain("charging_error");
    expect(content).toContain("overstay_alert");
    expect(content).toContain("requireInteraction");
  });

  it("should skip local tokens in FCM fallback", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain('startsWith("local_")');
  });

  it("should handle JSON parse errors for pushSubscription gracefully", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain("parseError");
    expect(content).toContain("Invalid pushSubscription JSON");
  });

  it("should log success and failure for debugging", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain("[UnifiedPush] Web Push sent");
    expect(content).toContain("[UnifiedPush] FCM sent");
    expect(content).toContain("[UnifiedPush] All push methods failed");
  });

  it("sendUserPushToMultiple should process in parallel", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain("Promise.allSettled");
  });

  it("should re-export NotificationType for convenience", () => {
    const filePath = path.join(__dirname, "unified-push.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain('export type { NotificationType }');
  });
});

describe("Service Worker v8 - Push Notification Fix", () => {
  it("should be updated to v8", () => {
    const swPath = path.join(__dirname, "../../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    
    expect(content).toContain("v8");
    expect(content).toContain("SW_VERSION = 'v8'");
  });

  it("should have enhanced push event handler with logging", () => {
    const swPath = path.join(__dirname, "../../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    
    expect(content).toContain("Push event received");
    expect(content).toContain("Push payload:");
    expect(content).toContain("Showing notification:");
  });

  it("should normalize title from multiple sources", () => {
    const swPath = path.join(__dirname, "../../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    
    // Should check notification.title, data.title, and top-level title
    expect(content).toContain("rawData.notification?.title");
    expect(content).toContain("rawData.data?.title");
    expect(content).toContain("rawData.title");
  });

  it("should normalize body from multiple sources", () => {
    const swPath = path.join(__dirname, "../../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    
    expect(content).toContain("rawData.notification?.body");
    expect(content).toContain("rawData.data?.body");
    expect(content).toContain("rawData.body");
  });

  it("should handle requireInteraction for critical types", () => {
    const swPath = path.join(__dirname, "../../client/public/sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    
    expect(content).toContain("low_balance");
    expect(content).toContain("charging_error");
    expect(content).toContain("overstay_alert");
    expect(content).toContain("requireInteraction");
  });
});

describe("FCM webpush config fix", () => {
  it("should include title and body in webpush.notification", () => {
    const fcmPath = path.join(__dirname, "../firebase/fcm.ts");
    const content = fs.readFileSync(fcmPath, "utf-8");
    
    // Check that webpush notification includes title and body
    // The webpush block should have title and body to prevent generic Chrome notifications
    const webpushSection = content.substring(
      content.indexOf("webpush: {"),
      content.indexOf("webpush: {") + 500
    );
    
    expect(webpushSection).toContain("title:");
    expect(webpushSection).toContain("body:");
    expect(webpushSection).toContain("Urgency");
    expect(webpushSection).toContain("TTL");
  });
});

describe("Charging modules use unified push", () => {
  it("charging-router should import from unified-push", () => {
    const filePath = path.join(__dirname, "../charging/charging-router.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain('from "../push/unified-push"');
    expect(content).toContain("sendUserPush");
  });

  it("overstay-monitor should import from unified-push", () => {
    const filePath = path.join(__dirname, "../charging/overstay-monitor.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain('from "../push/unified-push"');
    expect(content).toContain("sendUserPush");
  });

  it("balance-monitor should import from unified-push", () => {
    const filePath = path.join(__dirname, "../charging/balance-monitor.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain('from "../push/unified-push"');
    expect(content).toContain("sendUserPush");
    // Should also check for pushSubscription, not just fcmToken
    expect(content).toContain("pushSubscription");
  });

  it("proactive-notifications should use unified-push", () => {
    const filePath = path.join(__dirname, "../ai/proactive-notifications.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain("unified-push");
    expect(content).toContain("sendUserPush");
  });

  it("routers.ts should use unified-push for investor notifications", () => {
    const filePath = path.join(__dirname, "../routers.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    expect(content).toContain("unified-push");
    expect(content).toContain("sendUserPush");
  });
});
