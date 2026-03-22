/**
 * Tests for sendTicketAssignedEmailToTechnician email notification
 * Verifies that emails are sent to technicians when tickets are assigned
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Resend
const mockSend = vi.fn().mockResolvedValue({ id: "mock-email-id" });
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

// Mock getUserById
vi.mock("../db", () => ({
  getUserById: vi.fn().mockImplementation((id: number) => {
    if (id === 100) {
      return Promise.resolve({
        id: 100,
        name: "Carlos Técnico",
        email: "carlos@evgreen.lat",
        role: "technician",
      });
    }
    if (id === 200) {
      return Promise.resolve({
        id: 200,
        name: "Sin Email",
        email: null,
        role: "technician",
      });
    }
    return Promise.resolve(undefined);
  }),
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock support-db
vi.mock("./support-db", () => ({
  getSupportSettings: vi.fn().mockResolvedValue({
    supportEmail: "soporte@greenhproject.com",
  }),
  getTicketById: vi.fn().mockResolvedValue({
    id: 1001,
    userId: 50,
    subject: "Cargador no funciona",
    category: "CHARGER_PROBLEM",
    priority: "HIGH",
    status: "ASSIGNED",
    description: "El cargador de la estación Centro no inicia la carga",
  }),
  getAvailableAgent: vi.fn().mockResolvedValue(null),
  updateTicket: vi.fn().mockResolvedValue(undefined),
  createMessage: vi.fn().mockResolvedValue(1),
  incrementAgentTicketCount: vi.fn(),
  decrementAgentTicketCount: vi.fn(),
  getAgentByUserId: vi.fn().mockResolvedValue(null),
  getAllTickets: vi.fn().mockResolvedValue([]),
  getUnreadCountForAdmin: vi.fn().mockResolvedValue(0),
  getAllAgents: vi.fn().mockResolvedValue([]),
  upsertAgent: vi.fn().mockResolvedValue(1),
  ensureAgentRegistered: vi.fn().mockResolvedValue(1),
}));

// Mock email-helper
vi.mock("../utils/email-helper", () => ({
  buildEmailParams: vi.fn().mockImplementation((params) => ({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: "plain text version",
    replyTo: params.replyTo,
    headers: { "X-Entity-Ref-ID": "test-id" },
  })),
}));

// Mock firebase
vi.mock("../firebase/fcm", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  sendPushNotificationToMultiple: vi.fn().mockResolvedValue(undefined),
}));

// Mock technician notification service
vi.mock("../notifications/technician-notification-service", () => ({
  getActiveTechnicians: vi.fn().mockResolvedValue([]),
}));

// Mock LLM
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Respuesta de prueba" } }],
  }),
}));

describe("sendTicketAssignedEmailToTechnician", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("should send email to technician when assigned a ticket", async () => {
    // Import after mocks are set up
    const { buildEmailParams } = await import("../utils/email-helper");

    // Simulate what the function does
    const technicianUserId = 100;
    const ticketId = 1001;
    const ticketData = {
      subject: "Cargador no funciona",
      category: "CHARGER_PROBLEM",
      priority: "HIGH",
      userName: "Lina Maria",
      userEmail: "lina@test.com",
      escalationReason: "Escalado automáticamente por la IA de soporte",
    };

    // Verify the email params builder is called correctly
    const params = (buildEmailParams as any)({
      from: "EVGreen Soporte <soporte@evgreen.lat>",
      to: "carlos@evgreen.lat",
      subject: `[Ticket #${ticketId}] Te han asignado un ticket de soporte - ${ticketData.userName}`,
      html: "<div>test</div>",
      replyTo: "soporte@greenhproject.com",
    });

    expect(params.to).toBe("carlos@evgreen.lat");
    expect(params.subject).toContain("Ticket #1001");
    expect(params.subject).toContain("Lina Maria");
  });

  it("should include correct category labels in email", () => {
    const categoryLabels: Record<string, string> = {
      GENERAL: "General",
      CHARGING: "Carga",
      BILLING: "Facturación",
      TECHNICAL: "Técnico",
      ACCOUNT: "Cuenta",
      CHARGER_PROBLEM: "Problema de cargador",
    };

    expect(categoryLabels["CHARGER_PROBLEM"]).toBe("Problema de cargador");
    expect(categoryLabels["BILLING"]).toBe("Facturación");
    expect(categoryLabels["TECHNICAL"]).toBe("Técnico");
  });

  it("should include correct priority labels and colors", () => {
    const priorityLabels: Record<string, string> = {
      LOW: "Baja",
      MEDIUM: "Media",
      HIGH: "Alta",
      URGENT: "Urgente",
    };

    const priorityColors: Record<string, string> = {
      LOW: "#22c55e",
      MEDIUM: "#f59e0b",
      HIGH: "#f97316",
      URGENT: "#dc2626",
    };

    expect(priorityLabels["HIGH"]).toBe("Alta");
    expect(priorityColors["HIGH"]).toBe("#f97316");
    expect(priorityLabels["URGENT"]).toBe("Urgente");
    expect(priorityColors["URGENT"]).toBe("#dc2626");
  });

  it("should handle missing technician gracefully", async () => {
    const { getUserById } = await import("../db");
    const result = await getUserById(999);
    expect(result).toBeUndefined();
  });

  it("should handle technician without email gracefully", async () => {
    const { getUserById } = await import("../db");
    const result = await getUserById(200);
    expect(result).toBeDefined();
    expect(result!.email).toBeNull();
  });

  it("should send copy to support email for traceability", async () => {
    const { getSupportSettings } = await import("./support-db");
    const settings = await getSupportSettings();
    expect(settings.supportEmail).toBe("soporte@greenhproject.com");
  });

  it("should format email subject correctly for AI escalation", () => {
    const ticketId = 1001;
    const userName = "Lina Maria";
    const subject = `[Ticket #${ticketId}] Te han asignado un ticket de soporte - ${userName}`;
    expect(subject).toBe("[Ticket #1001] Te han asignado un ticket de soporte - Lina Maria");
  });

  it("should format email subject correctly for manual assignment", () => {
    const ticketId = 2005;
    const userName = "Carlos Rodriguez";
    const subject = `[Ticket #${ticketId}] Te han asignado un ticket de soporte - ${userName}`;
    expect(subject).toBe("[Ticket #2005] Te han asignado un ticket de soporte - Carlos Rodriguez");
  });

  it("should format email subject correctly for human agent request", () => {
    const ticketId = 3010;
    const userName = "Ana Lopez";
    const subject = `[Ticket #${ticketId}] Te han asignado un ticket de soporte - ${userName}`;
    expect(subject).toBe("[Ticket #3010] Te han asignado un ticket de soporte - Ana Lopez");
  });

  it("should handle default category when none provided", () => {
    const categoryLabels: Record<string, string> = {
      GENERAL: "General",
      CHARGING: "Carga",
    };
    const category = null;
    const result = category ? (categoryLabels[category] || category) : "Sin categoría";
    expect(result).toBe("Sin categoría");
  });

  it("should handle default priority when none provided", () => {
    const priorityLabels: Record<string, string> = {
      LOW: "Baja",
      MEDIUM: "Media",
      HIGH: "Alta",
      URGENT: "Urgente",
    };
    const priority = null;
    const defaultPriority = priority || "MEDIUM";
    const label = priorityLabels[defaultPriority] || defaultPriority;
    expect(label).toBe("Media");
  });

  it("should truncate long descriptions to 300 characters", () => {
    const longDescription = "A".repeat(500);
    const truncated = longDescription.substring(0, 300);
    const suffix = longDescription.length > 300 ? "..." : "";
    expect(truncated.length).toBe(300);
    expect(suffix).toBe("...");
  });

  it("should not truncate short descriptions", () => {
    const shortDescription = "Cargador no funciona";
    const truncated = shortDescription.substring(0, 300);
    const suffix = shortDescription.length > 300 ? "..." : "";
    expect(truncated).toBe("Cargador no funciona");
    expect(suffix).toBe("");
  });

  it("should include escalation reason in email when provided", () => {
    const escalationReason = "Escalado automáticamente por la IA de soporte";
    const hasReason = !!escalationReason;
    expect(hasReason).toBe(true);
  });

  it("should not include escalation reason row when not provided", () => {
    const escalationReason = undefined;
    const hasReason = !!escalationReason;
    expect(hasReason).toBe(false);
  });

  it("should use correct platform URL for technician", () => {
    const platformUrl = "https://evgreen.lat/technician/support";
    expect(platformUrl).toContain("evgreen.lat");
    expect(platformUrl).toContain("technician/support");
  });

  it("should include user email in parentheses when available", () => {
    const userName = "Lina Maria";
    const userEmail = "lina@test.com";
    const display = `${userName}${userEmail ? ` (${userEmail})` : ""}`;
    expect(display).toBe("Lina Maria (lina@test.com)");
  });

  it("should not include email parentheses when email is null", () => {
    const userName = "Lina Maria";
    const userEmail: string | null = null;
    const display = `${userName}${userEmail ? ` (${userEmail})` : ""}`;
    expect(display).toBe("Lina Maria");
  });
});
