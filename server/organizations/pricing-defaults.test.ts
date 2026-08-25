import { describe, expect, it } from "vitest";
import { platformPricingDefaults } from "../../drizzle/schema";

describe("platformPricingDefaults", () => {
  it("usa orgPlan como columna canónica para las búsquedas de configuración SaaS", () => {
    expect(platformPricingDefaults.orgPlan.name).toBe("org_plan");
    expect((platformPricingDefaults as Record<string, unknown>).plan).toBeUndefined();
  });
});
