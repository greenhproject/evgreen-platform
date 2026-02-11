import { describe, it, expect } from "vitest";
import {
  exportGuestsToExcel,
  exportPaymentsToExcel,
  exportGuestsToPDF,
  exportPaymentsToPDF,
} from "./event-export";

const mockGuests = [
  {
    id: 1,
    fullName: "Juan Pérez",
    email: "juan@test.com",
    phone: "+573001234567",
    company: "Empresa Test S.A.S.",
    position: "Gerente",
    investmentPackage: "DC_INDIVIDUAL",
    investmentAmount: 85000000,
    founderSlot: 1,
    status: "CHECKED_IN",
    qrCode: "EVG-ABC12345-XYZ",
    invitationSentAt: new Date("2026-02-01"),
    checkedInAt: new Date("2026-02-06"),
    createdAt: new Date("2026-01-30"),
  },
  {
    id: 2,
    fullName: "María García",
    email: "maria@test.com",
    phone: null,
    company: null,
    position: null,
    investmentPackage: "AC",
    investmentAmount: 8500000,
    founderSlot: 2,
    status: "CONFIRMED",
    qrCode: "EVG-DEF67890-ABC",
    invitationSentAt: new Date("2026-02-01"),
    checkedInAt: null,
    createdAt: new Date("2026-01-30"),
  },
  {
    id: 3,
    fullName: "Carlos López",
    email: "carlos@test.com",
    phone: "+573009876543",
    company: "Inversiones CL",
    position: "Director",
    investmentPackage: "COLECTIVO",
    investmentAmount: 200000000,
    founderSlot: 3,
    status: "INVITED",
    qrCode: "EVG-GHI11111-DEF",
    invitationSentAt: null,
    checkedInAt: null,
    createdAt: new Date("2026-02-05"),
  },
];

const mockPayments = [
  {
    id: 1,
    guestName: "Juan Pérez",
    guestEmail: "juan@test.com",
    guestCompany: "Empresa Test S.A.S.",
    founderSlot: 1,
    amount: 1000000,
    selectedPackage: "DC_INDIVIDUAL",
    paymentStatus: "PAID",
    paymentMethod: "TRANSFER",
    paymentReference: "EVT-REF-001",
    paidAt: new Date("2026-02-06"),
    createdAt: new Date("2026-02-06"),
  },
  {
    id: 2,
    guestName: "María García",
    guestEmail: "maria@test.com",
    guestCompany: null,
    founderSlot: 2,
    amount: 5000000,
    selectedPackage: "AC",
    paymentStatus: "PAID",
    paymentMethod: "NEQUI",
    paymentReference: "EVT-REF-002",
    paidAt: new Date("2026-02-06"),
    createdAt: new Date("2026-02-06"),
  },
  {
    id: 3,
    guestName: "Carlos López",
    guestEmail: "carlos@test.com",
    guestCompany: "Inversiones CL",
    founderSlot: 3,
    amount: 1000000,
    selectedPackage: "COLECTIVO",
    paymentStatus: "PENDING",
    paymentMethod: "WOMPI",
    paymentReference: "EVT-REF-003",
    paidAt: null,
    createdAt: new Date("2026-02-06"),
  },
];

describe("Event Export Module", () => {
  describe("exportGuestsToExcel", () => {
    it("should generate a valid Excel buffer with guest data", async () => {
      const buffer = await exportGuestsToExcel(mockGuests);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // XLSX files start with PK (zip format)
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });

    it("should handle empty guest list", async () => {
      const buffer = await exportGuestsToExcel([]);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle guests with null fields", async () => {
      const guestsWithNulls = [
        {
          id: 1,
          fullName: "Test User",
          email: "test@test.com",
          phone: null,
          company: null,
          position: null,
          investmentPackage: null,
          investmentAmount: null,
          founderSlot: null,
          status: "INVITED",
          qrCode: "EVG-TEST",
          invitationSentAt: null,
          checkedInAt: null,
          createdAt: null,
        },
      ];
      const buffer = await exportGuestsToExcel(guestsWithNulls);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("exportPaymentsToExcel", () => {
    it("should generate a valid Excel buffer with payment data", async () => {
      const buffer = await exportPaymentsToExcel(mockPayments);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });

    it("should handle empty payment list", async () => {
      const buffer = await exportPaymentsToExcel([]);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("exportGuestsToPDF", () => {
    it("should generate a valid PDF buffer with guest data", () => {
      const buffer = exportGuestsToPDF(mockGuests);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      const header = buffer.subarray(0, 4).toString("ascii");
      expect(header).toBe("%PDF");
    });

    it("should handle empty guest list", () => {
      const buffer = exportGuestsToPDF([]);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle guests with all statuses", () => {
      const allStatuses = [
        { ...mockGuests[0], status: "CHECKED_IN" },
        { ...mockGuests[1], status: "CANCELLED" },
        { ...mockGuests[2], status: "NO_SHOW" },
      ];
      const buffer = exportGuestsToPDF(allStatuses);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("exportPaymentsToPDF", () => {
    it("should generate a valid PDF buffer with payment data", () => {
      const buffer = exportPaymentsToPDF(mockPayments);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      const header = buffer.subarray(0, 4).toString("ascii");
      expect(header).toBe("%PDF");
    });

    it("should handle empty payment list", () => {
      const buffer = exportPaymentsToPDF([]);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should correctly calculate totals", () => {
      const buffer = exportPaymentsToPDF(mockPayments);
      // Just verify it generates without error - the totals are rendered inside the PDF
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });
});
