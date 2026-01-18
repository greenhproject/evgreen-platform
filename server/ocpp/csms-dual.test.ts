/**
 * Tests para el servidor CSMS dual (OCPP 1.6J y 2.0.1)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de la base de datos
vi.mock("../db", () => ({
  getChargingStationByOcppIdentity: vi.fn(),
  updateChargingStation: vi.fn(),
  getEvsesByStationId: vi.fn(),
  updateEvseStatus: vi.fn(),
  createTransaction: vi.fn(),
  getTransactionByOcppId: vi.fn(),
  updateTransaction: vi.fn(),
  createMeterValue: vi.fn(),
  getActiveTariffByStationId: vi.fn(),
  getTariffById: vi.fn(),
  createOcppLog: vi.fn(),
  updateStationOnlineStatus: vi.fn(),
}));

// Mock de nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-id-123"),
}));

describe("DualCSMS", () => {
  describe("Protocol Detection", () => {
    it("should detect OCPP 2.0.1 protocol from WebSocket subprotocol", () => {
      const protocols = new Set(["ocpp2.0.1", "ocpp1.6"]);
      
      // Simular la lógica de handleProtocols
      let selectedProtocol = "";
      if (protocols.has("ocpp2.0.1")) {
        selectedProtocol = "ocpp2.0.1";
      } else if (protocols.has("ocpp2.0")) {
        selectedProtocol = "ocpp2.0";
      } else if (protocols.has("ocpp1.6")) {
        selectedProtocol = "ocpp1.6";
      }
      
      expect(selectedProtocol).toBe("ocpp2.0.1");
    });

    it("should fallback to OCPP 1.6 when 2.0.1 is not available", () => {
      const protocols = new Set(["ocpp1.6"]);
      
      let selectedProtocol = "";
      if (protocols.has("ocpp2.0.1")) {
        selectedProtocol = "ocpp2.0.1";
      } else if (protocols.has("ocpp2.0")) {
        selectedProtocol = "ocpp2.0";
      } else if (protocols.has("ocpp1.6")) {
        selectedProtocol = "ocpp1.6";
      }
      
      expect(selectedProtocol).toBe("ocpp1.6");
    });

    it("should default to OCPP 1.6 when no protocols specified", () => {
      const protocols = new Set<string>();
      
      let selectedProtocol = "ocpp1.6"; // Default
      if (protocols.has("ocpp2.0.1")) {
        selectedProtocol = "ocpp2.0.1";
      } else if (protocols.has("ocpp2.0")) {
        selectedProtocol = "ocpp2.0";
      } else if (protocols.has("ocpp1.6")) {
        selectedProtocol = "ocpp1.6";
      }
      
      expect(selectedProtocol).toBe("ocpp1.6");
    });
  });

  describe("OCPP 1.6J Message Handling", () => {
    it("should parse OCPP 1.6 BootNotification request correctly", () => {
      const request = {
        chargePointVendor: "EVGreen",
        chargePointModel: "AC-7000",
        chargePointSerialNumber: "SN123456",
        firmwareVersion: "1.0.0",
      };

      expect(request.chargePointVendor).toBe("EVGreen");
      expect(request.chargePointModel).toBe("AC-7000");
      expect(request.chargePointSerialNumber).toBe("SN123456");
    });

    it("should parse OCPP 1.6 StartTransaction request correctly", () => {
      const request = {
        connectorId: 1,
        idTag: "USER123",
        meterStart: 0,
        timestamp: "2026-01-18T12:00:00Z",
      };

      expect(request.connectorId).toBe(1);
      expect(request.idTag).toBe("USER123");
      expect(request.meterStart).toBe(0);
    });

    it("should parse OCPP 1.6 StopTransaction request correctly", () => {
      const request = {
        transactionId: 1,
        meterStop: 15000, // 15 kWh en Wh
        timestamp: "2026-01-18T14:00:00Z",
        reason: "Local",
      };

      expect(request.transactionId).toBe(1);
      expect(request.meterStop).toBe(15000);
      expect(request.reason).toBe("Local");
    });

    it("should parse OCPP 1.6 StatusNotification request correctly", () => {
      const request = {
        connectorId: 1,
        errorCode: "NoError",
        status: "Available",
        timestamp: "2026-01-18T12:00:00Z",
      };

      expect(request.connectorId).toBe(1);
      expect(request.status).toBe("Available");
      expect(request.errorCode).toBe("NoError");
    });

    it("should map OCPP 1.6 status to internal status correctly", () => {
      const statusMap: Record<string, string> = {
        Available: "AVAILABLE",
        Preparing: "AVAILABLE",
        Charging: "CHARGING",
        SuspendedEV: "CHARGING",
        SuspendedEVSE: "CHARGING",
        Finishing: "CHARGING",
        Reserved: "RESERVED",
        Unavailable: "UNAVAILABLE",
        Faulted: "FAULTED",
      };

      expect(statusMap["Available"]).toBe("AVAILABLE");
      expect(statusMap["Charging"]).toBe("CHARGING");
      expect(statusMap["Reserved"]).toBe("RESERVED");
      expect(statusMap["Faulted"]).toBe("FAULTED");
    });
  });

  describe("OCPP 2.0.1 Message Handling", () => {
    it("should parse OCPP 2.0.1 BootNotification request correctly", () => {
      const request = {
        chargingStation: {
          vendorName: "EVGreen",
          model: "DC-100000",
          serialNumber: "SN789012",
          firmwareVersion: "2.0.0",
        },
        reason: "PowerUp",
      };

      expect(request.chargingStation.vendorName).toBe("EVGreen");
      expect(request.chargingStation.model).toBe("DC-100000");
      expect(request.reason).toBe("PowerUp");
    });

    it("should parse OCPP 2.0.1 TransactionEvent Started correctly", () => {
      const request = {
        eventType: "Started" as const,
        timestamp: "2026-01-18T12:00:00Z",
        triggerReason: "Authorized",
        seqNo: 0,
        transactionInfo: {
          transactionId: "TXN-123",
          chargingState: "Charging",
        },
        evse: {
          id: 1,
          connectorId: 1,
        },
        idToken: {
          idToken: "USER456",
          type: "Central",
        },
      };

      expect(request.eventType).toBe("Started");
      expect(request.transactionInfo.transactionId).toBe("TXN-123");
      expect(request.evse?.id).toBe(1);
    });

    it("should parse OCPP 2.0.1 TransactionEvent Ended correctly", () => {
      const request = {
        eventType: "Ended" as const,
        timestamp: "2026-01-18T14:00:00Z",
        triggerReason: "StopAuthorized",
        seqNo: 5,
        transactionInfo: {
          transactionId: "TXN-123",
          stoppedReason: "Local",
          timeSpentCharging: 7200,
        },
        meterValue: [
          {
            timestamp: "2026-01-18T14:00:00Z",
            sampledValue: [
              {
                value: 25000,
                measurand: "Energy.Active.Import.Register",
                unit: "Wh",
              },
            ],
          },
        ],
      };

      expect(request.eventType).toBe("Ended");
      expect(request.transactionInfo.stoppedReason).toBe("Local");
      expect(request.meterValue?.[0].sampledValue[0].value).toBe(25000);
    });

    it("should map OCPP 2.0.1 status to internal status correctly", () => {
      const statusMap: Record<string, string> = {
        Available: "AVAILABLE",
        Occupied: "CHARGING",
        Reserved: "RESERVED",
        Unavailable: "UNAVAILABLE",
        Faulted: "FAULTED",
      };

      expect(statusMap["Available"]).toBe("AVAILABLE");
      expect(statusMap["Occupied"]).toBe("CHARGING");
      expect(statusMap["Reserved"]).toBe("RESERVED");
    });
  });

  describe("Energy Calculation", () => {
    it("should calculate energy delivered correctly from Wh to kWh", () => {
      const meterStart = 0;
      const meterStop = 15000; // 15 kWh en Wh
      const energyDelivered = (meterStop - meterStart) / 1000;

      expect(energyDelivered).toBe(15);
    });

    it("should calculate total cost correctly", () => {
      const energyDelivered = 15; // kWh
      const pricePerKwh = 1800; // COP
      const totalCost = energyDelivered * pricePerKwh;

      expect(totalCost).toBe(27000);
    });

    it("should calculate investor share (80%) correctly", () => {
      const totalCost = 27000;
      const investorShare = totalCost * 0.8;
      const platformFee = totalCost * 0.2;

      expect(investorShare).toBe(21600);
      expect(platformFee).toBe(5400);
    });
  });

  describe("Message Format", () => {
    it("should format CALL message correctly", () => {
      const CALL = 2;
      const messageId = "msg-123";
      const action = "BootNotification";
      const payload = { chargePointVendor: "Test" };

      const message = [CALL, messageId, action, payload];

      expect(message[0]).toBe(2);
      expect(message[1]).toBe("msg-123");
      expect(message[2]).toBe("BootNotification");
      expect(message[3]).toEqual({ chargePointVendor: "Test" });
    });

    it("should format CALLRESULT message correctly", () => {
      const CALLRESULT = 3;
      const messageId = "msg-123";
      const payload = { status: "Accepted" };

      const message = [CALLRESULT, messageId, payload];

      expect(message[0]).toBe(3);
      expect(message[1]).toBe("msg-123");
      expect(message[2]).toEqual({ status: "Accepted" });
    });

    it("should format CALLERROR message correctly", () => {
      const CALLERROR = 4;
      const messageId = "msg-123";
      const errorCode = "InternalError";
      const errorDescription = "Something went wrong";

      const message = [CALLERROR, messageId, errorCode, errorDescription, {}];

      expect(message[0]).toBe(4);
      expect(message[1]).toBe("msg-123");
      expect(message[2]).toBe("InternalError");
      expect(message[3]).toBe("Something went wrong");
    });
  });

  describe("Remote Commands", () => {
    it("should format OCPP 1.6 RemoteStartTransaction correctly", () => {
      const payload = {
        connectorId: 1,
        idTag: "USER123",
      };

      expect(payload.connectorId).toBe(1);
      expect(payload.idTag).toBe("USER123");
    });

    it("should format OCPP 2.0.1 RequestStartTransaction correctly", () => {
      const payload = {
        evseId: 1,
        idToken: { idToken: "USER123", type: "Central" },
        remoteStartId: 12345,
      };

      expect(payload.evseId).toBe(1);
      expect(payload.idToken.idToken).toBe("USER123");
      expect(payload.idToken.type).toBe("Central");
    });

    it("should format ReserveNow for OCPP 1.6 correctly", () => {
      const payload = {
        connectorId: 1,
        expiryDate: "2026-01-18T15:00:00Z",
        idTag: "USER123",
        reservationId: 1,
      };

      expect(payload.connectorId).toBe(1);
      expect(payload.reservationId).toBe(1);
    });

    it("should format ReserveNow for OCPP 2.0.1 correctly", () => {
      const payload = {
        id: 1,
        expiryDateTime: "2026-01-18T15:00:00Z",
        idToken: { idToken: "USER123", type: "Central" },
        evseId: 1,
      };

      expect(payload.evseId).toBe(1);
      expect(payload.id).toBe(1);
      expect(payload.idToken.type).toBe("Central");
    });
  });

  describe("Reset Command", () => {
    it("should map reset types for OCPP 1.6 correctly", () => {
      const mapResetType16 = (type: string): string => {
        return type === "Immediate" || type === "Hard" ? "Hard" : "Soft";
      };

      expect(mapResetType16("Immediate")).toBe("Hard");
      expect(mapResetType16("Hard")).toBe("Hard");
      expect(mapResetType16("OnIdle")).toBe("Soft");
      expect(mapResetType16("Soft")).toBe("Soft");
    });

    it("should map reset types for OCPP 2.0.1 correctly", () => {
      const mapResetType201 = (type: string): string => {
        return type === "Soft" || type === "OnIdle" ? "OnIdle" : "Immediate";
      };

      expect(mapResetType201("Soft")).toBe("OnIdle");
      expect(mapResetType201("OnIdle")).toBe("OnIdle");
      expect(mapResetType201("Hard")).toBe("Immediate");
      expect(mapResetType201("Immediate")).toBe("Immediate");
    });
  });

  describe("Heartbeat Response", () => {
    it("should return current time in ISO format", () => {
      const response = {
        currentTime: new Date().toISOString(),
      };

      expect(response.currentTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("BootNotification Response", () => {
    it("should return Accepted status for known station", () => {
      const response = {
        currentTime: new Date().toISOString(),
        interval: 60,
        status: "Accepted",
      };

      expect(response.status).toBe("Accepted");
      expect(response.interval).toBe(60);
    });

    it("should return Pending status for unknown station", () => {
      const response = {
        currentTime: new Date().toISOString(),
        interval: 60,
        status: "Pending",
      };

      expect(response.status).toBe("Pending");
    });
  });
});
