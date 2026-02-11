/**
 * Stripe config - DEPRECATED
 * La plataforma ahora usa Wompi como pasarela de pagos.
 * Este archivo se mantiene como stub para evitar errores de importación.
 */

export const stripe = null;

export const PRODUCTS = {
  WALLET_RECHARGE: { id: "wallet_recharge", name: "Recarga de Saldo EVGreen", prices: {} },
  SUBSCRIPTION_BASIC: { id: "subscription_basic", name: "Plan Básico", price: 18900 },
  SUBSCRIPTION_PREMIUM: { id: "subscription_premium", name: "Plan Premium", price: 33900 },
};

export function isStripeConfigured(): boolean {
  return false;
}

export async function createWalletRechargeCheckout(_params: any): Promise<any> {
  return null;
}

export async function createSubscriptionCheckout(_params: any): Promise<any> {
  return null;
}
