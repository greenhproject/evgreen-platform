/**
 * Proveedor de IA: Manus LLM (Default)
 * Utiliza el servicio LLM integrado de Manus
 */

import { invokeLLM } from "../../_core/llm";
import type {
  IAIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
  AIStreamChunk,
} from "../types";

export class ManusProvider implements IAIProvider {
  readonly name = "manus" as const;
  readonly displayName = "Manus LLM (Integrado)";
  readonly supportedModels = ["manus-default"];
  readonly defaultModel = "manus-default";

  isConfigured(): boolean {
    // Manus LLM siempre está disponible ya que usa las credenciales del sistema
    return true;
  }

  async complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    try {
      // invokeLLM usa configuración interna, solo pasamos messages
      const response = await invokeLLM({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        // maxTokens se puede pasar si está soportado
        ...(options?.maxTokens && { max_tokens: options.maxTokens }),
      });

      const choice = response.choices?.[0];
      const messageContent = choice?.message?.content;
      // El contenido puede ser string o array de objetos
      let content = "";
      if (typeof messageContent === "string") {
        content = messageContent;
      } else if (Array.isArray(messageContent)) {
        content = messageContent
          .filter((part): part is { type: "text"; text: string } => part.type === "text")
          .map((part) => part.text)
          .join("");
      }
      
      // Estimar tokens si no vienen en la respuesta
      const usage = response.usage || {
        prompt_tokens: this.estimateTokens(messages.map(m => m.content).join(" ")),
        completion_tokens: this.estimateTokens(content),
        total_tokens: 0,
      };
      
      if (!usage.total_tokens) {
        usage.total_tokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
      }

      return {
        content,
        finishReason: this.mapFinishReason(choice?.finish_reason ?? undefined),
        usage: {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        },
        model: response.model || this.defaultModel,
        provider: this.name,
      };
    } catch (error: any) {
      console.error("[ManusProvider] Error:", error);
      throw new Error(`Error en Manus LLM: ${error.message}`);
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Manus LLM está incluido en la plataforma, sin costo adicional
    return 0;
  }

  private mapFinishReason(reason?: string): AICompletionResponse["finishReason"] {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }

  private estimateTokens(text: string): number {
    // Estimación aproximada: ~4 caracteres por token
    return Math.ceil(text.length / 4);
  }
}

export const manusProvider = new ManusProvider();
