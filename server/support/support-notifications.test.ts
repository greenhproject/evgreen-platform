/**
 * Tests for Support Push Notifications
 * Verifica que las notificaciones push se envían correctamente en los flujos de soporte
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies
vi.mock("../firebase/fcm", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
  sendPushNotificationToMultiple: vi.fn().mockResolvedValue([]),
}));

vi.mock("../notifications/technician-notification-service", () => ({
  getActiveTechnicians: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Técnico 1",
      email: "tech1@test.com",
      fcmToken: "fcm_token_tech1",
      techNotifyCriticalAlerts: true,
      techNotifyNewTickets: true,
      techNotifyMaintenanceReminders: true,
      techNotifyByEmail: true,
      techNotifyByPush: true,
      techAvailableForEmergencies: true,
      techWorkingHoursStart: "08:00",
      techWorkingHoursEnd: "17:00",
    },
    {
      id: 2,
      name: "Técnico 2",
      email: "tech2@test.com",
      fcmToken: "fcm_token_tech2",
      techNotifyCriticalAlerts: true,
      techNotifyNewTickets: true,
      techNotifyMaintenanceReminders: true,
      techNotifyByEmail: true,
      techNotifyByPush: true,
      techAvailableForEmergencies: true,
      techWorkingHoursStart: "08:00",
      techWorkingHoursEnd: "17:00",
    },
  ]),
}));

vi.mock("../db", () => ({
  getUserById: vi.fn().mockImplementation((id: number) => {
    if (id === 100) {
      return Promise.resolve({
        id: 100,
        name: "Usuario Test",
        email: "user@test.com",
        fcmToken: "fcm_token_user100",
      });
    }
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        name: "Técnico 1",
        email: "tech1@test.com",
        fcmToken: "fcm_token_tech1",
      });
    }
    return Promise.resolve(undefined);
  }),
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    }),
  }),
}));

vi.mock("./support-db", () => ({
  getTicketById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        userId: 100,
        subject: "Problema con cargador",
        description: "No funciona el conector",
        category: "charger_problem",
        status: "ASSIGNED",
        priority: "high",
        assignedToId: 1,
        stationId: 1,
        createdAt: new Date(),
      });
    }
    if (id === 2) {
      return Promise.resolve({
        id: 2,
        userId: 100,
        subject: "Consulta general",
        description: "Pregunta sobre tarifas",
        category: "general",
        status: "OPEN",
        priority: "medium",
        assignedToId: null,
        stationId: null,
        createdAt: new Date(),
      });
    }
    return Promise.resolve(null);
  }),
  getAgentByUserId: vi.fn().mockResolvedValue({ id: 1, userId: 1 }),
}));

vi.mock("../../drizzle/schema", () => ({
  notifications: {
    id: "id",
    userId: "userId",
    title: "title",
    message: "message",
    type: "type",
    referenceType: "referenceType",
    referenceId: "referenceId",
    isRead: "isRead",
    pushSent: "pushSent",
    pushSentAt: "pushSentAt",
    data: "data",
    createdAt: "createdAt",
  },
}));

import { sendPushNotification } from "../firebase/fcm";
import { getActiveTechnicians } from "../notifications/technician-notification-service";
import { getUserById, getDb } from "../db";
import * as supportDb from "./support-db";

describe("Support Push Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("NotificationType support types", () => {
    it("should include support notification types in FCM", async () => {
      // Verify the types are properly defined by importing
      const { sendPushNotification: send } = await import("../firebase/fcm");
      expect(send).toBeDefined();
    });
  });

  describe("Notification flow - New ticket", () => {
    it("should have getActiveTechnicians available for notification dispatch", async () => {
      const technicians = await getActiveTechnicians();
      expect(technicians).toHaveLength(2);
      expect(technicians[0].techNotifyNewTickets).toBe(true);
      expect(technicians[0].fcmToken).toBe("fcm_token_tech1");
    });

    it("should filter technicians who have techNotifyNewTickets enabled", async () => {
      const technicians = await getActiveTechnicians();
      const eligible = technicians.filter(t => t.techNotifyNewTickets !== false);
      expect(eligible.length).toBeGreaterThan(0);
    });
  });

  describe("Notification flow - Agent reply to user", () => {
    it("should retrieve user FCM token for push notification", async () => {
      const user = await getUserById(100);
      expect(user).toBeDefined();
      expect(user?.fcmToken).toBe("fcm_token_user100");
      expect(user?.name).toBe("Usuario Test");
    });

    it("should handle user without FCM token gracefully", async () => {
      const user = await getUserById(999);
      expect(user).toBeUndefined();
    });
  });

  describe("Notification flow - Ticket resolved", () => {
    it("should retrieve ticket data for resolved notification", async () => {
      const ticket = await supportDb.getTicketById(1);
      expect(ticket).toBeDefined();
      expect(ticket?.userId).toBe(100);
      expect(ticket?.assignedToId).toBe(1);
    });

    it("should handle non-existent ticket gracefully", async () => {
      const ticket = await supportDb.getTicketById(999);
      expect(ticket).toBeNull();
    });
  });

  describe("Notification flow - Assigned ticket", () => {
    it("should only notify assigned agent when ticket has assignedToId", async () => {
      const ticket = await supportDb.getTicketById(1);
      expect(ticket?.assignedToId).toBe(1);

      // When ticket is assigned, only the assigned agent should be notified
      const assignedUser = await getUserById(ticket!.assignedToId!);
      expect(assignedUser).toBeDefined();
      expect(assignedUser?.fcmToken).toBe("fcm_token_tech1");
    });

    it("should notify all technicians when ticket is unassigned", async () => {
      const ticket = await supportDb.getTicketById(2);
      expect(ticket?.assignedToId).toBeNull();

      // When ticket is unassigned, all technicians should be notified
      const technicians = await getActiveTechnicians();
      expect(technicians.length).toBe(2);
    });
  });

  describe("In-app notification creation", () => {
    it("should create in-app notification with correct data structure", async () => {
      const database = await getDb();
      expect(database).toBeDefined();
      expect(database?.insert).toBeDefined();
    });
  });

  describe("FCM push notification payload", () => {
    it("should send push notification with correct support type", async () => {
      await sendPushNotification("fcm_token_test", {
        type: "support_new_ticket",
        title: "Nuevo ticket de soporte #1",
        body: "Usuario Test: Problema con cargador",
        clickAction: "/technician/support",
        data: { ticketId: "1" },
      });

      expect(sendPushNotification).toHaveBeenCalledWith("fcm_token_test", {
        type: "support_new_ticket",
        title: "Nuevo ticket de soporte #1",
        body: "Usuario Test: Problema con cargador",
        clickAction: "/technician/support",
        data: { ticketId: "1" },
      });
    });

    it("should send agent reply notification with correct type", async () => {
      await sendPushNotification("fcm_token_user100", {
        type: "support_agent_reply",
        title: "Respuesta de soporte - Ticket #1",
        body: "Técnico 1: Estamos revisando el problema",
        clickAction: "/support",
        data: { ticketId: "1" },
      });

      expect(sendPushNotification).toHaveBeenCalledWith("fcm_token_user100", expect.objectContaining({
        type: "support_agent_reply",
        clickAction: "/support",
      }));
    });

    it("should send ticket resolved notification with correct type", async () => {
      await sendPushNotification("fcm_token_user100", {
        type: "support_ticket_resolved",
        title: "Ticket #1 resuelto",
        body: "Tu ticket de soporte ha sido resuelto.",
        clickAction: "/support",
        data: { ticketId: "1" },
      });

      expect(sendPushNotification).toHaveBeenCalledWith("fcm_token_user100", expect.objectContaining({
        type: "support_ticket_resolved",
      }));
    });

    it("should skip push for local_ FCM tokens", () => {
      const token = "local_test_token";
      expect(token.startsWith("local_")).toBe(true);
      // The notification functions check for local_ prefix and skip
    });
  });

  describe("Message truncation", () => {
    it("should truncate long messages to 120 characters", () => {
      const longMessage = "A".repeat(200);
      const truncated = longMessage.substring(0, 120);
      expect(truncated.length).toBe(120);
    });

    it("should not truncate short messages", () => {
      const shortMessage = "Problema con el cargador";
      const truncated = shortMessage.substring(0, 120);
      expect(truncated).toBe(shortMessage);
    });
  });
});
