/**
 * Router tRPC para el Sistema de IA
 * Endpoints para chat, configuración, recomendaciones y más
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { aiService } from "./ai-service";
import * as dbOps from "../db";
import type { AIMessage } from "./types";

// ============================================================================
// AI ROUTER
// ============================================================================

export const aiRouter = router({
  // --------------------------------------------------------------------------
  // CONFIGURACIÓN (Solo Admin)
  // --------------------------------------------------------------------------
  
  /**
   * Obtener configuración actual de IA
   */
  getConfig: adminProcedure.query(async () => {
    await aiService.loadConfig();
    return aiService.getConfig();
  }),

  /**
   * Obtener lista de proveedores disponibles
   */
  getProviders: adminProcedure.query(() => {
    return aiService.getAvailableProviders();
  }),

  /**
   * Actualizar configuración de IA
   */
  updateConfig: adminProcedure
    .input(z.object({
      provider: z.enum(["manus", "openai", "anthropic", "google", "azure", "custom"]).optional(),
      openaiApiKey: z.string().optional(),
      anthropicApiKey: z.string().optional(),
      googleApiKey: z.string().optional(),
      azureApiKey: z.string().optional(),
      azureEndpoint: z.string().optional(),
      customApiKey: z.string().optional(),
      customEndpoint: z.string().optional(),
      modelName: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(100).max(32000).optional(),
      enableChat: z.boolean().optional(),
      enableRecommendations: z.boolean().optional(),
      enableTripPlanner: z.boolean().optional(),
      enableInvestorInsights: z.boolean().optional(),
      enableAdminAnalytics: z.boolean().optional(),
      dailyUserLimit: z.number().min(1).optional(),
      dailyTotalLimit: z.number().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Guardar en base de datos
      await dbOps.upsertAIConfig({
        ...input,
        temperature: input.temperature?.toString(),
        updatedBy: ctx.user.id,
      });

      // Recargar configuración
      await aiService.loadConfig();

      return { success: true, config: aiService.getConfig() };
    }),

  /**
   * Probar conexión con un proveedor
   */
  testProvider: adminProcedure
    .input(z.object({
      provider: z.enum(["manus", "openai", "anthropic", "google", "azure", "custom"]),
      apiKey: z.string().optional(),
      endpoint: z.string().optional(),
      model: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Configurar temporalmente el proveedor
        const success = await aiService.setActiveProvider(input.provider, {
          openai: input.provider === "openai" ? input.apiKey : undefined,
          anthropic: input.provider === "anthropic" ? input.apiKey : undefined,
          google: input.provider === "google" ? input.apiKey : undefined,
          azure: input.provider === "azure" ? input.apiKey : undefined,
          azureEndpoint: input.endpoint,
          custom: input.provider === "custom" ? input.apiKey : undefined,
          customEndpoint: input.endpoint,
          model: input.model,
        });

        if (!success && input.provider !== "manus") {
          return {
            success: false,
            error: "El proveedor no está configurado correctamente",
          };
        }

        // Hacer una prueba simple
        const response = await aiService.complete([
          { role: "user", content: "Di 'OK' si puedes responder." },
        ], { maxTokens: 50 });

        return {
          success: true,
          response: response.content,
          model: response.model,
          provider: response.provider,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // --------------------------------------------------------------------------
  // CHAT CONVERSACIONAL
  // --------------------------------------------------------------------------

  /**
   * Crear nueva conversación
   */
  createConversation: protectedProcedure
    .input(z.object({
      type: z.string().default("chat"),
      title: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await dbOps.createAIConversation({
        userId: ctx.user.id,
        conversationType: input.type,
        title: input.title || "Nueva conversación",
      });
      return { id };
    }),

  /**
   * Obtener conversaciones del usuario
   */
  getConversations: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ input, ctx }) => {
      return dbOps.getAIConversationsByUserId(ctx.user.id, input?.limit || 20);
    }),

  /**
   * Obtener mensajes de una conversación
   */
  getMessages: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      // Verificar que la conversación pertenece al usuario
      const conversation = await dbOps.getAIConversationById(input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversación no encontrada" });
      }
      return dbOps.getAIMessagesByConversationId(input.conversationId, input.limit);
    }),

  /**
   * Enviar mensaje al chat
   */
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      message: z.string().min(1).max(10000),
      context: z.object({
        currentLatitude: z.number().optional(),
        currentLongitude: z.number().optional(),
        vehicleBrand: z.string().optional(),
        vehicleModel: z.string().optional(),
        batteryCapacity: z.number().optional(),
        connectorType: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verificar límites de uso
      const limits = await aiService.checkUsageLimits(ctx.user.id);
      if (!limits.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Has alcanzado el límite diario de ${limits.userLimit} mensajes`,
        });
      }

      // Verificar que la conversación pertenece al usuario
      const conversation = await dbOps.getAIConversationById(input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversación no encontrada" });
      }

      // Guardar mensaje del usuario
      await dbOps.createAIMessage({
        conversationId: input.conversationId,
        role: "user",
        content: input.message,
      });

      // Obtener historial de la conversación
      const history = await dbOps.getAIMessagesByConversationId(input.conversationId, 20);
      const conversationHistory: AIMessage[] = history.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      // Construir contexto
      const context = {
        userId: ctx.user.id,
        userRole: ctx.user.role,
        userName: ctx.user.name || undefined,
        currentLocation: input.context?.currentLatitude && input.context?.currentLongitude
          ? { latitude: input.context.currentLatitude, longitude: input.context.currentLongitude }
          : undefined,
        vehicle: input.context?.vehicleBrand
          ? {
              brand: input.context.vehicleBrand,
              model: input.context.vehicleModel || "",
              batteryCapacity: input.context.batteryCapacity || 0,
              connectorType: input.context.connectorType || "",
            }
          : undefined,
      };

      // Obtener respuesta de IA
      await aiService.loadConfig();
      const response = await aiService.chat(input.message, conversationHistory, context);

      // Guardar respuesta del asistente
      await dbOps.createAIMessage({
        conversationId: input.conversationId,
        role: "assistant",
        content: response.content,
        tokenCount: response.usage.totalTokens,
        provider: response.provider,
        model: response.model,
      });

      // Registrar uso
      await aiService.trackUsage(ctx.user.id, "chat", response);

      // Actualizar título de la conversación si es el primer mensaje
      if (history.length === 0) {
        const title = input.message.slice(0, 50) + (input.message.length > 50 ? "..." : "");
        await dbOps.updateAIConversation(input.conversationId, { title });
      }

      return {
        content: response.content,
        model: response.model,
        provider: response.provider,
      };
    }),

  /**
   * Eliminar conversación
   */
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const conversation = await dbOps.getAIConversationById(input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversación no encontrada" });
      }
      await dbOps.deleteAIConversation(input.conversationId);
      return { success: true };
    }),

  // --------------------------------------------------------------------------
  // RECOMENDACIONES
  // --------------------------------------------------------------------------

  /**
   * Obtener recomendaciones de estaciones de carga
   */
  getChargingRecommendations: protectedProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      batteryLevel: z.number().min(0).max(100).optional(),
      vehicleRange: z.number().optional(),
      preferredConnectorTypes: z.array(z.string()).optional(),
      maxDistance: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      await aiService.loadConfig();
      return aiService.getChargingRecommendations({
        userId: ctx.user.id,
        currentLatitude: input.latitude,
        currentLongitude: input.longitude,
        batteryLevel: input.batteryLevel,
        vehicleRange: input.vehicleRange,
        preferredConnectorTypes: input.preferredConnectorTypes,
        maxDistance: input.maxDistance,
      });
    }),

  // --------------------------------------------------------------------------
  // PLANIFICACIÓN DE VIAJES
  // --------------------------------------------------------------------------

  /**
   * Planificar viaje con paradas de carga
   */
  planTrip: protectedProcedure
    .input(z.object({
      origin: z.object({
        latitude: z.number(),
        longitude: z.number(),
        address: z.string().optional(),
      }),
      destination: z.object({
        latitude: z.number(),
        longitude: z.number(),
        address: z.string().optional(),
      }),
      vehicleRange: z.number(),
      currentBatteryLevel: z.number().min(0).max(100),
      preferredConnectorTypes: z.array(z.string()).optional(),
      minimumBatteryAtDestination: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await aiService.loadConfig();
      return aiService.planTrip({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // --------------------------------------------------------------------------
  // INSIGHTS PARA INVERSIONISTAS
  // --------------------------------------------------------------------------

  /**
   * Obtener insights de IA para inversionistas
   */
  getInvestorInsights: protectedProcedure
    .input(z.object({
      stationIds: z.array(z.number()).optional(),
      period: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "investor" && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo inversionistas pueden acceder a estos insights" });
      }

      await aiService.loadConfig();
      return aiService.getInvestorInsights({
        investorId: ctx.user.id,
        stationIds: input.stationIds,
        period: input.period,
      });
    }),

  // --------------------------------------------------------------------------
  // ESTADÍSTICAS DE USO
  // --------------------------------------------------------------------------

  /**
   * Obtener estadísticas de uso de IA del usuario
   */
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    return aiService.checkUsageLimits(ctx.user.id);
  }),

  /**
   * Obtener estadísticas globales de uso (Admin)
   */
  getGlobalUsageStats: adminProcedure.query(async () => {
    // TODO: Implementar estadísticas globales
    return {
      totalConversations: 0,
      totalMessages: 0,
      totalTokensUsed: 0,
      estimatedCost: 0,
    };
  }),
});

export type AIRouter = typeof aiRouter;
