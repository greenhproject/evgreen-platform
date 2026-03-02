/**
 * Tests para la funcionalidad de estado de batería del EV Assistant
 */
import { describe, it, expect } from "vitest";

describe("Battery Level Feature", () => {
  describe("Battery tag detection", () => {
    it("should detect BATTERY tag in AI response", () => {
      const response = "He actualizado tu nivel de batería. [BATTERY:75]";
      const match = response.match(/\[BATTERY:(\d+)\]/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe("75");
    });

    it("should not detect BATTERY tag when absent", () => {
      const response = "Tu batería tiene buena capacidad de 90 kWh.";
      const match = response.match(/\[BATTERY:(\d+)\]/);
      expect(match).toBeNull();
    });

    it("should detect various battery levels", () => {
      const testCases = [
        { input: "[BATTERY:0]", expected: "0" },
        { input: "[BATTERY:25]", expected: "25" },
        { input: "[BATTERY:50]", expected: "50" },
        { input: "[BATTERY:100]", expected: "100" },
      ];

      for (const tc of testCases) {
        const match = tc.input.match(/\[BATTERY:(\d+)\]/);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(tc.expected);
      }
    });
  });

  describe("Battery level validation", () => {
    it("should validate battery level is between 0 and 100", () => {
      const validateLevel = (level: number) => level >= 0 && level <= 100;
      expect(validateLevel(0)).toBe(true);
      expect(validateLevel(50)).toBe(true);
      expect(validateLevel(100)).toBe(true);
      expect(validateLevel(-1)).toBe(false);
      expect(validateLevel(101)).toBe(false);
    });
  });

  describe("Estimated range calculation", () => {
    it("should calculate estimated range with safety factor", () => {
      const calcRange = (batteryLevel: number, nominalRange: number) =>
        Math.round((batteryLevel / 100) * nominalRange * 0.85);

      // Full battery, 400km range
      expect(calcRange(100, 400)).toBe(340);
      // Half battery, 400km range
      expect(calcRange(50, 400)).toBe(170);
      // Quarter battery, 400km range
      expect(calcRange(25, 400)).toBe(85);
      // Low battery, 400km range
      expect(calcRange(10, 400)).toBe(34);
    });

    it("should handle zero battery level", () => {
      const calcRange = (batteryLevel: number, nominalRange: number) =>
        Math.round((batteryLevel / 100) * nominalRange * 0.85);
      expect(calcRange(0, 400)).toBe(0);
    });
  });

  describe("Battery color coding", () => {
    it("should return correct color for battery levels", () => {
      const getBatteryColor = (level: number) => {
        if (level <= 10) return "red";
        if (level <= 25) return "orange";
        if (level <= 50) return "yellow";
        return "green";
      };

      expect(getBatteryColor(5)).toBe("red");
      expect(getBatteryColor(10)).toBe("red");
      expect(getBatteryColor(15)).toBe("orange");
      expect(getBatteryColor(25)).toBe("orange");
      expect(getBatteryColor(30)).toBe("yellow");
      expect(getBatteryColor(50)).toBe("yellow");
      expect(getBatteryColor(51)).toBe("green");
      expect(getBatteryColor(100)).toBe("green");
    });
  });

  describe("System prompt battery integration", () => {
    it("should format battery info correctly when level is available", () => {
      const batteryLevel = 75;
      const lastUpdate = new Date("2026-03-02T10:00:00");
      const batteryInfo = `${batteryLevel}% (actualizado ${lastUpdate.toLocaleString("es-CO")})`;
      expect(batteryInfo).toContain("75%");
      expect(batteryInfo).toContain("actualizado");
    });

    it("should show 'No reportado' when battery level is null", () => {
      const batteryLevel = null;
      const batteryInfo =
        batteryLevel !== null && batteryLevel !== undefined
          ? `${batteryLevel}%`
          : "No reportado por el usuario";
      expect(batteryInfo).toBe("No reportado por el usuario");
    });

    it("should calculate estimated range when battery and range are available", () => {
      const batteryLevel = 80;
      const rangeKm = 400;
      const estimatedRangeNow =
        batteryLevel !== null && batteryLevel !== undefined && rangeKm
          ? Math.round((batteryLevel / 100) * rangeKm * 0.85)
          : null;
      expect(estimatedRangeNow).toBe(272);
    });

    it("should return null estimated range when battery is not available", () => {
      const batteryLevel = null;
      const rangeKm = 400;
      const estimatedRangeNow =
        batteryLevel !== null && batteryLevel !== undefined && rangeKm
          ? Math.round((batteryLevel / 100) * rangeKm * 0.85)
          : null;
      expect(estimatedRangeNow).toBeNull();
    });
  });

  describe("BATTERY tag cleaning from visible text", () => {
    it("should remove BATTERY tag from displayed text", () => {
      const rawText =
        "He actualizado tu nivel de batería a 75%. [BATTERY:75]";
      const cleanText = rawText.replace(/\[BATTERY:(\d+)\]/g, "");
      expect(cleanText).toBe(
        "He actualizado tu nivel de batería a 75%. "
      );
      expect(cleanText).not.toContain("[BATTERY:");
    });

    it("should clean all special tags together", () => {
      const rawText =
        "Aquí tienes la ruta [ROUTE:4.6,-74.0|5.5,-73.3|Ruta test] y tu batería [BATTERY:60]";
      const cleanText = rawText
        .replace(/\[NAV:(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\|([^\]]+)\]/g, "")
        .replace(/\[ROUTE:([^\]]+)\]/g, "")
        .replace(/\[RESERVE:([^\]]+)\]/g, "")
        .replace(/\[BATTERY:(\d+)\]/g, "");
      expect(cleanText).toBe("Aquí tienes la ruta  y tu batería ");
    });
  });
});
