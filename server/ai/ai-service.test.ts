/**
 * Tests para el Sistema de IA de Green EV
 * Pruebas unitarias para los proveedores de IA
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ManusProvider } from "./providers/manus-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { GoogleProvider } from "./providers/google-provider";
import type { AIMessage, AICompletionResponse } from "./types";

describe("ManusProvider", () => {
  let provider: ManusProvider;

  beforeEach(() => {
    provider = new ManusProvider();
  });

  it("debe tener nombre correcto", () => {
    expect(provider.name).toBe("manus");
    expect(provider.displayName).toBe("Manus LLM (Integrado)");
  });

  it("debe estar siempre configurado", () => {
    expect(provider.isConfigured()).toBe(true);
  });

  it("debe tener modelos soportados", () => {
    expect(provider.supportedModels).toBeInstanceOf(Array);
    expect(provider.supportedModels.length).toBeGreaterThan(0);
  });

  it("debe tener modelo por defecto", () => {
    expect(provider.defaultModel).toBeDefined();
    expect(typeof provider.defaultModel).toBe("string");
  });

  it("debe estimar costo como 0 (incluido)", () => {
    const cost = provider.estimateCost(1000, 500);
    expect(cost).toBe(0);
  });
});

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
  });

  it("debe tener nombre correcto", () => {
    expect(provider.name).toBe("openai");
    expect(provider.displayName).toBe("OpenAI");
  });

  it("no debe estar configurado sin API key", () => {
    expect(provider.isConfigured()).toBe(false);
  });

  it("debe tener modelos soportados", () => {
    expect(provider.supportedModels).toBeInstanceOf(Array);
    expect(provider.supportedModels).toContain("gpt-4o");
    expect(provider.supportedModels).toContain("gpt-4o-mini");
    expect(provider.supportedModels).toContain("gpt-4-turbo");
  });

  it("debe tener modelo por defecto gpt-4o-mini", () => {
    expect(provider.defaultModel).toBe("gpt-4o-mini");
  });

  it("debe estimar costos correctamente", () => {
    const cost = provider.estimateCost(1000, 500);
    // GPT-4o: $2.50/1M input, $10/1M output
    // 1000 input = $0.0025, 500 output = $0.005
    expect(cost).toBeGreaterThan(0);
  });

  it("debe configurarse correctamente con API key", () => {
    provider.configure({ apiKey: "sk-test-key-12345" });
    expect(provider.isConfigured()).toBe(true);
  });
});

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  it("debe tener nombre correcto", () => {
    expect(provider.name).toBe("anthropic");
    expect(provider.displayName).toBe("Anthropic Claude");
  });

  it("no debe estar configurado sin API key", () => {
    expect(provider.isConfigured()).toBe(false);
  });

  it("debe tener modelos soportados", () => {
    expect(provider.supportedModels).toBeInstanceOf(Array);
    expect(provider.supportedModels).toContain("claude-3-5-sonnet-20241022");
    expect(provider.supportedModels).toContain("claude-3-5-haiku-20241022");
  });

  it("debe tener modelo por defecto claude-3-5-sonnet", () => {
    expect(provider.defaultModel).toBe("claude-3-5-sonnet-20241022");
  });

  it("debe configurarse correctamente con API key", () => {
    provider.configure({ apiKey: "sk-ant-test-key-12345" });
    expect(provider.isConfigured()).toBe(true);
  });
});

describe("GoogleProvider", () => {
  let provider: GoogleProvider;

  beforeEach(() => {
    provider = new GoogleProvider();
  });

  it("debe tener nombre correcto", () => {
    expect(provider.name).toBe("google");
    expect(provider.displayName).toBe("Google Gemini");
  });

  it("no debe estar configurado sin API key", () => {
    expect(provider.isConfigured()).toBe(false);
  });

  it("debe tener modelos soportados", () => {
    expect(provider.supportedModels).toBeInstanceOf(Array);
    expect(provider.supportedModels).toContain("gemini-1.5-pro");
    expect(provider.supportedModels).toContain("gemini-1.5-flash");
  });

  it("debe tener modelo por defecto gemini-1.5-flash", () => {
    expect(provider.defaultModel).toBe("gemini-1.5-flash");
  });

  it("debe configurarse correctamente con API key", () => {
    provider.configure({ apiKey: "AIza-test-key-12345" });
    expect(provider.isConfigured()).toBe(true);
  });
});

describe("Tipos de IA", () => {
  it("AIMessage debe tener estructura correcta para role user", () => {
    const message: AIMessage = {
      role: "user",
      content: "Hola",
    };
    
    expect(message.role).toBe("user");
    expect(message.content).toBe("Hola");
  });

  it("AIMessage debe tener estructura correcta para role assistant", () => {
    const message: AIMessage = {
      role: "assistant",
      content: "¡Hola! ¿En qué puedo ayudarte?",
    };
    
    expect(message.role).toBe("assistant");
    expect(message.content).toBe("¡Hola! ¿En qué puedo ayudarte?");
  });

  it("AIMessage debe tener estructura correcta para role system", () => {
    const message: AIMessage = {
      role: "system",
      content: "Eres un asistente útil.",
    };
    
    expect(message.role).toBe("system");
    expect(message.content).toBe("Eres un asistente útil.");
  });

  it("AICompletionResponse debe tener estructura correcta", () => {
    const response: AICompletionResponse = {
      content: "Respuesta de prueba",
      model: "test-model",
      provider: "manus",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    };
    
    expect(response.content).toBe("Respuesta de prueba");
    expect(response.model).toBe("test-model");
    expect(response.provider).toBe("manus");
    expect(response.usage.inputTokens).toBe(100);
    expect(response.usage.outputTokens).toBe(50);
    expect(response.usage.totalTokens).toBe(150);
  });
});

describe("Configuración de proveedores", () => {
  it("OpenAI debe rechazar API keys inválidas", () => {
    const provider = new OpenAIProvider();
    provider.configure({ apiKey: "" });
    expect(provider.isConfigured()).toBe(false);
  });

  it("Anthropic debe rechazar API keys inválidas", () => {
    const provider = new AnthropicProvider();
    provider.configure({ apiKey: "" });
    expect(provider.isConfigured()).toBe(false);
  });

  it("Google debe rechazar API keys inválidas", () => {
    const provider = new GoogleProvider();
    provider.configure({ apiKey: "" });
    expect(provider.isConfigured()).toBe(false);
  });

  it("OpenAI debe permitir cambiar el modelo", () => {
    const provider = new OpenAIProvider();
    provider.configure({ apiKey: "sk-test", model: "gpt-4-turbo" });
    expect(provider.isConfigured()).toBe(true);
  });
});
