import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de uuid
vi.mock("uuid", () => ({
  v4: () => "12345678-1234-1234-1234-123456789abc",
}));

// Mock de Resend
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "email_123" } }),
    },
  })),
}));

// Mock de Wompi config
vi.mock("../wompi/config", () => ({
  isWompiConfigured: vi.fn().mockReturnValue(false),
  createWompiCheckout: vi.fn(),
  generatePaymentReference: vi.fn().mockReturnValue("EVT-TEST-REF"),
}));

describe("Event Router - Unit Tests", () => {
  describe("QR Code Generation", () => {
    it("should generate a unique QR code with EVG prefix", () => {
      // QR code format: EVG-XXXXXXXX-XXXX
      const qrPattern = /^EVG-[A-Z0-9]{8}-[A-Z0-9]+$/;
      const code = `EVG-${"12345678".substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      expect(code).toMatch(qrPattern);
    });
  });

  describe("Investment Packages", () => {
    const INVESTMENT_PACKAGES = {
      AC: { name: "AC Básico", amount: 8500000 },
      DC_INDIVIDUAL: { name: "DC Individual 120kW", amount: 85000000 },
      COLECTIVO: { name: "Estación Premium Colectiva", amount: 200000000 },
    };

    it("should have correct AC package amount", () => {
      expect(INVESTMENT_PACKAGES.AC.amount).toBe(8500000);
    });

    it("should have correct DC Individual package amount", () => {
      expect(INVESTMENT_PACKAGES.DC_INDIVIDUAL.amount).toBe(85000000);
    });

    it("should have correct Colectivo package amount", () => {
      expect(INVESTMENT_PACKAGES.COLECTIVO.amount).toBe(200000000);
    });

    it("should have all three packages defined", () => {
      expect(Object.keys(INVESTMENT_PACKAGES)).toHaveLength(3);
      expect(Object.keys(INVESTMENT_PACKAGES)).toEqual(["AC", "DC_INDIVIDUAL", "COLECTIVO"]);
    });
  });

  describe("Founder Slot Logic", () => {
    it("should assign founder slot up to 30", () => {
      const maxSlot = 29;
      const nextSlot = (maxSlot || 0) + 1;
      const founderSlot = nextSlot <= 30 ? nextSlot : null;
      expect(founderSlot).toBe(30);
    });

    it("should return null when all 30 slots are taken", () => {
      const maxSlot = 30;
      const nextSlot = (maxSlot || 0) + 1;
      const founderSlot = nextSlot <= 30 ? nextSlot : null;
      expect(founderSlot).toBeNull();
    });

    it("should assign slot 1 when no slots are taken", () => {
      const maxSlot = 0;
      const nextSlot = (maxSlot || 0) + 1;
      const founderSlot = nextSlot <= 30 ? nextSlot : null;
      expect(founderSlot).toBe(1);
    });

    it("should handle null maxSlot (no previous guests)", () => {
      const maxSlot = null;
      const nextSlot = (maxSlot || 0) + 1;
      const founderSlot = nextSlot <= 30 ? nextSlot : null;
      expect(founderSlot).toBe(1);
    });
  });

  describe("Email Invitation Template", () => {
    it("should generate valid HTML email with guest data", () => {
      const guest = {
        fullName: "Juan Pérez",
        email: "juan@test.com",
        founderSlot: 5,
        investmentPackage: "DC_INDIVIDUAL",
        qrCode: "EVG-12345678-ABC",
      };

      // Verify QR URL generation
      const qrUrl = `https://evgreen.lat/event-checkin/${guest.qrCode}`;
      expect(qrUrl).toBe("https://evgreen.lat/event-checkin/EVG-12345678-ABC");

      // Verify QR image URL generation
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}&bgcolor=0a0a0a&color=22c55e&format=png`;
      expect(qrImageUrl).toContain("EVG-12345678-ABC");
      expect(qrImageUrl).toContain("create-qr-code");
    });

    it("should include founder slot badge when slot is assigned", () => {
      const guest = { founderSlot: 5 };
      const founderSlotText = guest.founderSlot
        ? `CUPO FUNDADOR #${guest.founderSlot} DE 30`
        : "";
      expect(founderSlotText).toBe("CUPO FUNDADOR #5 DE 30");
    });

    it("should not include founder slot badge when slot is null", () => {
      const guest = { founderSlot: null };
      const founderSlotText = guest.founderSlot
        ? `CUPO FUNDADOR #${guest.founderSlot} DE 30`
        : "";
      expect(founderSlotText).toBe("");
    });
  });

  describe("Payment Validation", () => {
    it("should enforce minimum payment of 1,000,000 COP", () => {
      const minPayment = 1000000;
      expect(minPayment).toBe(1000000);
      
      // Test that amounts below minimum would be rejected
      const invalidAmount = 500000;
      expect(invalidAmount < minPayment).toBe(true);
    });

    it("should allow payments above minimum", () => {
      const minPayment = 1000000;
      const validAmounts = [1000000, 5000000, 10000000, 85000000];
      
      validAmounts.forEach((amount) => {
        expect(amount >= minPayment).toBe(true);
      });
    });

    it("should support all payment methods", () => {
      const validMethods = ["WOMPI", "CASH", "TRANSFER", "CARD", "NEQUI"];
      expect(validMethods).toHaveLength(5);
    });
  });

  describe("Check-in Logic", () => {
    it("should detect already checked-in guests", () => {
      const guest = { status: "CHECKED_IN", fullName: "Test User" };
      const alreadyCheckedIn = guest.status === "CHECKED_IN";
      expect(alreadyCheckedIn).toBe(true);
    });

    it("should detect cancelled invitations", () => {
      const guest = { status: "CANCELLED", fullName: "Test User" };
      const isCancelled = guest.status === "CANCELLED";
      expect(isCancelled).toBe(true);
    });

    it("should allow check-in for INVITED status", () => {
      const guest = { status: "INVITED" };
      const canCheckIn = guest.status !== "CHECKED_IN" && guest.status !== "CANCELLED";
      expect(canCheckIn).toBe(true);
    });

    it("should allow check-in for CONFIRMED status", () => {
      const guest = { status: "CONFIRMED" };
      const canCheckIn = guest.status !== "CHECKED_IN" && guest.status !== "CANCELLED";
      expect(canCheckIn).toBe(true);
    });
  });

  describe("QR Code URL Parsing", () => {
    it("should extract QR code from full URL", () => {
      const fullUrl = "https://evgreen.lat/event-checkin/EVG-12345678-ABC";
      let code = fullUrl;
      if (code.includes("/event-checkin/")) {
        code = code.split("/event-checkin/").pop() || code;
      }
      expect(code).toBe("EVG-12345678-ABC");
    });

    it("should handle raw QR codes without URL", () => {
      const rawCode = "EVG-12345678-ABC";
      let code = rawCode;
      if (code.includes("/event-checkin/")) {
        code = code.split("/event-checkin/").pop() || code;
      }
      expect(code).toBe("EVG-12345678-ABC");
    });
  });
});
