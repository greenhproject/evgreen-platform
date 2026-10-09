/**
 * Cubre los escenarios reales del badge numérico del ícono de la app:
 * - server/db.ts: getUnreadNotificationCount cuenta exactamente lo que hay
 *   en la base (0, varias, después de marcar como leídas).
 * - server/firebase/fcm.ts: el payload APNs usa el conteo real cuando se
 *   indica, y el valor histórico (1) cuando no — tanto para un solo
 *   destinatario como para el envío multicast (donde se documenta por qué
 *   sigue fijo en 1 a propósito).
 * - server/push/unified-push.ts: sendUserPushDetailed consulta el conteo
 *   real del usuario antes de armar el payload, no un valor fijo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 999900001;

// vi.mock se hoistea por encima de TODO el módulo, incluyendo const
// declarados antes en el archivo — cualquier valor que una factory necesite
// debe pasar por vi.hoisted() para sobrevivir ese reordenamiento.
const { sendMock, sendEachForMulticastMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue("mock-message-id"),
  sendEachForMulticastMock: vi.fn().mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    responses: [{ success: true }],
  }),
}));

vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    messaging: vi.fn(() => ({
      send: sendMock,
      sendEachForMulticast: sendEachForMulticastMock,
    })),
  },
}));

// sendUserPushDetailed necesita un usuario real (getUserById) y al menos un
// dispositivo activo (getActivePushDevicesForUser) para llegar hasta FCM —
// se simulan ambos, dejando el resto de cada módulo real (incluyendo
// getUnreadNotificationCount, que es justo lo que este archivo verifica).
vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getUserById: vi.fn().mockResolvedValue({ id: 999900001, fcmToken: null, pushSubscription: null }),
  };
});

vi.mock("./push-device-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./push-device-service")>();
  return {
    ...actual,
    getActivePushDevicesForUser: vi.fn().mockResolvedValue([{ token: "fake-device-token" }]),
  };
});

import { getDb } from "../db";
import { notifications, pushDeliveryEvents } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getUnreadNotificationCount } from "../db";
import { sendPushNotificationDetailed, sendPushNotificationToMultiple } from "../firebase/fcm";
import { sendUserPushDetailed } from "./unified-push";

async function insertNotification(isRead: 0 | 1) {
  const db = (await getDb())!;
  await db.insert(notifications).values({
    userId: TEST_USER_ID,
    title: "Prueba de badge",
    message: "Mensaje de prueba para el conteo de no leídas",
    type: "SYSTEM",
    isRead,
  });
}

async function cleanupTestNotifications() {
  const db = (await getDb())!;
  await db.delete(notifications).where(eq(notifications.userId, TEST_USER_ID));
  await db.delete(pushDeliveryEvents).where(eq(pushDeliveryEvents.userId, TEST_USER_ID));
}

describe("getUnreadNotificationCount", () => {
  beforeEach(cleanupTestNotifications);
  afterEach(cleanupTestNotifications);

  it("retorna 0 para un usuario sin notificaciones", async () => {
    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(0);
  });

  it("retorna 0 cuando todas las notificaciones ya están leídas", async () => {
    await insertNotification(1);
    await insertNotification(1);
    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(0);
  });

  it("cuenta solo las no leídas cuando hay una mezcla de leídas y no leídas", async () => {
    await insertNotification(0);
    await insertNotification(0);
    await insertNotification(1);
    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(2);
  });

  it("refleja el conteo correcto tras marcar todas como leídas", async () => {
    await insertNotification(0);
    await insertNotification(0);
    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(2);

    const db = (await getDb())!;
    await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.userId, TEST_USER_ID));
    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(0);
  });
});

describe("fcm.ts — badge en el payload APNs", () => {
  beforeEach(() => {
    sendMock.mockClear();
    sendEachForMulticastMock.mockClear();
  });

  it("sendPushNotificationDetailed usa badgeCount cuando se indica", async () => {
    await sendPushNotificationDetailed("fake-token", {
      type: "charging_complete",
      title: "Carga completada",
      body: "Listo",
      badgeCount: 7,
    });
    const sentMessage = sendMock.mock.calls[0][0];
    expect(sentMessage.apns.payload.aps.badge).toBe(7);
  });

  it("sendPushNotificationDetailed acepta 0 como valor real (no lo confunde con \"sin indicar\")", async () => {
    await sendPushNotificationDetailed("fake-token", {
      type: "charging_complete",
      title: "Carga completada",
      body: "Listo",
      badgeCount: 0,
    });
    const sentMessage = sendMock.mock.calls[0][0];
    expect(sentMessage.apns.payload.aps.badge).toBe(0);
  });

  it("sendPushNotificationDetailed usa 1 por compatibilidad si no se indica badgeCount", async () => {
    await sendPushNotificationDetailed("fake-token", {
      type: "charging_complete",
      title: "Carga completada",
      body: "Listo",
    });
    const sentMessage = sendMock.mock.calls[0][0];
    expect(sentMessage.apns.payload.aps.badge).toBe(1);
  });

  it("sendPushNotificationToMultiple mantiene badge fijo en 1 (sin userId único por token)", async () => {
    await sendPushNotificationToMultiple(["token-a", "token-b"], {
      type: "promotion",
      title: "Promo",
      body: "Oferta",
    });
    const sentMessage = sendEachForMulticastMock.mock.calls[0][0];
    expect(sentMessage.apns.payload.aps.badge).toBe(1);
  });
});

describe("unified-push.ts — sendUserPushDetailed consulta el conteo real antes de enviar", () => {
  beforeEach(async () => {
    sendMock.mockClear();
    await cleanupTestNotifications();
  });
  afterEach(cleanupTestNotifications);

  it("pasa el conteo real de no leídas como badgeCount al enviar FCM", async () => {
    await insertNotification(0);
    await insertNotification(0);
    await insertNotification(0);

    const result = await sendUserPushDetailed(TEST_USER_ID, {
      type: "charging_complete",
      title: "Carga completada",
      body: "Tu vehículo está listo",
    });

    expect(result.attempted).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentMessage = sendMock.mock.calls[0][0];
    expect(sentMessage.apns.payload.aps.badge).toBe(3);
  });

  it("refleja 0 cuando el usuario no tiene notificaciones sin leer", async () => {
    await sendUserPushDetailed(TEST_USER_ID, {
      type: "charging_complete",
      title: "Carga completada",
      body: "Tu vehículo está listo",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentMessage = sendMock.mock.calls[0][0];
    expect(sentMessage.apns.payload.aps.badge).toBe(0);
  });
});
