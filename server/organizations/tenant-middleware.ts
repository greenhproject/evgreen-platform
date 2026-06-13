/**
 * Tenant Context Middleware
 * 
 * Proporciona aislamiento de datos por organización (multi-tenant).
 * Se inyecta en el contexto tRPC para que los procedimientos puedan
 * filtrar datos por organización automáticamente.
 * 
 * Flujo:
 * 1. El usuario se autentica normalmente (Manus OAuth)
 * 2. Si el usuario tiene un organizationId asociado, se carga la org
 * 3. Los procedimientos que usen tenantProcedure tienen ctx.organization disponible
 * 4. Los datos se filtran automáticamente por organizationId
 */

import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { organizations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface TenantContext {
  organizationId: number | null;
  organization: {
    id: number;
    name: string;
    slug: string;
    plan: string;
    status: string;
    networkMember: boolean;
    supportIncluded: boolean;
    transactionFeePercent: string | null;
    supportFeePercent: string | null;
    maxChargers: number | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    logoUrl: string | null;
    appName: string | null;
    customDomain: string | null;
  } | null;
}

/**
 * Resuelve el contexto de tenant a partir del usuario autenticado.
 * 
 * Estrategia de resolución (en orden de prioridad):
 * 1. Header X-Organization-Id (para superadmin que gestiona múltiples orgs)
 * 2. Campo organizationId en el usuario (asignado al crear la cuenta del tenant)
 * 3. Lookup por ownerId en la tabla organizations
 * 4. null (usuario sin organización = usuario final de EVGreen)
 */
export async function resolveTenantContext(
  userId: number | null,
  userOpenId: string | null,
  headerOrgId?: string | null,
  userRole?: string | null
): Promise<TenantContext> {
  // Si no hay usuario autenticado, no hay tenant
  if (!userId || !userOpenId) {
    return { organizationId: null, organization: null };
  }

  const db = (await getDb())!;
  let orgId: number | null = null;

  // 1. Header override (solo para admins/staff)
  if (headerOrgId && (userRole === "admin" || userRole === "staff")) {
    orgId = parseInt(headerOrgId, 10);
    if (isNaN(orgId)) orgId = null;
  }

  // 2. Lookup por ownerId en organizations (el dueño de la org)
  if (!orgId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ownerId, userOpenId))
      .limit(1);
    
    if (org) {
      orgId = org.id;
    }
  }

  // Si no se encontró organización, el usuario es un usuario final
  if (!orgId) {
    return { organizationId: null, organization: null };
  }

  // Cargar datos completos de la organización
  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      status: organizations.status,
      networkMember: organizations.networkMember,
      supportIncluded: organizations.supportIncluded,
      transactionFeePercent: organizations.transactionFeePercent,
      supportFeePercent: organizations.supportFeePercent,
      maxChargers: organizations.maxChargers,
      primaryColor: organizations.primaryColor,
      secondaryColor: organizations.secondaryColor,
      logoUrl: organizations.logoUrl,
      appName: organizations.appName,
      customDomain: organizations.customDomain,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) {
    return { organizationId: null, organization: null };
  }

  // Verificar que la organización esté activa
  if (org.status === "suspended") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "La organización está suspendida. Contacte a soporte.",
    });
  }

  return {
    organizationId: org.id,
    organization: org,
  };
}

/**
 * Calcula el fee efectivo para una transacción de una organización.
 * Usa los valores de la org, o los defaults globales si no están configurados.
 */
export async function getEffectiveFees(orgId: number): Promise<{
  transactionFeePercent: number;
  supportFeePercent: number;
  totalFeePercent: number;
  networkDiscount: number;
}> {
  const db = (await getDb())!;

  const [org] = await db
    .select({
      transactionFeePercent: organizations.transactionFeePercent,
      supportFeePercent: organizations.supportFeePercent,
      supportIncluded: organizations.supportIncluded,
      networkMember: organizations.networkMember,
      networkDiscount: organizations.networkDiscount,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Organización no encontrada" });
  }

  // Defaults globales (los que están en platform_pricing_defaults)
  const defaultTransactionFee = 5.0;
  const defaultSupportFee = 20.0;
  const defaultNetworkDiscount = 1.0;

  const transactionFee = org.transactionFeePercent
    ? parseFloat(org.transactionFeePercent)
    : defaultTransactionFee;

  const supportFee = org.supportIncluded
    ? (org.supportFeePercent ? parseFloat(org.supportFeePercent) : defaultSupportFee)
    : 0;

  const networkDiscount = org.networkMember
    ? (org.networkDiscount ? parseFloat(org.networkDiscount) : defaultNetworkDiscount)
    : 0;

  // Si tiene soporte incluido, el fee total es el supportFee (que ya incluye el transactionFee)
  // Si no tiene soporte, el fee total es solo el transactionFee
  const totalFee = org.supportIncluded
    ? supportFee - networkDiscount
    : transactionFee - networkDiscount;

  return {
    transactionFeePercent: transactionFee,
    supportFeePercent: supportFee,
    totalFeePercent: Math.max(0, totalFee),
    networkDiscount,
  };
}

/**
 * Verifica si una organización puede agregar más cargadores.
 */
export async function canAddCharger(orgId: number, currentCount: number): Promise<boolean> {
  const db = (await getDb())!;

  const [org] = await db
    .select({ maxChargers: organizations.maxChargers })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org || !org.maxChargers) return true; // Sin límite
  return currentCount < org.maxChargers;
}

/**
 * Obtiene la configuración de branding de una organización para white-label.
 */
export async function getOrgBranding(orgId: number): Promise<{
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  appName: string;
  customDomain: string | null;
} | null> {
  const db = (await getDb())!;

  const [org] = await db
    .select({
      logoUrl: organizations.logoUrl,
      primaryColor: organizations.primaryColor,
      secondaryColor: organizations.secondaryColor,
      appName: organizations.appName,
      customDomain: organizations.customDomain,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return null;

  return {
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor || "#22c55e",
    secondaryColor: org.secondaryColor || "#1e40af",
    appName: org.appName || "EVGreen",
    customDomain: org.customDomain,
  };
}
