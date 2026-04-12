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
import { createMaintenanceTicket } from "../db";
import { storagePut } from "../storage";
import { sendPushNotification, sendPushNotificationToMultiple } from "../firebase/fcm";
import { sendUserPush } from "../push/unified-push";
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

// In-memory typing state (simple approach, works for single-server)
const typingState = new Map<string, { userId: number; userName: string; role: string; timestamp: number }>();

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
      // Push notification via unified push (Web Push + FCM)
      await sendUserPush(target.id, {
        type: pushType,
        title,
        body,
        clickAction: "/technician/support",
        data: { ticketId: String(ticketId) },
      }).catch(err => console.error(`[SupportPush] Push error for tech ${target.id}:`, err));

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

    // Push notification via unified push (Web Push + FCM)
    await sendUserPush(userId, {
      type: "support_agent_reply",
      title,
      body,
      clickAction: "/support",
      data: { ticketId: String(ticketId) },
    }).catch(err => console.error(`[SupportPush] Push error for user ${userId}:`, err));

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

    // Push notification via unified push (Web Push + FCM)
    await sendUserPush(userId, {
      type: "support_ticket_resolved",
      title,
      body,
      clickAction: "/support",
      data: { ticketId: String(ticketId) },
    }).catch(err => console.error(`[SupportPush] Push error for resolved ticket:`, err));

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

=== TEMAS QUE PUEDES RESOLVER (sin escalar) ===
1. Preguntas generales sobre cómo usar la app (escanear QR, iniciar carga, ver historial)
2. Información básica sobre tarifas y precios
3. Cómo recargar la billetera
4. Información general sobre tipos de conector y compatibilidad
5. Preguntas frecuentes sobre vehículos eléctricos

=== TEMAS QUE DEBES ESCALAR INMEDIATAMENTE ===
1. Cualquier problema con un cargador (no enciende, no carga, cable dañado, pantalla rota, error)
2. Problemas de cobro, facturación o reembolsos
3. Problemas con transacciones o pagos
4. Problemas de acceso a la cuenta
5. Cualquier falla técnica reportada por el usuario
6. Cuando el usuario dice que algo "no funciona" o "no sirve"
7. Cuando el usuario pide hablar con un humano o agente
8. Cuando el problema persiste después de tu primera sugerencia
9. Cuando el usuario muestra frustración o urgencia

=== REGLAS ===
- Responde siempre en español
- Sé amable, profesional y conciso
- Si puedes resolver el problema con información general, hazlo directamente
- Si el problema requiere acción técnica, acceso a sistemas, o atención personalizada, DEBES escalar
- Para escalar, responde EXACTAMENTE con el prefijo "[ESCALAR]" al inicio de tu mensaje, seguido de una explicación amable al usuario de que lo conectarás con un técnico
- IMPORTANTE: Después de 2 intercambios de mensajes sin resolver el problema, DEBES escalar automáticamente
- NO inventes información técnica específica sobre el estado de cargadores o transacciones
- Ante la duda, ES MEJOR ESCALAR que dejar al usuario sin solución

=== FORMATO ===
- Usa respuestas cortas y directas (máximo 2-3 párrafos)
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
        const userMessageCount = messages.filter(m => m.senderRole === "user").length;
        const conversationHistory = messages.map(m => ({
          role: m.senderRole === "user" ? "user" as const : "assistant" as const,
          content: m.message,
        }));

        // Auto-escalate after 3+ user messages without resolution
        const forceEscalate = userMessageCount >= 3;

        try {
          const systemPrompt = forceEscalate
            ? AI_SUPPORT_SYSTEM_PROMPT + "\n\nIMPORTANTE: El usuario ya ha enviado varios mensajes sin resolver su problema. DEBES responder con [ESCALAR] al inicio para transferirlo a un agente humano. Explica amablemente que lo conectarás con un técnico."
            : AI_SUPPORT_SYSTEM_PROMPT;

          const aiResponse = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
            ],
          });

          const aiContent = typeof aiResponse.choices[0]?.message?.content === "string"
            ? aiResponse.choices[0].message.content
            : "";

          // Check if AI wants to escalate (or force escalation)
          const shouldEscalate = aiContent.startsWith("[ESCALAR]") || forceEscalate;
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
            // Ensure technicians are registered as agents before trying to assign
            await supportDb.autoRegisterAllTechnicians();
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

              // Send email notification to support
              await sendSupportEmailNotification(ticketId, input.message, ctx.user.name || "Usuario");
              // Send email notification to assigned technician
              sendTicketAssignedEmailToTechnician(ticketId, agent.userId, {
                subject: ticket.subject,
                category: ticket.category,
                priority: ticket.priority,
                description: ticket.description,
                userName: ctx.user.name || "Usuario",
                userEmail: ctx.user.email,
                escalationReason: "Escalado automáticamente por la IA de soporte",
              }).catch(err => console.error("[Support] Technician assignment email error:", err));
              // Auto-create maintenance ticket for the technician
              autoCreateMaintenanceTicket(ticketId, ticket, agent.userId).catch(err => console.error("[Support] Auto-create maintenance ticket error:", err));
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

      // Ensure technicians are registered as agents
      await supportDb.autoRegisterAllTechnicians();
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

      // Send email to assigned technician if one was found
      if (agent) {
        sendTicketAssignedEmailToTechnician(input.ticketId, agent.userId, {
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          description: ticket.description,
          userName: ctx.user.name || "Usuario",
          userEmail: ctx.user.email,
          escalationReason: "El usuario solicitó hablar con un agente humano",
        }).catch(err => console.error("[Support] Human agent assignment email error:", err));
        // Auto-create maintenance ticket for the technician
        autoCreateMaintenanceTicket(input.ticketId, ticket, agent.userId).catch(err => console.error("[Support] Auto-create maintenance ticket error:", err));
      }

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
        connectorId: input.connectorId ? String(input.connectorId) : null,
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
  // SHARED: Upload attachment for support chat
  // ========================================================================
  uploadAttachment: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string().refine(
        (ct) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(ct),
        { message: "Solo se permiten imágenes JPEG, PNG, WebP o GIF" }
      ),
    }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await supportDb.getTicketById(input.ticketId);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify access: user owns ticket or is tech/admin
      const isOwner = ticket.userId === ctx.user.id;
      const isAgent = ["admin", "staff", "superadmin", "technician", "engineer"].includes(ctx.user.role);
      if (!isOwner && !isAgent) throw new TRPCError({ code: "FORBIDDEN" });

      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La imagen no puede superar 10MB" });
      }

      // Compress with sharp
      const sharp = (await import("sharp")).default;
      const compressedBuffer = await sharp(buffer)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `support/ticket-${input.ticketId}/${timestamp}-${randomSuffix}.webp`;
      const { url } = await storagePut(fileKey, compressedBuffer, "image/webp");

      // Save as message with attachment
      await supportDb.createMessage({
        ticketId: input.ticketId,
        senderId: ctx.user.id,
        senderRole: isOwner ? "user" : "agent",
        message: "📷 Imagen adjunta",
        attachmentUrl: url,
      });

      // If user sends image and ticket is assigned, notify technician
      if (isOwner && ticket.assignedToId) {
        notifyTechniciansOfSupportTicket(
          input.ticketId,
          ticket.subject || "Imagen adjunta",
          "El usuario envió una imagen adjunta",
          ctx.user.name || "Usuario",
          "user_reply"
        ).catch(err => console.error("[Support] Image upload push error:", err));
      }

      // If agent sends image, notify user
      if (isAgent) {
        notifyUserOfAgentReply(
          input.ticketId,
          ticket.userId,
          ctx.user.name || "Soporte EVGreen",
          "Te envió una imagen"
        ).catch(err => console.error("[Support] Agent image push error:", err));
      }

      return { url, success: true };
    }),

  // ========================================================================
  // SHARED: Typing indicator (polling-based)
  // ========================================================================
  setTyping: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      isTyping: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Store typing state in memory (simple approach)
      const key = `typing:${input.ticketId}:${ctx.user.id}`;
      if (input.isTyping) {
        typingState.set(key, {
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuario",
          role: ["admin", "staff", "superadmin", "technician", "engineer"].includes(ctx.user.role) ? "agent" : "user",
          timestamp: Date.now(),
        });
      } else {
        typingState.delete(key);
      }
      return { success: true };
    }),

  getTypingStatus: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ ctx, input }) => {
      const now = Date.now();
      const result: { userId: number; userName: string; role: string }[] = [];
      // Check all typing entries for this ticket
      const entries = Array.from(typingState.entries());
      for (const [key, value] of entries) {
        if (key.startsWith(`typing:${input.ticketId}:`) && value.userId !== ctx.user.id) {
          // Expire after 5 seconds
          if (now - value.timestamp < 5000) {
            result.push({ userId: value.userId, userName: value.userName, role: value.role });
          } else {
            typingState.delete(key);
          }
        }
      }
      return result;
    }),

  // ========================================================================
  // ADMIN/TECH: List all tickets (excludes AI_HANDLING by default)
  // ========================================================================
  listAll: techProcedure
    .input(z.object({
      status: z.string().optional(),
      category: z.string().optional(),
      includeAiHandling: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Auto-register technician as support agent on first access
      await supportDb.ensureAgentRegistered(ctx.user.id);
      
      return supportDb.getAllTickets({
        status: input?.status,
        category: input?.category,
        excludeAiHandling: !input?.includeAiHandling,
      });
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

      // If a technician was assigned manually, send email notification
      if (input.assignedToId !== undefined && input.assignedToId > 0) {
        const ticket = await supportDb.getTicketById(input.ticketId);
        if (ticket) {
          const ticketUser = await getUserById(ticket.userId);
          sendTicketAssignedEmailToTechnician(input.ticketId, input.assignedToId, {
            subject: ticket.subject,
            category: ticket.category,
            priority: ticket.priority,
            description: ticket.description,
            userName: ticketUser?.name || `Usuario #${ticket.userId}`,
            userEmail: ticketUser?.email,
            escalationReason: "Asignado manualmente por administrador",
          }).catch(err => console.error("[Support] Manual assignment email error:", err));
        }
      }

      // Auto-create maintenance ticket when support ticket is ASSIGNED
      if (input.status === "ASSIGNED" || (input.assignedToId !== undefined && input.assignedToId > 0)) {
        const ticket = await supportDb.getTicketById(input.ticketId);
        if (ticket) {
          try {
            await autoCreateMaintenanceTicket(input.ticketId, ticket, input.assignedToId || ticket.assignedToId || undefined);
          } catch (err) {
            console.error("[Support] Auto-create maintenance ticket error:", err);
          }
        }
      }

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

/**
 * Auto-crear ticket de mantenimiento cuando un ticket de soporte se asigna a un técnico.
 * Esto hace que el ticket aparezca en "Mis Tickets" del técnico.
 */
async function autoCreateMaintenanceTicket(
  supportTicketId: number,
  ticket: { subject?: string | null; description?: string | null; category?: string | null; priority?: string | null; userId: number },
  technicianId?: number
) {
  try {
    // Map support priority to maintenance priority
    const priorityMap: Record<string, string> = {
      low: "LOW", medium: "MEDIUM", high: "HIGH", urgent: "CRITICAL",
    };
    const maintenancePriority = priorityMap[ticket.priority || "medium"] || "MEDIUM";

    // Map support category to maintenance category
    const categoryMap: Record<string, string> = {
      TECHNICAL: "HARDWARE", BILLING: "SOFTWARE", GENERAL: "SOFTWARE",
      ACCOUNT: "SOFTWARE", CHARGER: "HARDWARE", CONNECTIVITY: "CONNECTIVITY",
    };
    const maintenanceCategory = categoryMap[ticket.category || "GENERAL"] || "SOFTWARE";

    await createMaintenanceTicket({
      stationId: 1, // Default station - will be updated by technician
      technicianId: technicianId || null,
      reportedById: ticket.userId,
      title: `[Soporte #${supportTicketId}] ${ticket.subject || "Ticket de soporte"}`,
      description: ticket.description || `Ticket de soporte #${supportTicketId} escalado para atención técnica.`,
      priority: maintenancePriority,
      category: maintenanceCategory,
      status: "PENDING",
    } as any);

    console.log(`[Support] Auto-created maintenance ticket for support ticket #${supportTicketId}`);
  } catch (err) {
    console.error(`[Support] Failed to auto-create maintenance ticket for #${supportTicketId}:`, err);
  }
}

/**
 * Enviar email al técnico cuando se le asigna un ticket escalado o manualmente.
 * Incluye detalles del ticket y enlace directo a la plataforma.
 * También envía copia al email de soporte para trazabilidad.
 */
async function sendTicketAssignedEmailToTechnician(
  ticketId: number,
  technicianUserId: number,
  ticketData: {
    subject?: string | null;
    category?: string | null;
    priority?: string | null;
    description?: string | null;
    userName: string;
    userEmail?: string | null;
    escalationReason?: string;
  }
) {
  try {
    if (!resend) {
      console.log("[Support] No Resend API key, skipping technician assignment email");
      return;
    }

    // Get technician info
    const technician = await getUserById(technicianUserId);
    if (!technician || !technician.email) {
      console.log(`[Support] Technician ${technicianUserId} has no email, skipping`);
      return;
    }

    const categoryLabels: Record<string, string> = {
      GENERAL: "General", general: "General",
      CHARGING: "Carga", charging: "Carga",
      BILLING: "Facturación", billing: "Facturación",
      TECHNICAL: "Técnico", technical: "Técnico",
      ACCOUNT: "Cuenta", account: "Cuenta",
      CHARGER_PROBLEM: "Problema de cargador", charger_problem: "Problema de cargador",
    };

    const priorityLabels: Record<string, string> = {
      LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente",
    };

    const priorityColors: Record<string, string> = {
      LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#f97316", URGENT: "#dc2626",
    };

    const category = ticketData.category ? (categoryLabels[ticketData.category] || ticketData.category) : "Sin categoría";
    const priority = ticketData.priority || "MEDIUM";
    const priorityLabel = priorityLabels[priority] || priority;
    const priorityColor = priorityColors[priority] || "#f59e0b";
    const subject = ticketData.subject || `Ticket #${ticketId}`;
    const platformUrl = "https://evgreen.lat/technician/support";

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #0a5c36 0%, #0d7a4a 100%); color: white; padding: 24px 28px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600;">&#9889; Ticket de Soporte Asignado</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Se te ha asignado un nuevo ticket para atender</p>
        </div>
        
        <div style="padding: 24px 28px; border: 1px solid #e5e7eb; border-top: none;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #166534;">
              <strong>Hola ${technician.name || "Técnico"},</strong><br/>
              Se te ha asignado el ticket <strong>#${ticketId}</strong>. Por favor revísalo y responde al usuario lo antes posible.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 130px;">Ticket</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 14px; font-weight: 600;">#${ticketId} - ${subject}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">Categoría</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 14px;">${category}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">Prioridad</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 14px;">
                <span style="display: inline-block; background: ${priorityColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${priorityLabel}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">Usuario</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 14px;">${ticketData.userName}${ticketData.userEmail ? ` (${ticketData.userEmail})` : ""}</td>
            </tr>
            ${ticketData.escalationReason ? `
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">Motivo</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 14px;">${ticketData.escalationReason}</td>
            </tr>` : ""}
            ${ticketData.description ? `
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">Descripción</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 14px;">${ticketData.description.substring(0, 300)}${ticketData.description.length > 300 ? "..." : ""}</td>
            </tr>` : ""}
          </table>

          <div style="text-align: center; margin-top: 24px;">
            <a href="${platformUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #0a5c36 0%, #0d7a4a 100%); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Atender Ticket en la Plataforma
            </a>
          </div>
        </div>

        <div style="padding: 16px 28px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
            Este email fue enviado automáticamente por EVGreen. No responder a este correo.
          </p>
        </div>
      </div>
    `;

    // Send to technician
    await resend.emails.send(buildEmailParams({
      from: "EVGreen Soporte <soporte@evgreen.lat>",
      to: technician.email,
      subject: `[Ticket #${ticketId}] Te han asignado un ticket de soporte - ${ticketData.userName}`,
      html: emailHtml,
      replyTo: "soporte@greenhproject.com",
    }));

    console.log(`[Support] Assignment email sent to technician ${technician.email} for ticket #${ticketId}`);

    // Send copy to support email for traceability
    const settings = await supportDb.getSupportSettings();
    const supportEmail = settings.supportEmail || "soporte@greenhproject.com";
    if (supportEmail !== technician.email) {
      await resend.emails.send(buildEmailParams({
        from: "EVGreen Soporte <soporte@evgreen.lat>",
        to: supportEmail,
        subject: `[Copia] Ticket #${ticketId} asignado a ${technician.name || "Técnico"} - ${ticketData.userName}`,
        html: emailHtml,
        replyTo: technician.email,
      }));
      console.log(`[Support] Assignment copy sent to ${supportEmail} for ticket #${ticketId}`);
    }
  } catch (error) {
    console.error("[Support] Technician assignment email error:", error);
  }
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
