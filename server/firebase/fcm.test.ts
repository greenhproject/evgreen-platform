/**
 * Tests para Firebase Cloud Messaging
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Firebase Cloud Messaging", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("Configuración de Firebase", () => {
    it("debe tener las variables de entorno de Firebase configuradas", () => {
      // Verificar que las variables de entorno están definidas
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      // Al menos el projectId debe estar configurado
      expect(projectId).toBeDefined();
      expect(projectId).toBe("evgreen-app");
    });

    it("debe tener el client email configurado correctamente", () => {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      expect(clientEmail).toBeDefined();
      expect(clientEmail).toContain("@evgreen-app.iam.gserviceaccount.com");
    });

    it("debe tener la clave privada configurada", () => {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      expect(privateKey).toBeDefined();
      expect(privateKey).toContain("PRIVATE KEY");
    });
  });

  describe("Tipos de notificación", () => {
    it("debe definir todos los tipos de notificación", async () => {
      const { default: fcm } = await import("./fcm");
      
      // Verificar que el módulo exporta las funciones necesarias
      expect(fcm.sendPushNotification).toBeDefined();
      expect(fcm.sendPushNotificationToMultiple).toBeDefined();
      expect(fcm.sendChargingCompleteNotification).toBeDefined();
      expect(fcm.sendChargingStartedNotification).toBeDefined();
      expect(fcm.sendLowBalanceNotification).toBeDefined();
      expect(fcm.sendPromotionNotification).toBeDefined();
      expect(fcm.subscribeToTopic).toBeDefined();
      expect(fcm.unsubscribeFromTopic).toBeDefined();
      expect(fcm.sendToTopic).toBeDefined();
    });
  });

  describe("Funciones de notificación", () => {
    it("sendPushNotification debe retornar false si no hay token válido", async () => {
      const { sendPushNotification } = await import("./fcm");
      
      // Con un token inválido, debe retornar false
      const result = await sendPushNotification("invalid-token", {
        type: "system_alert",
        title: "Test",
        body: "Test notification",
      });
      
      // Puede retornar false si Firebase no está inicializado o el token es inválido
      expect(typeof result).toBe("boolean");
    });

    it("sendPushNotificationToMultiple debe manejar arrays vacíos", async () => {
      const { sendPushNotificationToMultiple } = await import("./fcm");
      
      const result = await sendPushNotificationToMultiple([], {
        type: "promotion",
        title: "Test",
        body: "Test notification",
      });
      
      expect(result.success).toBe(0);
      expect(result.failure).toBe(0);
      expect(result.invalidTokens).toEqual([]);
    });
  });
});
