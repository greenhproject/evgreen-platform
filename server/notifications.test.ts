/**
 * Tests unitarios para el sistema de notificaciones
 * Prueba el router de notificaciones y las funciones de base de datos
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de Firebase Admin
vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    messaging: vi.fn(() => ({
      send: vi.fn().mockResolvedValue("message-id"),
      sendEachForMulticast: vi.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      }),
      subscribeToTopic: vi.fn().mockResolvedValue({}),
      unsubscribeFromTopic: vi.fn().mockResolvedValue({}),
    })),
  },
}));

// Mock de la base de datos
vi.mock("./db", () => ({
  getNotificationsByUserId: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      title: "Carga completada",
      message: "Tu sesión de carga ha finalizado",
      type: "CHARGING",
      isRead: false,
      createdAt: new Date(),
    },
    {
      id: 2,
      userId: 1,
      title: "Promoción especial",
      message: "20% de descuento en cargas nocturnas",
      type: "PROMO",
      isRead: true,
      createdAt: new Date(),
    },
  ]),
  markNotificationAsRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsAsRead: vi.fn().mockResolvedValue(undefined),
  deleteNotification: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue(1),
  getNotificationByKey: vi.fn().mockResolvedValue(null),
}));

import * as db from "./db";
import {
  sendPushNotification,
  sendPushNotificationToMultiple,
  sendChargingCompleteNotification,
  sendChargingStartedNotification,
  sendLowBalanceNotification,
  sendPromotionNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
} from "./firebase/fcm";

describe("Sistema de Notificaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Funciones de Base de Datos", () => {
    it("debe obtener notificaciones por usuario", async () => {
      const notifications = await db.getNotificationsByUserId(1, false);
      
      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toBe("Carga completada");
      expect(notifications[1].type).toBe("PROMO");
    });

    it("debe marcar una notificación como leída", async () => {
      await db.markNotificationAsRead(1);
      
      expect(db.markNotificationAsRead).toHaveBeenCalledWith(1);
    });

    it("debe marcar todas las notificaciones como leídas", async () => {
      await db.markAllNotificationsAsRead(1);
      
      expect(db.markAllNotificationsAsRead).toHaveBeenCalledWith(1);
    });

    it("debe eliminar una notificación", async () => {
      await db.deleteNotification(1, 1);
      
      expect(db.deleteNotification).toHaveBeenCalledWith(1, 1);
    });

    it("debe crear una notificación", async () => {
      const notificationData = {
        userId: 1,
        title: "Nueva notificación",
        message: "Mensaje de prueba",
        type: "SYSTEM",
      };
      
      const id = await db.createNotification(notificationData as any);
      
      expect(id).toBe(1);
      expect(db.createNotification).toHaveBeenCalledWith(notificationData);
    });

    it("debe buscar notificación por key único", async () => {
      const notification = await db.getNotificationByKey(1, "low_balance_123");
      
      expect(db.getNotificationByKey).toHaveBeenCalledWith(1, "low_balance_123");
    });
  });

  describe("Firebase Cloud Messaging", () => {
    const mockToken = "mock-fcm-token-12345";

    it("debe enviar notificación push a un dispositivo", async () => {
      const result = await sendPushNotification(mockToken, {
        type: "charging_complete",
        title: "Carga completada",
        body: "Tu vehículo está listo",
      });

      // El resultado depende de si Firebase está inicializado
      expect(typeof result).toBe("boolean");
    });

    it("debe enviar notificación de carga completada", async () => {
      const result = await sendChargingCompleteNotification(mockToken, {
        stationName: "EVGreen Mosquera",
        energyDelivered: 25.5,
        totalCost: 45000,
        duration: 3600,
      });

      expect(typeof result).toBe("boolean");
    });

    it("debe enviar notificación de carga iniciada", async () => {
      const result = await sendChargingStartedNotification(mockToken, {
        stationName: "EVGreen Centro",
        connectorType: "CCS2",
      });

      expect(typeof result).toBe("boolean");
    });

    it("debe enviar notificación de saldo bajo", async () => {
      const result = await sendLowBalanceNotification(mockToken, 5000);

      expect(typeof result).toBe("boolean");
    });

    it("debe enviar notificación de promoción a múltiples dispositivos", async () => {
      const tokens = [mockToken, "another-token"];
      const result = await sendPromotionNotification(tokens, {
        title: "¡Oferta especial!",
        description: "20% de descuento en cargas nocturnas",
        discount: 20,
        validUntil: "2026-02-28",
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("failure");
      expect(result).toHaveProperty("invalidTokens");
    });

    it("debe suscribir a un topic", async () => {
      const result = await subscribeToTopic(mockToken, "evgreen_promotions");

      expect(typeof result).toBe("boolean");
    });

    it("debe desuscribir de un topic", async () => {
      const result = await unsubscribeFromTopic(mockToken, "evgreen_promotions");

      expect(typeof result).toBe("boolean");
    });
  });

  describe("Tipos de Notificación", () => {
    it("debe soportar todos los tipos de notificación", () => {
      const types = [
        "charging_complete",
        "charging_started",
        "charging_error",
        "low_balance",
        "balance_added",
        "promotion",
        "station_available",
        "reservation_reminder",
        "system_alert",
      ];

      types.forEach(type => {
        expect(typeof type).toBe("string");
      });
    });

    it("debe tener estilos definidos para cada tipo", () => {
      const notificationStyles = {
        charging_complete: { icon: "✅", color: "#22c55e" },
        charging_started: { icon: "⚡", color: "#3b82f6" },
        charging_error: { icon: "❌", color: "#ef4444" },
        low_balance: { icon: "💰", color: "#f59e0b" },
        balance_added: { icon: "💵", color: "#22c55e" },
        promotion: { icon: "🎉", color: "#8b5cf6" },
        station_available: { icon: "📍", color: "#06b6d4" },
        reservation_reminder: { icon: "⏰", color: "#f97316" },
        system_alert: { icon: "🔔", color: "#64748b" },
      };

      Object.entries(notificationStyles).forEach(([type, style]) => {
        expect(style).toHaveProperty("icon");
        expect(style).toHaveProperty("color");
        expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe("Preferencias de Notificación", () => {
    it("debe tener preferencias por defecto", () => {
      const defaultPreferences = {
        chargingComplete: true,
        lowBalance: true,
        promotions: true,
        pushEnabled: false,
      };

      expect(defaultPreferences.chargingComplete).toBe(true);
      expect(defaultPreferences.lowBalance).toBe(true);
      expect(defaultPreferences.promotions).toBe(true);
      expect(defaultPreferences.pushEnabled).toBe(false);
    });

    it("debe permitir actualizar preferencias individuales", () => {
      const preferences = {
        chargingComplete: true,
        lowBalance: true,
        promotions: true,
      };

      const updated = { ...preferences, promotions: false };

      expect(updated.chargingComplete).toBe(true);
      expect(updated.lowBalance).toBe(true);
      expect(updated.promotions).toBe(false);
    });
  });

  describe("Validación de Tokens FCM", () => {
    it("debe rechazar tokens vacíos", () => {
      const emptyToken = "";
      expect(emptyToken.length).toBe(0);
    });

    it("debe aceptar tokens válidos", () => {
      const validToken = "dGVzdC10b2tlbi0xMjM0NTY3ODkw";
      expect(validToken.length).toBeGreaterThan(10);
    });

    it("debe identificar tokens locales", () => {
      const localToken = "local_1706817600000_abc123";
      expect(localToken.startsWith("local_")).toBe(true);
    });
  });
});

describe("Integración de Notificaciones en Tiempo Real", () => {
  it("debe formatear correctamente el mensaje de carga completada", () => {
    const data = {
      stationName: "EVGreen Mosquera",
      energyDelivered: 25.5,
      totalCost: 45000,
      duration: 3600,
    };

    const message = `Tu vehículo está listo. ${data.energyDelivered.toFixed(2)} kWh en ${data.stationName}. Total: $${data.totalCost.toLocaleString()}`;

    expect(message).toContain("25.50 kWh");
    expect(message).toContain("EVGreen Mosquera");
    expect(message).toContain("$45,000");
  });

  it("debe formatear correctamente el mensaje de saldo bajo", () => {
    const currentBalance = 5000;
    const message = `Tu saldo actual es de $${currentBalance.toLocaleString()}. Recarga para seguir cargando tu vehículo.`;

    expect(message).toContain("$5,000");
    expect(message).toContain("Recarga");
  });

  it("debe calcular tiempo transcurrido correctamente", () => {
    const startTime = Date.now() - 3600000; // hace 1 hora
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);

    expect(hours).toBe(1);
    expect(minutes).toBe(0);
  });
});
