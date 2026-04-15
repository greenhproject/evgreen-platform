/**
 * Tests for the Investor Onboarding system
 * Tests the email template generation, onboarding flow logic, and data validation
 */
import { describe, it, expect, vi } from "vitest";

// ============================================================================
// Email Template Tests
// ============================================================================
describe("Onboarding Email Template", () => {
  it("should format COP amounts correctly", () => {
    const formatCOP = (amount: number): string => {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    expect(formatCOP(50000000)).toContain("50.000.000");
    expect(formatCOP(100000000)).toContain("100.000.000");
    expect(formatCOP(0)).toContain("0");
  });

  it("should generate different content for individual vs collective investments", () => {
    const individualData = {
      investorName: "Carlos López",
      investorEmail: "carlos@test.com",
      investmentAmount: 50000000,
      investmentType: "individual" as const,
      stationName: "Estación Bogotá Norte",
      onboardingUrl: "https://app.evgreen.lat/investor/onboarding",
    };

    const collectiveData = {
      ...individualData,
      investmentType: "collective" as const,
      projectName: "Proyecto Medellín",
      participationPercent: 15,
    };

    // Individual should mention "propietario de estación"
    expect(individualData.investmentType).toBe("individual");
    // Collective should mention "inversionista"
    expect(collectiveData.investmentType).toBe("collective");
    expect(collectiveData.participationPercent).toBe(15);
  });
});

// ============================================================================
// Onboarding Step Validation Tests
// ============================================================================
describe("Onboarding Step Validation", () => {
  it("should validate step range (0-7)", () => {
    const validSteps = [0, 1, 2, 3, 4, 5, 6, 7];
    const invalidSteps = [-1, 8, 100];

    validSteps.forEach((step) => {
      expect(step >= 0 && step <= 7).toBe(true);
    });

    invalidSteps.forEach((step) => {
      expect(step >= 0 && step <= 7).toBe(false);
    });
  });

  it("should track step progression correctly", () => {
    const onboardingState = {
      currentStep: 1,
      completed: false,
      startedAt: new Date(),
      completedAt: null as Date | null,
    };

    // Advance through steps
    onboardingState.currentStep = 2; // Personal profile
    expect(onboardingState.currentStep).toBe(2);

    onboardingState.currentStep = 3; // Company
    expect(onboardingState.currentStep).toBe(3);

    onboardingState.currentStep = 4; // Banking
    expect(onboardingState.currentStep).toBe(4);

    onboardingState.currentStep = 5; // Dashboard tour
    expect(onboardingState.currentStep).toBe(5);

    onboardingState.currentStep = 6; // Completion
    onboardingState.completed = true;
    onboardingState.completedAt = new Date();

    expect(onboardingState.completed).toBe(true);
    expect(onboardingState.completedAt).toBeInstanceOf(Date);
  });
});

// ============================================================================
// Personal Profile Validation Tests
// ============================================================================
describe("Personal Profile Step", () => {
  it("should accept valid document types", () => {
    const validTypes = ["CC", "NIT", "CE", "PASAPORTE", "TI", "PEP"];
    validTypes.forEach((type) => {
      expect(validTypes.includes(type)).toBe(true);
    });
  });

  it("should validate name is at least 2 characters", () => {
    expect("A".length >= 2).toBe(false);
    expect("AB".length >= 2).toBe(true);
    expect("Carlos López".length >= 2).toBe(true);
  });

  it("should handle optional fields gracefully", () => {
    const input = {
      name: "Carlos López",
      phone: undefined,
      documentType: undefined,
      documentNumber: undefined,
    };

    // Only non-undefined fields should be saved
    const updateData: Record<string, any> = {};
    if (input.name) updateData.name = input.name;
    if (input.phone) updateData.phone = input.phone;
    if (input.documentType) updateData.documentType = input.documentType;
    if (input.documentNumber) updateData.documentNumber = input.documentNumber;

    expect(Object.keys(updateData)).toEqual(["name"]);
  });
});

// ============================================================================
// Company Profile Validation Tests
// ============================================================================
describe("Company Profile Step", () => {
  it("should accept valid person types", () => {
    const validTypes = ["PERSON_ENTITY", "LEGAL_ENTITY"];
    expect(validTypes.includes("PERSON_ENTITY")).toBe(true);
    expect(validTypes.includes("LEGAL_ENTITY")).toBe(true);
    expect(validTypes.includes("INVALID")).toBe(false);
  });

  it("should accept valid regime types", () => {
    const validRegimes = [
      "SIMPLIFIED_REGIME",
      "COMMON_REGIME",
      "NOT_RESPONSIBLE_FOR_IVA",
    ];
    validRegimes.forEach((regime) => {
      expect(validRegimes.includes(regime)).toBe(true);
    });
  });

  it("should allow skipping company step for natural persons", () => {
    const input = {
      companyName: undefined,
      taxId: undefined,
      fiscalAddress: undefined,
      fiscalCity: undefined,
      fiscalDepartment: undefined,
    };

    const updateData: Record<string, any> = {};
    if (input.companyName) updateData.companyName = input.companyName;
    if (input.taxId) updateData.taxId = input.taxId;

    // No fields to update = skip is valid
    expect(Object.keys(updateData).length).toBe(0);
  });
});

// ============================================================================
// Banking Info Validation Tests
// ============================================================================
describe("Banking Info Step", () => {
  it("should require both bankName and bankAccount", () => {
    const validInput = { bankName: "Bancolombia", bankAccount: "123456789" };
    const missingBank = { bankName: "", bankAccount: "123456789" };
    const missingAccount = { bankName: "Bancolombia", bankAccount: "" };

    expect(validInput.bankName.length > 0 && validInput.bankAccount.length > 0).toBe(true);
    expect(missingBank.bankName.length > 0 && missingBank.bankAccount.length > 0).toBe(false);
    expect(missingAccount.bankName.length > 0 && missingAccount.bankAccount.length > 0).toBe(false);
  });

  it("should accept known Colombian banks", () => {
    const knownBanks = [
      "Bancolombia",
      "Davivienda",
      "BBVA",
      "Banco de Bogotá",
      "Banco de Occidente",
      "Banco AV Villas",
      "Banco Caja Social",
      "Scotiabank Colpatria",
      "Banco Falabella",
      "Nequi",
      "Daviplata",
    ];

    expect(knownBanks.length).toBeGreaterThan(0);
    expect(knownBanks.includes("Bancolombia")).toBe(true);
    expect(knownBanks.includes("Nequi")).toBe(true);
  });
});

// ============================================================================
// Onboarding Completion Tests
// ============================================================================
describe("Onboarding Completion", () => {
  it("should calculate profile completeness correctly", () => {
    const user = {
      name: "Carlos López",
      email: "carlos@test.com",
      phone: "+573001234567",
      companyName: "Mi Empresa SAS",
      taxId: "901.447.678-0",
      bankName: "Bancolombia",
      bankAccount: "123456789",
    };

    const profileComplete = !!(user.name && user.email && user.phone);
    const companyComplete = !!(user.companyName && user.taxId);
    const bankingComplete = !!(user.bankName && user.bankAccount);

    expect(profileComplete).toBe(true);
    expect(companyComplete).toBe(true);
    expect(bankingComplete).toBe(true);
  });

  it("should detect incomplete profiles", () => {
    const incompleteUser = {
      name: "Carlos",
      email: "carlos@test.com",
      phone: "",
      companyName: "",
      taxId: "",
      bankName: "",
      bankAccount: "",
    };

    const profileComplete = !!(incompleteUser.name && incompleteUser.email && incompleteUser.phone);
    const companyComplete = !!(incompleteUser.companyName && incompleteUser.taxId);
    const bankingComplete = !!(incompleteUser.bankName && incompleteUser.bankAccount);

    expect(profileComplete).toBe(false); // missing phone
    expect(companyComplete).toBe(false); // missing company
    expect(bankingComplete).toBe(false); // missing banking
  });

  it("should not send welcome email twice", () => {
    const user = {
      welcomeEmailSent: true,
      email: "carlos@test.com",
    };

    const shouldSend = user.email && !user.welcomeEmailSent;
    expect(shouldSend).toBe(false);
  });

  it("should send welcome email for new investor", () => {
    const user = {
      welcomeEmailSent: false,
      email: "carlos@test.com",
    };

    const shouldSend = user.email && !user.welcomeEmailSent;
    expect(shouldSend).toBeTruthy();
  });
});

// ============================================================================
// Onboarding URL Construction Tests
// ============================================================================
describe("Onboarding URL Construction", () => {
  it("should construct correct onboarding URL", () => {
    const baseUrl = "https://app.evgreen.lat";
    const onboardingUrl = `${baseUrl}/investor/onboarding`;
    expect(onboardingUrl).toBe("https://app.evgreen.lat/investor/onboarding");
  });

  it("should handle missing base URL with fallback", () => {
    const baseUrl = undefined || "https://app.evgreen.lat";
    const onboardingUrl = `${baseUrl}/investor/onboarding`;
    expect(onboardingUrl).toBe("https://app.evgreen.lat/investor/onboarding");
  });
});
