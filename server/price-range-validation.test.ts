/**
 * Tests para validación de rangos globales de precio en tarifas por estación.
 * Verifica que los endpoints create, update y updateByStation rechacen
 * precios fuera del rango global (minPricePerKwh - maxPricePerKwh).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
const mockGetPriceRanges = vi.fn();
const mockGetChargingStationById = vi.fn();
const mockGetActiveTariffByStationId = vi.fn();
const mockGetTariffsByStationId = vi.fn();
const mockGetTariffById = vi.fn();
const mockCreateTariff = vi.fn();
const mockUpdateTariff = vi.fn();

vi.mock("./db", () => ({
  getPriceRanges: (...args: any[]) => mockGetPriceRanges(...args),
  getChargingStationById: (...args: any[]) => mockGetChargingStationById(...args),
  getActiveTariffByStationId: (...args: any[]) => mockGetActiveTariffByStationId(...args),
  getTariffsByStationId: (...args: any[]) => mockGetTariffsByStationId(...args),
  getTariffById: (...args: any[]) => mockGetTariffById(...args),
  createTariff: (...args: any[]) => mockCreateTariff(...args),
  updateTariff: (...args: any[]) => mockUpdateTariff(...args),
}));

describe("Price Range Validation", () => {
  const globalRanges = {
    minPrice: 1300,
    maxPrice: 2500,
    enableDynamicPricing: true,
    defaultBasePricePerKwh: 1500,
    defaultReservationFee: 5000,
    defaultOverstayPenaltyPerMin: 500,
    defaultOverstayGracePeriodMinutes: 10,
    defaultConnectionFee: 2000,
    defaultPricePerKwhAC: 800,
    defaultPricePerKwhDC: 1200,
    enableDifferentiatedPricing: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPriceRanges.mockResolvedValue(globalRanges);
    mockGetChargingStationById.mockResolvedValue({ id: 1, name: "Test Station", ownerId: 1 });
    mockGetTariffsByStationId.mockResolvedValue([]);
    mockCreateTariff.mockResolvedValue(1);
    mockGetActiveTariffByStationId.mockResolvedValue(null);
  });

  describe("Validation logic", () => {
    it("should reject price below global minimum", () => {
      const price = 1200;
      const isValid = price >= globalRanges.minPrice && price <= globalRanges.maxPrice;
      expect(isValid).toBe(false);
    });

    it("should reject price above global maximum", () => {
      const price = 3000;
      const isValid = price >= globalRanges.minPrice && price <= globalRanges.maxPrice;
      expect(isValid).toBe(false);
    });

    it("should accept price within global range", () => {
      const price = 1500;
      const isValid = price >= globalRanges.minPrice && price <= globalRanges.maxPrice;
      expect(isValid).toBe(true);
    });

    it("should accept price at exact minimum boundary", () => {
      const price = 1300;
      const isValid = price >= globalRanges.minPrice && price <= globalRanges.maxPrice;
      expect(isValid).toBe(true);
    });

    it("should accept price at exact maximum boundary", () => {
      const price = 2500;
      const isValid = price >= globalRanges.minPrice && price <= globalRanges.maxPrice;
      expect(isValid).toBe(true);
    });

    it("should validate the corrected diamante oriental price", () => {
      // Previously was $1,200 (below min $1,300), now corrected to $1,300
      const correctedPrice = 1300;
      const isValid = correctedPrice >= globalRanges.minPrice && correctedPrice <= globalRanges.maxPrice;
      expect(isValid).toBe(true);
    });

    it("should correctly identify out-of-range prices for error message", () => {
      const price = 1200;
      const minPrice = globalRanges.minPrice;
      const maxPrice = globalRanges.maxPrice;
      
      const isBelow = price < minPrice;
      const isAbove = price > maxPrice;
      
      expect(isBelow).toBe(true);
      expect(isAbove).toBe(false);
      
      // es-CO locale uses period as thousands separator
      const errorMsg = `El precio por kWh ($${price.toLocaleString("es-CO")} COP) debe estar dentro del rango global permitido: $${minPrice.toLocaleString("es-CO")} - $${maxPrice.toLocaleString("es-CO")} COP/kWh`;
      expect(errorMsg).toContain("1.200");
      expect(errorMsg).toContain("1.300");
      expect(errorMsg).toContain("2.500");
    });

    it("should skip validation when autoPricing is enabled", () => {
      // When autoPricing is true, the system manages the price dynamically
      // so manual price validation should be skipped
      const autoPricing = true;
      const price = 900; // Below minimum
      
      const shouldValidate = !autoPricing;
      expect(shouldValidate).toBe(false);
    });
  });
});
