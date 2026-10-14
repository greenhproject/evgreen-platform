/**
 * Encontrado al validar en un dispositivo real el fix del badge (PR #30):
 * el botón "Enviar notificación de prueba" (push.sendTestNotification) solo
 * llamaba a sendUserPushDetailed, sin crear nunca un registro en
 * `notifications` — a diferencia de cualquier flujo real (ej. "carga
 * completada" en server/_core/index.ts), que siempre crea el registro
 * interno Y el push juntos. Resultado real observado: enviar varias
 * notificaciones de prueba no movía ni la campanita interna ni el badge
 * del ícono, ni una sola vez.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, TEST_USER_ID } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue("mock-message-id"),
  TEST_USER_ID: 999900003,
}));

vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    messaging: vi.fn(() => ({ send: sendMock })),
  },
}));

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getUserById: vi.fn().mockResolvedValue({ id: TEST_USER_ID, fcmToken: null, pushSubscription: null }),
  };
});

vi.mock("./push-device-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./push-device-service")>();
  return {
    ...actual,
    getActivePushDevicesForUser: vi.fn().mockResolvedValue([{ token: "fake-device-token" }]),
  };
});

import { getDb, getUnreadNotificationCount } from "../db";
import { notifications, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { appRouter } from "../routers";

// push-router.ts's sendTestNotification hace su propia consulta a `users`
// (no pasa por el getUserById mockeado arriba), así que necesita una fila
// real para no devolver "Usuario no encontrado" antes de llegar al código
// que se está probando.
async function setup() {
  const db = (await getDb())!;
  await db.insert(users).values({
    id: TEST_USER_ID,
    openId: `test-openid-${TEST_USER_ID}`,
    name: "Usuario de prueba",
    email: `test-${TEST_USER_ID}@example.com`,
  });
}

async function cleanup() {
  const db = (await getDb())!;
  await db.delete(notifications).where(eq(notifications.userId, TEST_USER_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
}

function callerAsTestUser() {
  const ctx = {
    user: { id: TEST_USER_ID, name: "Usuario de prueba" } as any,
    req: { protocol: "https", headers: {} } as any,
    res: {} as any,
  };
  return appRouter.createCaller(ctx);
}

describe("push.sendTestNotification crea un registro real, no solo el push", () => {
  beforeEach(async () => {
    await cleanup();
    await setup();
  });
  afterEach(cleanup);

  it("una llamada deja exactamente 1 notificación sin leer para el usuario", async () => {
    const caller = callerAsTestUser();
    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(0);

    await caller.push.sendTestNotification();

    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(1);
  });

  it("4 llamadas seguidas dejan 4 notificaciones sin leer — el escenario exacto que reportó Leonardo en su teléfono", async () => {
    const caller = callerAsTestUser();

    await caller.push.sendTestNotification();
    await caller.push.sendTestNotification();
    await caller.push.sendTestNotification();
    await caller.push.sendTestNotification();

    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(4);

    const db = (await getDb())!;
    const rows = await db.select().from(notifications).where(eq(notifications.userId, TEST_USER_ID));
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.isRead === 0)).toBe(true);
  });

  it("el conteo baja al marcar como leída la notificación de prueba creada", async () => {
    const caller = callerAsTestUser();
    await caller.push.sendTestNotification();
    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(1);

    const db = (await getDb())!;
    const [row] = await db.select().from(notifications).where(eq(notifications.userId, TEST_USER_ID)).limit(1);
    await caller.notifications.markAsRead({ id: row!.id });

    expect(await getUnreadNotificationCount(TEST_USER_ID)).toBe(0);
  });
});
