/**
 * ============================================================================
 * Maintenance Schedule Router - Mantenimientos preventivos programados
 * ============================================================================
 * CRUD para programar, editar, completar y cancelar mantenimientos.
 * Accesible desde: admin, soporte (jefe de área/ingeniero), técnico.
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { getDb } from "../db";
import { 
  scheduledMaintenances, 
  maintenanceTasks, 
  chargingStations, 
  users,
  InsertScheduledMaintenance,
  InsertMaintenanceTask,
} from "../../drizzle/schema";
import { eq, and, desc, asc, gte, lte, sql, or, inArray } from "drizzle-orm";

// Tipos de mantenimiento disponibles
const MAINTENANCE_TYPES = [
  "preventivo",
  "inspección",
  "limpieza",
  "calibración",
  "actualización_firmware",
  "revisión_eléctrica",
  "revisión_conectores",
  "prueba_carga",
] as const;

const FREQUENCIES = [
  "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "one_time"
] as const;

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  one_time: "Una vez",
};

/**
 * Calculate the next due date based on frequency and current date
 */
function calculateNextDueDate(frequency: string, fromDate: Date): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "biweekly": next.setDate(next.getDate() + 14); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "quarterly": next.setMonth(next.getMonth() + 3); break;
    case "semiannual": next.setMonth(next.getMonth() + 6); break;
    case "annual": next.setFullYear(next.getFullYear() + 1); break;
    case "one_time": break; // No recurrence
  }
  return next;
}

// Procedure that allows admin, support_lead, and support roles
const supportProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "support_lead", "support"];
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Solo admin y soporte pueden gestionar mantenimientos programados" 
    });
  }
  return next({ ctx });
});

export const maintenanceScheduleRouter = router({
  // ============================================================================
  // LIST - Listar mantenimientos programados
  // ============================================================================
  list: supportProcedure
    .input(z.object({
      stationId: z.number().optional(),
      status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const conditions = [];
      if (input?.stationId) conditions.push(eq(scheduledMaintenances.stationId, input.stationId));
      if (input?.status) conditions.push(eq(scheduledMaintenances.status, input.status));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [schedules, countResult] = await Promise.all([
        database.select({
          id: scheduledMaintenances.id,
          stationId: scheduledMaintenances.stationId,
          stationName: chargingStations.name,
          title: scheduledMaintenances.title,
          description: scheduledMaintenances.description,
          maintenanceType: scheduledMaintenances.maintenanceType,
          frequency: scheduledMaintenances.frequency,
          nextDueDate: scheduledMaintenances.nextDueDate,
          lastCompletedDate: scheduledMaintenances.lastCompletedDate,
          preferredTimeStart: scheduledMaintenances.preferredTimeStart,
          preferredTimeEnd: scheduledMaintenances.preferredTimeEnd,
          assignedTechnicianId: scheduledMaintenances.assignedTechnicianId,
          technicianName: users.name,
          estimatedCostCop: scheduledMaintenances.estimatedCostCop,
          reminderDaysBefore: scheduledMaintenances.reminderDaysBefore,
          status: scheduledMaintenances.status,
          notes: scheduledMaintenances.notes,
          createdAt: scheduledMaintenances.createdAt,
        })
        .from(scheduledMaintenances)
        .leftJoin(chargingStations, eq(scheduledMaintenances.stationId, chargingStations.id))
        .leftJoin(users, eq(scheduledMaintenances.assignedTechnicianId, users.id))
        .where(whereClause)
        .orderBy(asc(scheduledMaintenances.nextDueDate))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0),
        
        database.select({ count: sql<number>`count(*)` })
          .from(scheduledMaintenances)
          .where(whereClause),
      ]);

      return {
        schedules,
        total: countResult[0]?.count ?? 0,
        frequencyLabels: FREQUENCY_LABELS,
        maintenanceTypes: MAINTENANCE_TYPES,
      };
    }),

  // ============================================================================
  // CREATE - Crear nuevo mantenimiento programado
  // ============================================================================
  create: supportProcedure
    .input(z.object({
      stationId: z.number(),
      title: z.string().min(3).max(255),
      description: z.string().optional(),
      maintenanceType: z.string().min(1),
      frequency: z.enum(FREQUENCIES),
      nextDueDate: z.string(), // ISO date string
      preferredTimeStart: z.string().default("08:00"),
      preferredTimeEnd: z.string().default("17:00"),
      assignedTechnicianId: z.number().optional(),
      assignedEngineerId: z.number().optional(),
      estimatedCostCop: z.number().min(0).default(0),
      reminderDaysBefore: z.number().min(1).max(30).default(3),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Verify station exists
      const station = await database.select().from(chargingStations).where(eq(chargingStations.id, input.stationId)).limit(1);
      if (station.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      }

      const result = await database.insert(scheduledMaintenances).values({
        stationId: input.stationId,
        title: input.title,
        description: input.description || null,
        maintenanceType: input.maintenanceType,
        frequency: input.frequency,
        nextDueDate: new Date(input.nextDueDate),
        preferredTimeStart: input.preferredTimeStart,
        preferredTimeEnd: input.preferredTimeEnd,
        assignedTechnicianId: input.assignedTechnicianId || null,
        assignedEngineerId: input.assignedEngineerId || null,
        estimatedCostCop: input.estimatedCostCop,
        reminderDaysBefore: input.reminderDaysBefore,
        notes: input.notes || null,
        createdBy: ctx.user.id,
      });

      // Create the first task for this schedule
      const taskDueDate = new Date(input.nextDueDate);
      await database.insert(maintenanceTasks).values({
        scheduleId: Number(result[0].insertId),
        stationId: input.stationId,
        title: input.title,
        description: input.description || null,
        maintenanceType: input.maintenanceType,
        dueDate: taskDueDate,
        scheduledDate: taskDueDate,
        assignedTechnicianId: input.assignedTechnicianId || null,
      });

      return { id: Number(result[0].insertId), message: "Mantenimiento programado creado exitosamente" };
    }),

  // ============================================================================
  // UPDATE - Actualizar mantenimiento programado
  // ============================================================================
  update: supportProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(3).max(255).optional(),
      description: z.string().optional(),
      maintenanceType: z.string().optional(),
      frequency: z.enum(FREQUENCIES).optional(),
      nextDueDate: z.string().optional(),
      preferredTimeStart: z.string().optional(),
      preferredTimeEnd: z.string().optional(),
      assignedTechnicianId: z.number().nullable().optional(),
      assignedEngineerId: z.number().nullable().optional(),
      estimatedCostCop: z.number().min(0).optional(),
      reminderDaysBefore: z.number().min(1).max(30).optional(),
      status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const updateData: Record<string, any> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.maintenanceType !== undefined) updateData.maintenanceType = input.maintenanceType;
      if (input.frequency !== undefined) updateData.frequency = input.frequency;
      if (input.nextDueDate !== undefined) updateData.nextDueDate = new Date(input.nextDueDate);
      if (input.preferredTimeStart !== undefined) updateData.preferredTimeStart = input.preferredTimeStart;
      if (input.preferredTimeEnd !== undefined) updateData.preferredTimeEnd = input.preferredTimeEnd;
      if (input.assignedTechnicianId !== undefined) updateData.assignedTechnicianId = input.assignedTechnicianId;
      if (input.assignedEngineerId !== undefined) updateData.assignedEngineerId = input.assignedEngineerId;
      if (input.estimatedCostCop !== undefined) updateData.estimatedCostCop = input.estimatedCostCop;
      if (input.reminderDaysBefore !== undefined) updateData.reminderDaysBefore = input.reminderDaysBefore;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No hay campos para actualizar" });
      }

      await database.update(scheduledMaintenances)
        .set(updateData)
        .where(eq(scheduledMaintenances.id, input.id));

      return { message: "Mantenimiento actualizado exitosamente" };
    }),

  // ============================================================================
  // DELETE - Cancelar mantenimiento programado
  // ============================================================================
  cancel: supportProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      await database.update(scheduledMaintenances)
        .set({ status: "cancelled" })
        .where(eq(scheduledMaintenances.id, input.id));

      // Cancel all pending tasks for this schedule
      await database.update(maintenanceTasks)
        .set({ status: "cancelled" })
        .where(and(
          eq(maintenanceTasks.scheduleId, input.id),
          eq(maintenanceTasks.status, "pending"),
        ));

      return { message: "Mantenimiento cancelado" };
    }),

  // ============================================================================
  // TASKS - Listar tareas de mantenimiento
  // ============================================================================
  listTasks: supportProcedure
    .input(z.object({
      scheduleId: z.number().optional(),
      stationId: z.number().optional(),
      status: z.enum(["pending", "in_progress", "completed", "overdue", "cancelled"]).optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const conditions = [];
      if (input?.scheduleId) conditions.push(eq(maintenanceTasks.scheduleId, input.scheduleId));
      if (input?.stationId) conditions.push(eq(maintenanceTasks.stationId, input.stationId));
      if (input?.status) conditions.push(eq(maintenanceTasks.status, input.status));
      if (input?.fromDate) conditions.push(gte(maintenanceTasks.dueDate, new Date(input.fromDate)));
      if (input?.toDate) conditions.push(lte(maintenanceTasks.dueDate, new Date(input.toDate)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [tasks, countResult] = await Promise.all([
        database.select({
          id: maintenanceTasks.id,
          scheduleId: maintenanceTasks.scheduleId,
          stationId: maintenanceTasks.stationId,
          stationName: chargingStations.name,
          title: maintenanceTasks.title,
          description: maintenanceTasks.description,
          maintenanceType: maintenanceTasks.maintenanceType,
          dueDate: maintenanceTasks.dueDate,
          scheduledDate: maintenanceTasks.scheduledDate,
          completedDate: maintenanceTasks.completedDate,
          assignedTechnicianId: maintenanceTasks.assignedTechnicianId,
          technicianName: users.name,
          status: maintenanceTasks.status,
          completionNotes: maintenanceTasks.completionNotes,
          actualCostCop: maintenanceTasks.actualCostCop,
          qualityRating: maintenanceTasks.qualityRating,
          createdAt: maintenanceTasks.createdAt,
        })
        .from(maintenanceTasks)
        .leftJoin(chargingStations, eq(maintenanceTasks.stationId, chargingStations.id))
        .leftJoin(users, eq(maintenanceTasks.assignedTechnicianId, users.id))
        .where(whereClause)
        .orderBy(asc(maintenanceTasks.dueDate))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0),

        database.select({ count: sql<number>`count(*)` })
          .from(maintenanceTasks)
          .where(whereClause),
      ]);

      return { tasks, total: countResult[0]?.count ?? 0 };
    }),

  // ============================================================================
  // COMPLETE TASK - Completar una tarea de mantenimiento
  // ============================================================================
  completeTask: supportProcedure
    .input(z.object({
      taskId: z.number(),
      completionNotes: z.string().optional(),
      actualCostCop: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Get the task
      const task = await database.select().from(maintenanceTasks).where(eq(maintenanceTasks.id, input.taskId)).limit(1);
      if (task.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tarea no encontrada" });
      }

      const now = new Date();

      // Complete the task
      await database.update(maintenanceTasks)
        .set({
          status: "completed",
          completedDate: now,
          completionNotes: input.completionNotes || null,
          actualCostCop: input.actualCostCop,
        })
        .where(eq(maintenanceTasks.id, input.taskId));

      // Update the schedule
      const schedule = await database.select().from(scheduledMaintenances)
        .where(eq(scheduledMaintenances.id, task[0].scheduleId)).limit(1);

      if (schedule.length > 0 && schedule[0].frequency !== "one_time") {
        // Calculate next due date and create next task
        const nextDue = calculateNextDueDate(schedule[0].frequency, now);
        
        await database.update(scheduledMaintenances)
          .set({
            lastCompletedDate: now,
            nextDueDate: nextDue,
            reminderSent: false,
          })
          .where(eq(scheduledMaintenances.id, schedule[0].id));

        // Create next task
        await database.insert(maintenanceTasks).values({
          scheduleId: schedule[0].id,
          stationId: schedule[0].stationId,
          title: schedule[0].title,
          description: schedule[0].description || null,
          maintenanceType: schedule[0].maintenanceType,
          dueDate: nextDue,
          scheduledDate: nextDue,
          assignedTechnicianId: schedule[0].assignedTechnicianId,
        });
      } else if (schedule.length > 0 && schedule[0].frequency === "one_time") {
        // Mark schedule as completed for one-time
        await database.update(scheduledMaintenances)
          .set({ status: "completed", lastCompletedDate: now })
          .where(eq(scheduledMaintenances.id, schedule[0].id));
      }

      return { message: "Tarea completada exitosamente" };
    }),

  // ============================================================================
  // RATE TASK - Calificar una tarea completada
  // ============================================================================
  rateTask: supportProcedure
    .input(z.object({
      taskId: z.number(),
      qualityRating: z.number().min(1).max(5),
      ratingNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      await database.update(maintenanceTasks)
        .set({
          qualityRating: input.qualityRating,
          ratingNotes: input.ratingNotes || null,
          ratedBy: ctx.user.id,
        })
        .where(eq(maintenanceTasks.id, input.taskId));

      return { message: "Calificación registrada" };
    }),

  // ============================================================================
  // CALENDAR VIEW - Vista de calendario con tareas por rango de fechas
  // ============================================================================
  calendarView: supportProcedure
    .input(z.object({
      startDate: z.string(), // ISO date
      endDate: z.string(), // ISO date
      stationId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const conditions = [
        gte(maintenanceTasks.dueDate, new Date(input.startDate)),
        lte(maintenanceTasks.dueDate, new Date(input.endDate)),
      ];
      if (input.stationId) conditions.push(eq(maintenanceTasks.stationId, input.stationId));

      const tasks = await database.select({
        id: maintenanceTasks.id,
        scheduleId: maintenanceTasks.scheduleId,
        stationId: maintenanceTasks.stationId,
        stationName: chargingStations.name,
        title: maintenanceTasks.title,
        maintenanceType: maintenanceTasks.maintenanceType,
        dueDate: maintenanceTasks.dueDate,
        scheduledDate: maintenanceTasks.scheduledDate,
        status: maintenanceTasks.status,
        assignedTechnicianId: maintenanceTasks.assignedTechnicianId,
        technicianName: users.name,
      })
      .from(maintenanceTasks)
      .leftJoin(chargingStations, eq(maintenanceTasks.stationId, chargingStations.id))
      .leftJoin(users, eq(maintenanceTasks.assignedTechnicianId, users.id))
      .where(and(...conditions))
      .orderBy(asc(maintenanceTasks.dueDate));

      return { tasks };
    }),

  // ============================================================================
  // DASHBOARD STATS - Estadísticas para el dashboard de soporte
  // ============================================================================
  dashboardStats: supportProcedure.query(async () => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [activeSchedules, pendingTasks, overdueTasks, upcomingTasks, completedThisMonth] = await Promise.all([
      // Active schedules count
      database.select({ count: sql<number>`count(*)` })
        .from(scheduledMaintenances)
        .where(eq(scheduledMaintenances.status, "active")),
      
      // Pending tasks count
      database.select({ count: sql<number>`count(*)` })
        .from(maintenanceTasks)
        .where(eq(maintenanceTasks.status, "pending")),
      
      // Overdue tasks (pending + past due date)
      database.select({ count: sql<number>`count(*)` })
        .from(maintenanceTasks)
        .where(and(
          eq(maintenanceTasks.status, "pending"),
          lte(maintenanceTasks.dueDate, now),
        )),
      
      // Tasks due in next 7 days
      database.select({ count: sql<number>`count(*)` })
        .from(maintenanceTasks)
        .where(and(
          eq(maintenanceTasks.status, "pending"),
          gte(maintenanceTasks.dueDate, now),
          lte(maintenanceTasks.dueDate, nextWeek),
        )),
      
      // Completed this month
      database.select({ count: sql<number>`count(*)` })
        .from(maintenanceTasks)
        .where(and(
          eq(maintenanceTasks.status, "completed"),
          gte(maintenanceTasks.completedDate, new Date(now.getFullYear(), now.getMonth(), 1)),
        )),
    ]);

    return {
      activeSchedules: activeSchedules[0]?.count ?? 0,
      pendingTasks: pendingTasks[0]?.count ?? 0,
      overdueTasks: overdueTasks[0]?.count ?? 0,
      upcomingTasks: upcomingTasks[0]?.count ?? 0,
      completedThisMonth: completedThisMonth[0]?.count ?? 0,
    };
  }),

  // ============================================================================
  // GET TECHNICIANS - Obtener lista de técnicos disponibles
  // ============================================================================
  getTechnicians: supportProcedure.query(async () => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const technicians = await database.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(sql`${users.role} IN ('support', 'support_lead', 'admin', 'engineer')`)
    .orderBy(asc(users.name));

    return { technicians };
  }),

  // ============================================================================
  // GET STATIONS - Obtener lista de estaciones para el selector
  // ============================================================================
  getStations: supportProcedure.query(async () => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const stations = await database.select({
      id: chargingStations.id,
      name: chargingStations.name,
      city: chargingStations.city,
      address: chargingStations.address,
    })
    .from(chargingStations)
    .orderBy(asc(chargingStations.name));

    return { stations };
  }),
});
