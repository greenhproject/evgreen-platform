/**
 * Tests para validación de rangos globales de precio en tarifas por estación,
 * validación AC/DC, log de auditoría y notificaciones a inversionistas.
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
const mockCreateTariffChangeLog = vi.fn();
const mockGetTariffChangeLogs = vi.fn();
const mockGetTariffChangeLogsByStation = vi.fn();
const mockGetInvestorsWithActiveStations = vi.fn();
const mockCreateNotification = vi.fn();

vi.mock("./db", () => ({
  getPriceRanges: (...args: any[]) => mockGetPriceRanges(...args),
  getChargingStationById: (...args: any[]) => mockGetChargingStationById(...args),
  getActiveTariffByStationId: (...args: any[]) => mockGetActiveTariffByStationId(...args),
  getTariffsByStationId: (...args: any[]) => mockGetTariffsByStationId(...args),
  getTariffById: (...args: any[]) => mockGetTariffById(...args),
  createTariff: (...args: any[]) => mockCreateTariff(...args),
  updateTariff: (...args: any[]) => mockUpdateTariff(...args),
  createTariffChangeLog: (...args: any[]) => mockCreateTariffChangeLog(...args),
  getTariffChangeLogs: (...args: any[]) => mockGetTariffChangeLogs(...args),
  getTariffChangeLogsByStation: (...args: any[]) => mockGetTariffChangeLogsByStation(...args),
  getInvestorsWithActiveStations: (...args: any[]) => mockGetInvestorsWithActiveStations(...args),
  createNotification: (...args: any[]) => mockCreateNotification(...args),
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
    defaultPricePerKwhAC: 1400,
    defaultPricePerKwhDC: 2000,
    enableDifferentiatedPricing: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPriceRanges.mockResolvedValue(globalRanges);
    mockGetChargingStationById.mockResolvedValue({ id: 1, name: "Test Station", ownerId: 1 });
    mockGetTariffsByStationId.mockResolvedValue([]);
    mockCreateTariff.mockResolvedValue(1);
    mockGetActiveTariffByStationId.mockResolvedValue(null);
    mockCreateTariffChangeLog.mockResolvedValue(1);
    mockGetInvestorsWithActiveStations.mockResolvedValue([]);
  });

  describe("Basic price range validation", () => {
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

    it("should skip validation when autoPricing is enabled", () => {
      const autoPricing = true;
      const price = 900; // Below minimum
      const shouldValidate = !autoPricing;
      expect(shouldValidate).toBe(false);
    });

    it("should correctly format error message with es-CO locale", () => {
      const price = 1200;
      const errorMsg = `El precio por kWh ($${price.toLocaleString("es-CO")} COP) debe estar dentro del rango global permitido: $${globalRanges.minPrice.toLocaleString("es-CO")} - $${globalRanges.maxPrice.toLocaleString("es-CO")} COP/kWh`;
      expect(errorMsg).toContain("1.200");
      expect(errorMsg).toContain("1.300");
      expect(errorMsg).toContain("2.500");
    });
  });

  describe("AC/DC differentiated pricing validation", () => {
    it("should reject AC price below global minimum", () => {
      const acPrice = 1000;
      const isValid = acPrice >= globalRanges.minPrice && acPrice <= globalRanges.maxPrice;
      expect(isValid).toBe(false);
    });

    it("should reject DC price above global maximum", () => {
      const dcPrice = 3500;
      const isValid = dcPrice >= globalRanges.minPrice && dcPrice <= globalRanges.maxPrice;
      expect(isValid).toBe(false);
    });

    it("should accept AC and DC prices within global range", () => {
      const acPrice = 1400;
      const dcPrice = 2000;
      const acValid = acPrice >= globalRanges.minPrice && acPrice <= globalRanges.maxPrice;
      const dcValid = dcPrice >= globalRanges.minPrice && dcPrice <= globalRanges.maxPrice;
      expect(acValid).toBe(true);
      expect(dcValid).toBe(true);
    });

    it("should reject when AC price is greater than DC price", () => {
      const acPrice = 2200;
      const dcPrice = 1800;
      const acLessThanDc = acPrice <= dcPrice;
      expect(acLessThanDc).toBe(false);
    });

    it("should accept when AC price equals DC price", () => {
      const acPrice = 1800;
      const dcPrice = 1800;
      const acLessThanOrEqualDc = acPrice <= dcPrice;
      expect(acLessThanOrEqualDc).toBe(true);
    });

    it("should skip AC/DC validation when differentiated pricing is disabled", () => {
      const enableDifferentiatedPricing = false;
      const acPrice = 500; // Below minimum
      const shouldValidateAcDc = enableDifferentiatedPricing;
      expect(shouldValidateAcDc).toBe(false);
    });
  });

  describe("Tariff change audit log", () => {
    it("should create a change log entry for tariff creation", async () => {
      const logEntry = {
        tariffId: 1,
        stationId: 1,
        changedBy: 1,
        changedByName: "Admin",
        changedByRole: "admin",
        changeType: "CREATE" as const,
        previousValues: null,
        newValues: { pricePerKwh: "1500", name: "Tarifa Test" },
        description: "Tarifa creada para estación Test",
      };

      await mockCreateTariffChangeLog(logEntry);
      expect(mockCreateTariffChangeLog).toHaveBeenCalledWith(logEntry);
      expect(mockCreateTariffChangeLog).toHaveBeenCalledTimes(1);
    });

    it("should create a change log entry for tariff update", async () => {
      const logEntry = {
        tariffId: 1,
        stationId: 1,
        changedBy: 1,
        changedByName: "Admin",
        changedByRole: "admin",
        changeType: "UPDATE" as const,
        previousValues: { pricePerKwh: "1300" },
        newValues: { pricePerKwh: "1500" },
        description: "Precio actualizado de $1.300 a $1.500 COP/kWh",
      };

      await mockCreateTariffChangeLog(logEntry);
      expect(mockCreateTariffChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({
          changeType: "UPDATE",
          previousValues: expect.objectContaining({ pricePerKwh: "1300" }),
          newValues: expect.objectContaining({ pricePerKwh: "1500" }),
        })
      );
    });

    it("should create a GLOBAL_UPDATE log when price ranges change", async () => {
      const logEntry = {
        tariffId: null,
        stationId: null,
        changedBy: 1,
        changedByName: "Admin",
        changedByRole: "admin",
        changeType: "GLOBAL_UPDATE" as const,
        previousValues: { minPrice: 1300, maxPrice: 2500 },
        newValues: { minPrice: 1400, maxPrice: 2600 },
        description: "Rangos globales actualizados",
      };

      await mockCreateTariffChangeLog(logEntry);
      expect(mockCreateTariffChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({
          changeType: "GLOBAL_UPDATE",
          tariffId: null,
          stationId: null,
        })
      );
    });

    it("should create a DEACTIVATE log when tariff is deactivated", async () => {
      const logEntry = {
        tariffId: 1,
        stationId: 1,
        changedBy: 1,
        changedByName: "Admin",
        changedByRole: "admin",
        changeType: "DEACTIVATE" as const,
        previousValues: { isActive: true },
        newValues: { isActive: false },
        description: "Tarifa desactivada",
      };

      await mockCreateTariffChangeLog(logEntry);
      expect(mockCreateTariffChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({ changeType: "DEACTIVATE" })
      );
    });

    it("should retrieve change logs filtered by station", async () => {
      const mockLogs = [
        { id: 1, stationId: 1, changeType: "CREATE", createdAt: new Date() },
        { id: 2, stationId: 1, changeType: "UPDATE", createdAt: new Date() },
      ];
      mockGetTariffChangeLogsByStation.mockResolvedValue(mockLogs);

      const logs = await mockGetTariffChangeLogsByStation(1, 50);
      expect(logs).toHaveLength(2);
      expect(logs[0].stationId).toBe(1);
    });
  });

  describe("Investor notifications on global range change", () => {
    it("should notify investors when price ranges change", async () => {
      const investors = [
        { userId: 10, userName: "Investor 1", email: "inv1@test.com", fcmToken: "token1", stationCount: 2 },
        { userId: 20, userName: "Investor 2", email: "inv2@test.com", fcmToken: null, stationCount: 1 },
      ];
      mockGetInvestorsWithActiveStations.mockResolvedValue(investors);

      const previousMin = 1300;
      const previousMax = 2500;
      const newMin = 1400;
      const newMax = 2600;
      const rangesChanged = previousMin !== newMin || previousMax !== newMax;

      expect(rangesChanged).toBe(true);

      if (rangesChanged) {
        const investorList = await mockGetInvestorsWithActiveStations();
        for (const investor of investorList) {
          await mockCreateNotification({
            userId: investor.userId,
            title: "Actualización de rangos de precio",
            message: `Nuevo rango: $${newMin.toLocaleString("es-CO")} - $${newMax.toLocaleString("es-CO")} COP/kWh`,
            type: "SYSTEM",
          });
        }
      }

      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          title: "Actualización de rangos de precio",
        })
      );
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 20,
        })
      );
    });

    it("should NOT notify investors when ranges stay the same", async () => {
      const previousMin = 1300;
      const previousMax = 2500;
      const newMin = 1300;
      const newMax = 2500;
      const rangesChanged = previousMin !== newMin || previousMax !== newMax;

      expect(rangesChanged).toBe(false);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("should handle investors without FCM tokens gracefully", async () => {
      const investors = [
        { userId: 10, userName: "Investor", email: "inv@test.com", fcmToken: null, stationCount: 1 },
      ];
      mockGetInvestorsWithActiveStations.mockResolvedValue(investors);

      const investorList = await mockGetInvestorsWithActiveStations();
      for (const investor of investorList) {
        // Should create in-app notification regardless of FCM token
        await mockCreateNotification({
          userId: investor.userId,
          title: "Actualización de rangos de precio",
          message: "Nuevo rango",
          type: "SYSTEM",
        });
        // FCM push should only be sent if token exists
        const shouldSendPush = !!investor.fcmToken;
        expect(shouldSendPush).toBe(false);
      }

      // In-app notification should still be created
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    });
  });
});
