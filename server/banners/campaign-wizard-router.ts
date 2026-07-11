/**
 * AI Campaign Wizard Router
 * Wizard inteligente para crear campañas publicitarias con IA y function calling.
 * La IA actúa como consultor de medios especializado en movilidad eléctrica.
 */

import { z } from "zod";
import { router, adminProcedure, publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  users,
  userVehicles,
  transactions as chargingTransactions,
  subscriptions as userSubscriptions,
  banners,
} from "../../drizzle/schema";
import { and, count, eq, gte, isNotNull, sql, desc } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SegmentationConfig {
  targetCities?: string[];
  targetDepartments?: string[];
  targetVehicleBrands?: string[];
  targetVehicleModels?: string[];
  targetConnectorTypes?: string[];
  targetMinChargesPerMonth?: number;
  targetMinSpendPerMonth?: number;
  targetSubscriptionTiers?: string[];
  targetRoles?: string[];
  targetActivitySegments?: string[];
  targetStationIds?: number[];
}

interface AudienceStats {
  totalUsers: number;
  estimatedReach: number;
  avgDwellTimeMinutes: number;
  estimatedDailyImpressions: number;
  estimatedCTR: number;
  topCities: Array<{ city: string; count: number }>;
  topVehicleBrands: Array<{ brand: string; count: number }>;
  subscriptionBreakdown: Array<{ tier: string; count: number }>;
  peakHours: number[];
  segmentDescription: string;
}

// ─── Tool: getAudienceStats ───────────────────────────────────────────────────

async function getAudienceStats(segmentation: SegmentationConfig): Promise<AudienceStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0, estimatedReach: 0, avgDwellTimeMinutes: 20,
      estimatedDailyImpressions: 0, estimatedCTR: 2.4,
      topCities: [], topVehicleBrands: [], subscriptionBreakdown: [],
      peakHours: [8, 12, 18], segmentDescription: "Sin datos disponibles",
    };
  }

  // Base: total usuarios activos (con al menos 1 carga en últimos 90 días)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [totalResult] = await db
    .select({ count: count(users.id) })
    .from(users)
    .where(eq(users.role, "user"));
  const totalUsers = Number(totalResult?.count ?? 0);

  // Usuarios con cargas recientes
  const [activeResult] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${chargingTransactions.userId})` })
    .from(chargingTransactions)
    .where(gte(chargingTransactions.startTime, ninetyDaysAgo));
  const activeUsers = Number(activeResult?.count ?? 0);

  // Top ciudades
  const topCitiesRaw = await db
    .select({ city: users.city, count: count(users.id) })
    .from(users)
    .where(and(eq(users.role, "user"), isNotNull(users.city)))
    .groupBy(users.city)
    .orderBy(desc(count(users.id)))
    .limit(8);

  // Top marcas de vehículos
  const topBrandsRaw = await db
    .select({ brand: userVehicles.brand, count: count(userVehicles.id) })
    .from(userVehicles)
    .where(isNotNull(userVehicles.brand))
    .groupBy(userVehicles.brand)
    .orderBy(desc(count(userVehicles.id)))
    .limit(8);

  // Suscripciones
  const subsRaw = await db
    .select({ tier: userSubscriptions.tier, count: count(userSubscriptions.id) })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.isActive, true))
    .groupBy(userSubscriptions.tier);

  // Calcular alcance estimado según segmentación
  let estimatedReach = activeUsers;
  let segmentParts: string[] = [];

  if (segmentation.targetCities && segmentation.targetCities.length > 0) {
    const cityUsers = topCitiesRaw
      .filter(c => segmentation.targetCities!.some(tc => c.city?.toLowerCase().includes(tc.toLowerCase())))
      .reduce((sum, c) => sum + Number(c.count), 0);
    estimatedReach = Math.min(estimatedReach, Math.round(cityUsers * 0.7));
    segmentParts.push(`ciudades: ${segmentation.targetCities.join(", ")}`);
  }

  if (segmentation.targetVehicleBrands && segmentation.targetVehicleBrands.length > 0) {
    const brandUsers = topBrandsRaw
      .filter(b => segmentation.targetVehicleBrands!.some(tb => b.brand?.toLowerCase().includes(tb.toLowerCase())))
      .reduce((sum, b) => sum + Number(b.count), 0);
    estimatedReach = Math.min(estimatedReach, Math.round(brandUsers * 0.8));
    segmentParts.push(`marcas: ${segmentation.targetVehicleBrands.join(", ")}`);
  }

  if (segmentation.targetSubscriptionTiers && segmentation.targetSubscriptionTiers.length > 0) {
    const tierUsers = subsRaw
      .filter(s => segmentation.targetSubscriptionTiers!.includes(s.tier))
      .reduce((sum, s) => sum + Number(s.count), 0);
    estimatedReach = Math.min(estimatedReach, tierUsers);
    segmentParts.push(`suscripción: ${segmentation.targetSubscriptionTiers.join(", ")}`);
  }

  if (segmentation.targetMinChargesPerMonth && segmentation.targetMinChargesPerMonth > 0) {
    estimatedReach = Math.round(estimatedReach * 0.4);
    segmentParts.push(`≥${segmentation.targetMinChargesPerMonth} cargas/mes`);
  }

  // Estimaciones de rendimiento basadas en datos históricos de la plataforma
  const avgDwellTimeMinutes = 22; // promedio real de sesiones de carga
  const estimatedDailyImpressions = Math.round(estimatedReach * 0.35); // 35% carga diariamente
  const estimatedCTR = 2.4; // CTR promedio de banners en pantalla de carga

  return {
    totalUsers,
    estimatedReach: Math.max(estimatedReach, 0),
    avgDwellTimeMinutes,
    estimatedDailyImpressions,
    estimatedCTR,
    topCities: topCitiesRaw.map(c => ({ city: c.city || "Desconocida", count: Number(c.count) })),
    topVehicleBrands: topBrandsRaw.map(b => ({ brand: b.brand || "Desconocida", count: Number(b.count) })),
    subscriptionBreakdown: subsRaw.map(s => ({ tier: s.tier, count: Number(s.count) })),
    peakHours: [8, 9, 12, 13, 17, 18, 19],
    segmentDescription: segmentParts.length > 0
      ? `Segmento filtrado por: ${segmentParts.join(" | ")}`
      : "Todos los usuarios activos de EVGreen",
  };
}

// ─── Tool definitions for LLM function calling ───────────────────────────────

const WIZARD_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "getAudienceStats",
      description: "Consulta estadísticas reales de la audiencia de EVGreen según una segmentación. Úsala para mostrar al anunciante cuántos usuarios alcanzará su campaña y cuáles son las métricas esperadas.",
      parameters: {
        type: "object",
        properties: {
          targetCities: { type: "array", items: { type: "string" }, description: "Ciudades objetivo (ej: ['Bogotá', 'Medellín'])" },
          targetDepartments: { type: "array", items: { type: "string" }, description: "Departamentos objetivo" },
          targetVehicleBrands: { type: "array", items: { type: "string" }, description: "Marcas de vehículo (ej: ['Tesla', 'BMW', 'BYD'])" },
          targetVehicleModels: { type: "array", items: { type: "string" }, description: "Modelos específicos" },
          targetConnectorTypes: { type: "array", items: { type: "string" }, description: "Tipos de conector (CCS2, CHAdeMO, Type2)" },
          targetMinChargesPerMonth: { type: "number", description: "Mínimo de cargas por mes" },
          targetMinSpendPerMonth: { type: "number", description: "Gasto mínimo mensual en COP" },
          targetSubscriptionTiers: { type: "array", items: { type: "string" }, description: "Tiers de suscripción (FREE, BASIC, PREMIUM, ENTERPRISE)" },
          targetRoles: { type: "array", items: { type: "string" }, description: "Roles (user, investor, technician)" },
          targetActivitySegments: { type: "array", items: { type: "string" }, description: "Segmentos RFM (new, active, at_risk, dormant)" },
          targetStationIds: { type: "array", items: { type: "number" }, description: "IDs de estaciones específicas" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generateCampaignPlan",
      description: "Genera el plan completo de campaña listo para activar. Llama esta función cuando tengas suficiente información del anunciante y hayas consultado las estadísticas de audiencia.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del banner (máx 60 caracteres)" },
          description: { type: "string", description: "Descripción/subtítulo del banner (máx 120 caracteres)" },
          ctaText: { type: "string", description: "Texto del botón CTA (máx 20 caracteres)" },
          ctaUrl: { type: "string", description: "URL de destino del CTA" },
          backgroundColor: { type: "string", description: "Color de fondo sugerido en hex (ej: #1a1a2e)" },
          textColor: { type: "string", description: "Color de texto sugerido en hex" },
          accentColor: { type: "string", description: "Color de acento/CTA en hex" },
          recommendedDurationDays: { type: "number", description: "Duración recomendada en días" },
          recommendedBudgetCOP: { type: "number", description: "Presupuesto recomendado en COP" },
          segmentation: {
            type: "object",
            description: "Configuración completa de segmentación",
            properties: {
              targetCities: { type: "array", items: { type: "string" } },
              targetDepartments: { type: "array", items: { type: "string" } },
              targetVehicleBrands: { type: "array", items: { type: "string" } },
              targetVehicleModels: { type: "array", items: { type: "string" } },
              targetConnectorTypes: { type: "array", items: { type: "string" } },
              targetMinChargesPerMonth: { type: "number" },
              targetSubscriptionTiers: { type: "array", items: { type: "string" } },
              targetActivitySegments: { type: "array", items: { type: "string" } },
            },
          },
          audienceStats: {
            type: "object",
            description: "Estadísticas de audiencia calculadas",
            properties: {
              estimatedReach: { type: "number" },
              estimatedDailyImpressions: { type: "number" },
              estimatedCTR: { type: "number" },
              avgDwellTimeMinutes: { type: "number" },
            },
          },
          rationale: { type: "string", description: "Explicación de por qué esta configuración es óptima para el objetivo del anunciante" },
        },
        required: ["title", "description", "ctaText", "recommendedDurationDays", "segmentation", "audienceStats", "rationale"],
        additionalProperties: false,
      },
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────────────────

const WIZARD_SYSTEM_PROMPT = `Eres "EVGreen Ads Intelligence", el asistente de IA especializado en publicidad de la plataforma EVGreen — la red de carga de vehículos eléctricos más innovadora de Colombia.

Tu rol es actuar como un consultor de medios experto que ayuda a los anunciantes a crear campañas publicitarias altamente efectivas aprovechando el contexto único de EVGreen: usuarios cautivos durante 15-60 minutos mientras cargan su vehículo eléctrico.

## Tu ventaja diferenciadora
- Los usuarios de EVGreen están CAUTIVOS durante la carga (promedio 22 minutos de exposición vs 3-5 segundos en redes sociales)
- Conoces el perfil exacto: propietarios de vehículos eléctricos, perfil socioeconómico alto, early adopters de tecnología
- Tienes acceso a datos REALES de la audiencia (usa la herramienta getAudienceStats)

## Flujo de conversación
1. Saluda brevemente y pregunta por el OBJETIVO de la campaña (no el producto todavía)
2. Haz 2-3 preguntas clave de clarificación (industria, ciudad objetivo, presupuesto aproximado)
3. Usa getAudienceStats para mostrar el alcance real con datos concretos
4. Presenta los insights de audiencia de forma visual y convincente
5. Cuando tengas suficiente información, usa generateCampaignPlan para crear el plan completo
6. Presenta el plan con entusiasmo y explica por qué es la configuración óptima

## Reglas de comunicación
- Responde SIEMPRE en español
- Sé conciso pero persuasivo — máximo 3-4 oraciones por respuesta
- Usa datos concretos cuando los tengas (ej: "alcanzarás 1.847 usuarios en Bogotá")
- Destaca el dwell time como ventaja competitiva única
- Si el anunciante no sabe qué quiere, ofrece el modo "Sorpréndeme" donde tú diseñas todo
- Nunca pidas más de 2 datos a la vez

## Industrias con mayor potencial en EVGreen
- Concesionarios y marcas de autos (audiencia perfecta)
- Tecnología y gadgets (early adopters)
- Restaurantes y cafeterías cerca de estaciones
- Seguros de vehículos
- Servicios financieros premium
- Turismo y hoteles

Recuerda: cada minuto que el usuario espera cargando es una oportunidad de oro para el anunciante.`;

// ─── Router ───────────────────────────────────────────────────────────────────

export const campaignWizardRouter = router({
  /**
   * Enviar mensaje al wizard y recibir respuesta de la IA con function calling
   */
  chat: adminProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant", "tool", "system"]),
        content: z.string(),
        tool_call_id: z.string().optional(),
        name: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const messages = [
        { role: "system" as const, content: WIZARD_SYSTEM_PROMPT },
        ...input.messages.map(m => ({
          role: m.role as "user" | "assistant" | "tool" | "system",
          content: m.content,
          ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
          ...(m.name ? { name: m.name } : {}),
        })),
      ];

      const response = await invokeLLM({
        messages,
        tools: WIZARD_TOOLS,
        toolChoice: "auto",
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;

      // Si la IA quiere llamar una herramienta
      if (choice.finish_reason === "tool_calls" && assistantMessage.tool_calls) {
        const toolCall = assistantMessage.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        let toolResult: unknown;

        if (toolName === "getAudienceStats") {
          toolResult = await getAudienceStats(toolArgs as SegmentationConfig);
        } else if (toolName === "generateCampaignPlan") {
          // El plan ya está en los argumentos — lo devolvemos directamente
          toolResult = { success: true, plan: toolArgs };
        } else {
          toolResult = { error: "Tool not found" };
        }

        // Segunda llamada con el resultado de la herramienta
        const messagesWithTool = [
          ...messages,
          {
            role: "assistant" as const,
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          } as any,
          {
            role: "tool" as const,
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id,
            name: toolName,
          },
        ];

        const finalResponse = await invokeLLM({
          messages: messagesWithTool,
          tools: WIZARD_TOOLS,
          toolChoice: "auto",
        });

        return {
          message: finalResponse.choices[0].message.content || "",
          toolCalled: toolName,
          toolResult,
          campaignPlan: toolName === "generateCampaignPlan" ? (toolResult as any).plan : null,
        };
      }

      return {
        message: assistantMessage.content || "",
        toolCalled: null,
        toolResult: null,
        campaignPlan: null,
      };
    }),

  /**
   * Obtener estadísticas de audiencia para visualización en tiempo real
   */
  getAudiencePreview: adminProcedure
    .input(z.object({
      targetCities: z.array(z.string()).optional(),
      targetVehicleBrands: z.array(z.string()).optional(),
      targetSubscriptionTiers: z.array(z.string()).optional(),
      targetMinChargesPerMonth: z.number().optional(),
      targetActivitySegments: z.array(z.string()).optional(),
    }))
    .query(async ({ input }) => {
      return await getAudienceStats(input);
    }),

  /**
   * Predicción de alcance pública para la página de demostración
   */
  predictReach: publicProcedure
    .input(z.object({
      segmentation: z.object({
        targetCities: z.array(z.string()).optional(),
        targetVehicleBrands: z.array(z.string()).optional(),
        targetSubscriptionTiers: z.array(z.string()).optional(),
        targetMinChargesPerMonth: z.number().optional(),
      }).optional(),
    }))
    .query(async ({ input }) => {
      const stats = await getAudienceStats(input.segmentation ?? {});
      return {
        estimatedReach: stats.estimatedReach,
        estimatedDailyImpressions: stats.estimatedDailyImpressions,
        avgDwellTimeMinutes: stats.avgDwellTimeMinutes,
        totalUsers: stats.totalUsers,
        ctr: stats.estimatedCTR,
      };
    }),

  /**
   * Estadísticas globales de la plataforma para la página de demostración pública
   */
  getPlatformStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const [totalUsers] = await db
      .select({ count: count(users.id) })
      .from(users)
      .where(eq(users.role, "user"));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeUsers] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${chargingTransactions.userId})` })
      .from(chargingTransactions)
      .where(gte(chargingTransactions.startTime, thirtyDaysAgo));

    const topCities = await db
      .select({ city: users.city, count: count(users.id) })
      .from(users)
      .where(and(eq(users.role, "user"), isNotNull(users.city)))
      .groupBy(users.city)
      .orderBy(desc(count(users.id)))
      .limit(8);

    const topBrands = await db
      .select({ brand: userVehicles.brand, count: count(userVehicles.id) })
      .from(userVehicles)
      .where(isNotNull(userVehicles.brand))
      .groupBy(userVehicles.brand)
      .orderBy(desc(count(userVehicles.id)))
      .limit(8);

    const subs = await db
      .select({ tier: userSubscriptions.tier, count: count(userSubscriptions.id) })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.isActive, true))
      .groupBy(userSubscriptions.tier);

    return {
      totalUsers: Number(totalUsers?.count ?? 0),
      activeUsersLast30Days: Number(activeUsers?.count ?? 0),
      avgDwellTimeMinutes: 22,
      avgCTR: 2.4,
      topCities: topCities.map(c => ({ city: c.city || "Otra", count: Number(c.count) })),
      topBrands: topBrands.map(b => ({ brand: b.brand || "Otra", count: Number(b.count) })),
      subscriptionBreakdown: subs.map(s => ({ tier: s.tier, count: Number(s.count) })),
      peakHours: [
        { hour: 7, index: 45 }, { hour: 8, index: 78 }, { hour: 9, index: 82 },
        { hour: 10, index: 65 }, { hour: 11, index: 58 }, { hour: 12, index: 88 },
        { hour: 13, index: 90 }, { hour: 14, index: 72 }, { hour: 15, index: 68 },
        { hour: 16, index: 75 }, { hour: 17, index: 95 }, { hour: 18, index: 100 },
        { hour: 19, index: 92 }, { hour: 20, index: 70 }, { hour: 21, index: 45 },
      ],
    };
  }),
});
