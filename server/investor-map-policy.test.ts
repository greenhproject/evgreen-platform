import { describe, expect, it } from "vitest";
import { hasValidInvestorMapCoordinates, toInvestorMapPosition } from "../shared/investor-map-policy";

describe("investor map coordinate policy", () => {
  it("accepts persisted decimal coordinates returned as strings", () => {
    expect(hasValidInvestorMapCoordinates({ latitude: "4.58100000", longitude: "-74.08560000" })).toBe(true);
    expect(toInvestorMapPosition({ latitude: "4.58100000", longitude: "-74.08560000" })).toEqual({ lat: 4.581, lng: -74.0856 });
  });

  it("rejects incomplete, malformed and out-of-range records", () => {
    expect(hasValidInvestorMapCoordinates({ latitude: null, longitude: "-74.08" })).toBe(false);
    expect(hasValidInvestorMapCoordinates({ latitude: "Bogotá", longitude: "-74.08" })).toBe(false);
    expect(hasValidInvestorMapCoordinates({ latitude: "91", longitude: "-74.08" })).toBe(false);
    expect(toInvestorMapPosition({ latitude: "4.6", longitude: "181" })).toBeNull();
  });
});
