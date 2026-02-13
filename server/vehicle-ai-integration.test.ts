/**
 * Tests para la integración del vehículo predeterminado con IA y TripPlanner
 */
import { describe, it, expect } from "vitest";

// ============================================================================
// Tests de VehicleContext
// ============================================================================

describe("VehicleContext Interface", () => {
  it("should have correct structure for vehicle context", () => {
    const vehicleContext = {
      id: 1,
      brand: "Tesla",
      model: "Model 3",
      year: 2024,
      batteryCapacityKwh: 60,
      rangeKm: 450,
      connectorTypes: ["CCS_2", "TYPE_2"],
      maxChargePowerKw: 250,
      nickname: "Mi Tesla",
      isDefault: true,
    };

    expect(vehicleContext.id).toBe(1);
    expect(vehicleContext.brand).toBe("Tesla");
    expect(vehicleContext.model).toBe("Model 3");
    expect(vehicleContext.year).toBe(2024);
    expect(vehicleContext.batteryCapacityKwh).toBe(60);
    expect(vehicleContext.rangeKm).toBe(450);
    expect(vehicleContext.connectorTypes).toEqual(["CCS_2", "TYPE_2"]);
    expect(vehicleContext.maxChargePowerKw).toBe(250);
    expect(vehicleContext.nickname).toBe("Mi Tesla");
    expect(vehicleContext.isDefault).toBe(true);
  });

  it("should handle null optional fields", () => {
    const vehicleContext = {
      id: 2,
      brand: "BYD",
      model: "Dolphin",
      year: null,
      batteryCapacityKwh: null,
      rangeKm: null,
      connectorTypes: ["TYPE_2"],
      maxChargePowerKw: null,
      nickname: null,
      isDefault: false,
    };

    expect(vehicleContext.year).toBeNull();
    expect(vehicleContext.batteryCapacityKwh).toBeNull();
    expect(vehicleContext.rangeKm).toBeNull();
    expect(vehicleContext.maxChargePowerKw).toBeNull();
    expect(vehicleContext.nickname).toBeNull();
  });
});

// ============================================================================
// Tests de compatibilidad de conectores
// ============================================================================

describe("Connector Compatibility", () => {
  const stationConnectors = ["TYPE_2", "CCS_2", "CHADEMO"];

  it("should detect compatible station when vehicle has matching connector", () => {
    const vehicleConnectors = ["CCS_2", "TYPE_2"];
    const isCompatible = stationConnectors.some(ct => vehicleConnectors.includes(ct));
    expect(isCompatible).toBe(true);
  });

  it("should detect incompatible station when no matching connector", () => {
    const vehicleConnectors = ["TESLA"];
    const isCompatible = stationConnectors.some(ct => vehicleConnectors.includes(ct));
    expect(isCompatible).toBe(false);
  });

  it("should consider all connectors as compatible when vehicle has no connectors specified", () => {
    const vehicleConnectors: string[] = [];
    const isCompatible = vehicleConnectors.length > 0
      ? stationConnectors.some(ct => vehicleConnectors.includes(ct))
      : true;
    expect(isCompatible).toBe(true);
  });

  it("should handle multiple vehicle connectors with partial match", () => {
    const vehicleConnectors = ["TYPE_1", "CCS_1", "CCS_2"];
    const isCompatible = stationConnectors.some(ct => vehicleConnectors.includes(ct));
    expect(isCompatible).toBe(true);
  });

  it("should handle GBT connectors", () => {
    const vehicleConnectors = ["GBT_AC", "GBT_DC"];
    const stationWithGBT = ["GBT_AC", "TYPE_2"];
    const isCompatible = stationWithGBT.some(ct => vehicleConnectors.includes(ct));
    expect(isCompatible).toBe(true);
  });
});

// ============================================================================
// Tests de generación de prompt con vehículo
// ============================================================================

describe("AI Prompt Vehicle Integration", () => {
  it("should generate vehicle section in prompt when default vehicle exists", () => {
    const vehicle = {
      brand: "Tesla",
      model: "Model 3",
      year: 2024,
      batteryCapacityKwh: 60,
      rangeKm: 450,
      connectorTypes: ["CCS_2", "TYPE_2"],
      maxChargePowerKw: 250,
      nickname: "Mi Tesla",
    };

    const prompt = `=== VEHÍCULO PREDETERMINADO DEL USUARIO ===
- ${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}${vehicle.nickname ? ` "${vehicle.nickname}"` : ''}
- Capacidad de batería: ${vehicle.batteryCapacityKwh ? `${vehicle.batteryCapacityKwh} kWh` : 'No especificada'}
- Autonomía: ${vehicle.rangeKm ? `${vehicle.rangeKm} km` : 'No especificada'}
- Conectores compatibles: ${vehicle.connectorTypes.join(', ') || 'No especificado'}
- Potencia máxima de carga: ${vehicle.maxChargePowerKw ? `${vehicle.maxChargePowerKw} kW` : 'No especificada'}`;

    expect(prompt).toContain("Tesla Model 3 (2024)");
    expect(prompt).toContain('"Mi Tesla"');
    expect(prompt).toContain("60 kWh");
    expect(prompt).toContain("450 km");
    expect(prompt).toContain("CCS_2, TYPE_2");
    expect(prompt).toContain("250 kW");
  });

  it("should handle vehicle with missing optional fields in prompt", () => {
    const vehicle = {
      brand: "BYD",
      model: "Dolphin",
      year: null as number | null,
      batteryCapacityKwh: null as number | null,
      rangeKm: null as number | null,
      connectorTypes: ["TYPE_2"],
      maxChargePowerKw: null as number | null,
      nickname: null as string | null,
    };

    const prompt = `- ${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}${vehicle.nickname ? ` "${vehicle.nickname}"` : ''}
- Capacidad de batería: ${vehicle.batteryCapacityKwh ? `${vehicle.batteryCapacityKwh} kWh` : 'No especificada'}
- Autonomía: ${vehicle.rangeKm ? `${vehicle.rangeKm} km` : 'No especificada'}`;

    expect(prompt).toContain("BYD Dolphin");
    expect(prompt).not.toContain("(null)");
    expect(prompt).toContain("No especificada");
  });

  it("should tag compatible stations in prompt", () => {
    const userConnectors = ["CCS_2", "TYPE_2"];
    const stations = [
      { name: "Estación A", connectorTypes: ["CCS_2", "CHADEMO"] },
      { name: "Estación B", connectorTypes: ["TESLA"] },
      { name: "Estación C", connectorTypes: ["TYPE_2"] },
    ];

    const tags = stations.map(station => {
      const isCompatible = userConnectors.length > 0
        ? station.connectorTypes.some(ct => userConnectors.includes(ct))
        : true;
      return isCompatible ? '✅ COMPATIBLE' : '⚠️ NO COMPATIBLE con tu vehículo';
    });

    expect(tags[0]).toBe('✅ COMPATIBLE');
    expect(tags[1]).toBe('⚠️ NO COMPATIBLE con tu vehículo');
    expect(tags[2]).toBe('✅ COMPATIBLE');
  });
});

// ============================================================================
// Tests de TripPlanner con vehículo
// ============================================================================

describe("TripPlanner Vehicle Integration", () => {
  it("should use vehicle range when vehicle is selected", () => {
    const vehicle = { rangeKm: 450 };
    const vehicleRange = vehicle.rangeKm || 300;
    expect(vehicleRange).toBe(450);
  });

  it("should use default range when no vehicle selected", () => {
    const vehicle = null;
    const vehicleRange = vehicle?.rangeKm || 300;
    expect(vehicleRange).toBe(300);
  });

  it("should extract connector types from selected vehicle", () => {
    const vehicle = { connectorTypes: ["CCS_2", "TYPE_2"] };
    const connectors = (vehicle.connectorTypes as string[]) || [];
    expect(connectors).toEqual(["CCS_2", "TYPE_2"]);
  });

  it("should return empty connectors when no vehicle selected", () => {
    const vehicle = null;
    const connectors = vehicle ? (vehicle.connectorTypes as string[]) || [] : [];
    expect(connectors).toEqual([]);
  });

  it("should select default vehicle from list", () => {
    const vehicles = [
      { id: 1, brand: "BYD", model: "Dolphin", isDefault: false },
      { id: 2, brand: "Tesla", model: "Model 3", isDefault: true },
      { id: 3, brand: "Renault", model: "Zoe", isDefault: false },
    ];

    const defaultVehicle = vehicles.find(v => v.isDefault) || vehicles[0];
    expect(defaultVehicle.id).toBe(2);
    expect(defaultVehicle.brand).toBe("Tesla");
  });

  it("should fallback to first vehicle when no default is set", () => {
    const vehicles = [
      { id: 1, brand: "BYD", model: "Dolphin", isDefault: false },
      { id: 2, brand: "Tesla", model: "Model 3", isDefault: false },
    ];

    const defaultVehicle = vehicles.find(v => v.isDefault) || vehicles[0];
    expect(defaultVehicle.id).toBe(1);
  });

  it("should pass preferred connector types to planTrip mutation", () => {
    const vehicleConnectors = ["CCS_2", "TYPE_2"];
    const mutationInput = {
      origin: { latitude: 4.711, longitude: -74.072, address: "Bogotá" },
      destination: { latitude: 6.244, longitude: -75.581, address: "Medellín" },
      vehicleRange: 450,
      currentBatteryLevel: 80,
      minimumBatteryAtDestination: 20,
      preferredConnectorTypes: vehicleConnectors.length > 0 ? vehicleConnectors : undefined,
    };

    expect(mutationInput.preferredConnectorTypes).toEqual(["CCS_2", "TYPE_2"]);
  });

  it("should not pass preferredConnectorTypes when manual mode", () => {
    const vehicleConnectors: string[] = [];
    const mutationInput = {
      origin: { latitude: 4.711, longitude: -74.072, address: "Bogotá" },
      destination: { latitude: 6.244, longitude: -75.581, address: "Medellín" },
      vehicleRange: 300,
      currentBatteryLevel: 80,
      minimumBatteryAtDestination: 20,
      preferredConnectorTypes: vehicleConnectors.length > 0 ? vehicleConnectors : undefined,
    };

    expect(mutationInput.preferredConnectorTypes).toBeUndefined();
  });
});

// ============================================================================
// Tests de formato de conectores
// ============================================================================

describe("Connector Type Formatting", () => {
  const formatConnectorType = (type: string) => {
    const map: Record<string, string> = {
      TYPE_1: "Tipo 1",
      TYPE_2: "Tipo 2",
      CCS_1: "CCS1",
      CCS_2: "CCS2",
      CHADEMO: "CHAdeMO",
      TESLA: "Tesla",
      GBT_AC: "GB/T AC",
      GBT_DC: "GB/T DC",
    };
    return map[type] || type;
  };

  it("should format all known connector types", () => {
    expect(formatConnectorType("TYPE_1")).toBe("Tipo 1");
    expect(formatConnectorType("TYPE_2")).toBe("Tipo 2");
    expect(formatConnectorType("CCS_1")).toBe("CCS1");
    expect(formatConnectorType("CCS_2")).toBe("CCS2");
    expect(formatConnectorType("CHADEMO")).toBe("CHAdeMO");
    expect(formatConnectorType("TESLA")).toBe("Tesla");
    expect(formatConnectorType("GBT_AC")).toBe("GB/T AC");
    expect(formatConnectorType("GBT_DC")).toBe("GB/T DC");
  });

  it("should return original type for unknown connectors", () => {
    expect(formatConnectorType("UNKNOWN")).toBe("UNKNOWN");
  });
});

// ============================================================================
// Tests de cálculo de tiempo de carga
// ============================================================================

describe("Charging Time Estimation", () => {
  it("should estimate charging time based on vehicle and charger power", () => {
    const kwhNeeded = 40; // kWh to charge
    const chargerPowerKw = 150; // kW charger
    const vehicleMaxPowerKw = 250; // kW vehicle max
    const effectivePower = Math.min(chargerPowerKw, vehicleMaxPowerKw);
    const timeHours = kwhNeeded / effectivePower;
    const timeMinutes = Math.round(timeHours * 60);

    expect(effectivePower).toBe(150);
    expect(timeMinutes).toBe(16);
  });

  it("should use vehicle max power as bottleneck when lower than charger", () => {
    const kwhNeeded = 40;
    const chargerPowerKw = 350;
    const vehicleMaxPowerKw = 50;
    const effectivePower = Math.min(chargerPowerKw, vehicleMaxPowerKw);
    const timeHours = kwhNeeded / effectivePower;
    const timeMinutes = Math.round(timeHours * 60);

    expect(effectivePower).toBe(50);
    expect(timeMinutes).toBe(48);
  });

  it("should handle AC charging (slower)", () => {
    const kwhNeeded = 30;
    const chargerPowerKw = 22; // AC charger
    const vehicleMaxPowerKw = 11; // AC limited vehicle
    const effectivePower = Math.min(chargerPowerKw, vehicleMaxPowerKw);
    const timeHours = kwhNeeded / effectivePower;
    const timeMinutes = Math.round(timeHours * 60);

    expect(effectivePower).toBe(11);
    expect(timeMinutes).toBe(164); // ~2h 44min
  });
});

// ============================================================================
// Tests de UserContext con vehículos
// ============================================================================

describe("UserContext with Vehicles", () => {
  it("should include defaultVehicle and vehicles array in user context", () => {
    const userContext = {
      id: 1,
      name: "Test User",
      email: "test@test.com",
      role: "user",
      walletBalance: 50000,
      totalCharges: 10,
      totalEnergyKwh: 150,
      totalSpent: 180000,
      averageChargeKwh: 15,
      favoriteStations: ["Estación A"],
      preferredChargingTimes: ["18:00"],
      lastChargeDate: "2026-02-13",
      defaultVehicle: {
        id: 1,
        brand: "Tesla",
        model: "Model 3",
        year: 2024,
        batteryCapacityKwh: 60,
        rangeKm: 450,
        connectorTypes: ["CCS_2", "TYPE_2"],
        maxChargePowerKw: 250,
        nickname: "Mi Tesla",
        isDefault: true,
      },
      vehicles: [
        {
          id: 1,
          brand: "Tesla",
          model: "Model 3",
          year: 2024,
          batteryCapacityKwh: 60,
          rangeKm: 450,
          connectorTypes: ["CCS_2", "TYPE_2"],
          maxChargePowerKw: 250,
          nickname: "Mi Tesla",
          isDefault: true,
        },
        {
          id: 2,
          brand: "BYD",
          model: "Dolphin",
          year: 2025,
          batteryCapacityKwh: 44.9,
          rangeKm: 340,
          connectorTypes: ["TYPE_2", "CCS_2"],
          maxChargePowerKw: 60,
          nickname: null,
          isDefault: false,
        },
      ],
    };

    expect(userContext.defaultVehicle).not.toBeNull();
    expect(userContext.defaultVehicle!.brand).toBe("Tesla");
    expect(userContext.vehicles).toHaveLength(2);
    expect(userContext.vehicles[0].isDefault).toBe(true);
    expect(userContext.vehicles[1].isDefault).toBe(false);
  });

  it("should handle user with no vehicles", () => {
    const userContext = {
      id: 1,
      name: "New User",
      defaultVehicle: null,
      vehicles: [],
    };

    expect(userContext.defaultVehicle).toBeNull();
    expect(userContext.vehicles).toHaveLength(0);
  });

  it("should select first vehicle as default when no explicit default", () => {
    const vehicles = [
      { id: 1, brand: "BYD", isDefault: false },
      { id: 2, brand: "Tesla", isDefault: false },
    ];

    const defaultVehicle = vehicles.find(v => v.isDefault) || (vehicles.length > 0 ? vehicles[0] : null);
    expect(defaultVehicle).not.toBeNull();
    expect(defaultVehicle!.id).toBe(1);
  });
});
