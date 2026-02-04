/**
 * Configuración de Wompi para pagos en Colombia
 * 
 * Wompi es una pasarela de pagos colombiana que soporta:
 * - Tarjetas de crédito/débito
 * - PSE (transferencia bancaria)
 * - Nequi
 * - Bancolombia QR
 * - Efectivo (Efecty, Baloto)
 */

import crypto from "crypto";

// Variables de entorno de Wompi
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY;
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY;
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET;
const WOMPI_TEST_MODE = process.env.WOMPI_TEST_MODE === "true";

// URLs de API
const WOMPI_API_URL = WOMPI_TEST_MODE 
  ? "https://sandbox.wompi.co/v1"
  : "https://production.wompi.co/v1";

export interface WompiConfig {
  publicKey: string | undefined;
  privateKey: string | undefined;
  integritySecret: string | undefined;
  testMode: boolean;
  apiUrl: string;
}

export const wompiConfig: WompiConfig = {
  publicKey: WOMPI_PUBLIC_KEY,
  privateKey: WOMPI_PRIVATE_KEY,
  integritySecret: WOMPI_INTEGRITY_SECRET,
  testMode: WOMPI_TEST_MODE,
  apiUrl: WOMPI_API_URL,
};

/**
 * Verificar si Wompi está configurado
 */
export function isWompiConfigured(): boolean {
  return !!(WOMPI_PUBLIC_KEY && WOMPI_PRIVATE_KEY && WOMPI_INTEGRITY_SECRET);
}

/**
 * Generar firma de integridad para transacciones Wompi
 * @param reference - Referencia única de la transacción
 * @param amountInCents - Monto en centavos
 * @param currency - Moneda (default: COP)
 * @param expirationTime - Fecha de expiración opcional
 */
export function generateIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string = "COP",
  expirationTime?: string
): string {
  if (!WOMPI_INTEGRITY_SECRET) {
    throw new Error("WOMPI_INTEGRITY_SECRET no está configurado");
  }

  let dataToSign = `${reference}${amountInCents}${currency}`;
  
  if (expirationTime) {
    dataToSign += expirationTime;
  }
  
  dataToSign += WOMPI_INTEGRITY_SECRET;

  return crypto.createHash("sha256").update(dataToSign).digest("hex");
}

/**
 * Generar referencia única para transacciones
 */
export function generatePaymentReference(prefix: string = "EVG"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Crear sesión de checkout de Wompi
 */
export async function createWompiCheckout(params: {
  reference: string;
  amountInCents: number;
  currency?: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  redirectUrl: string;
  expirationTime?: string;
}): Promise<{
  checkoutUrl: string;
  reference: string;
  signature: string;
} | null> {
  if (!isWompiConfigured()) {
    console.error("[Wompi] Wompi no está configurado");
    return null;
  }

  const {
    reference,
    amountInCents,
    currency = "COP",
    customerEmail,
    redirectUrl,
    expirationTime,
  } = params;

  const signature = generateIntegritySignature(
    reference,
    amountInCents,
    currency,
    expirationTime
  );

  // URL del checkout de Wompi
  const checkoutParams = new URLSearchParams({
    "public-key": WOMPI_PUBLIC_KEY!,
    currency,
    "amount-in-cents": amountInCents.toString(),
    reference,
    "signature:integrity": signature,
    "redirect-url": redirectUrl,
    "customer-data:email": customerEmail,
  });

  if (params.customerName) {
    checkoutParams.append("customer-data:full-name", params.customerName);
  }

  if (params.customerPhone) {
    checkoutParams.append("customer-data:phone-number", params.customerPhone);
  }

  if (expirationTime) {
    checkoutParams.append("expiration-time", expirationTime);
  }

  const checkoutUrl = `https://checkout.wompi.co/p/?${checkoutParams.toString()}`;

  return {
    checkoutUrl,
    reference,
    signature,
  };
}

/**
 * Consultar estado de una transacción
 */
export async function getTransactionStatus(transactionId: string): Promise<any> {
  if (!WOMPI_PRIVATE_KEY) {
    throw new Error("WOMPI_PRIVATE_KEY no está configurado");
  }

  const response = await fetch(`${WOMPI_API_URL}/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${WOMPI_PRIVATE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error consultando transacción: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Consultar transacción por referencia
 */
export async function getTransactionByReference(reference: string): Promise<any> {
  if (!WOMPI_PRIVATE_KEY) {
    throw new Error("WOMPI_PRIVATE_KEY no está configurado");
  }

  const response = await fetch(
    `${WOMPI_API_URL}/transactions?reference=${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${WOMPI_PRIVATE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Error consultando transacción: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Verificar firma de webhook de Wompi
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  if (!WOMPI_INTEGRITY_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHash("sha256")
    .update(`${timestamp}${payload}${WOMPI_INTEGRITY_SECRET}`)
    .digest("hex");

  return signature === expectedSignature;
}

/**
 * Estados de transacción de Wompi
 */
export const WOMPI_TRANSACTION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
  VOIDED: "VOIDED",
  ERROR: "ERROR",
} as const;

/**
 * Métodos de pago disponibles en Wompi
 */
export const WOMPI_PAYMENT_METHODS = {
  CARD: "CARD",
  PSE: "PSE",
  NEQUI: "NEQUI",
  BANCOLOMBIA_QR: "BANCOLOMBIA_QR",
  BANCOLOMBIA_TRANSFER: "BANCOLOMBIA_TRANSFER",
  EFECTY: "EFECTY",
  BALOTO: "BALOTO",
} as const;
