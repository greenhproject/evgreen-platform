/**
 * Proveedor de IA: OpenAI
 * Soporta GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
 */

import type {
  IAIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
  AIProviderConfig,
} from "../types";

export class OpenAIProvider implements IAIProvider {
  readonly name = "openai" as const;
  readonly displayName = "OpenAI";
  readonly supportedModels = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
  ];
  readonly defaultModel = "gpt-4o-mini";

  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config?: AIProviderConfig) {
    this.apiKey = config?.apiKey;
    this.model = config?.model || this.defaultModel;
    this.endpoint = config?.endpoint || "https://api.openai.com/v1/chat/completions";
  }

  configure(config: AIProviderConfig): void {
    this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;
    if (config.endpoint) this.endpoint = config.endpoint;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error("OpenAI API key no configurada");
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2000,
          top_p: options?.topP,
          frequency_penalty: options?.frequencyPenalty,
          presence_penalty: options?.presencePenalty,
          stop: options?.stop,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content || "",
        finishReason: this.mapFinishReason(choice?.finish_reason),
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model || this.model,
        provider: this.name,
      };
    } catch (error: any) {
      console.error("[OpenAIProvider] Error:", error);
      throw new Error(`Error en OpenAI: ${error.message}`);
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Precios aproximados en USD por 1M tokens (enero 2026)
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4o": { input: 2.5, output: 10 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-4-turbo": { input: 10, output: 30 },
      "gpt-4": { input: 30, output: 60 },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    };

    const modelPricing = pricing[this.model] || pricing["gpt-4o-mini"];
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
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
}

export const openaiProvider = new OpenAIProvider();
