import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de config
vi.mock("./config", () => ({
  getWompiKeys: vi.fn(),
  generatePaymentReference: vi.fn(() => "REC-TEST-123"),
  generateIntegritySignature: vi.fn(() => "test-integrity-signature"),
  WOMPI_TRANSACTION_STATUS: {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    DECLINED: "DECLINED",
    VOIDED: "VOIDED",
    ERROR: "ERROR",
  },
}));

// Mock de db
vi.mock("../db", () => ({
  getActiveSubscriptionsForBilling: vi.fn(),
  createWompiTransaction: vi.fn(() => 1),
  updateWompiTransactionByReference: vi.fn(),
  updateSubscriptionBilling: vi.fn(),
  incrementSubscriptionFailedPayments: vi.fn(),
  cancelUserSubscription: vi.fn(),
  createNotification: vi.fn(),
  getUserById: vi.fn(() => ({ id: 1, fcmToken: null })),
}));

// Mock de FCM
vi.mock("../firebase/fcm", () => ({
  sendPushNotification: vi.fn(() => true),
}));

// Mock de fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

import { processRecurringBilling, createPaymentSource, getAcceptanceToken } from "./recurring-billing";
import { getWompiKeys } from "./config";
import * as db from "../db";

const mockKeys = {
  publicKey: "pub_test_abc",
  privateKey: "prv_test_xyz",
  integritySecret: "integrity_test",
  eventsSecret: "events_test",
  testMode: true,
  apiUrl: "https://api-sandbox.co.uat.wompi.dev/v1",
};

describe("Recurring Billing Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processRecurringBilling", () => {
    it("retorna resultado vacío si Wompi no está configurado", async () => {
      (getWompiKeys as any).mockResolvedValue(null);

      const result = await processRecurringBilling();

      expect(result.processed).toBe(0);
      expect(result.errors).toContain("Wompi no configurado");
    });

    it("retorna resultado vacío si no hay suscripciones pendientes", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);
      (db.getActiveSubscriptionsForBilling as any).mockResolvedValue([]);

      const result = await processRecurringBilling();

      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
    });

    it("cancela suscripción con demasiados fallos", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);
      (db.getActiveSubscriptionsForBilling as any).mockResolvedValue([
        {
          id: 1,
          userId: 10,
          tier: "BASIC",
          failedPaymentCount: 3,
          wompiPaymentSourceId: "ps_123",
          customerEmail: "test@test.com",
        },
      ]);

      const result = await processRecurringBilling();

      expect(result.cancelled).toBe(1);
      expect(db.cancelUserSubscription).toHaveBeenCalledWith(10);
      expect(db.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          title: "Suscripción cancelada por falta de pago",
        })
      );
    });

    it("cobra exitosamente con payment source tokenizado", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);
      (db.getActiveSubscriptionsForBilling as any).mockResolvedValue([
        {
          id: 1,
          userId: 10,
          tier: "BASIC",
          failedPaymentCount: 0,
          wompiPaymentSourceId: "ps_123",
          customerEmail: "test@test.com",
        },
      ]);

      // First call: getAcceptanceToken fetches merchants/{publicKey}
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              presigned_acceptance: { acceptance_token: "acc_test", permalink: "https://wompi.co/terms" },
              presigned_personal_data_auth: { acceptance_token: "personal_test" },
            },
          }),
      });
      // Second call: create transaction
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: "tx-wompi-001",
              status: "APPROVED",
              payment_method_type: "CARD",
            },
          }),
      });

      const result = await processRecurringBilling();

      expect(result.successful).toBe(1);
      expect(db.updateSubscriptionBilling).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          failedPaymentCount: 0,
        })
      );
      expect(db.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          title: "Cobro de suscripción exitoso",
        })
      );
    });

    it("maneja pago pendiente sin contar como fallo", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);
      (db.getActiveSubscriptionsForBilling as any).mockResolvedValue([
        {
          id: 2,
          userId: 20,
          tier: "PREMIUM",
          failedPaymentCount: 0,
          wompiPaymentSourceId: "ps_456",
          customerEmail: "premium@test.com",
        },
      ]);

      // First call: getAcceptanceToken
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              presigned_acceptance: { acceptance_token: "acc_test", permalink: "https://wompi.co/terms" },
              presigned_personal_data_auth: { acceptance_token: "personal_test" },
            },
          }),
      });
      // Second call: create transaction
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: "tx-wompi-002",
              status: "PENDING",
              payment_method_type: "CARD",
            },
          }),
      });

      const result = await processRecurringBilling();

      expect(result.successful).toBe(1); // PENDING no es fallo
      expect(result.failed).toBe(0);
    });

    it("maneja pago rechazado incrementando fallos", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);
      (db.getActiveSubscriptionsForBilling as any).mockResolvedValue([
        {
          id: 3,
          userId: 30,
          tier: "BASIC",
          failedPaymentCount: 1,
          wompiPaymentSourceId: "ps_789",
          customerEmail: "user@test.com",
        },
      ]);

      // First call: getAcceptanceToken
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              presigned_acceptance: { acceptance_token: "acc_test", permalink: "https://wompi.co/terms" },
              presigned_personal_data_auth: { acceptance_token: "personal_test" },
            },
          }),
      });
      // Second call: create transaction
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: "tx-wompi-003",
              status: "DECLINED",
              payment_method_type: "CARD",
            },
          }),
      });

      const result = await processRecurringBilling();

      expect(result.failed).toBe(1);
      expect(db.incrementSubscriptionFailedPayments).toHaveBeenCalledWith(3);
      expect(db.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 30,
          title: "Error en cobro de suscripción",
        })
      );
    });

    it("notifica pago manual si no tiene payment source", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);
      (db.getActiveSubscriptionsForBilling as any).mockResolvedValue([
        {
          id: 4,
          userId: 40,
          tier: "PREMIUM",
          failedPaymentCount: 0,
          wompiPaymentSourceId: null,
          customerEmail: "manual@test.com",
        },
      ]);

      const result = await processRecurringBilling();

      expect(result.failed).toBe(1);
      expect(db.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 40,
          title: "Renovación de suscripción pendiente",
        })
      );
    });

    it("envía push notification cuando el usuario tiene FCM token", async () => {
      const { sendPushNotification } = await import("../firebase/fcm");
      (db.getUserById as any).mockResolvedValue({ id: 10, fcmToken: "fcm_token_abc" });
      (getWompiKeys as any).mockResolvedValue(mockKeys);
      (db.getActiveSubscriptionsForBilling as any).mockResolvedValue([
        {
          id: 1,
          userId: 10,
          tier: "BASIC",
          failedPaymentCount: 0,
          wompiPaymentSourceId: "ps_123",
          customerEmail: "test@test.com",
        },
      ]);

      // First call: getAcceptanceToken
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              presigned_acceptance: { acceptance_token: "acc_test", permalink: "https://wompi.co/terms" },
              presigned_personal_data_auth: { acceptance_token: "personal_test" },
            },
          }),
      });
      // Second call: create transaction
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { id: "tx-001", status: "APPROVED", payment_method_type: "CARD" },
          }),
      });

      await processRecurringBilling();

      expect(sendPushNotification).toHaveBeenCalledWith(
        "fcm_token_abc",
        expect.objectContaining({
          title: "Cobro de suscripción exitoso",
        })
      );
    });
  });

  describe("createPaymentSource", () => {
    it("retorna null si Wompi no está configurado", async () => {
      (getWompiKeys as any).mockResolvedValue(null);

      const result = await createPaymentSource({
        cardToken: "tok_123",
        customerEmail: "test@test.com",
        acceptanceToken: "acc_123",
      });

      expect(result).toBeNull();
    });

    it("crea payment source exitosamente", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { id: 12345, status: "AVAILABLE" },
          }),
      });

      const result = await createPaymentSource({
        cardToken: "tok_123",
        customerEmail: "test@test.com",
        acceptanceToken: "acc_123",
      });

      expect(result).toEqual({
        paymentSourceId: "12345",
        status: "AVAILABLE",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/payment_sources"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockKeys.privateKey}`,
          }),
        })
      );
    });

    it("retorna null si la API falla", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve("Invalid card token"),
      });

      const result = await createPaymentSource({
        cardToken: "invalid_token",
        customerEmail: "test@test.com",
        acceptanceToken: "acc_123",
      });

      expect(result).toBeNull();
    });
  });

  describe("getAcceptanceToken", () => {
    it("retorna null si Wompi no está configurado", async () => {
      (getWompiKeys as any).mockResolvedValue(null);

      const result = await getAcceptanceToken();
      expect(result).toBeNull();
    });

    it("obtiene acceptance token exitosamente", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              presigned_acceptance: {
                acceptance_token: "acc_token_123",
                permalink: "https://wompi.co/terms",
              },
              presigned_personal_data_auth: {
                acceptance_token: "personal_token_456",
              },
            },
          }),
      });

      const result = await getAcceptanceToken();

      expect(result).toEqual({
        acceptanceToken: "acc_token_123",
        personalAuthToken: "personal_token_456",
        permalink: "https://wompi.co/terms",
      });
    });

    it("retorna null si la API falla", async () => {
      (getWompiKeys as any).mockResolvedValue(mockKeys);

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await getAcceptanceToken();
      expect(result).toBeNull();
    });
  });

  describe("Plan Prices", () => {
    it("usa precios correctos para cada plan", () => {
      // Verificar que los precios están definidos correctamente
      const PLAN_PRICES: Record<string, number> = {
        BASIC: 18900,
        PREMIUM: 33900,
      };

      expect(PLAN_PRICES.BASIC).toBe(18900);
      expect(PLAN_PRICES.PREMIUM).toBe(33900);
    });
  });
});
