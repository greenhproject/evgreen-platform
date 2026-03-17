/**
 * Support System - tRPC Router
 * Chat con IA → escalación a humano → asignación de agentes → reportes de problemas
 */
import { z } from "zod";
import { router } from "../_core/trpc";
import { publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { Resend } from "resend";
import { buildEmailParams } from "../utils/email-helper";
import * as supportDb from "./support-db";

// Role-based procedures (replicate from main routers)
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !["admin", "staff", "superadmin"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acceso denegado" });
  }
  return next({ ctx });
});

const techProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !["admin", "staff", "superadmin", "technician", "engineer"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acceso denegado" });
  }
  return next({ ctx });
});

// Resend for email notifications
const resendApiKey = process.env.RESEND_API_KEY || "";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// ============================================================================
// AI SUPPORT CHAT SYSTEM PROMPT
// ============================================================================

const AI_SUPPORT_SYSTEM_PROMPT = `Eres el asistente de soporte técnico de EVGreen, una plataforma de carga de vehículos eléctricos en Colombia.

Tu rol es ayudar a los usuarios a resolver problemas técnicos y responder preguntas sobre la plataforma.

=== TEMAS QUE PUEDES RESOLVER ===
1. Problemas de conexión con cargadores (reiniciar sesión, verificar estado)
2. Preguntas sobre tarifas, precios y facturación
3. Problemas con la billetera (recargas, saldo, transacciones)
4. Cómo usar la aplicación (escanear QR, iniciar carga, ver historial)
5. Información sobre estaciones de carga (ubicación, disponibilidad, tipos de conector)
6. Problemas con reservas y programación de cargas
7. Preguntas sobre vehículos eléctricos y compatibilidad
8. Problemas con la cuenta del usuario (perfil, notificaciones)

=== REGLAS ===
- Responde siempre en español
- Sé amable, profesional y conciso
- Si puedes resolver el problema, hazlo directamente
- Si NO puedes resolver el problema (requiere acceso a sistemas internos, es un problema técnico complejo, o el usuario necesita atención personalizada), responde EXACTAMENTE con el prefijo "[ESCALAR]" seguido de tu mensaje
- Ejemplos de cuándo escalar:
  * El usuario reporta un cargador dañado o fuera de servicio
  * El usuario tiene un cobro incorrecto que necesita reembolso
  * El usuario no puede acceder a su cuenta
  * El problema persiste después de tus sugerencias
  * El usuario pide explícitamente hablar con un humano
- NO inventes información técnica específica sobre el estado de cargadores o transacciones
- Si no tienes suficiente información, pregunta al usuario antes de escalar

=== FORMATO ===
- Usa respuestas cortas y directas (máximo 3-4 párrafos)
- Usa emojis moderadamente para ser amigable
- Ofrece pasos numerados cuando sea apropiado`;

// ============================================================================
// SUPPORT ROUTER
// ============================================================================

export const supportRouterV2 = router({
  // ========================================================================
  // USER: Send message (AI first, then human)
  // ========================================================================
  sendMessage: protectedProcedure
    .input(z.object({
      ticketId: z.number().optional(), // null = new conversation
      message: z.string().min(1).max(2000),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let ticketId = input.ticketId;

      // Create ticket if new conversation
      if (!ticketId) {
        ticketId = await supportDb.createTicket({
          userId: ctx.user.id,
          subject: input.message.substring(0, 100),
          description: input.message,
          category: input.category || "general",
          status: "AI_HANDLING",
          priority: "medium",
        });
      }

      // Save user message
      await supportDb.createMessage({
        ticketId,
        senderId: ctx.user.id,
        senderRole: "user",
        message: input.message,
      });

      // Check ticket status
      const ticket = await supportDb.getTicketById(ticketId);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      // If AI is handling, get AI response
      if (ticket.status === "AI_HANDLING") {
        // Get conversation history for context
        const messages = await supportDb.getMessagesByTicketId(ticketId);
        const conversationHistory = messages.map(m => ({
          role: m.senderRole === "user" ? "user" as const : "assistant" as const,
          content: m.message,
        }));

        try {
          const aiResponse = await invokeLLM({
            messages: [
              { role: "system", content: AI_SUPPORT_SYSTEM_PROMPT },
              ...conversationHistory,
            ],
          });

          const aiContent = typeof aiResponse.choices[0]?.message?.content === "string"
            ? aiResponse.choices[0].message.content
            : "";

          // Check if AI wants to escalate
          const shouldEscalate = aiContent.startsWith("[ESCALAR]");
          const cleanContent = shouldEscalate
            ? aiContent.replace("[ESCALAR]", "").trim()
            : aiContent;

          // Save AI response
          await supportDb.createMessage({
            ticketId,
            senderId: 0, // System/AI
            senderRole: "ai",
            message: cleanContent,
          });

          if (shouldEscalate) {
            // Try to assign to available agent
            const agent = await supportDb.getAvailableAgent();
            if (agent) {
              await supportDb.updateTicket(ticketId, {
                status: "ASSIGNED",
                assignedToId: agent.userId,
              });
              await supportDb.incrementAgentTicketCount(agent.agentId);

              // Save system message about escalation
              await supportDb.createMessage({
                ticketId,
                senderId: 0,
                senderRole: "system",
                message: "Tu conversación ha sido transferida a un agente de soporte. Te responderá en breve.",
              });

              // Send email notification
              await sendSupportEmailNotification(ticketId, input.message, ctx.user.name || "Usuario");
            } else {
              await supportDb.updateTicket(ticketId, { status: "WAITING_AGENT" });
              await supportDb.createMessage({
                ticketId,
                senderId: 0,
                senderRole: "system",
                message: "En este momento no hay agentes disponibles. Tu solicitud ha sido registrada y te responderemos lo antes posible.",
              });
              // Still send email
              await sendSupportEmailNotification(ticketId, input.message, ctx.user.name || "Usuario");
            }
          }

          return {
            ticketId,
            aiResponse: cleanContent,
            escalated: shouldEscalate,
            status: shouldEscalate ? (await supportDb.getTicketById(ticketId))?.status : "AI_HANDLING",
          };
        } catch (error) {
          console.error("[Support] AI error:", error);
          // Fallback: escalate to human
          const agent = await supportDb.getAvailableAgent();
          if (agent) {
            await supportDb.updateTicket(ticketId, { status: "ASSIGNED", assignedToId: agent.userId });
            await supportDb.incrementAgentTicketCount(agent.agentId);
          } else {
            await supportDb.updateTicket(ticketId, { status: "WAITING_AGENT" });
          }
          await supportDb.createMessage({
            ticketId,
            senderId: 0,
            senderRole: "system",
            message: "Estamos conectándote con un agente de soporte para ayudarte mejor.",
          });
          await sendSupportEmailNotification(ticketId, input.message, ctx.user.name || "Usuario");
          return {
            ticketId,
            aiResponse: "Estamos conectándote con un agente de soporte para ayudarte mejor.",
            escalated: true,
            status: "WAITING_AGENT",
          };
        }
      }

      // If already assigned to human agent, just save message and notify
      await sendSupportEmailNotification(ticketId, input.message, ctx.user.name || "Usuario");
      return {
        ticketId,
        aiResponse: null,
        escalated: false,
        status: ticket.status,
      };
    }),

  // ========================================================================
  // USER: Request human agent explicitly
  // ========================================================================
  requestHumanAgent: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await supportDb.getTicketById(input.ticketId);
      if (!ticket || ticket.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const agent = await supportDb.getAvailableAgent();
      if (agent) {
        await supportDb.updateTicket(input.ticketId, { status: "ASSIGNED", assignedToId: agent.userId });
        await supportDb.incrementAgentTicketCount(agent.agentId);
        await supportDb.createMessage({
          ticketId: input.ticketId,
          senderId: 0,
          senderRole: "system",
          message: "Tu conversación ha sido transferida a un agente de soporte humano. Te responderá en breve.",
        });
      } else {
        await supportDb.updateTicket(input.ticketId, { status: "WAITING_AGENT" });
        await supportDb.createMessage({
          ticketId: input.ticketId,
          senderId: 0,
          senderRole: "system",
          message: "En este momento no hay agentes disponibles. Tu solicitud ha sido registrada y te responderemos lo antes posible. También puedes contactarnos por teléfono.",
        });
      }

      await sendSupportEmailNotification(input.ticketId, "Usuario solicita agente humano", ctx.user.name || "Usuario");
      return { success: true, hasAgent: !!agent };
    }),

  // ========================================================================
  // USER: Get my tickets/conversations
  // ========================================================================
  myTickets: protectedProcedure.query(async ({ ctx }) => {
    return supportDb.getTicketsByUserId(ctx.user.id);
  }),

  // ========================================================================
  // USER: Get conversation messages
  // ========================================================================
  getMessages: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ ctx, input }) => {
      const ticket = await supportDb.getTicketById(input.ticketId);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      // User can only see their own tickets, agents can see assigned tickets
      const isOwner = ticket.userId === ctx.user.id;
      const isAgent = ["admin", "staff", "superadmin", "technician", "engineer"].includes(ctx.user.role);
      if (!isOwner && !isAgent) throw new TRPCError({ code: "FORBIDDEN" });

      // Mark messages as read
      const readerRole = isOwner ? "user" : "agent";
      await supportDb.markMessagesAsRead(input.ticketId, readerRole);

      const messages = await supportDb.getMessagesByTicketId(input.ticketId);
      return { ticket, messages };
    }),

  // ========================================================================
  // USER: Get unread count
  // ========================================================================
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return supportDb.getUnreadCountForUser(ctx.user.id);
  }),

  // ========================================================================
  // USER: Report charger problem
  // ========================================================================
  reportProblem: protectedProcedure
    .input(z.object({
      stationId: z.number(),
      stationName: z.string(),
      evseId: z.number().optional(),
      connectorId: z.number().optional(),
      problemType: z.enum([
        "NO_ENCIENDE",
        "NO_CARGA",
        "CABLE_DANADO",
        "PANTALLA_ROTA",
        "CONECTOR_DANADO",
        "ERROR_COMUNICACION",
        "COBRO_INCORRECTO",
        "OTRO",
      ]),
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create problem report
      const reportId = await supportDb.createProblemReport({
        userId: ctx.user.id,
        stationId: input.stationId,
        stationName: input.stationName,
        connectorId: input.connectorId || null,
        problemType: input.problemType,
        description: input.description || null,
        status: "PENDING",
      });

      // Also create a support ticket linked to this report
      const ticketId = await supportDb.createTicket({
        userId: ctx.user.id,
        subject: `Reporte de problema: ${getProblemTypeLabel(input.problemType)} - ${input.stationName}`,
        description: `Estación: ${input.stationName}\nTipo de problema: ${getProblemTypeLabel(input.problemType)}\n${input.description ? `Descripción: ${input.description}` : ""}`,
        category: "charger_problem",
        status: "OPEN",
        priority: "high",
        stationId: input.stationId,
      });

      // Try to assign to available agent
      const agent = await supportDb.getAvailableAgent();
      if (agent) {
        await supportDb.updateTicket(ticketId, { status: "ASSIGNED", assignedToId: agent.userId });
        await supportDb.incrementAgentTicketCount(agent.agentId);
      }

      // Send email notification
      await sendProblemReportEmail(input, ctx.user.name || "Usuario");

      return { reportId, ticketId, success: true };
    }),

  // ========================================================================
  // ADMIN/TECH: List all tickets
  // ========================================================================
  listAll: techProcedure
    .input(z.object({
      status: z.string().optional(),
      category: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return supportDb.getAllTickets(input);
    }),

  // ========================================================================
  // ADMIN/TECH: Get ticket with full conversation
  // ========================================================================
  getTicketDetail: techProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ input }) => {
      return supportDb.getTicketWithMessages(input.ticketId);
    }),

  // ========================================================================
  // ADMIN/TECH: Reply to ticket (as human agent)
  // ========================================================================
  reply: techProcedure
    .input(z.object({
      ticketId: z.number(),
      message: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await supportDb.getTicketById(input.ticketId);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      // Save agent message
      await supportDb.createMessage({
        ticketId: input.ticketId,
        senderId: ctx.user.id,
        senderRole: "agent",
        message: input.message,
      });

      // Update ticket status if needed
      if (ticket.status === "OPEN" || ticket.status === "WAITING_AGENT") {
        await supportDb.updateTicket(input.ticketId, {
          status: "ASSIGNED",
          assignedToId: ctx.user.id,
        });
      }

      // TODO: Send push notification to user

      return { success: true };
    }),

  // ========================================================================
  // ADMIN/TECH: Update ticket status
  // ========================================================================
  updateTicket: techProcedure
    .input(z.object({
      ticketId: z.number(),
      status: z.string().optional(),
      priority: z.string().optional(),
      assignedToId: z.number().optional(),
      resolution: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const data: any = {};
      if (input.status) data.status = input.status;
      if (input.priority) data.priority = input.priority;
      if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
      if (input.resolution) {
        data.resolution = input.resolution;
        data.resolvedAt = new Date();
      }
      await supportDb.updateTicket(input.ticketId, data);

      // If resolved, decrement agent ticket count
      if (input.status === "RESOLVED") {
        const ticket = await supportDb.getTicketById(input.ticketId);
        if (ticket?.assignedToId) {
          const agent = await supportDb.getAgentByUserId(ticket.assignedToId);
          if (agent) await supportDb.decrementAgentTicketCount(agent.id);
        }
      }

      return { success: true };
    }),

  // ========================================================================
  // ADMIN/TECH: Get unread count for admin panel
  // ========================================================================
  adminUnreadCount: techProcedure.query(async () => {
    return supportDb.getUnreadCountForAdmin();
  }),

  // ========================================================================
  // ADMIN: Manage support agents
  // ========================================================================
  listAgents: adminProcedure.query(async () => {
    return supportDb.getAllAgents();
  }),

  upsertAgent: adminProcedure
    .input(z.object({
      userId: z.number(),
      scheduleStart: z.string().optional(),
      scheduleEnd: z.string().optional(),
      workDays: z.array(z.number()).optional(),
      maxConcurrentTickets: z.number().optional(),
      isAvailable: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await supportDb.upsertAgent({
        userId: input.userId,
        scheduleStart: input.scheduleStart || "08:00",
        scheduleEnd: input.scheduleEnd || "17:00",
        workDays: input.workDays || [1, 2, 3, 4, 5],
        maxConcurrentTickets: input.maxConcurrentTickets || 5,
        isAvailable: input.isAvailable ?? true,
        isOnline: true,
      });
      return { id };
    }),

  // ========================================================================
  // TECH: Toggle online status
  // ========================================================================
  toggleOnline: techProcedure
    .input(z.object({ isOnline: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await supportDb.updateAgentStatus(ctx.user.id, input.isOnline);
      return { success: true };
    }),

  // ========================================================================
  // ADMIN: List problem reports
  // ========================================================================
  listProblemReports: techProcedure
    .input(z.object({
      status: z.string().optional(),
      stationId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return supportDb.getProblemReports(input);
    }),

  // ========================================================================
  // ADMIN: Update problem report
  // ========================================================================
  updateProblemReport: techProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      resolution: z.string().optional(),
      assignedToId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const data: any = {};
      if (input.status) data.status = input.status;
      if (input.resolution) {
        data.resolution = input.resolution;
        data.resolvedAt = new Date();
      }
      if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
      await supportDb.updateProblemReport(input.id, data);
      return { success: true };
    }),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getProblemTypeLabel(type: string): string {
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
  return labels[type] || type;
}

async function sendSupportEmailNotification(ticketId: number, userMessage: string, userName: string) {
  try {
    const settings = await supportDb.getSupportSettings();
    const email = settings.supportEmail || "soporte@greenhproject.com";

    if (!resend) {
      console.log("[Support] No Resend API key, skipping email notification");
      return;
    }

    await resend.emails.send(buildEmailParams({
      from: "EVGreen Soporte <soporte@evgreen.lat>",
      to: email,
      subject: `[Ticket #${ticketId}] Nuevo mensaje de soporte - ${userName}`,
      html: `
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
            <p style="margin-top: 20px;">
              <a href="https://app.evgreen.lat/admin/support/${ticketId}" 
                 style="background: #0a5c36; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
                Ver en la plataforma
              </a>
            </p>
          </div>
        </div>
      `,
      replyTo: email,
    }));
  } catch (error) {
    console.error("[Support] Email notification error:", error);
  }
}

async function sendProblemReportEmail(report: { stationName: string; problemType: string; description?: string | null }, userName: string) {
  try {
    const settings = await supportDb.getSupportSettings();
    const email = settings.supportEmail || "soporte@greenhproject.com";

    if (!resend) return;

    await resend.emails.send(buildEmailParams({
      from: "EVGreen Soporte <soporte@evgreen.lat>",
      to: email,
      subject: `[ALERTA] Reporte de problema en cargador - ${report.stationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🚨 Reporte de Problema en Cargador</h2>
          </div>
          <div style="padding: 20px; background: #f9f9f9; border: 1px solid #e0e0e0;">
            <p><strong>Estación:</strong> ${report.stationName}</p>
            <p><strong>Tipo de problema:</strong> ${getProblemTypeLabel(report.problemType)}</p>
            <p><strong>Reportado por:</strong> ${userName}</p>
            ${report.description ? `<p><strong>Descripción:</strong> ${report.description}</p>` : ""}
            <p style="margin-top: 20px;">
              <a href="https://app.evgreen.lat/admin/support" 
                 style="background: #dc2626; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
                Ver en la plataforma
              </a>
            </p>
          </div>
        </div>
      `,
      replyTo: email,
    }));
  } catch (error) {
    console.error("[Support] Problem report email error:", error);
  }
}
