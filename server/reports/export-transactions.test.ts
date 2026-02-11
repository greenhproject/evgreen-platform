import { describe, it, expect } from "vitest";
import { generateExcelReport, generatePDFReport } from "./export-transactions";

describe("Exportación de Transacciones", () => {
  const mockTransactions = [
    {
      id: 1,
      stationId: 100,
      stationName: "Estación Centro",
      startTime: new Date("2026-01-15T10:00:00Z"),
      kwhConsumed: "25.50",
      totalCost: "25500",
      investorShare: "20400",
      status: "COMPLETED",
    },
    {
      id: 2,
      stationId: 100,
      stationName: "Estación Centro",
      startTime: new Date("2026-01-16T14:30:00Z"),
      kwhConsumed: "18.75",
      totalCost: "18750",
      investorShare: "15000",
      status: "COMPLETED",
    },
  ];

  const mockOptions = {
    investorName: "Juan Pérez",
    investorPercentage: 80,
    platformFeePercentage: 20,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-31"),
  };

  describe("generateExcelReport", () => {
    it("debe generar un buffer de Excel válido", () => {
      const buffer = generateExcelReport(mockTransactions, mockOptions);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("debe generar Excel con transacciones vacías", () => {
      const buffer = generateExcelReport([], mockOptions);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("debe manejar valores null en kwhConsumed y totalCost", () => {
      const transactionsWithNulls = [
        {
          id: 1,
          stationId: 100,
          stationName: "Estación Test",
          startTime: new Date(),
          kwhConsumed: null,
          totalCost: null,
          investorShare: null,
          status: "PENDING",
        },
      ];
      const buffer = generateExcelReport(transactionsWithNulls, mockOptions);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("generatePDFReport", () => {
    it("debe generar un buffer de PDF válido", () => {
      const buffer = generatePDFReport(mockTransactions, mockOptions);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("debe generar PDF con transacciones vacías", () => {
      const buffer = generatePDFReport([], mockOptions);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("debe manejar valores null en kwhConsumed y totalCost", () => {
      const transactionsWithNulls = [
        {
          id: 1,
          stationId: 100,
          stationName: "Estación Test",
          startTime: new Date(),
          kwhConsumed: null,
          totalCost: null,
          investorShare: null,
          status: "PENDING",
        },
      ];
      const buffer = generatePDFReport(transactionsWithNulls, mockOptions);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
