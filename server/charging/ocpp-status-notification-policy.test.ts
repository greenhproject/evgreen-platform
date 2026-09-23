import { describe, expect, it } from "vitest";
import {
  shouldAutoReleaseStaleFinishing,
  shouldTreatOcpp16AvailableAsPhysicalDisconnect,
} from "../../shared/ocpp-status-notification-policy";

describe("OCPP status notification physical connector policy", () => {
  it("does not treat connectorId 0 Available as a cable disconnection", () => {
    expect(shouldTreatOcpp16AvailableAsPhysicalDisconnect({
      connectorId: 0,
      status: "Available",
      previousConnectorStatus: "FINISHING",
    })).toBe(false);
  });

  it("only accepts a connector-specific Available after Finishing as a cable disconnection", () => {
    expect(shouldTreatOcpp16AvailableAsPhysicalDisconnect({
      connectorId: 1,
      status: "Available",
      previousConnectorStatus: "FINISHING",
    })).toBe(true);
    expect(shouldTreatOcpp16AvailableAsPhysicalDisconnect({
      connectorId: 1,
      status: "Available",
      previousConnectorStatus: "CHARGING",
    })).toBe(false);
  });

  it("does not release a connected cable solely because its transaction is old", () => {
    expect(shouldAutoReleaseStaleFinishing()).toBe(false);
  });
});
