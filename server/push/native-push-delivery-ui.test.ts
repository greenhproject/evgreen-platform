import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const nativePushSource = fs.readFileSync(path.join(root, "client/src/lib/native-push.ts"), "utf8");
const notificationHookSource = fs.readFileSync(path.join(root, "client/src/hooks/useNotifications.ts"), "utf8");

describe("Native Push delivery receipts", () => {
  it("reports receipt and opening only when native events occur", () => {
    expect(nativePushSource).toContain('"RECEIVED" | "OPENED"');
    expect(nativePushSource).toContain('reportDeliveryEvent(data, "RECEIVED", options)');
    expect(nativePushSource).toContain('reportDeliveryEvent(data, "OPENED", options)');
    expect(nativePushSource).toContain("deliveryId");
  });

  it("registers native tokens with platform metadata and acknowledges events", () => {
    expect(notificationHookSource).toContain("platform: platform === \"android\" || platform === \"ios\"");
    expect(notificationHookSource).toContain("acknowledgeDeliveryMutation");
    expect(notificationHookSource).toContain("Solicitud aceptada por el proveedor");
    expect(notificationHookSource).not.toContain('toast.success("Notificación de prueba enviada")');
  });
});
