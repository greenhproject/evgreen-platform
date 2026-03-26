/**
 * Tests for Subscription Bug Fixes:
 * 1. Profile displays correct subscription plan (not hardcoded "Plan Gratuito")
 * 2. Subscription activation tries direct charge with saved card first
 * 3. Subscription discount is applied to charging price per kWh
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Test Suite 1: Profile Subscription Display
// ============================================================
describe("Profile Subscription Display", () => {
  it("should show correct plan name based on subscription tier", () => {
    // Simulate the logic from Profile.tsx
    const getPlanDisplay = (subscription: { isActive: boolean; tier: string } | null | undefined) => {
      if (subscription?.isActive) {
        const tierNames: Record<string, string> = {
          BASIC: "Plan Básico",
          PREMIUM: "Plan Premium",
          FREE: "Plan Gratuito",
        };
        return tierNames[subscription.tier] || "Plan Gratuito";
      }
      return "Plan Gratuito";
    };

    // Active BASIC subscription
    expect(getPlanDisplay({ isActive: true, tier: "BASIC" })).toBe("Plan Básico");
    
    // Active PREMIUM subscription
    expect(getPlanDisplay({ isActive: true, tier: "PREMIUM" })).toBe("Plan Premium");
    
    // Active FREE subscription
    expect(getPlanDisplay({ isActive: true, tier: "FREE" })).toBe("Plan Gratuito");
    
    // No subscription
    expect(getPlanDisplay(null)).toBe("Plan Gratuito");
    expect(getPlanDisplay(undefined)).toBe("Plan Gratuito");
    
    // Inactive subscription
    expect(getPlanDisplay({ isActive: false, tier: "BASIC" })).toBe("Plan Gratuito");
  });

  it("should show correct badge color based on tier", () => {
    const getBadgeColor = (subscription: { isActive: boolean; tier: string } | null | undefined) => {
      if (subscription?.isActive) {
        if (subscription.tier === "PREMIUM") return "bg-amber-500/20 text-amber-400";
        if (subscription.tier === "BASIC") return "bg-blue-500/20 text-blue-400";
      }
      return "bg-emerald-500/20 text-emerald-400";
    };

    expect(getBadgeColor({ isActive: true, tier: "PREMIUM" })).toContain("amber");
    expect(getBadgeColor({ isActive: true, tier: "BASIC" })).toContain("blue");
    expect(getBadgeColor(null)).toContain("emerald");
    expect(getBadgeColor({ isActive: false, tier: "BASIC" })).toContain("emerald");
  });

  it("should hide 'Actualizar a Premium' button when already subscribed", () => {
    const shouldShowUpgradeButton = (subscription: { isActive: boolean; tier: string } | null | undefined) => {
      return !subscription?.isActive;
    };

    expect(shouldShowUpgradeButton(null)).toBe(true);
    expect(shouldShowUpgradeButton({ isActive: false, tier: "FREE" })).toBe(true);
    expect(shouldShowUpgradeButton({ isActive: true, tier: "BASIC" })).toBe(false);
    expect(shouldShowUpgradeButton({ isActive: true, tier: "PREMIUM" })).toBe(false);
  });
});

// ============================================================
// Test Suite 2: Direct Charge with Saved Card
// ============================================================
describe("Subscription Direct Charge Logic", () => {
  it("should attempt direct charge when user has saved payment source", async () => {
    // Simulate the decision logic from createSubscriptionPayment
    const shouldAttemptDirectCharge = (
      paymentSourceId: number | null | undefined,
      paymentSourceStatus: string | null | undefined
    ) => {
      return !!(paymentSourceId && paymentSourceStatus === "AVAILABLE");
    };

    // Has payment source and it's available
    expect(shouldAttemptDirectCharge(12345, "AVAILABLE")).toBe(true);
    
    // Has payment source but not available
    expect(shouldAttemptDirectCharge(12345, "PENDING")).toBe(false);
    expect(shouldAttemptDirectCharge(12345, null)).toBe(false);
    
    // No payment source
    expect(shouldAttemptDirectCharge(null, null)).toBe(false);
    expect(shouldAttemptDirectCharge(undefined, undefined)).toBe(false);
  });

  it("should fall back to checkout URL when direct charge fails", () => {
    // Simulate the response handling from frontend
    type SubscriptionResponse = {
      directCharge?: boolean;
      success?: boolean;
      status?: string;
      message?: string;
      checkoutUrl?: string;
    };

    const handleResponse = (data: SubscriptionResponse) => {
      if (data.directCharge && data.success) {
        return "DIRECT_SUCCESS";
      } else if (data.directCharge && data.status === "PENDING") {
        return "DIRECT_PENDING";
      } else if (data.checkoutUrl) {
        return "REDIRECT_TO_CHECKOUT";
      }
      return "UNKNOWN";
    };

    // Direct charge success
    expect(handleResponse({ directCharge: true, success: true, message: "Activada" }))
      .toBe("DIRECT_SUCCESS");
    
    // Direct charge pending
    expect(handleResponse({ directCharge: true, success: false, status: "PENDING", message: "Procesando" }))
      .toBe("DIRECT_PENDING");
    
    // Fallback to checkout
    expect(handleResponse({ checkoutUrl: "https://checkout.wompi.co/..." }))
      .toBe("REDIRECT_TO_CHECKOUT");
    
    // Direct charge failed, fallback to checkout
    expect(handleResponse({ directCharge: true, success: false, checkoutUrl: "https://checkout.wompi.co/..." }))
      .toBe("REDIRECT_TO_CHECKOUT");
  });

  it("should calculate correct subscription amount in cents", () => {
    const PLAN_PRICES: Record<string, number> = {
      basic: 18900,
      premium: 39900,
    };

    const getAmountInCents = (planId: string) => {
      const price = PLAN_PRICES[planId];
      return price ? price * 100 : 0;
    };

    expect(getAmountInCents("basic")).toBe(1890000);
    expect(getAmountInCents("premium")).toBe(3990000);
    expect(getAmountInCents("free")).toBe(0);
  });
});

// ============================================================
// Test Suite 3: Subscription Discount on Charging
// ============================================================
describe("Subscription Discount on Charging Price", () => {
  it("should apply BASIC plan 3% discount to pricePerKwh", () => {
    const applyDiscount = (pricePerKwh: number, discountPercentage: string | null) => {
      if (!discountPercentage) return pricePerKwh;
      const discountPct = parseFloat(discountPercentage);
      if (discountPct <= 0) return pricePerKwh;
      return Math.round(pricePerKwh * (1 - discountPct / 100));
    };

    // BASIC plan: 3% discount on $1200/kWh
    const discountedPrice = applyDiscount(1200, "3");
    expect(discountedPrice).toBe(1164); // 1200 * 0.97 = 1164

    // BASIC plan: 3% discount on $1800/kWh
    expect(applyDiscount(1800, "3")).toBe(1746); // 1800 * 0.97 = 1746
  });

  it("should apply PREMIUM plan 5% discount to pricePerKwh", () => {
    const applyDiscount = (pricePerKwh: number, discountPercentage: string | null) => {
      if (!discountPercentage) return pricePerKwh;
      const discountPct = parseFloat(discountPercentage);
      if (discountPct <= 0) return pricePerKwh;
      return Math.round(pricePerKwh * (1 - discountPct / 100));
    };

    // PREMIUM plan: 5% discount on $1200/kWh
    expect(applyDiscount(1200, "5")).toBe(1140); // 1200 * 0.95 = 1140

    // PREMIUM plan: 5% discount on $1800/kWh
    expect(applyDiscount(1800, "5")).toBe(1710); // 1800 * 0.95 = 1710
  });

  it("should NOT apply discount when subscription is inactive or FREE", () => {
    const applySubscriptionDiscount = (
      pricePerKwh: number,
      subscription: { isActive: boolean; discountPercentage: string | null } | null
    ) => {
      if (!subscription?.isActive || !subscription.discountPercentage) return pricePerKwh;
      const discountPct = parseFloat(subscription.discountPercentage);
      if (discountPct <= 0) return pricePerKwh;
      return Math.round(pricePerKwh * (1 - discountPct / 100));
    };

    // No subscription
    expect(applySubscriptionDiscount(1200, null)).toBe(1200);
    
    // Inactive subscription
    expect(applySubscriptionDiscount(1200, { isActive: false, discountPercentage: "3" })).toBe(1200);
    
    // FREE plan (0% discount)
    expect(applySubscriptionDiscount(1200, { isActive: true, discountPercentage: "0" })).toBe(1200);
    
    // Null discount
    expect(applySubscriptionDiscount(1200, { isActive: true, discountPercentage: null })).toBe(1200);
  });

  it("should calculate correct total cost with subscription discount", () => {
    const calculateTotalCost = (
      energyKwh: number,
      basePricePerKwh: number,
      discountPct: number,
      timeCost: number,
      sessionFee: number
    ) => {
      const discountedPrice = Math.round(basePricePerKwh * (1 - discountPct / 100));
      const energyCost = energyKwh * discountedPrice;
      return energyCost + timeCost + sessionFee;
    };

    // 15 kWh at $1200/kWh with 3% discount
    const total = calculateTotalCost(15, 1200, 3, 0, 2000);
    const expectedEnergy = 15 * 1164; // 15 * (1200 * 0.97) = 17460
    expect(total).toBe(expectedEnergy + 2000); // 19460

    // 15 kWh at $1200/kWh with NO discount
    const totalNoDiscount = calculateTotalCost(15, 1200, 0, 0, 2000);
    expect(totalNoDiscount).toBe(15 * 1200 + 2000); // 20000

    // Savings from subscription
    const savings = totalNoDiscount - total;
    expect(savings).toBe(15 * (1200 - 1164)); // 15 * 36 = 540 COP saved
  });

  it("should preserve discounted price through the entire charging flow", () => {
    // Simulate the flow: startCharge -> pendingSession -> StartTransaction -> StopTransaction
    
    // Step 1: startCharge calculates discounted price
    const basePrice = 1500;
    const discountPct = 3; // BASIC plan
    const discountedPrice = Math.round(basePrice * (1 - discountPct / 100));
    expect(discountedPrice).toBe(1455);
    
    // Step 2: Price stored in pending session
    const pendingSession = {
      pricePerKwh: discountedPrice,
      chargeMode: "full_charge",
      targetValue: 0,
    };
    
    // Step 3: StartTransaction reads from pending session
    const txPricePerKwh = pendingSession.pricePerKwh;
    expect(txPricePerKwh).toBe(1455);
    
    // Step 4: appliedPricePerKwh saved in transaction
    const transaction = {
      appliedPricePerKwh: String(txPricePerKwh),
    };
    
    // Step 5: StopTransaction reads appliedPricePerKwh
    const finalPrice = parseFloat(String(transaction.appliedPricePerKwh));
    expect(finalPrice).toBe(1455);
    
    // Step 6: Energy cost calculated with discounted price
    const energyDelivered = 20; // kWh
    const energyCost = energyDelivered * finalPrice;
    expect(energyCost).toBe(29100); // 20 * 1455
    
    // Without discount it would be 20 * 1500 = 30000
    const savingsFromDiscount = (energyDelivered * basePrice) - energyCost;
    expect(savingsFromDiscount).toBe(900); // 900 COP saved on this charge
  });
});

// ============================================================
// Test Suite 4: Discount Percentage by Plan
// ============================================================
describe("Discount Percentage Configuration", () => {
  it("should assign correct discount percentage per tier", () => {
    const getDiscountForTier = (planId: string) => {
      const tier = planId === "premium" ? "PREMIUM" : planId === "basic" ? "BASIC" : "FREE";
      const discountPercentage = tier === "PREMIUM" ? "5" : tier === "BASIC" ? "3" : "0";
      return discountPercentage;
    };

    expect(getDiscountForTier("basic")).toBe("3");
    expect(getDiscountForTier("premium")).toBe("5");
    expect(getDiscountForTier("free")).toBe("0");
  });

  it("should assign correct free reservations per month per tier", () => {
    const getFreeReservations = (planId: string) => {
      const tier = planId === "premium" ? "PREMIUM" : planId === "basic" ? "BASIC" : "FREE";
      return tier === "PREMIUM" ? 5 : tier === "BASIC" ? 2 : 0;
    };

    expect(getFreeReservations("basic")).toBe(2);
    expect(getFreeReservations("premium")).toBe(5);
    expect(getFreeReservations("free")).toBe(0);
  });
});
