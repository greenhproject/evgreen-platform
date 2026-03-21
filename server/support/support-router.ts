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
import { sendPushNotification, sendPushNotificationToMultiple } from "../firebase/fcm";
import { getActiveTechnicians } from "../notifications/technician-notification-service";
import { getUserById } from "../db";
import { notifications } from "../../drizzle/schema";
import { getDb } from "../db";

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
// PUSH NOTIFICATION HELPERS FOR SUPPORT
// ============================================================================

/**
 * Notificar a técnicos/agentes cuando un usuario crea un nuevo ticket o responde
 * Envía push FCM + notificación in-app + copia al remitente para trazabilidad
 */
async function notifyTechniciansOfSupportTicket(
  ticketId: number,
  subject: string,
  userMessage: string,
  userName: string,
  type: "new_ticket" | "user_reply"
): Promise<void> {
  try {
    const ticket = await supportDb.getTicketById(ticketId);
    if (!ticket) return;

    // If ticket is assigned, only notify the assigned agent
    // Otherwise notify all active technicians
    let targetUsers: { id: number; fcmToken: string | null; name: string | null }[] = [];

    if (ticket.assignedToId) {
      const assignedUser = await getUserById(ticket.assignedToId);
      if (assignedUser) {
        targetUsers = [{ id: assignedUser.id, fcmToken: assignedUser.fcmToken, name: assignedUser.name }];
      }
    } else {
      const technicians = await getActiveTechnicians();
      targetUsers = technicians
        .filter(t => t.techNotifyNewTickets !== false)
        .map(t => ({ id: t.id, fcmToken: t.fcmToken, name: t.name }));
    }

    if (targetUsers.length === 0) return;

    const pushType = type === "new_ticket" ? "support_new_ticket" as const : "support_user_reply" as const;
    const title = type === "new_ticket"
      ? `Nuevo ticket de soporte #${ticketId}`
      : `Respuesta en ticket #${ticketId}`;
    const body = type === "new_ticket"
      ? `${userName}: ${subject.substring(0, 120)}`
      : `${userName}: ${userMessage.substring(0, 120)}`;

    const database = await getDb();

    for (const target of targetUsers) {
      // Push notification via FCM
      if (target.fcmToken && !target.fcmToken.startsWith("local_")) {
        await sendPushNotification(target.fcmToken, {
          type: pushType,
          title,
          body,
          clickAction: "/technician/support",
          data: { ticketId: String(ticketId) },
        }).catch(err => console.error(`[SupportPush] FCM error for tech ${target.id}:`, err));
      }

      // In-app notification
      if (database) {
        await database.insert(notifications).values({
          userId: target.id,
          title,
          message: body,
          type: "SYSTEM",
          referenceType: "support_ticket",
          referenceId: ticketId,
          isRead: false,
          pushSent: !!target.fcmToken && !target.fcmToken?.startsWith("local_"),
          pushSentAt: target.fcmToken ? new Date() : undefined,
          data: JSON.stringify({ ticketId, type: pushType, userName }),
        }).catch(err => console.error(`[SupportPush] In-app notification error for tech ${target.id}:`, err));
      }
    }

    console.log(`[SupportPush] ${type} notification sent to ${targetUsers.length} technicians for ticket #${ticketId}`);
  } catch (error) {
    console.error("[SupportPush] Error notifying technicians:", error);
  }
}

/**
 * Notificar al usuario cuando un técnico/agente responde su ticket
 * Envía push FCM + notificación in-app
 */
async function notifyUserOfAgentReply(
  ticketId: number,
  userId: number,
  agentName: string,
  agentMessage: string
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user) return;

    const title = `Respuesta de soporte - Ticket #${ticketId}`;
    const body = `${agentName}: ${agentMessage.substring(0, 120)}`;

    // Push notification via FCM
    if (user.fcmToken && !user.fcmToken.startsWith("local_")) {
      await sendPushNotification(user.fcmToken, {
        type: "support_agent_reply",
        title,
        body,
        clickAction: "/support",
        data: { ticketId: String(ticketId) },
      }).catch(err => console.error(`[SupportPush] FCM error for user ${userId}:`, err));
    }

    // In-app notification
    const database = await getDb();
    if (database) {
      await database.insert(notifications).values({
        userId,
        title,
        message: body,
        type: "SYSTEM",
        referenceType: "support_ticket",
        referenceId: ticketId,
        isRead: false,
        pushSent: !!user.fcmToken && !user.fcmToken.startsWith("local_"),
        pushSentAt: user.fcmToken ? new Date() : undefined,
        data: JSON.stringify({ ticketId, type: "support_agent_reply", agentName }),
      }).catch(err => console.error(`[SupportPush] In-app notification error for user ${userId}:`, err));
    }

    // Copia al remitente (agente) para trazabilidad
    const ticket = await supportDb.getTicketById(ticketId);
    if (ticket?.assignedToId && database) {
      await database.insert(notifications).values({
        userId: ticket.assignedToId,
        title: `[Copia] Respuesta enviada - Ticket #${ticketId}`,
        message: `Tu respuesta a ${user.name || 'usuario'}: ${agentMessage.substring(0, 120)}`,
        type: "SYSTEM",
        referenceType: "support_ticket",
        referenceId: ticketId,
        isRead: true, // Mark as read since it's a copy
        data: JSON.stringify({ ticketId, type: "support_agent_reply_copy" }),
      }).catch(err => console.error(`[SupportPush] Copy notification error:`, err));
    }

    console.log(`[SupportPush] Agent reply notification sent to user ${userId} for ticket #${ticketId}`);
  } catch (error) {
    console.error("[SupportPush] Error notifying user of agent reply:", error);
  }
}

/**
 * Notificar al usuario cuando su ticket es resuelto
 */
async function notifyUserOfTicketResolved(
  ticketId: number,
  userId: number,
  resolution?: string
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user) return;

    const title = `Ticket #${ticketId} resuelto`;
    const body = resolution
      ? `Tu ticket ha sido resuelto: ${resolution.substring(0, 120)}`
      : "Tu ticket de soporte ha sido resuelto. Gracias por contactarnos.";

    // Push notification
    if (user.fcmToken && !user.fcmToken.startsWith("local_")) {
      await sendPushNotification(user.fcmToken, {
        type: "support_ticket_resolved",
        title,
        body,
        clickAction: "/support",
        data: { ticketId: String(ticketId) },
      }).catch(err => console.error(`[SupportPush] FCM error for resolved ticket:`, err));
    }

    // In-app notification
    const database = await getDb();
    if (database) {
      await database.insert(notifications).values({
        userId,
        title,
        message: body,
        type: "SYSTEM",
        referenceType: "support_ticket",
        referenceId: ticketId,
        isRead: false,
        pushSent: !!user.fcmToken && !user.fcmToken.startsWith("local_"),
        pushSentAt: user.fcmToken ? new Date() : undefined,
        data: JSON.stringify({ ticketId, type: "support_ticket_resolved" }),
      }).catch(err => console.error(`[SupportPush] Resolved notification error:`, err));
    }

    console.log(`[SupportPush] Ticket resolved notification sent to user ${userId} for ticket #${ticketId}`);
  } catch (error) {
    console.error("[SupportPush] Error notifying ticket resolved:", error);
  }
}

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
      let isNewTicket = false;
      if (!ticketId) {
        ticketId = await supportDb.createTicket({
          userId: ctx.user.id,
          subject: input.message.substring(0, 100),
          description: input.message,
          category: input.category || "general",
          status: "AI_HANDLING",
          priority: "medium",
        });
        isNewTicket = true;
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
              // Push notification to assigned agent
              notifyTechniciansOfSupportTicket(
                ticketId,
                input.message.substring(0, 100),
                input.message,
                ctx.user.name || "Usuario",
                "new_ticket"
              ).catch(err => console.error("[Support] Escalation push error:", err));
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
              // Push notification to all technicians
              notifyTechniciansOfSupportTicket(
                ticketId,
                input.message.substring(0, 100),
                input.message,
                ctx.user.name || "Usuario",
                "new_ticket"
              ).catch(err => console.error("[Support] Waiting agent push error:", err));
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

      // Push notification to assigned agent
      notifyTechniciansOfSupportTicket(
        ticketId,
        ticket.subject || input.message.substring(0, 100),
        input.message,
        ctx.user.name || "Usuario",
        "user_reply"
      ).catch(err => console.error("[Support] Push notification error:", err));

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

      // Push notification to technicians
      notifyTechniciansOfSupportTicket(
        input.ticketId,
        ticket.subject || "Solicitud de agente humano",
        "El usuario solicita hablar con un agente humano",
        ctx.user.name || "Usuario",
        "new_ticket"
      ).catch(err => console.error("[Support] Human agent request push error:", err));

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

      // Push notification to technicians about the problem report
      notifyTechniciansOfSupportTicket(
        ticketId,
        `Reporte: ${getProblemTypeLabel(input.problemType)} - ${input.stationName}`,
        input.description || getProblemTypeLabel(input.problemType),
        ctx.user.name || "Usuario",
        "new_ticket"
      ).catch(err => console.error("[Support] Problem report push error:", err));

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

      // Send push notification to user
      notifyUserOfAgentReply(
        input.ticketId,
        ticket.userId,
        ctx.user.name || "Soporte EVGreen",
        input.message
      ).catch(err => console.error("[Support] Agent reply push error:", err));

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

      // If resolved, decrement agent ticket count and notify user
      if (input.status === "RESOLVED") {
        const ticket = await supportDb.getTicketById(input.ticketId);
        if (ticket?.assignedToId) {
          const agent = await supportDb.getAgentByUserId(ticket.assignedToId);
          if (agent) await supportDb.decrementAgentTicketCount(agent.id);
        }
        // Notify user that ticket is resolved
        if (ticket) {
          notifyUserOfTicketResolved(
            input.ticketId,
            ticket.userId,
            input.resolution
          ).catch(err => console.error("[Support] Ticket resolved push error:", err));
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
