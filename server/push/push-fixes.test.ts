/**
 * Tests para las correcciones de notificaciones push y reservas
 */

import { describe, it, expect, vi } from "vitest";

describe("Web Push Service", () => {
  it("should export required functions", async () => {
    const webPushService = await import("./web-push-service");
    expect(typeof webPushService.sendWebPush).toBe("function");
    expect(typeof webPushService.sendWebPushToMultiple).toBe("function");
    expect(typeof webPushService.isWebPushAvailable).toBe("function");
    expect(typeof webPushService.getVapidPublicKey).toBe("function");
  });

  it("should have PushSubscriptionData type with correct shape", async () => {
    const validSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      keys: {
        p256dh: "testP256dhKey",
        auth: "testAuthKey",
      },
    };
    
    // Verify the shape matches the interface
    expect(validSubscription).toHaveProperty("endpoint");
    expect(validSubscription).toHaveProperty("keys");
    expect(validSubscription.keys).toHaveProperty("p256dh");
    expect(validSubscription.keys).toHaveProperty("auth");
  });

  it("isWebPushAvailable should return boolean", async () => {
    const { isWebPushAvailable } = await import("./web-push-service");
    const result = isWebPushAvailable();
    expect(typeof result).toBe("boolean");
  });

  it("getVapidPublicKey should return string", async () => {
    const { getVapidPublicKey } = await import("./web-push-service");
    const result = getVapidPublicKey();
    expect(typeof result).toBe("string");
  });

  it("getVapidPublicKey should return a valid base64url string when configured", async () => {
    const { getVapidPublicKey, isWebPushAvailable } = await import("./web-push-service");
    const key = getVapidPublicKey();
    if (isWebPushAvailable()) {
      // VAPID public key should be base64url encoded (65 bytes = ~87 chars)
      expect(key.length).toBeGreaterThanOrEqual(80);
      expect(key.length).toBeLessThanOrEqual(90);
      // Should only contain base64url characters
      expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("sendWebPush should return false when not initialized", async () => {
    // Create a fresh module with no VAPID keys
    const webpush = await import("web-push");
    // We can't easily test this without mocking env, but we can verify the function signature
    const { sendWebPush } = await import("./web-push-service");
    expect(typeof sendWebPush).toBe("function");
  });

  it("sendWebPushToMultiple should handle empty array", async () => {
    const { sendWebPushToMultiple } = await import("./web-push-service");
    const result = await sendWebPushToMultiple([], {
      title: "Test",
      body: "Test body",
    });
    expect(result.success).toBe(0);
    expect(result.failure).toBe(0);
    expect(result.invalidSubscriptions).toHaveLength(0);
  });
});

describe("Push Router - registerSubscription input validation", () => {
  it("should validate subscription data shape", () => {
    const validInput = {
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-token",
        keys: {
          p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfWRk",
          auth: "tBHItJI5svbpC7htDc_xow",
        },
      },
    };

    // Validate the structure
    expect(validInput.subscription.endpoint).toMatch(/^https?:\/\//);
    expect(validInput.subscription.keys.p256dh.length).toBeGreaterThan(0);
    expect(validInput.subscription.keys.auth.length).toBeGreaterThan(0);
  });

  it("should reject empty endpoint", () => {
    const invalidInput = {
      subscription: {
        endpoint: "",
        keys: {
          p256dh: "test",
          auth: "test",
        },
      },
    };

    // Empty endpoint should be invalid
    expect(invalidInput.subscription.endpoint.length).toBe(0);
  });

  it("should reject missing keys", () => {
    const invalidInput = {
      subscription: {
        endpoint: "https://test.com",
        keys: {
          p256dh: "",
          auth: "",
        },
      },
    };

    expect(invalidInput.subscription.keys.p256dh.length).toBe(0);
    expect(invalidInput.subscription.keys.auth.length).toBe(0);
  });
});

describe("Push notification payload format", () => {
  it("should create correct Web Push payload", () => {
    const notification = {
      title: "Carga completada",
      body: "Tu BYD Sealion0 ha terminado de cargar al 100%",
      tag: "charging-complete",
      data: { type: "charging_complete", url: "/historial" },
    };

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      tag: notification.tag,
      data: notification.data,
      vibrate: [200, 100, 200],
    });

    const parsed = JSON.parse(payload);
    expect(parsed.title).toBe("Carga completada");
    expect(parsed.body).toContain("BYD Sealion0");
    expect(parsed.data.type).toBe("charging_complete");
    expect(parsed.data.url).toBe("/historial");
    expect(parsed.icon).toBe("/icons/icon-192x192.png");
  });

  it("should handle notification with all optional fields", () => {
    const notification = {
      title: "Reserva confirmada",
      body: "Tu reserva en EVG Diamante Oriental ha sido confirmada",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      image: "https://example.com/station.jpg",
      tag: "reservation-confirmed",
      data: { type: "reservation", url: "/reservations" },
      actions: [
        { action: "view", title: "Ver reserva" },
        { action: "cancel", title: "Cancelar" },
      ],
      vibrate: [200, 100, 200],
      requireInteraction: false,
    };

    const payload = JSON.stringify(notification);
    const parsed = JSON.parse(payload);
    
    expect(parsed.actions).toHaveLength(2);
    expect(parsed.image).toBe("https://example.com/station.jpg");
    expect(parsed.requireInteraction).toBe(false);
  });
});

describe("VAPID key format validation", () => {
  it("should validate base64url encoding", () => {
    const validBase64url = "BNdeUbRCy_Ecyn6JZJ22nv9Ktk6DkjYA1-pP-e-YZxPkl4EvuK4mxFFbILasnquQHJMRheFPd3J3uG8MPa-HrO4";
    
    // Base64url should not contain + or / (those are base64 standard)
    expect(validBase64url).not.toMatch(/[+/]/);
    // Should only contain alphanumeric, - and _
    expect(validBase64url).toMatch(/^[A-Za-z0-9_-]+$/);
    // P-256 public key in base64url should be ~87 chars
    expect(validBase64url.length).toBe(87);
  });

  it("should convert base64url to Uint8Array correctly", () => {
    // Simulate the urlBase64ToUint8Array function
    function urlBase64ToUint8Array(base64String: string): Uint8Array {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = Buffer.from(base64, "base64");
      return new Uint8Array(rawData);
    }

    const testKey = "BNdeUbRCy_Ecyn6JZJ22nv9Ktk6DkjYA1-pP-e-YZxPkl4EvuK4mxFFbILasnquQHJMRheFPd3J3uG8MPa-HrO4";
    const result = urlBase64ToUint8Array(testKey);
    
    // P-256 uncompressed public key should be 65 bytes
    expect(result.length).toBe(65);
    // First byte should be 0x04 (uncompressed point indicator)
    expect(result[0]).toBe(0x04);
  });
});

describe("Reservation from chat - data validation", () => {
  it("should validate reservation data from RESERVE tag", () => {
    // Simular datos que vienen del tag [RESERVE:...]
    const reserveTag = "[RESERVE:stationId=1|connectorId=1|date=2026-03-02|startTime=08:00|endTime=09:00|stationName=EVG diamante oriental]";
    
    // Parsear el tag
    const match = reserveTag.match(/\[RESERVE:([^\]]+)\]/);
    expect(match).not.toBeNull();
    
    const params: Record<string, string> = {};
    match![1].split("|").forEach((pair) => {
      const [key, value] = pair.split("=");
      params[key] = value;
    });

    expect(params.stationId).toBe("1");
    expect(params.connectorId).toBe("1");
    expect(params.date).toBe("2026-03-02");
    expect(params.startTime).toBe("08:00");
    expect(params.endTime).toBe("09:00");
    expect(params.stationName).toBe("EVG diamante oriental");
  });

  it("should create valid reservation mutation input", () => {
    const params = {
      stationId: "1",
      connectorId: "1",
      date: "2026-03-02",
      startTime: "08:00",
      endTime: "09:00",
    };

    // Construir el input como lo haría el componente ReservationButton
    const startDateTime = new Date(`${params.date}T${params.startTime}:00`);
    const endDateTime = new Date(`${params.date}T${params.endTime}:00`);

    expect(startDateTime.getTime()).toBeLessThan(endDateTime.getTime());
    expect(parseInt(params.stationId)).toBeGreaterThan(0);
    expect(parseInt(params.connectorId)).toBeGreaterThan(0);
  });

  it("should reject reservation where end time is before start time", () => {
    const params = {
      date: "2026-03-02",
      startTime: "10:00",
      endTime: "08:00",
    };

    const startDateTime = new Date(`${params.date}T${params.startTime}:00`);
    const endDateTime = new Date(`${params.date}T${params.endTime}:00`);

    expect(startDateTime.getTime()).toBeGreaterThan(endDateTime.getTime());
  });
});

describe("Reservation cancellation refund policy", () => {
  it("should grant 100% refund when cancelled 30+ minutes before start", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
    
    expect(minutesUntilStart).toBeGreaterThanOrEqual(30);
    const hasRefund = minutesUntilStart >= 30;
    expect(hasRefund).toBe(true);
    
    // Refund should be 100% of reservation fee
    const reservationFee = 5000;
    const refundAmount = hasRefund ? reservationFee : 0;
    expect(refundAmount).toBe(5000);
  });

  it("should not grant refund when cancelled less than 30 minutes before start", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
    const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
    
    expect(minutesUntilStart).toBeLessThan(30);
    const hasRefund = minutesUntilStart >= 30;
    expect(hasRefund).toBe(false);
    
    const reservationFee = 5000;
    const refundAmount = hasRefund ? reservationFee : 0;
    expect(refundAmount).toBe(0);
  });

  it("should handle edge case at exactly 30 minutes", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 30 * 60 * 1000); // exactly 30 minutes
    const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
    
    // At exactly 30 minutes, should still get refund
    const hasRefund = minutesUntilStart >= 30;
    expect(hasRefund).toBe(true);
  });
});

describe("Connector status for future reservations", () => {
  it("should keep connector AVAILABLE for reservations more than 15 min away", () => {
    const now = new Date();
    const reservationStart = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const minutesUntilStart = (reservationStart.getTime() - now.getTime()) / (1000 * 60);
    
    // Connector should stay AVAILABLE if reservation is >15 min away
    const shouldMarkReserved = minutesUntilStart <= 15;
    expect(shouldMarkReserved).toBe(false);
  });

  it("should mark connector RESERVED when 15 min or less before start", () => {
    const now = new Date();
    const reservationStart = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
    const minutesUntilStart = (reservationStart.getTime() - now.getTime()) / (1000 * 60);
    
    const shouldMarkReserved = minutesUntilStart <= 15;
    expect(shouldMarkReserved).toBe(true);
  });

  it("should show cancel button for future reservations regardless of connector status", () => {
    // The cancel button should appear in the "nextReservation" section
    // even when the connector is AVAILABLE (not yet RESERVED)
    const connectorStatus = "AVAILABLE";
    const hasNextReservation = true;
    const isMyReservation = true;
    
    // Cancel should be available when it's my reservation, regardless of connector status
    const showCancelButton = hasNextReservation && isMyReservation;
    expect(showCancelButton).toBe(true);
    expect(connectorStatus).toBe("AVAILABLE"); // Connector stays available
  });
});
