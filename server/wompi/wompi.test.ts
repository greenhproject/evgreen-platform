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
});
