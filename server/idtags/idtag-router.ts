import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";

// Procedimiento para administradores
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acceso denegado" });
  }
  return next({ ctx });
});

export const idTagRouter = router({
  // =========================================================================
  // USUARIO: Ver mis idTags
  // =========================================================================
  getMyIdTags: protectedProcedure.query(async ({ ctx }) => {
    return db.getIdTagsByUserId(ctx.user.id);
  }),

  // =========================================================================
  // USUARIO: Validar un idTag (para mostrar info en la app)
  // =========================================================================
  validateTag: protectedProcedure
    .input(z.object({ idTag: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.validateIdTag(input.idTag);
    }),

  // =========================================================================
  // ADMIN: Listar todos los idTags
  // =========================================================================
  listAll: adminProcedure
    .input(z.object({
      type: z.enum(["APP", "RFID", "NFC", "REMOTE"]).optional(),
      status: z.enum(["ACTIVE", "BLOCKED", "EXPIRED", "LOST"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getAllIdTags(input);
    }),

  // =========================================================================
  // ADMIN: Crear un nuevo idTag (para asignar tarjeta RFID a un usuario)
  // =========================================================================
  create: adminProcedure
    .input(z.object({
      idTag: z.string().min(1).max(50),
      userId: z.number().optional(),
      type: z.enum(["APP", "RFID", "NFC", "REMOTE"]),
      label: z.string().max(100).optional(),
      serialNumber: z.string().max(100).optional(),
      expiresAt: z.string().datetime().optional(),
      parentIdTag: z.string().max(50).optional(),
      maxActiveTransactions: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ input }) => {
      // Verificar que no existe
      const existing = await db.getIdTag(input.idTag);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `El idTag "${input.idTag}" ya existe`,
        });
      }

      // Verificar que el usuario existe si se proporcionó
      if (input.userId) {
        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Usuario con ID ${input.userId} no encontrado`,
          });
        }
      }

      const id = await db.createIdTag({
        idTag: input.idTag,
        userId: input.userId,
        type: input.type,
        label: input.label,
        serialNumber: input.serialNumber,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        parentIdTag: input.parentIdTag,
        maxActiveTransactions: input.maxActiveTransactions,
      });

      return { id, idTag: input.idTag };
    }),

  // =========================================================================
  // ADMIN: Actualizar un idTag
  // =========================================================================
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      userId: z.number().nullable().optional(),
      status: z.enum(["ACTIVE", "BLOCKED", "EXPIRED", "LOST"]).optional(),
      label: z.string().max(100).optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      maxActiveTransactions: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: any = {};
      
      if (data.userId !== undefined) updateData.userId = data.userId;
      if (data.status) updateData.status = data.status;
      if (data.label !== undefined) updateData.label = data.label;
      if (data.expiresAt !== undefined) {
        updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      }
      if (data.maxActiveTransactions) updateData.maxActiveTransactions = data.maxActiveTransactions;

      await db.updateIdTag(id, updateData);
      return { success: true };
    }),

  // =========================================================================
  // ADMIN: Bloquear un idTag
  // =========================================================================
  block: adminProcedure
    .input(z.object({ idTag: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await db.blockIdTag(input.idTag);
      return { success: true };
    }),

  // =========================================================================
  // ADMIN: Asignar idTag a un usuario
  // =========================================================================
  assignToUser: adminProcedure
    .input(z.object({
      idTag: z.string().min(1),
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const tag = await db.getIdTag(input.idTag);
      if (!tag) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `idTag "${input.idTag}" no encontrado`,
        });
      }

      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Usuario con ID ${input.userId} no encontrado`,
        });
      }

      await db.updateIdTag(tag.id, { userId: input.userId });
      return { success: true };
    }),

  // =========================================================================
  // ADMIN: Generar idTags RFID en lote (para imprimir tarjetas)
  // =========================================================================
  generateBatch: adminProcedure
    .input(z.object({
      count: z.number().min(1).max(100),
      type: z.enum(["RFID", "NFC"]),
      prefix: z.string().max(10).optional(),
      label: z.string().max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const generated: { id: number; idTag: string }[] = [];
      const prefix = input.prefix || (input.type === "RFID" ? "RF" : "NF");
      
      for (let i = 0; i < input.count; i++) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let j = 0; j < 8; j++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const idTag = `${prefix}-${code}`;
        
        try {
          const id = await db.createIdTag({
            idTag,
            type: input.type,
            label: input.label || `Tarjeta ${input.type} #${generated.length + 1}`,
          });
          generated.push({ id, idTag });
        } catch (e) {
          // Si hay colisión, reintentar
          i--;
        }
      }

      return { generated, count: generated.length };
    }),
});
