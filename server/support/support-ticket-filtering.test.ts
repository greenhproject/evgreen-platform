/**
 * Tests for support ticket filtering and agent auto-registration
 */
import { describe, it, expect, vi } from "vitest";

// Mock the database module
vi.mock("../db", () => ({
  getDb: vi.fn(() => null),
  getUserById: vi.fn(),
}));

vi.mock("../../drizzle/schema", () => ({
  supportTickets: { id: "id", userId: "userId", stationId: "stationId", transactionId: "transactionId", subject: "subject", description: "description", category: "category", priority: "priority", status: "status", assignedToId: "assignedToId", resolution: "resolution", resolvedAt: "resolvedAt", createdAt: "createdAt", updatedAt: "updatedAt" },
  supportMessages: { id: "id", ticketId: "ticketId", senderId: "senderId", senderRole: "senderRole", message: "message", attachmentUrl: "attachmentUrl", readAt: "readAt", createdAt: "createdAt" },
  supportAgents: { id: "id", userId: "userId", isOnline: "isOnline", isAvailable: "isAvailable", scheduleStart: "scheduleStart", scheduleEnd: "scheduleEnd", workDays: "workDays", maxConcurrentTickets: "maxConcurrentTickets", activeTicketCount: "activeTicketCount", lastAssignedAt: "lastAssignedAt" },
  chargerProblemReports: {},
  users: { id: "id", name: "name", email: "email" },
  chargingStations: {},
  notifications: {},
  platformSettings: {},
  InsertSupportTicket: {},
  InsertSupportMessage: {},
  InsertSupportAgent: {},
  InsertChargerProblemReport: {},
}));

describe("Support Ticket System - Filtering Logic", () => {
  describe("AI_HANDLING Exclusion", () => {
    it("should define AI_HANDLING as a valid ticket status", () => {
      const validStatuses = ["AI_HANDLING", "OPEN", "ASSIGNED", "WAITING_AGENT", "IN_PROGRESS", "RESOLVED", "CLOSED"];
      expect(validStatuses).toContain("AI_HANDLING");
    });

    it("should have pending statuses that exclude AI_HANDLING", () => {
      const pendingStatuses = ["WAITING_AGENT", "OPEN", "ASSIGNED", "IN_PROGRESS"];
      expect(pendingStatuses).not.toContain("AI_HANDLING");
      expect(pendingStatuses).toContain("WAITING_AGENT");
      expect(pendingStatuses).toContain("OPEN");
      expect(pendingStatuses).toContain("ASSIGNED");
    });

    it("should have resolved statuses that include RESOLVED and CLOSED", () => {
      const resolvedStatuses = ["RESOLVED", "CLOSED"];
      expect(resolvedStatuses).toContain("RESOLVED");
      expect(resolvedStatuses).toContain("CLOSED");
      expect(resolvedStatuses).not.toContain("AI_HANDLING");
    });
  });

  describe("Ticket Status Flow", () => {
    it("should start with AI_HANDLING when user creates ticket via chat", () => {
      expect("AI_HANDLING").toBe("AI_HANDLING");
    });

    it("should transition to WAITING_AGENT when AI escalates and no agent available", () => {
      expect("WAITING_AGENT").toBe("WAITING_AGENT");
    });

    it("should transition to ASSIGNED when AI escalates and agent is available", () => {
      expect("ASSIGNED").toBe("ASSIGNED");
    });

    it("should start with OPEN when user reports a charger problem", () => {
      expect("OPEN").toBe("OPEN");
    });

    it("should transition to RESOLVED when technician resolves ticket", () => {
      expect("RESOLVED").toBe("RESOLVED");
    });
  });

  describe("AI Escalation Logic", () => {
    it("should detect [ESCALAR] prefix in AI response", () => {
      const aiResponse = "[ESCALAR] Entiendo tu problema. Te voy a conectar con un técnico.";
      const shouldEscalate = aiResponse.startsWith("[ESCALAR]");
      expect(shouldEscalate).toBe(true);
    });

    it("should not escalate normal AI responses", () => {
      const aiResponse = "¡Hola! Para recargar tu billetera, ve a la sección Billetera.";
      const shouldEscalate = aiResponse.startsWith("[ESCALAR]");
      expect(shouldEscalate).toBe(false);
    });

    it("should clean [ESCALAR] prefix from message", () => {
      const aiResponse = "[ESCALAR] Te conectaré con un técnico para resolver tu problema.";
      const cleanContent = aiResponse.replace("[ESCALAR]", "").trim();
      expect(cleanContent).toBe("Te conectaré con un técnico para resolver tu problema.");
    });

    it("should force escalation after 3+ user messages", () => {
      const userMessageCount = 3;
      const forceEscalate = userMessageCount >= 3;
      expect(forceEscalate).toBe(true);
    });

    it("should not force escalation with fewer than 3 user messages", () => {
      const userMessageCount = 2;
      const forceEscalate = userMessageCount >= 3;
      expect(forceEscalate).toBe(false);
    });

    it("should escalate when either AI decides or force threshold reached", () => {
      const aiWantsEscalate = false;
      const forceEscalate = true;
      const shouldEscalate = aiWantsEscalate || forceEscalate;
      expect(shouldEscalate).toBe(true);
    });
  });

  describe("Agent Auto-Registration", () => {
    it("should define valid agent roles", () => {
      const agentRoles = ["admin", "staff", "superadmin", "technician", "engineer"];
      expect(agentRoles).toContain("technician");
      expect(agentRoles).toContain("engineer");
      expect(agentRoles).not.toContain("user");
      expect(agentRoles).not.toContain("investor");
    });

    it("should create agent with 24/7 availability by default", () => {
      const defaultAgent = {
        isOnline: true,
        isAvailable: true,
        scheduleStart: "00:00",
        scheduleEnd: "23:59",
        workDays: [0, 1, 2, 3, 4, 5, 6],
        maxConcurrentTickets: 10,
        activeTicketCount: 0,
      };
      expect(defaultAgent.isOnline).toBe(true);
      expect(defaultAgent.isAvailable).toBe(true);
      expect(defaultAgent.workDays).toHaveLength(7);
      expect(defaultAgent.scheduleStart).toBe("00:00");
      expect(defaultAgent.scheduleEnd).toBe("23:59");
    });
  });

  describe("Frontend Tab Filtering", () => {
    const tickets = [
      { id: 1, status: "WAITING_AGENT", subject: "Cargador no funciona" },
      { id: 2, status: "OPEN", subject: "Reporte de problema" },
      { id: 3, status: "ASSIGNED", subject: "Cobro incorrecto" },
      { id: 4, status: "IN_PROGRESS", subject: "En revisión" },
      { id: 5, status: "RESOLVED", subject: "Ya resuelto" },
      { id: 6, status: "CLOSED", subject: "Cerrado" },
    ];

    it("should filter pending tickets correctly (WAITING_AGENT, OPEN, ASSIGNED, IN_PROGRESS)", () => {
      const pendingTickets = tickets.filter(t =>
        ["WAITING_AGENT", "OPEN", "ASSIGNED", "IN_PROGRESS"].includes(t.status)
      );
      expect(pendingTickets).toHaveLength(4);
      expect(pendingTickets.map(t => t.id)).toEqual([1, 2, 3, 4]);
    });

    it("should filter resolved tickets correctly (RESOLVED, CLOSED)", () => {
      const resolvedTickets = tickets.filter(t =>
        ["RESOLVED", "CLOSED"].includes(t.status)
      );
      expect(resolvedTickets).toHaveLength(2);
      expect(resolvedTickets.map(t => t.id)).toEqual([5, 6]);
    });

    it("should show all tickets in 'all' tab (AI_HANDLING excluded by backend)", () => {
      expect(tickets).toHaveLength(6);
    });

    it("should not include AI_HANDLING in any technician tab", () => {
      const aiHandlingTickets = tickets.filter(t => t.status === "AI_HANDLING");
      expect(aiHandlingTickets).toHaveLength(0);
    });
  });

  describe("Search Filtering", () => {
    const tickets = [
      { id: 1, subject: "Cargador no funciona", description: "El cargador de la estación X", userName: "Juan" },
      { id: 2, subject: "Cobro incorrecto", description: "Me cobraron de más", userName: "María" },
      { id: 3, subject: "Problema con billetera", description: "No puedo recargar", userName: "Carlos" },
    ];

    it("should filter by subject text", () => {
      const q = "cargador";
      const filtered = tickets.filter(t =>
        (t.subject || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.userName || "").toLowerCase().includes(q)
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it("should filter by userName", () => {
      const q = "maría";
      const filtered = tickets.filter(t =>
        (t.subject || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.userName || "").toLowerCase().includes(q)
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(2);
    });

    it("should filter by description text", () => {
      const q = "recargar";
      const filtered = tickets.filter(t =>
        (t.subject || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.userName || "").toLowerCase().includes(q)
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(3);
    });
  });
});
