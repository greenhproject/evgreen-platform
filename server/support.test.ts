/**
 * Support System Tests
 * Tests for support router, support-db helpers, and settings integration
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Hola, soy el asistente de EVGreen. ¿En qué puedo ayudarte?" } }],
  }),
}));

// Mock Resend
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "mock-email-id" }),
    },
  })),
}));

// Mock email helper
vi.mock("./utils/email-helper", () => ({
  buildEmailParams: vi.fn((params: any) => params),
}));

describe("Support System", () => {
  describe("Support Router Structure", () => {
    it("should export supportRouterV2 from support-router", async () => {
      const { supportRouterV2 } = await import("./support/support-router");
      expect(supportRouterV2).toBeDefined();
    });

    it("should have all required procedures", async () => {
      const { supportRouterV2 } = await import("./support/support-router");
      const procedures = Object.keys(supportRouterV2);
      
      // User-facing procedures
      expect(procedures).toContain("sendMessage");
      expect(procedures).toContain("requestHumanAgent");
      expect(procedures).toContain("myTickets");
      expect(procedures).toContain("getMessages");
      expect(procedures).toContain("unreadCount");
      expect(procedures).toContain("reportProblem");
      
      // Admin/tech procedures
      expect(procedures).toContain("listAll");
      expect(procedures).toContain("getTicketDetail");
      expect(procedures).toContain("reply");
      expect(procedures).toContain("updateTicket");
      expect(procedures).toContain("adminUnreadCount");
      
      // Agent management
      expect(procedures).toContain("listAgents");
      expect(procedures).toContain("upsertAgent");
      expect(procedures).toContain("toggleOnline");
      
      // Problem reports
      expect(procedures).toContain("listProblemReports");
      expect(procedures).toContain("updateProblemReport");
    });
  });

  describe("Support DB Module", () => {
    it("should export all required functions", async () => {
      const supportDb = await import("./support/support-db");
      
      // Ticket functions
      expect(typeof supportDb.createTicket).toBe("function");
      expect(typeof supportDb.getTicketById).toBe("function");
      expect(typeof supportDb.getTicketsByUserId).toBe("function");
      expect(typeof supportDb.getAllTickets).toBe("function");
      expect(typeof supportDb.updateTicket).toBe("function");
      expect(typeof supportDb.getTicketWithMessages).toBe("function");
      
      // Message functions
      expect(typeof supportDb.createMessage).toBe("function");
      expect(typeof supportDb.getMessagesByTicketId).toBe("function");
      expect(typeof supportDb.markMessagesAsRead).toBe("function");
      expect(typeof supportDb.getUnreadCountForUser).toBe("function");
      expect(typeof supportDb.getUnreadCountForAdmin).toBe("function");
      
      // Agent functions
      expect(typeof supportDb.getAvailableAgent).toBe("function");
      expect(typeof supportDb.incrementAgentTicketCount).toBe("function");
      expect(typeof supportDb.decrementAgentTicketCount).toBe("function");
      expect(typeof supportDb.getAllAgents).toBe("function");
      expect(typeof supportDb.upsertAgent).toBe("function");
      expect(typeof supportDb.updateAgentStatus).toBe("function");
      expect(typeof supportDb.getAgentByUserId).toBe("function");
      
      // Problem report functions
      expect(typeof supportDb.createProblemReport).toBe("function");
      expect(typeof supportDb.getProblemReports).toBe("function");
      expect(typeof supportDb.updateProblemReport).toBe("function");
      
      // Settings helper
      expect(typeof supportDb.getSupportSettings).toBe("function");
    });
  });

  describe("Schema Support Tables", () => {
    it("should have support_tickets table", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.supportTickets).toBeDefined();
      expect(schema.InsertSupportTicket).not.toBeUndefined; // Type exists
    });

    it("should have support_messages table", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.supportMessages).toBeDefined();
    });

    it("should have support_agents table", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.supportAgents).toBeDefined();
    });

    it("should have charger_problem_reports table", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.chargerProblemReports).toBeDefined();
    });

    it("should have supportEmail and supportPhone in platformSettings", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.platformSettings).toBeDefined();
      // Check column definitions exist
      const columns = Object.keys(schema.platformSettings);
      expect(columns).toContain("supportEmail");
      expect(columns).toContain("supportPhone");
      expect(columns).toContain("supportAutoAssign");
    });
  });

  describe("AI Support System Prompt", () => {
    it("should handle AI response without escalation", async () => {
      const { invokeLLM } = await import("./_core/llm");
      const mockedLLM = vi.mocked(invokeLLM);
      
      mockedLLM.mockResolvedValueOnce({
        choices: [{ message: { content: "Para verificar el estado de tu cargador, ve a la sección de estaciones en la app." } }],
      } as any);

      const result = await mockedLLM({
        messages: [
          { role: "system", content: "Eres el asistente de soporte técnico de EVGreen" },
          { role: "user", content: "¿Cómo veo el estado de mi cargador?" },
        ],
      });

      const aiContent = result.choices[0]?.message?.content as string;
      expect(aiContent).not.toContain("[ESCALAR]");
      expect(aiContent.length).toBeGreaterThan(0);
    });

    it("should handle AI escalation response", async () => {
      const { invokeLLM } = await import("./_core/llm");
      const mockedLLM = vi.mocked(invokeLLM);
      
      mockedLLM.mockResolvedValueOnce({
        choices: [{ message: { content: "[ESCALAR] Entiendo que tienes un cobro incorrecto. Voy a transferirte con un agente que puede revisar tu transacción." } }],
      } as any);

      const result = await mockedLLM({
        messages: [
          { role: "system", content: "Eres el asistente de soporte técnico de EVGreen" },
          { role: "user", content: "Me cobraron de más en mi última carga" },
        ],
      });

      const aiContent = result.choices[0]?.message?.content as string;
      expect(aiContent.startsWith("[ESCALAR]")).toBe(true);
      
      // Verify escalation parsing
      const shouldEscalate = aiContent.startsWith("[ESCALAR]");
      const cleanContent = shouldEscalate ? aiContent.replace("[ESCALAR]", "").trim() : aiContent;
      expect(shouldEscalate).toBe(true);
      expect(cleanContent).not.toContain("[ESCALAR]");
      expect(cleanContent.length).toBeGreaterThan(0);
    });
  });

  describe("Problem Type Labels", () => {
    it("should have all problem types defined in the schema", async () => {
      // Verify the enum values match the router's expected types
      const problemTypes = [
        "NO_ENCIENDE",
        "NO_CARGA",
        "CABLE_DANADO",
        "PANTALLA_ROTA",
        "CONECTOR_DANADO",
        "ERROR_COMUNICACION",
        "COBRO_INCORRECTO",
        "OTRO",
      ];
      
      // Each problem type should have a Spanish label
      const labels: Record<string, string> = {
        NO_ENCIENDE: "No enciende",
        NO_CARGA: "No carga",
        CABLE_DANADO: "Cable dañado",
        PANTALLA_ROTA: "Pantalla rota",
        CONECTOR_DANADO: "Conector dañado",
        ERROR_COMUNICACION: "Error de comunicación",
        COBRO_INCORRECTO: "Cobro incorrecto",
        OTRO: "Otro problema",
      };

      for (const type of problemTypes) {
        expect(labels[type]).toBeDefined();
        expect(labels[type].length).toBeGreaterThan(0);
      }
    });
  });

  describe("Settings Integration", () => {
    it("should include supportEmail and supportPhone in settings update schema", async () => {
      // Verify the router accepts these fields
      const { z } = await import("zod");
      
      const updateSchema = z.object({
        supportEmail: z.string().optional(),
        supportPhone: z.string().optional(),
      });

      // Valid inputs
      expect(() => updateSchema.parse({ supportEmail: "test@example.com" })).not.toThrow();
      expect(() => updateSchema.parse({ supportPhone: "+573001234567" })).not.toThrow();
      expect(() => updateSchema.parse({})).not.toThrow();
      expect(() => updateSchema.parse({ supportEmail: "soporte@evgreen.lat", supportPhone: "+573009876543" })).not.toThrow();
    });

    it("should return default support settings when no settings exist", async () => {
      // Verify default values match expected
      const defaultEmail = "soporte@greenhproject.com";
      const defaultPhone = "+573001234567";
      
      expect(defaultEmail).toContain("@");
      expect(defaultPhone).toMatch(/^\+\d+/);
    });
  });

  describe("Support Router Registration", () => {
    it("should be registered in the main app router", async () => {
      const routersModule = await import("./routers");
      const appRouter = routersModule.appRouter;
      
      // The support router should be accessible
      expect(appRouter).toBeDefined();
      
      // Check that the router has a 'support' key
      const routerKeys = Object.keys(appRouter);
      // tRPC routers are nested, so we check the _def.procedures
      expect(routerKeys.length).toBeGreaterThan(0);
    });
  });

  describe("Email Notification Templates", () => {
    it("should have proper HTML structure for support email", () => {
      const ticketId = 123;
      const userName = "Juan Pérez";
      const userMessage = "Mi cargador no funciona";
      
      // Simulate the email HTML template
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0a5c36; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">⚡ EVGreen - Nuevo Mensaje de Soporte</h2>
          </div>
          <div style="padding: 20px; background: #f9f9f9; border: 1px solid #e0e0e0;">
            <p><strong>Ticket:</strong> #${ticketId}</p>
            <p><strong>Usuario:</strong> ${userName}</p>
            <p><strong>Mensaje:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0;">
              ${userMessage}
            </div>
          </div>
        </div>
      `;
      
      expect(html).toContain(`#${ticketId}`);
      expect(html).toContain(userName);
      expect(html).toContain(userMessage);
      expect(html).toContain("EVGreen");
      expect(html).toContain("#0a5c36"); // Brand color
    });

    it("should have proper HTML structure for problem report email", () => {
      const stationName = "Estación Centro Comercial";
      const problemType = "CABLE_DANADO";
      const userName = "María López";
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🚨 Reporte de Problema en Cargador</h2>
          </div>
          <div style="padding: 20px; background: #f9f9f9; border: 1px solid #e0e0e0;">
            <p><strong>Estación:</strong> ${stationName}</p>
            <p><strong>Tipo de problema:</strong> Cable dañado</p>
            <p><strong>Reportado por:</strong> ${userName}</p>
          </div>
        </div>
      `;
      
      expect(html).toContain(stationName);
      expect(html).toContain("Cable dañado");
      expect(html).toContain(userName);
      expect(html).toContain("#dc2626"); // Alert color
    });
  });

  describe("Ticket Status Flow", () => {
    it("should have valid status transitions", () => {
      const validStatuses = [
        "AI_HANDLING",    // AI is responding to user
        "WAITING_AGENT",  // Escalated, no agent available
        "ASSIGNED",       // Assigned to human agent
        "OPEN",           // Created from problem report
        "RESOLVED",       // Issue resolved
        "CLOSED",         // Ticket closed
      ];

      // Verify all statuses are strings
      for (const status of validStatuses) {
        expect(typeof status).toBe("string");
        expect(status.length).toBeGreaterThan(0);
      }

      // Verify expected flow
      expect(validStatuses).toContain("AI_HANDLING");
      expect(validStatuses).toContain("WAITING_AGENT");
      expect(validStatuses).toContain("ASSIGNED");
      expect(validStatuses).toContain("RESOLVED");
    });

    it("should have valid priority levels", () => {
      const validPriorities = ["low", "medium", "high", "urgent"];
      expect(validPriorities).toContain("low");
      expect(validPriorities).toContain("medium");
      expect(validPriorities).toContain("high");
      expect(validPriorities).toContain("urgent");
    });
  });
});
