/**
 * loyalty-service.ts
 * Servicio de fidelización EVGreen Rewards
 * Gestiona la acumulación y redención de puntos por kWh cargado
 */

import { getDb } from "../db";
import { loyaltyPoints, loyaltyConfig, loyaltyRedemptions } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AwardPointsInput {
  userId: number;
  transactionId: number;
  kwhDelivered: number;
}

export interface RedeemPointsInput {
  userId: number;
  pointsToRedeem: number;
  transactionId?: number;
  redemptionType?: "charge_discount" | "marketplace";
}

// ─── Helpers de configuración ─────────────────────────────────────────────────

/**
 * Obtiene la configuración activa del programa de puntos.
 * Si no existe, retorna los valores por defecto.
 */
export async function getLoyaltyConfig() {
  const db = (await getDb())!;
  const rows = await db.select().from(loyaltyConfig).limit(1);
  if (rows.length > 0) return rows[0];
  // Valores por defecto si no hay config en BD
  return {
    id: 0,
    pointsPerKwh: "1.00",
    pointValueCop: "50.00",
    minRedemptionPoints: 100,
    maxRedemptionPercent: "20.00",
    marketplaceUrl: null as string | null,
    marketplaceName: "Marketplace EVGreen",
    marketplaceDescription: null as string | null,
    enabled: true,
    termsUrl: null as string | null,
    updatedBy: null as number | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Saldo del usuario ────────────────────────────────────────────────────────

/**
 * Retorna el saldo actual de puntos del usuario (suma de todos los movimientos)
 */
export async function getUserLoyaltyBalance(userId: number): Promise<number> {
  const db = (await getDb())!;
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(${loyaltyPoints.points}), 0)` })
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.userId, userId));
  return Math.max(0, parseFloat(result[0]?.total ?? "0"));
}

// ─── Acumulación de puntos ────────────────────────────────────────────────────

/**
 * Acumula puntos al completar una sesión de carga.
 * Idempotente: si ya se acumularon puntos para esta transacción, no duplica.
 */
export async function awardLoyaltyPoints(input: AwardPointsInput): Promise<{ pointsAwarded: number } | null> {
  const db = (await getDb())!;

  const config = await getLoyaltyConfig();
  if (!config.enabled) return null;

  // Verificar idempotencia: ¿ya se acumularon puntos para esta transacción?
  const existing = await db
    .select({ id: loyaltyPoints.id })
    .from(loyaltyPoints)
    .where(
      and(
        eq(loyaltyPoints.userId, input.userId),
        eq(loyaltyPoints.transactionId, input.transactionId),
        eq(loyaltyPoints.source, "charge_session"),
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Loyalty] Points already awarded for transaction ${input.transactionId}, skipping.`);
    return null;
  }

  const pointsPerKwh = parseFloat(String(config.pointsPerKwh));
  const rawPoints = input.kwhDelivered * pointsPerKwh;
  const pointsAwarded = Math.floor(rawPoints); // Solo puntos enteros

  if (pointsAwarded <= 0) return null;

  // Calcular saldo actual para registrar balanceAfter
  const currentBalance = await getUserLoyaltyBalance(input.userId);
  const balanceAfter = currentBalance + pointsAwarded;

  await db.insert(loyaltyPoints).values({
    userId: input.userId,
    points: String(pointsAwarded),
    balanceAfter: String(balanceAfter),
    source: "charge_session",
    transactionId: input.transactionId,
    kwhCharged: String(input.kwhDelivered.toFixed(4)),
    description: `${input.kwhDelivered.toFixed(2)} kWh cargados`,
  });

  return { pointsAwarded };
}

// ─── Redención de puntos ──────────────────────────────────────────────────────

/**
 * Redime puntos del saldo del usuario.
 * Retorna el monto en COP equivalente al descuento.
 */
export async function redeemLoyaltyPoints(input: RedeemPointsInput): Promise<{
  success: boolean;
  discountCop: number;
  pointsRedeemed: number;
  error?: string;
}> {
  const db = (await getDb())!;

  const config = await getLoyaltyConfig();
  if (!config.enabled) {
    return { success: false, discountCop: 0, pointsRedeemed: 0, error: "Programa de puntos no activo" };
  }

  if (input.pointsToRedeem < config.minRedemptionPoints) {
    return {
      success: false,
      discountCop: 0,
      pointsRedeemed: 0,
      error: `Mínimo ${config.minRedemptionPoints} puntos para redimir`,
    };
  }

  // Verificar saldo disponible
  const balance = await getUserLoyaltyBalance(input.userId);
  if (balance < input.pointsToRedeem) {
    return {
      success: false,
      discountCop: 0,
      pointsRedeemed: 0,
      error: `Saldo insuficiente. Tienes ${Math.floor(balance)} puntos.`,
    };
  }

  const pointValueCop = parseFloat(String(config.pointValueCop));
  const discountCop = input.pointsToRedeem * pointValueCop;
  const balanceAfter = balance - input.pointsToRedeem;

  // Registrar movimiento negativo en loyalty_points
  await db.insert(loyaltyPoints).values({
    userId: input.userId,
    points: String(-input.pointsToRedeem),
    balanceAfter: String(balanceAfter),
    source: "redemption",
    transactionId: input.transactionId ?? null,
    description: `Redención: $${discountCop.toLocaleString("es-CO")} COP`,
  });

  // Registrar en loyalty_redemptions para trazabilidad
  await db.insert(loyaltyRedemptions).values({
    userId: input.userId,
    pointsUsed: String(input.pointsToRedeem),
    discountAmountCop: String(discountCop),
    redemptionType: input.redemptionType ?? "charge_discount",
    transactionId: input.transactionId ?? null,
    status: "applied",
    appliedAt: new Date(),
  });

  return { success: true, discountCop, pointsRedeemed: input.pointsToRedeem };
}

// ─── Historial ────────────────────────────────────────────────────────────────

/**
 * Retorna el historial de puntos del usuario (últimas 50 transacciones)
 */
export async function getUserLoyaltyHistory(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(loyaltyPoints)
    .where(eq(loyaltyPoints.userId, userId))
    .orderBy(sql`${loyaltyPoints.createdAt} DESC`)
    .limit(50);
}

// ─── Estadísticas admin ───────────────────────────────────────────────────────

export async function getLoyaltyAdminStats() {
  const db = (await getDb())!;

  const [usersWithPointsResult, totalIssuedResult, totalRedeemedResult] = await Promise.all([
    db.select({ count: sql<number>`COUNT(DISTINCT ${loyaltyPoints.userId})` }).from(loyaltyPoints),
    db
      .select({ total: sql<string>`COALESCE(SUM(${loyaltyPoints.points}), 0)` })
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.source, "charge_session")),
    db
      .select({ total: sql<string>`COALESCE(ABS(SUM(${loyaltyPoints.points})), 0)` })
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.source, "redemption")),
  ]);

  const totalIssued = parseFloat(totalIssuedResult[0]?.total ?? "0");
  const totalRedeemed = parseFloat(totalRedeemedResult[0]?.total ?? "0");

  return {
    usersWithPoints: Number(usersWithPointsResult[0]?.count ?? 0),
    totalPointsIssued: Math.floor(totalIssued),
    totalPointsRedeemed: Math.floor(totalRedeemed),
    totalPointsActive: Math.max(0, Math.floor(totalIssued - totalRedeemed)),
  };
}
