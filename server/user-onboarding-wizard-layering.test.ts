import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizardSource = readFileSync(
  resolve(process.cwd(), "client/src/components/UserOnboardingWizard.tsx"),
  "utf8",
);

describe("UserOnboardingWizard selector layering", () => {
  it("renders every portalized selector above the onboarding mask", () => {
    expect(wizardSource).toContain('USER_ONBOARDING_SELECT_CONTENT_CLASS = "z-[110]"');
    expect(wizardSource).toContain('className={USER_ONBOARDING_SELECT_CONTENT_CLASS}');
    expect(wizardSource.match(/className=\{USER_ONBOARDING_SELECT_CONTENT_CLASS\}/g)).toHaveLength(5);
    expect(wizardSource).toContain('fixed inset-0 z-[100]');
  });
});
