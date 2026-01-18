/**
 * Proveedor de IA: Google AI
 * Soporta Gemini Pro, Gemini Flash
 */

import type {
  IAIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
  AIProviderConfig,
} from "../types";

export class GoogleProvider implements IAIProvider {
  readonly name = "google" as const;
  readonly displayName = "Google Gemini";
  readonly supportedModels = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];
  readonly defaultModel = "gemini-1.5-flash";

  private apiKey: string | undefined;
  private model: string;

  constructor(config?: AIProviderConfig) {
    this.apiKey = config?.apiKey;
    this.model = config?.model || this.defaultModel;
  }

  configure(config: AIProviderConfig): void {
    this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error("Google AI API key no configurada");
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

      // Convertir mensajes al formato de Gemini
      const systemInstruction = messages.find((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      const contents = conversationMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction.content }] }
            : undefined,
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 2000,
            topP: options?.topP,
            stopSequences: options?.stop,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Google AI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts
        ?.map((p: any) => p.text)
        .join("") || "";

      // Google no devuelve conteo de tokens directamente en la respuesta
      const estimatedInputTokens = this.estimateTokens(
        messages.map((m) => m.content).join(" ")
      );
      const estimatedOutputTokens = this.estimateTokens(content);

      return {
        content,
        finishReason: this.mapFinishReason(candidate?.finishReason),
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || estimatedInputTokens,
          outputTokens: data.usageMetadata?.candidatesTokenCount || estimatedOutputTokens,
          totalTokens:
            data.usageMetadata?.totalTokenCount ||
            estimatedInputTokens + estimatedOutputTokens,
        },
        model: this.model,
        provider: this.name,
      };
    } catch (error: any) {
      console.error("[GoogleProvider] Error:", error);
      throw new Error(`Error en Google AI: ${error.message}`);
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Precios aproximados en USD por 1M tokens (enero 2026)
    const pricing: Record<string, { input: number; output: number }> = {
      "gemini-2.0-flash-exp": { input: 0, output: 0 }, // Experimental, gratis
      "gemini-1.5-pro": { input: 1.25, output: 5 },
      "gemini-1.5-flash": { input: 0.075, output: 0.3 },
      "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
    };

    const modelPricing = pricing[this.model] || pricing["gemini-1.5-flash"];
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }

  private mapFinishReason(reason?: string): AICompletionResponse["finishReason"] {
    switch (reason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
      case "RECITATION":
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

export const googleProvider = new GoogleProvider();
