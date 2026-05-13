import { describe, it, expect } from "vitest";

describe("Google Maps API Key", () => {
  it("should have VITE_GOOGLE_MAPS_API_KEY configured", () => {
    const key = process.env.VITE_GOOGLE_MAPS_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(key!.startsWith("AIza")).toBe(true);
  });

  it("should be a valid Google Maps API key format", () => {
    const key = process.env.VITE_GOOGLE_MAPS_API_KEY!;
    // Google API keys are typically 39 characters starting with AIza
    expect(key.length).toBeGreaterThanOrEqual(30);
    expect(key).toMatch(/^AIza[A-Za-z0-9_-]+$/);
  });
});
