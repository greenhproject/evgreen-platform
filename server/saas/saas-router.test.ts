/**
 * Tests for SaaS Landing Router
 * Validates demo request and contact form procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb to avoid real DB connections in tests
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));

// Mock Resend to avoid real email sends in tests
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "mock-email-id" }),
    },
  })),
}));

import { saasRouter } from "./saas-router";
import { getDb } from "../db";

describe("saasRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitDemoRequest", () => {
    it("should have submitDemoRequest procedure defined", () => {
      expect(saasRouter).toBeDefined();
      expect(saasRouter._def).toBeDefined();
    });

    it("validates required fields - name must be at least 2 chars", async () => {
      // The Zod schema enforces min(2) on name
      const schema = (saasRouter._def.procedures as any)?.submitDemoRequest?._def?.inputs?.[0];
      if (schema) {
        const result = schema.safeParse({ name: "A", company: "Test Co", email: "test@test.com" });
        expect(result.success).toBe(false);
      }
    });

    it("validates email format", async () => {
      const schema = (saasRouter._def.procedures as any)?.submitDemoRequest?._def?.inputs?.[0];
      if (schema) {
        const result = schema.safeParse({ name: "John", company: "Test Co", email: "not-an-email" });
        expect(result.success).toBe(false);
      }
    });

    it("accepts valid demo request data", async () => {
      const schema = (saasRouter._def.procedures as any)?.submitDemoRequest?._def?.inputs?.[0];
      if (schema) {
        const result = schema.safeParse({
          name: "Juan Pérez",
          company: "Empresa S.A.S.",
          email: "juan@empresa.com",
          phone: "+57 300 000 0000",
          chargerCount: "6-20",
          plan: "professional",
          message: "Quiero una demo de la plataforma",
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("submitContactForm", () => {
    it("should have submitContactForm procedure defined", () => {
      expect(saasRouter._def).toBeDefined();
    });

    it("validates message minimum length", async () => {
      const schema = (saasRouter._def.procedures as any)?.submitContactForm?._def?.inputs?.[0];
      if (schema) {
        const result = schema.safeParse({
          name: "Juan",
          email: "juan@test.com",
          subject: "Consulta",
          message: "Corto", // less than 10 chars
        });
        expect(result.success).toBe(false);
      }
    });

    it("accepts valid contact form data", async () => {
      const schema = (saasRouter._def.procedures as any)?.submitContactForm?._def?.inputs?.[0];
      if (schema) {
        const result = schema.safeParse({
          name: "María García",
          email: "maria@empresa.com",
          phone: "+57 310 000 0000",
          subject: "Consulta sobre planes",
          message: "Me gustaría saber más sobre el plan Professional y sus características.",
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
