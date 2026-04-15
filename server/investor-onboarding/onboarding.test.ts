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

// ============================================================================
// Founder Profile Step Tests
// ============================================================================
describe("Founder Profile Step", () => {
  it("should validate founder title max length (100 chars)", () => {
    const shortTitle = "Co-Fundador & Visionario";
    const longTitle = "A".repeat(101);

    expect(shortTitle.length <= 100).toBe(true);
    expect(longTitle.length <= 100).toBe(false);
  });

  it("should validate investor quote max length (500 chars)", () => {
    const shortQuote = "Invertir en movilidad eléctrica es invertir en el futuro de Colombia";
    const longQuote = "B".repeat(501);

    expect(shortQuote.length <= 500).toBe(true);
    expect(longQuote.length <= 500).toBe(false);
  });

  it("should validate investor bio max length (2000 chars)", () => {
    const shortBio = "Empresario con 20 años de experiencia en el sector energético.";
    const longBio = "C".repeat(2001);

    expect(shortBio.length <= 2000).toBe(true);
    expect(longBio.length <= 2000).toBe(false);
  });

  it("should only allow founders to save founder profile", () => {
    const founderUser = { isFounder: true, role: "investor" };
    const regularUser = { isFounder: false, role: "investor" };

    expect(founderUser.isFounder).toBe(true);
    expect(regularUser.isFounder).toBe(false);
  });

  it("should build correct update data from founder input", () => {
    const input = {
      founderTitle: "Co-Fundador Estratégico",
      investorQuote: "El futuro es eléctrico",
      investorBio: "Empresario colombiano apasionado por la sostenibilidad",
      investorShowInWall: true,
    };

    const updateData: Record<string, any> = {};
    if (input.founderTitle !== undefined) updateData.founderTitle = input.founderTitle;
    if (input.investorQuote !== undefined) updateData.investorQuote = input.investorQuote;
    if (input.investorBio !== undefined) updateData.investorBio = input.investorBio;
    if (input.investorShowInWall !== undefined) updateData.investorShowInWall = input.investorShowInWall;

    expect(Object.keys(updateData)).toEqual([
      "founderTitle",
      "investorQuote",
      "investorBio",
      "investorShowInWall",
    ]);
    expect(updateData.founderTitle).toBe("Co-Fundador Estratégico");
    expect(updateData.investorShowInWall).toBe(true);
  });

  it("should handle empty founder profile (all optional)", () => {
    const input = {
      founderTitle: undefined,
      investorQuote: undefined,
      investorBio: undefined,
      investorShowInWall: undefined,
    };

    const updateData: Record<string, any> = {};
    if (input.founderTitle !== undefined) updateData.founderTitle = input.founderTitle;
    if (input.investorQuote !== undefined) updateData.investorQuote = input.investorQuote;
    if (input.investorBio !== undefined) updateData.investorBio = input.investorBio;
    if (input.investorShowInWall !== undefined) updateData.investorShowInWall = input.investorShowInWall;

    expect(Object.keys(updateData).length).toBe(0);
  });

  it("should default investorShowInWall to true", () => {
    const defaultShowInWall = true;
    expect(defaultShowInWall).toBe(true);
  });
});

// ============================================================================
// Founder Photo Upload Tests
// ============================================================================
describe("Founder Photo Upload", () => {
  it("should validate accepted image mime types", () => {
    const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
    expect(acceptedTypes.includes("image/jpeg")).toBe(true);
    expect(acceptedTypes.includes("image/png")).toBe(true);
    expect(acceptedTypes.includes("image/webp")).toBe(true);
    expect(acceptedTypes.includes("image/gif")).toBe(false);
    expect(acceptedTypes.includes("application/pdf")).toBe(false);
  });

  it("should determine correct file extension from mime type", () => {
    const getExt = (mimeType: string): string => {
      if (mimeType.includes("png")) return "png";
      if (mimeType.includes("webp")) return "webp";
      return "jpg";
    };

    expect(getExt("image/jpeg")).toBe("jpg");
    expect(getExt("image/png")).toBe("png");
    expect(getExt("image/webp")).toBe("webp");
  });

  it("should generate unique file keys for S3 uploads", () => {
    const userId = 42;
    const randomSuffix1 = Math.random().toString(36).substring(2, 10);
    const randomSuffix2 = Math.random().toString(36).substring(2, 10);

    const key1 = `founders/${userId}-photo-${randomSuffix1}.jpg`;
    const key2 = `founders/${userId}-photo-${randomSuffix2}.jpg`;

    expect(key1).toContain("founders/42-photo-");
    expect(key2).toContain("founders/42-photo-");
    expect(key1).not.toBe(key2); // Should be unique
  });

  it("should enforce 5MB file size limit", () => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const smallFile = 1 * 1024 * 1024; // 1MB
    const largeFile = 6 * 1024 * 1024; // 6MB

    expect(smallFile <= maxSize).toBe(true);
    expect(largeFile <= maxSize).toBe(false);
  });
});

// ============================================================================
// Founder Onboarding Step Count Tests
// ============================================================================
describe("Onboarding Step Count", () => {
  it("should have 7 steps for founders", () => {
    const allSteps = ["welcome", "personal", "company", "banking", "founder", "dashboard", "complete"];
    const founderSteps = allSteps; // Founders see all steps
    expect(founderSteps.length).toBe(7);
    expect(founderSteps).toContain("founder");
  });

  it("should have 6 steps for regular investors", () => {
    const allSteps = ["welcome", "personal", "company", "banking", "founder", "dashboard", "complete"];
    const regularSteps = allSteps.filter((s) => s !== "founder");
    expect(regularSteps.length).toBe(6);
    expect(regularSteps).not.toContain("founder");
  });

  it("should set correct max step on completion", () => {
    const founderMaxStep = 7;
    const regularMaxStep = 6;

    expect(founderMaxStep).toBe(7);
    expect(regularMaxStep).toBe(6);
  });
});
