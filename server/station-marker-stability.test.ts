import { describe, expect, it } from "vitest";
import { createStationMarkerFingerprint } from "../client/src/lib/station-marker-stability";

describe("createStationMarkerFingerprint", () => {
  const station = {
    id: 7,
    latitude: "4.711",
    longitude: "-74.072",
    evses: [{ id: 5, chargeType: "DC", connectorType: "CCS2", connectorStatus: "AVAILABLE" }],
  };

  it("does not depend on user-distance presentation data", () => {
    const first = createStationMarkerFingerprint([{ ...station, calculatedDistance: 0.4 } as any]);
    const afterGpsTick = createStationMarkerFingerprint([{ ...station, calculatedDistance: 0.9 } as any]);

    expect(afterGpsTick).toBe(first);
  });

  it("changes when marker-relevant connector state changes", () => {
    const available = createStationMarkerFingerprint([station]);
    const occupied = createStationMarkerFingerprint([{
      ...station,
      evses: [{ ...station.evses[0], connectorStatus: "OCCUPIED" }],
    }]);

    expect(occupied).not.toBe(available);
  });
});
