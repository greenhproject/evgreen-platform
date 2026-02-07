import Stripe from "stripe";

// Inicializar cliente de Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("[Stripe] STRIPE_SECRET_KEY not configured - payments will be disabled");
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

// Productos y precios para EVGreen
export const PRODUCTS = {
  // Recarga de saldo para sesiones de carga
  WALLET_RECHARGE: {
    id: "wallet_recharge",
    name: "Recarga de Saldo EVGreen",
    description: "Recarga tu billetera para pagar sesiones de carga",
    prices: {
      COP_20000: { amount: 20000, currency: "cop", label: "$20,000 COP" },
      COP_50000: { amount: 50000, currency: "cop", label: "$50,000 COP" },
      COP_100000: { amount: 100000, currency: "cop", label: "$100,000 COP" },
      COP_200000: { amount: 200000, currency: "cop", label: "$200,000 COP" },
    },
  },
  
  // Suscripciones mensuales
  SUBSCRIPTION_BASIC: {
    id: "subscription_basic",
    name: "Plan Básico EVGreen",
    description: "3% desc. en kWh + 10% desc. en tarifa de ocupación + reservas extendidas",
    pricePerMonth: 18900, // $18,900 COP/mes
    currency: "cop",
    discountKwh: 3, // 3% descuento en kWh
    discountOccupancy: 10, // 10% descuento en tarifa de ocupación
    reservationExtensionMinutes: 15, // 15 min extra en reservas
    benefits: [
      "3% de descuento en el kWh en la red de estaciones",
      "10% de descuento en la tarifa de ocupación",
      "15 min de rango extendido en reservas de cargadores",
      "Soporte prioritario en estaciones de carga",
    ],
  },
  
  SUBSCRIPTION_PREMIUM: {
    id: "subscription_premium",
    name: "Plan Premium EVGreen",
    description: "5% desc. en kWh + 15% desc. en ocupación + tarjeta física personalizada",
    pricePerMonth: 33900, // $33,900 COP/mes
    currency: "cop",
    discountKwh: 5, // 5% descuento en kWh
    discountOccupancy: 15, // 15% descuento en tarifa de ocupación
    reservationExtensionMinutes: 20, // 20 min extra en reservas
    benefits: [
      "5% de descuento en el kWh en la red de cargadores",
      "15% de descuento en la tarifa de ocupación",
      "20 min de rango extendido en reservas de cargadores",
      "Soporte prioritario en estaciones de carga",
      "Tarjeta física personalizada para inicio rápido de carga",
    ],
  },
  
  // Pago directo de sesión de carga
  CHARGING_SESSION: {
    id: "charging_session",
    name: "Sesión de Carga",
    description: "Pago por sesión de carga completada",
  },
} as const;

// Función para crear una sesión de checkout para recarga de saldo
export async function createWalletRechargeCheckout(params: {
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string } | null> {
  if (!stripe) {
    console.error("[Stripe] Stripe not configured");
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: params.userEmail,
      client_reference_id: params.userId,
      metadata: {
        user_id: params.userId,
        customer_email: params.userEmail,
        customer_name: params.userName,
        type: "wallet_recharge",
        amount: params.amount.toString(),
      },
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: {
              name: PRODUCTS.WALLET_RECHARGE.name,
              description: PRODUCTS.WALLET_RECHARGE.description,
            },
            unit_amount: params.amount * 100, // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return {
      url: session.url!,
      sessionId: session.id,
    };
  } catch (error) {
    console.error("[Stripe] Error creating checkout session:", error);
    return null;
  }
}

// Función para crear una sesión de checkout para suscripción
export async function createSubscriptionCheckout(params: {
  userId: string;
  userEmail: string;
  userName: string;
  planId: "basic" | "premium";
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string } | null> {
  if (!stripe) {
    console.error("[Stripe] Stripe not configured");
    return null;
  }

  const plan = params.planId === "basic" 
    ? PRODUCTS.SUBSCRIPTION_BASIC 
    : PRODUCTS.SUBSCRIPTION_PREMIUM;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: params.userEmail,
      client_reference_id: params.userId,
      metadata: {
        user_id: params.userId,
        customer_email: params.userEmail,
        customer_name: params.userName,
        type: "subscription",
        plan_id: params.planId,
      },
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: plan.pricePerMonth * 100, // Stripe usa centavos
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return {
      url: session.url!,
      sessionId: session.id,
    };
  } catch (error) {
    console.error("[Stripe] Error creating subscription checkout:", error);
    return null;
  }
}

// Función para crear un pago directo por sesión de carga
export async function createChargingSessionPayment(params: {
  userId: string;
  userEmail: string;
  userName: string;
  transactionId: string;
  stationName: string;
  energyKwh: number;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string } | null> {
  if (!stripe) {
    console.error("[Stripe] Stripe not configured");
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: params.userEmail,
      client_reference_id: params.userId,
      metadata: {
        user_id: params.userId,
        customer_email: params.userEmail,
        customer_name: params.userName,
        type: "charging_session",
        transaction_id: params.transactionId,
        station_name: params.stationName,
        energy_kwh: params.energyKwh.toString(),
      },
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: {
              name: `Sesión de Carga - ${params.stationName}`,
              description: `${params.energyKwh.toFixed(2)} kWh consumidos`,
            },
            unit_amount: Math.round(params.amount * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return {
      url: session.url!,
      sessionId: session.id,
    };
  } catch (error) {
    console.error("[Stripe] Error creating charging session payment:", error);
    return null;
  }
}

// Verificar si Stripe está configurado
export function isStripeConfigured(): boolean {
  return stripe !== null;
}
