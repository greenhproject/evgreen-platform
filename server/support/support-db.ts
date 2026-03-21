/**
 * Support System - Database Helpers
 * Maneja tickets de soporte, mensajes de chat, agentes y reportes de problemas
 */
import { eq, and, desc, asc, sql, lte, gte, isNull, or, count } from "drizzle-orm";
import { getDb } from "../db";
import {
  supportTickets,
  supportMessages,
  supportAgents,
  chargerProblemReports,
  users,
  chargingStations,
  InsertSupportTicket,
  InsertSupportMessage,
  InsertSupportAgent,
  InsertChargerProblemReport,
} from "../../drizzle/schema";

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export async function createTicket(ticket: InsertSupportTicket) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(supportTickets).values(ticket);
  return result[0].insertId;
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
  return rows[0] || null;
}

export async function getTicketsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt));
}

export async function getAllTickets(filters?: { status?: string; category?: string; assignedToId?: number; excludeAiHandling?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(supportTickets.status, filters.status));
  if (filters?.category) conditions.push(eq(supportTickets.category, filters.category));
  if (filters?.assignedToId) conditions.push(eq(supportTickets.assignedToId, filters.assignedToId));
  if (filters?.excludeAiHandling) {
    conditions.push(sql`${supportTickets.status} != 'AI_HANDLING'`);
  }

  const selectFields = {
    id: supportTickets.id,
    userId: supportTickets.userId,
    stationId: supportTickets.stationId,
    transactionId: supportTickets.transactionId,
    subject: supportTickets.subject,
    description: supportTickets.description,
    category: supportTickets.category,
    priority: supportTickets.priority,
    status: supportTickets.status,
    assignedToId: supportTickets.assignedToId,
    resolution: supportTickets.resolution,
    resolvedAt: supportTickets.resolvedAt,
    createdAt: supportTickets.createdAt,
    updatedAt: supportTickets.updatedAt,
    userName: users.name,
    userEmail: users.email,
  };

  if (conditions.length > 0) {
    return db.select(selectFields).from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(supportTickets.createdAt));
  }
  return db.select(selectFields).from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .orderBy(desc(supportTickets.createdAt));
}

export async function updateTicket(id: number, data: Partial<InsertSupportTicket>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(supportTickets).set(data).where(eq(supportTickets.id, id));
}

export async function getTicketWithMessages(ticketId: number) {
  const db = await getDb();
  if (!db) return null;
  const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
  if (!ticket[0]) return null;

  const messages = await db.select({
    id: supportMessages.id,
    ticketId: supportMessages.ticketId,
    senderId: supportMessages.senderId,
    senderRole: supportMessages.senderRole,
    message: supportMessages.message,
    attachmentUrl: supportMessages.attachmentUrl,
    readAt: supportMessages.readAt,
    createdAt: supportMessages.createdAt,
    senderName: users.name,
    senderEmail: users.email,
  })
    .from(supportMessages)
    .leftJoin(users, eq(supportMessages.senderId, users.id))
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(asc(supportMessages.createdAt));

  // Get user info
  const user = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).where(eq(users.id, ticket[0].userId));

  // Get assigned agent info
  let assignedAgent = null;
  if (ticket[0].assignedToId) {
    const agent = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, ticket[0].assignedToId));
    assignedAgent = agent[0] || null;
  }

  return {
    ...ticket[0],
    user: user[0] || null,
    assignedAgent,
    messages,
  };
}

// ============================================================================
// SUPPORT MESSAGES (Chat)
// ============================================================================

export async function createMessage(msg: InsertSupportMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(supportMessages).values(msg);
  return result[0].insertId;
}

export async function getMessagesByTicketId(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: supportMessages.id,
    ticketId: supportMessages.ticketId,
    senderId: supportMessages.senderId,
    senderRole: supportMessages.senderRole,
    message: supportMessages.message,
    attachmentUrl: supportMessages.attachmentUrl,
    readAt: supportMessages.readAt,
    createdAt: supportMessages.createdAt,
    senderName: users.name,
  })
    .from(supportMessages)
    .leftJoin(users, eq(supportMessages.senderId, users.id))
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(asc(supportMessages.createdAt));
}

export async function markMessagesAsRead(ticketId: number, readerRole: string) {
  const db = await getDb();
  if (!db) return;
  // Mark messages from the OTHER side as read
  const oppositeRole = readerRole === "user" ? "agent" : "user";
  await db.update(supportMessages)
    .set({ readAt: new Date() })
    .where(and(
      eq(supportMessages.ticketId, ticketId),
      eq(supportMessages.senderRole, oppositeRole),
      isNull(supportMessages.readAt)
    ));
}

export async function getUnreadCountForUser(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  // Get all tickets for this user that have unread agent messages
  const result = await db.select({ cnt: count() })
    .from(supportMessages)
    .innerJoin(supportTickets, eq(supportMessages.ticketId, supportTickets.id))
    .where(and(
      eq(supportTickets.userId, userId),
      eq(supportMessages.senderRole, "agent"),
      isNull(supportMessages.readAt)
    ));
  return result[0]?.cnt || 0;
}

export async function getUnreadCountForAdmin() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ cnt: count() })
    .from(supportMessages)
    .where(and(
      eq(supportMessages.senderRole, "user"),
      isNull(supportMessages.readAt)
    ));
  return result[0]?.cnt || 0;
}

// ============================================================================
// SUPPORT AGENTS
// ============================================================================

export async function getAvailableAgent(): Promise<{ userId: number; agentId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ...

  // Get all agents that are online, available, within schedule, and have capacity
  const agents = await db.select()
    .from(supportAgents)
    .where(and(
      eq(supportAgents.isOnline, true),
      eq(supportAgents.isAvailable, true),
    ))
    .orderBy(asc(supportAgents.activeTicketCount), asc(supportAgents.lastAssignedAt));

  for (const agent of agents) {
    // Check work days
    const workDays = (agent.workDays as number[]) || [1, 2, 3, 4, 5];
    if (!workDays.includes(currentDay)) continue;

    // Check schedule
    const start = agent.scheduleStart || "08:00";
    const end = agent.scheduleEnd || "17:00";
    if (currentHour < start || currentHour > end) continue;

    // Check capacity
    if (agent.activeTicketCount >= agent.maxConcurrentTickets) continue;

    return { userId: agent.userId, agentId: agent.id };
  }

  return null;
}

export async function incrementAgentTicketCount(agentId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportAgents)
    .set({
      activeTicketCount: sql`${supportAgents.activeTicketCount} + 1`,
      lastAssignedAt: new Date(),
    })
    .where(eq(supportAgents.id, agentId));
}

export async function decrementAgentTicketCount(agentId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportAgents)
    .set({
      activeTicketCount: sql`GREATEST(${supportAgents.activeTicketCount} - 1, 0)`,
    })
    .where(eq(supportAgents.id, agentId));
}

export async function getAllAgents() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: supportAgents.id,
    userId: supportAgents.userId,
    isOnline: supportAgents.isOnline,
    isAvailable: supportAgents.isAvailable,
    scheduleStart: supportAgents.scheduleStart,
    scheduleEnd: supportAgents.scheduleEnd,
    workDays: supportAgents.workDays,
    maxConcurrentTickets: supportAgents.maxConcurrentTickets,
    activeTicketCount: supportAgents.activeTicketCount,
    lastAssignedAt: supportAgents.lastAssignedAt,
    userName: users.name,
    userEmail: users.email,
  })
    .from(supportAgents)
    .leftJoin(users, eq(supportAgents.userId, users.id));
}

export async function upsertAgent(data: InsertSupportAgent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if agent exists for this user
  const existing = await db.select().from(supportAgents).where(eq(supportAgents.userId, data.userId));
  if (existing.length > 0) {
    await db.update(supportAgents).set(data).where(eq(supportAgents.userId, data.userId));
    return existing[0].id;
  }
  const result = await db.insert(supportAgents).values(data);
  return result[0].insertId;
}

export async function updateAgentStatus(userId: number, isOnline: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportAgents)
    .set({ isOnline })
    .where(eq(supportAgents.userId, userId));
}

export async function getAgentByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(supportAgents).where(eq(supportAgents.userId, userId));
  return rows[0] || null;
}

// ============================================================================
// AUTO-REGISTER TECHNICIAN AS SUPPORT AGENT
// ============================================================================

export async function ensureAgentRegistered(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(supportAgents).where(eq(supportAgents.userId, userId));
  if (existing.length === 0) {
    await db.insert(supportAgents).values({
      userId,
      isOnline: true,
      isAvailable: true,
      scheduleStart: "00:00",
      scheduleEnd: "23:59",
      workDays: [0, 1, 2, 3, 4, 5, 6],
      maxConcurrentTickets: 10,
      activeTicketCount: 0,
    });
    console.log(`[Support] Auto-registered user ${userId} as support agent`);
  } else {
    await db.update(supportAgents)
      .set({ isOnline: true })
      .where(eq(supportAgents.userId, userId));
  }
}

// ============================================================================
// CHARGER PROBLEM REPORTS
// ============================================================================

export async function createProblemReport(report: InsertChargerProblemReport) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(chargerProblemReports).values(report);
  return result[0].insertId;
}

export async function getProblemReports(filters?: { status?: string; stationId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(chargerProblemReports.status, filters.status));
  if (filters?.stationId) conditions.push(eq(chargerProblemReports.stationId, filters.stationId));

  if (conditions.length > 0) {
    return db.select().from(chargerProblemReports)
      .where(and(...conditions))
      .orderBy(desc(chargerProblemReports.createdAt));
  }
  return db.select().from(chargerProblemReports).orderBy(desc(chargerProblemReports.createdAt));
}

export async function updateProblemReport(id: number, data: Partial<InsertChargerProblemReport>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(chargerProblemReports).set(data).where(eq(chargerProblemReports.id, id));
}

// ============================================================================
// PLATFORM SETTINGS HELPERS
// ============================================================================

export async function getSupportSettings() {
  const db = await getDb();
  if (!db) return { supportEmail: "soporte@greenhproject.com", supportPhone: "+573001234567", supportAutoAssign: true };
  const { platformSettings: ps } = await import("../../drizzle/schema");
  const rows = await db.select({
    supportEmail: ps.supportEmail,
    supportPhone: ps.supportPhone,
    supportAutoAssign: ps.supportAutoAssign,
  }).from(ps).limit(1);
  return rows[0] || { supportEmail: "soporte@greenhproject.com", supportPhone: "+573001234567", supportAutoAssign: true };
}
