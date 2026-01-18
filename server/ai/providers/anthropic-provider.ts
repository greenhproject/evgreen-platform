/**
 * Proveedor de IA: Anthropic
 * Soporta Claude 3.5, Claude 3, Claude 2
 */

import type {
  IAIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
  AIProviderConfig,
} from "../types";

export class AnthropicProvider implements IAIProvider {
  readonly name = "anthropic" as const;
  readonly displayName = "Anthropic Claude";
  readonly supportedModels = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ];
  readonly defaultModel = "claude-3-5-sonnet-20241022";

  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config?: AIProviderConfig) {
    this.apiKey = config?.apiKey;
    this.model = config?.model || this.defaultModel;
    this.endpoint = config?.endpoint || "https://api.anthropic.com/v1/messages";
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
      throw new Error("Anthropic API key no configurada");
    }

    try {
      // Anthropic requiere separar el system message
      const systemMessage = messages.find((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: options?.maxTokens ?? 2000,
          system: systemMessage?.content,
          messages: conversationMessages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP,
          stop_sequences: options?.stop,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      // Anthropic devuelve content como array
      const content = data.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("") || "";

      return {
        content,
        finishReason: this.mapFinishReason(data.stop_reason),
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        model: data.model || this.model,
        provider: this.name,
      };
    } catch (error: any) {
      console.error("[AnthropicProvider] Error:", error);
      throw new Error(`Error en Anthropic: ${error.message}`);
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Precios aproximados en USD por 1M tokens (enero 2026)
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
      "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
      "claude-3-opus-20240229": { input: 15, output: 75 },
      "claude-3-sonnet-20240229": { input: 3, output: 15 },
      "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
    };

    const modelPricing = pricing[this.model] || pricing["claude-3-5-sonnet-20241022"];
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }

  private mapFinishReason(reason?: string): AICompletionResponse["finishReason"] {
    switch (reason) {
      case "end_turn":
      case "stop_sequence":
        return "stop";
      case "max_tokens":
        return "length";
      default:
        return "stop";
    }
  }
}

export const anthropicProvider = new AnthropicProvider();
