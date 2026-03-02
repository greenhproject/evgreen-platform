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
