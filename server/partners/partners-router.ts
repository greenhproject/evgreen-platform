/**
 * Partners Router - Endpoints para el programa de distribuidores
 * - apply: Formulario público de aplicación
 * - admin.list: Lista de aplicaciones (admin)
 * - admin.updateStatus: Cambiar estado de aplicación (admin)
 */
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { partnerApplications } from "../../drizzle/schema";
import { eq, desc, like, or, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export const partnersRouter = router({
  // ============ PUBLIC: Apply to partner program ============
  submitApplication: publicProcedure
    .input(z.object({
      companyName: z.string().min(1, "Nombre de empresa requerido"),
      contactName: z.string().min(1, "Nombre de contacto requerido"),
      email: z.string().email("Email inválido"),
      phone: z.string().min(5, "Teléfono requerido"),
      city: z.string().optional(),
      currentBrands: z.string().optional(),
      annualVolume: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const now = Date.now();

      await db!.insert(partnerApplications).values({
        companyName: input.companyName,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        city: input.city || null,
        currentBrands: input.currentBrands || null,
        annualVolume: input.annualVolume || null,
        message: input.message || null,
        status: "pending",
        createdAt: now,
      });

      // Notify owner about new partner application
      await notifyOwner({
        title: "Nueva Aplicación Partner",
        content: `${input.companyName} (${input.contactName}) ha aplicado al programa de Partners.\nEmail: ${input.email}\nTeléfono: ${input.phone}\nCiudad: ${input.city || "N/A"}\nMarcas: ${input.currentBrands || "N/A"}\nVolumen: ${input.annualVolume || "N/A"}`,
      });

      return { success: true };
    }),

  // ============ ADMIN: List partner applications ============
  admin: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.enum(["all", "pending", "contacted", "approved", "rejected"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const db = await getDb();
        const conditions: any[] = [];

        if (input.status && input.status !== "all") {
          conditions.push(eq(partnerApplications.status, input.status));
        }

        if (input.search) {
          const s = `%${input.search}%`;
          conditions.push(
            or(
              like(partnerApplications.companyName, s),
              like(partnerApplications.contactName, s),
              like(partnerApplications.email, s),
              like(partnerApplications.city, s),
            )
          );
        }

        const query = db!.select().from(partnerApplications);
        const results = conditions.length > 0
          ? await query.where(sql`${sql.join(conditions, sql` AND `)}`)
              .orderBy(desc(partnerApplications.createdAt))
          : await query.orderBy(desc(partnerApplications.createdAt));

        return results;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "contacted", "approved", "rejected"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const db = await getDb();
        await db!.update(partnerApplications)
          .set({ status: input.status, updatedAt: Date.now() })
          .where(eq(partnerApplications.id, input.id));
        return { success: true };
      }),
  }),
});
