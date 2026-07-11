import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { runWeeklyReportJob, sendWeeklyReportToUser } from "../email/weekly-report-email";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /**
   * Dispara el job de reporte semanal manualmente (para pruebas desde el panel admin).
   * Si se pasa userId, solo envía a ese usuario. Si no, envía a todos los elegibles.
   * mode: "last_week" = semana pasada lunes-domingo | "last_7_days" = últimos 7 días (default para trigger manual)
   */
  triggerWeeklyReport: adminProcedure
    .input(z.object({
      userId: z.number().int().positive().optional(),
      mode: z.enum(["last_week", "last_7_days"]).default("last_7_days"),
    }))
    .mutation(async ({ input }) => {
      if (input.userId) {
        const result = await sendWeeklyReportToUser(input.userId, input.mode);
        return {
          success: result.sent,
          reason: result.reason ?? null,
          sent: result.sent ? 1 : 0,
          skipped: result.sent ? 0 : 1,
          errors: 0,
          eligible: 1,
        };
      }
      const stats = await runWeeklyReportJob(input.mode);
      return {
        success: stats.sent > 0 || stats.eligible === 0,
        reason: null,
        ...stats,
      };
    }),
});
