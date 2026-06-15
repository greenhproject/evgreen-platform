/**
 * Router tRPC para gestión de API Keys desde el panel admin
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { generateApiKey, hashApiKey } from "./public-api";
import { TRPCError } from "@trpc/server";

export function buildApiKeysRouter(router: any, adminProcedure: any) {
  return router({
    /**
     * Listar API keys del usuario actual (admin ve todas)
     */
    list: adminProcedure.query(async ({ ctx }: any) => {
      const database = await getDb();
      if (!database) return [];

      const result = await database.execute(sql`
        SELECT ak.id, ak.userId, ak.name, ak.keyPrefix, ak.permissions,
               ak.isActive, ak.expiresAt, ak.lastUsedAt, ak.usageCount, ak.createdAt,
               u.name as userName, u.email as userEmail
        FROM api_keys ak
        JOIN users u ON ak.userId = u.id
        ORDER BY ak.createdAt DESC
      `);
      return ((result as any)[0] as any[]) || [];
    }),

    /**
     * Crear nueva API key
     */
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        permissions: z.array(z.string()).optional(),
        expiresInDays: z.number().min(1).max(365).optional(),
      }))
      .mutation(async ({ ctx, input }: any) => {
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

        const rawKey = generateApiKey();
        const keyHash = hashApiKey(rawKey);
        const keyPrefix = rawKey.substring(0, 12);
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null;

        await database.execute(sql`
          INSERT INTO api_keys (userId, name, keyHash, keyPrefix, permissions, isActive, expiresAt, createdAt)
          VALUES (${ctx.user.id}, ${input.name}, ${keyHash}, ${keyPrefix},
                  ${JSON.stringify(input.permissions || ["*"])}, 1,
                  ${expiresAt ? expiresAt.toISOString().slice(0, 19).replace("T", " ") : null},
                  NOW())
        `);

        // Retornar la key completa SOLO en la creación (después no se puede recuperar)
        return {
          success: true,
          apiKey: rawKey,
          prefix: keyPrefix,
          name: input.name,
          message: "⚠️ Guarda esta API Key ahora. No podrás verla de nuevo.",
        };
      }),

    /**
     * Revocar (desactivar) una API key
     */
    revoke: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await database.execute(sql`
          UPDATE api_keys SET isActive = 0 WHERE id = ${input.id}
        `);
        return { success: true };
      }),

    /**
     * Eliminar una API key permanentemente
     */
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await database.execute(sql`DELETE FROM api_keys WHERE id = ${input.id}`);
        return { success: true };
      }),
  });
}
