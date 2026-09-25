import { describe, expect, it } from "vitest";
import { userOnboardingProgress } from "../drizzle/schema";

describe("user onboarding schema contract", () => {
  it("maps the progress state to the physical status column installed by migration 0030", () => {
    expect(userOnboardingProgress.userId.name).toBe("user_id");
    expect(userOnboardingProgress.status.name).toBe("status");
    expect(userOnboardingProgress.currentStep.name).toBe("current_step");
    expect(userOnboardingProgress.lastSavedAt.name).toBe("last_saved_at");
  });
});
