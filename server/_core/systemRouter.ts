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
   */
  triggerWeeklyReport: adminProcedure
    .input(z.object({ userId: z.number().int().positive().optional() }))
    .mutation(async ({ input }) => {
      if (input.userId) {
        const result = await sendWeeklyReportToUser(input.userId);
        return { success: result.sent, reason: result.reason ?? null, count: result.sent ? 1 : 0 };
      }
      await runWeeklyReportJob();
      return { success: true, reason: null, count: -1 }; // -1 = todos los elegibles
    }),
});
