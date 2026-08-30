export const USER_ONBOARDING_VERSION = "2026-08-v1";

export const USER_ONBOARDING_STEPS = {
  welcome: 1,
  profile: 2,
  vehicle: 3,
  billing: 4,
  notifications: 5,
  complete: 6,
} as const;

export type UserOnboardingStatus = "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export function canShowUserOnboarding(role: string, status?: UserOnboardingStatus | null) {
  return role === "user" && status !== "COMPLETED" && status !== "SKIPPED";
}

export function normalizeOnboardingName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

export function shouldRequireBillingFields(wantsElectronicInvoice: boolean) {
  return wantsElectronicInvoice;
}
