/**
 * EVGreen Platform - Loyalty Points Router
 * Sistema de fidelización: 1 punto por kWh cargado
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  loyaltyConfig,
  loyaltyPoints,
  loyaltyRedemptions,
} from "../../drizzle/schema";
import { eq, desc, sum, sql } from "drizzle-orm";

// ─── Helpers de BD ────────────────────────────────────────────────────────────

/** Obtiene la configuración global de loyalty (singleton id=1) */
export async function getLoyaltyConfig() {
  const db = (await getDb())!;
  const [cfg] = await db.select().from(loyaltyConfig).where(eq(loyaltyConfig.id, 1)).limit(1);
  return cfg ?? null;
}

/** Obtiene el saldo actual de puntos de un usuario */
export async function getUserLoyaltyBalance(userId: number): Promise<number> {
  const db = (await getDb())!;
  const result = await db
    .select({ total: sum(loyaltyPoints.points) })
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.userId, userId));
  return parseFloat((result[0]?.total as string) ?? "0") || 0;
}

/** Agrega puntos a un usuario por una sesión de carga */
export async function awardLoyaltyPoints({
  userId,
  kwhCharged,
  transactionId,
  pointsPerKwh,
}: {
  userId: number;
  kwhCharged: number;
  transactionId: number;
  pointsPerKwh: number;
}): Promise<number> {
  const db = (await getDb())!;
  const pointsEarned = parseFloat((kwhCharged * pointsPerKwh).toFixed(2));
  if (pointsEarned <= 0) return 0;

  const currentBalance = await getUserLoyaltyBalance(userId);
  const newBalance = parseFloat((currentBalance + pointsEarned).toFixed(2));

  await db.insert(loyaltyPoints).values({
    userId,
    points: pointsEarned.toString(),
    balanceAfter: newBalance.toString(),
    source: "charge_session",
    transactionId,
    kwhCharged: kwhCharged.toString(),
    description: `+${pointsEarned} pts por ${kwhCharged.toFixed(2)} kWh cargados`,
  });

  return pointsEarned;
}

// ─── Builder del router ───────────────────────────────────────────────────────

export function buildLoyaltyRouter(
  router: any,
  publicProcedure: any,
  protectedProcedure: any,
  adminProcedure: any
) {
  return router({
    /** Configuración pública del programa de puntos */
    getConfig: publicProcedure.query(async () => {
      const cfg = await getLoyaltyConfig();
      if (!cfg) return null;
      return {
        pointsPerKwh: parseFloat(cfg.pointsPerKwh),
        pointValueCop: parseFloat(cfg.pointValueCop),
        minRedemptionPoints: cfg.minRedemptionPoints,
        maxRedemptionPercent: parseFloat(cfg.maxRedemptionPercent),
        marketplaceUrl: cfg.marketplaceUrl,
        marketplaceName: cfg.marketplaceName,
        marketplaceDescription: cfg.marketplaceDescription,
        enabled: cfg.enabled,
        termsUrl: cfg.termsUrl,
      };
    }),

    /** Saldo de puntos del usuario autenticado */
    getBalance: protectedProcedure.query(async ({ ctx }: { ctx: { user: { id: number } } }) => {
      const balance = await getUserLoyaltyBalance(ctx.user.id);
      const cfg = await getLoyaltyConfig();
      const pointValueCop = cfg ? parseFloat(cfg.pointValueCop) : 75;
      const minPoints = cfg?.minRedemptionPoints ?? 100;
      return {
        balance,
        estimatedValueCop: parseFloat((balance * pointValueCop).toFixed(0)),
        canRedeem: balance >= minPoints,
        minRedemptionPoints: minPoints,
      };
    }),

    /** Historial de movimientos de puntos */
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(30) }))
      .query(async ({ ctx, input }: { ctx: { user: { id: number } }; input: { limit: number } }) => {
        const db = (await getDb())!;
        const rows = await db
          .select()
          .from(loyaltyPoints)
          .where(eq(loyaltyPoints.userId, ctx.user.id))
          .orderBy(desc(loyaltyPoints.createdAt))
          .limit(input.limit);
        return rows.map((r: any) => ({
          ...r,
          points: parseFloat(r.points),
          balanceAfter: parseFloat(r.balanceAfter),
          kwhCharged: r.kwhCharged ? parseFloat(r.kwhCharged) : null,
        }));
      }),

    /** Redimir puntos como descuento en billetera */
    redeem: protectedProcedure
      .input(z.object({ points: z.number().min(1, "Mínimo 1 punto") }))
      .mutation(async ({ ctx, input }: { ctx: { user: { id: number } }; input: { points: number } }) => {
        const db = (await getDb())!;
        const cfg = await getLoyaltyConfig();
        if (!cfg || !cfg.enabled) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El programa de puntos no está activo" });
        }

        const minPoints = cfg.minRedemptionPoints;
        const pointValueCop = parseFloat(cfg.pointValueCop);
        const balance = await getUserLoyaltyBalance(ctx.user.id);

        if (input.points > balance) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Saldo insuficiente. Tienes ${balance.toFixed(0)} puntos` });
        }
        if (input.points < minPoints) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Mínimo ${minPoints} puntos para redimir` });
        }

        const discountCop = parseFloat((input.points * pointValueCop).toFixed(0));
        const newBalance = parseFloat((balance - input.points).toFixed(2));

        // Registrar redención
        const [redemption] = await db
          .insert(loyaltyRedemptions)
          .values({
            userId: ctx.user.id,
            pointsUsed: input.points.toString(),
            discountAmountCop: discountCop.toString(),
            redemptionType: "charge_discount",
            status: "pending",
          })
          .$returningId();

        // Registrar movimiento negativo
        await db.insert(loyaltyPoints).values({
          userId: ctx.user.id,
          points: (-input.points).toString(),
          balanceAfter: newBalance.toString(),
          source: "redemption",
          description: `Redención de ${input.points} pts → $${discountCop.toLocaleString("es-CO")} COP`,
        });

        // Acreditar descuento en billetera
        await db.execute(
          sql`UPDATE wallets SET balance = balance + ${discountCop} WHERE userId = ${ctx.user.id}`
        );

        // Marcar redención como aplicada
        await db
          .update(loyaltyRedemptions)
          .set({ status: "applied", appliedAt: new Date() })
          .where(eq(loyaltyRedemptions.id, (redemption as any).id));

        return {
          success: true,
          pointsRedeemed: input.points,
          discountCop,
          newBalance,
          message: `¡Redimiste ${input.points} puntos! Se acreditaron $${discountCop.toLocaleString("es-CO")} COP a tu billetera.`,
        };
      }),

    /** Historial de redenciones del usuario */
    getRedemptions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
      .query(async ({ ctx, input }: { ctx: { user: { id: number } }; input: { limit: number } }) => {
        const db = (await getDb())!;
        const rows = await db
          .select()
          .from(loyaltyRedemptions)
          .where(eq(loyaltyRedemptions.userId, ctx.user.id))
          .orderBy(desc(loyaltyRedemptions.createdAt))
          .limit(input.limit);
        return rows.map((r: any) => ({
          ...r,
          pointsUsed: parseFloat(r.pointsUsed),
          discountAmountCop: parseFloat(r.discountAmountCop),
        }));
      }),

    // ─── Admin ────────────────────────────────────────────────────────────────

    /** Admin: actualizar configuración del programa de puntos */
    adminUpdateConfig: adminProcedure
      .input(
        z.object({
          pointsPerKwh: z.number().min(0.1).max(100).optional(),
          pointValueCop: z.number().min(1).max(10000).optional(),
          minRedemptionPoints: z.number().min(1).max(10000).optional(),
          maxRedemptionPercent: z.number().min(1).max(100).optional(),
          marketplaceUrl: z.string().url().nullable().optional(),
          marketplaceName: z.string().max(100).optional(),
          marketplaceDescription: z.string().max(300).nullable().optional(),
          enabled: z.boolean().optional(),
          termsUrl: z.string().url().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }: { ctx: { user: { id: number } }; input: any }) => {
        const db = (await getDb())!;
        const existing = await getLoyaltyConfig();
        const updateData: Record<string, any> = { updatedBy: ctx.user.id };

        if (input.pointsPerKwh !== undefined) updateData.pointsPerKwh = input.pointsPerKwh.toString();
        if (input.pointValueCop !== undefined) updateData.pointValueCop = input.pointValueCop.toString();
        if (input.minRedemptionPoints !== undefined) updateData.minRedemptionPoints = input.minRedemptionPoints;
        if (input.maxRedemptionPercent !== undefined) updateData.maxRedemptionPercent = input.maxRedemptionPercent.toString();
        if (input.marketplaceUrl !== undefined) updateData.marketplaceUrl = input.marketplaceUrl;
        if (input.marketplaceName !== undefined) updateData.marketplaceName = input.marketplaceName;
        if (input.marketplaceDescription !== undefined) updateData.marketplaceDescription = input.marketplaceDescription;
        if (input.enabled !== undefined) updateData.enabled = input.enabled;
        if (input.termsUrl !== undefined) updateData.termsUrl = input.termsUrl;

        if (existing) {
          await db.update(loyaltyConfig).set(updateData).where(eq(loyaltyConfig.id, 1));
        } else {
          await db.insert(loyaltyConfig).values({ id: 1, ...updateData });
        }

        return { success: true, message: "Configuración de puntos actualizada" };
      }),

    /** Admin: ver saldo de puntos de cualquier usuario */
    adminGetUserBalance: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }: { input: { userId: number } }) => {
        const db = (await getDb())!;
        const balance = await getUserLoyaltyBalance(input.userId);
        const history = await db
          .select()
          .from(loyaltyPoints)
          .where(eq(loyaltyPoints.userId, input.userId))
          .orderBy(desc(loyaltyPoints.createdAt))
          .limit(20);
        return { balance, history };
      }),

    /** Admin: ajuste manual de puntos */
    adminAdjustPoints: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          points: z.number(),
          reason: z.string().max(200),
        })
      )
      .mutation(async ({ ctx, input }: { ctx: { user: { id: number } }; input: { userId: number; points: number; reason: string } }) => {
        const db = (await getDb())!;
        const balance = await getUserLoyaltyBalance(input.userId);
        const newBalance = parseFloat((balance + input.points).toFixed(2));
        if (newBalance < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El ajuste dejaría el saldo en negativo" });
        }
        await db.insert(loyaltyPoints).values({
          userId: input.userId,
          points: input.points.toString(),
          balanceAfter: newBalance.toString(),
          source: "adjustment",
          description: `Ajuste manual por admin: ${input.reason}`,
        });
        return { success: true, newBalance };
      }),
  });
}
