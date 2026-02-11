import { describe, it, expect } from "vitest";
import {
  generateIntegritySignature,
  generatePaymentReference,
  buildCheckoutUrl,
  verifyWebhookChecksum,
  WOMPI_TRANSACTION_STATUS,
  WOMPI_PAYMENT_METHODS,
} from "./config";

describe("Wompi Config", () => {
  describe("generateIntegritySignature", () => {
    it("genera firma SHA256 correcta con referencia, monto y moneda", () => {
      const reference = "WLT-TEST-ABC123";
      const amountInCents = 5000000; // $50,000 COP
      const currency = "COP";
      const integritySecret = "test_integrity_secret_123";

      const signature = generateIntegritySignature(
        reference,
        amountInCents,
        currency,
        integritySecret
      );

      // La firma debe ser un hash SHA256 hexadecimal de 64 caracteres
      expect(signature).toHaveLength(64);
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it("genera firmas diferentes para montos diferentes", () => {
      const secret = "test_secret";
      const sig1 = generateIntegritySignature("REF1", 100000, "COP", secret);
      const sig2 = generateIntegritySignature("REF1", 200000, "COP", secret);

      expect(sig1).not.toBe(sig2);
    });

    it("genera firmas diferentes para referencias diferentes", () => {
      const secret = "test_secret";
      const sig1 = generateIntegritySignature("REF1", 100000, "COP", secret);
      const sig2 = generateIntegritySignature("REF2", 100000, "COP", secret);

      expect(sig1).not.toBe(sig2);
    });

    it("incluye expirationTime en la firma si se proporciona", () => {
      const secret = "test_secret";
      const sigWithout = generateIntegritySignature("REF1", 100000, "COP", secret);
      const sigWith = generateIntegritySignature("REF1", 100000, "COP", secret, "2026-02-08T00:00:00.000Z");

      expect(sigWithout).not.toBe(sigWith);
    });
  });

  describe("generatePaymentReference", () => {
    it("genera referencia con prefijo por defecto EVG", () => {
      const ref = generatePaymentReference();
      expect(ref).toMatch(/^EVG-/);
    });

    it("genera referencia con prefijo personalizado", () => {
      const ref = generatePaymentReference("WLT");
      expect(ref).toMatch(/^WLT-/);
    });

    it("genera referencias únicas", () => {
      const refs = new Set<string>();
      for (let i = 0; i < 100; i++) {
        refs.add(generatePaymentReference("TST"));
      }
      expect(refs.size).toBe(100);
    });

    it("genera referencia en mayúsculas", () => {
      const ref = generatePaymentReference("test");
      expect(ref).toBe(ref.toUpperCase());
    });
  });

  describe("buildCheckoutUrl", () => {
    it("construye URL de checkout con todos los parámetros requeridos", () => {
      const url = buildCheckoutUrl({
        publicKey: "pub_test_abc123",
        reference: "WLT-TEST-REF",
        amountInCents: 5000000,
        currency: "COP",
        signature: "abc123signature",
        redirectUrl: "https://evgreen.lat/wallet?payment=wompi",
        customerEmail: "test@example.com",
      });

      expect(url).toContain("https://checkout.wompi.co/p/");
      expect(url).toContain("public-key=pub_test_abc123");
      expect(url).toContain("amount-in-cents=5000000");
      expect(url).toContain("currency=COP");
      expect(url).toContain("reference=WLT-TEST-REF");
      expect(url).toContain("signature%3Aintegrity=abc123signature");
      expect(url).toContain("customer-data%3Aemail=test%40example.com");
    });

    it("incluye nombre del cliente si se proporciona", () => {
      const url = buildCheckoutUrl({
        publicKey: "pub_test_abc123",
        reference: "WLT-TEST-REF",
        amountInCents: 5000000,
        currency: "COP",
        signature: "abc123signature",
        redirectUrl: "https://evgreen.lat/wallet",
        customerEmail: "test@example.com",
        customerName: "Juan Pérez",
      });

      expect(url).toContain("customer-data%3Afull-name=");
    });

    it("incluye teléfono del cliente si se proporciona", () => {
      const url = buildCheckoutUrl({
        publicKey: "pub_test_abc123",
        reference: "WLT-TEST-REF",
        amountInCents: 5000000,
        currency: "COP",
        signature: "abc123signature",
        redirectUrl: "https://evgreen.lat/wallet",
        customerEmail: "test@example.com",
        customerPhone: "+573001234567",
      });

      expect(url).toContain("customer-data%3Aphone-number=");
    });
  });

  describe("verifyWebhookChecksum", () => {
    it("retorna false si el evento no tiene signature", () => {
      const result = verifyWebhookChecksum({}, "secret");
      expect(result).toBe(false);
    });

    it("retorna false si el evento no tiene properties", () => {
      const result = verifyWebhookChecksum(
        { signature: { checksum: "abc" } },
        "secret"
      );
      expect(result).toBe(false);
    });

    it("verifica checksum correcto con propiedades del evento", () => {
      const crypto = require("crypto");
      const eventsSecret = "test_events_secret";
      const timestamp = 1707350400;

      const event = {
        event: "transaction.updated",
        data: {
          transaction: {
            id: "123-abc",
            status: "APPROVED",
            amount_in_cents: 5000000,
          },
        },
        timestamp,
        signature: {
          properties: [
            "data.transaction.id",
            "data.transaction.status",
            "data.transaction.amount_in_cents",
          ],
          checksum: "", // Se calculará abajo
        },
      };

      // Calcular el checksum esperado
      const concatenated = "123-abcAPPROVED5000000" + timestamp + eventsSecret;
      event.signature.checksum = crypto
        .createHash("sha256")
        .update(concatenated)
        .digest("hex");

      const result = verifyWebhookChecksum(event, eventsSecret);
      expect(result).toBe(true);
    });

    it("rechaza checksum incorrecto", () => {
      const event = {
        event: "transaction.updated",
        data: {
          transaction: {
            id: "123-abc",
            status: "APPROVED",
            amount_in_cents: 5000000,
          },
        },
        timestamp: 1707350400,
        signature: {
          properties: [
            "data.transaction.id",
            "data.transaction.status",
            "data.transaction.amount_in_cents",
          ],
          checksum: "invalid_checksum_value",
        },
      };

      const result = verifyWebhookChecksum(event, "test_events_secret");
      expect(result).toBe(false);
    });
  });

  describe("Constants", () => {
    it("define todos los estados de transacción", () => {
      expect(WOMPI_TRANSACTION_STATUS.PENDING).toBe("PENDING");
      expect(WOMPI_TRANSACTION_STATUS.APPROVED).toBe("APPROVED");
      expect(WOMPI_TRANSACTION_STATUS.DECLINED).toBe("DECLINED");
      expect(WOMPI_TRANSACTION_STATUS.VOIDED).toBe("VOIDED");
      expect(WOMPI_TRANSACTION_STATUS.ERROR).toBe("ERROR");
    });

    it("define todos los métodos de pago", () => {
      expect(WOMPI_PAYMENT_METHODS.CARD).toBe("CARD");
      expect(WOMPI_PAYMENT_METHODS.PSE).toBe("PSE");
      expect(WOMPI_PAYMENT_METHODS.NEQUI).toBe("NEQUI");
      expect(WOMPI_PAYMENT_METHODS.BANCOLOMBIA_QR).toBe("BANCOLOMBIA_QR");
      expect(WOMPI_PAYMENT_METHODS.EFECTY).toBe("EFECTY");
    });
  });

  describe("Subscription Payment References", () => {
    it("genera referencia con prefijo SUB para suscripciones", () => {
      const ref = generatePaymentReference("SUB");
      expect(ref).toMatch(/^SUB-/);
      expect(ref.length).toBeGreaterThan(10);
    });

    it("genera firmas de integridad válidas para montos de suscripción", () => {
      const secret = "test_integrity_secret";
      
      // Plan Básico: $18,900 COP = 1890000 centavos
      const sigBasic = generateIntegritySignature("SUB-BASIC-001", 1890000, "COP", secret);
      expect(sigBasic).toHaveLength(64);
      expect(sigBasic).toMatch(/^[a-f0-9]{64}$/);

      // Plan Premium: $33,900 COP = 3390000 centavos
      const sigPremium = generateIntegritySignature("SUB-PREMIUM-001", 3390000, "COP", secret);
      expect(sigPremium).toHaveLength(64);
      expect(sigPremium).toMatch(/^[a-f0-9]{64}$/);

      // Las firmas deben ser diferentes
      expect(sigBasic).not.toBe(sigPremium);
    });

    it("construye URL de checkout para suscripción con redirect correcto", () => {
      const url = buildCheckoutUrl({
        publicKey: "pub_test_abc123",
        reference: "SUB-PREMIUM-XYZ",
        amountInCents: 3390000,
        currency: "COP",
        signature: "abc123signature",
        redirectUrl: "https://evgreen.lat/wallet?payment=wompi&reference=SUB-PREMIUM-XYZ&type=subscription&plan=premium",
        customerEmail: "user@test.com",
      });

      expect(url).toContain("https://checkout.wompi.co/p/");
      expect(url).toContain("reference=SUB-PREMIUM-XYZ");
      expect(url).toContain("amount-in-cents=3390000");
      expect(url).toContain("type%3Dsubscription");
      expect(url).toContain("plan%3Dpremium");
    });
  });

  describe("Card Data Extraction from Wompi Responses", () => {
    it("extrae brand y last_four del formato directo (payment_method.brand)", () => {
      const tx = {
        payment_method: {
          type: "CARD",
          brand: "VISA",
          last_four: "4242",
        },
      };
      const cardBrand = tx.payment_method?.brand || (tx.payment_method as any)?.extra?.brand;
      const cardLastFour = tx.payment_method?.last_four || (tx.payment_method as any)?.extra?.last_four;
      expect(cardBrand).toBe("VISA");
      expect(cardLastFour).toBe("4242");
    });

    it("extrae brand y last_four del formato legacy (payment_method.extra)", () => {
      const tx = {
        payment_method: {
          type: "CARD",
          extra: {
            brand: "MASTERCARD",
            last_four: "1234",
          },
        },
      };
      const cardBrand = (tx.payment_method as any)?.brand || tx.payment_method?.extra?.brand;
      const cardLastFour = (tx.payment_method as any)?.last_four || tx.payment_method?.extra?.last_four;
      expect(cardBrand).toBe("MASTERCARD");
      expect(cardLastFour).toBe("1234");
    });

    it("retorna undefined si no hay datos de tarjeta", () => {
      const tx = {
        payment_method_type: "NEQUI",
      };
      const cardBrand = (tx as any).payment_method?.brand || (tx as any).payment_method?.extra?.brand;
      const cardLastFour = (tx as any).payment_method?.last_four || (tx as any).payment_method?.extra?.last_four;
      expect(cardBrand).toBeUndefined();
      expect(cardLastFour).toBeUndefined();
    });

    it("prioriza formato directo sobre legacy cuando ambos existen", () => {
      const tx = {
        payment_method: {
          type: "CARD",
          brand: "VISA",
          last_four: "4242",
          extra: {
            brand: "MASTERCARD",
            last_four: "9999",
          },
        },
      };
      const cardBrand = tx.payment_method?.brand || tx.payment_method?.extra?.brand;
      const cardLastFour = tx.payment_method?.last_four || tx.payment_method?.extra?.last_four;
      expect(cardBrand).toBe("VISA");
      expect(cardLastFour).toBe("4242");
    });
  });

  describe("Webhook Checksum for Subscription Events", () => {
    it("verifica checksum de evento de suscripción aprobada", () => {
      const crypto = require("crypto");
      const eventsSecret = "test_events_secret";
      const timestamp = 1707350400;

      const event = {
        event: "transaction.updated",
        data: {
          transaction: {
            id: "sub-tx-456",
            status: "APPROVED",
            amount_in_cents: 3390000,
          },
        },
        timestamp,
        signature: {
          properties: [
            "data.transaction.id",
            "data.transaction.status",
            "data.transaction.amount_in_cents",
          ],
          checksum: "",
        },
      };

      const concatenated = "sub-tx-456APPROVED3390000" + timestamp + eventsSecret;
      event.signature.checksum = crypto
        .createHash("sha256")
        .update(concatenated)
        .digest("hex");

      const result = verifyWebhookChecksum(event, eventsSecret);
      expect(result).toBe(true);
    });

    it("verifica checksum de evento de pago rechazado", () => {
      const crypto = require("crypto");
      const eventsSecret = "test_events_secret";
      const timestamp = 1707350500;

      const event = {
        event: "transaction.updated",
        data: {
          transaction: {
            id: "sub-tx-789",
            status: "DECLINED",
            amount_in_cents: 1890000,
          },
        },
        timestamp,
        signature: {
          properties: [
            "data.transaction.id",
            "data.transaction.status",
            "data.transaction.amount_in_cents",
          ],
          checksum: "",
        },
      };

      const concatenated = "sub-tx-789DECLINED1890000" + timestamp + eventsSecret;
      event.signature.checksum = crypto
        .createHash("sha256")
        .update(concatenated)
        .digest("hex");

      const result = verifyWebhookChecksum(event, eventsSecret);
      expect(result).toBe(true);
    });
  });
});
