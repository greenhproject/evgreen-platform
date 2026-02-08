/**
 * Configuración de Wompi para pagos en Colombia
 * 
 * Las llaves se leen dinámicamente desde la tabla platform_settings,
 * permitiendo al admin cambiarlas desde el panel sin reiniciar el servidor.
 * 
 * Wompi soporta: Tarjetas, PSE, Nequi, Bancolombia QR, Efecty
 */

import crypto from "crypto";
import { getWompiConfig } from "../db";

// ============================================================================
// TYPES
// ============================================================================

export interface WompiKeys {
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
  testMode: boolean;
  apiUrl: string;
}

// ============================================================================
// DYNAMIC CONFIG (reads from DB each time)
// ============================================================================

/**
 * Obtener configuración de Wompi desde la BD.
 * Retorna null si no está configurado.
 */
export async function getWompiKeys(): Promise<WompiKeys | null> {
  const config = await getWompiConfig();
  if (!config || !config.publicKey || !config.privateKey || !config.integritySecret) {
    return null;
  }

  // Validar que las llaves sean de Wompi (no de Stripe u otro proveedor)
  const isWompiPublicKey = config.publicKey.startsWith("pub_") || config.publicKey.startsWith("pub_test_") || config.publicKey.startsWith("pub_prod_") || config.publicKey.startsWith("pub_staging_");
  const isWompiPrivateKey = config.privateKey.startsWith("prv_") || config.privateKey.startsWith("prv_test_") || config.privateKey.startsWith("prv_prod_") || config.privateKey.startsWith("prv_staging_");
  
  if (!isWompiPublicKey || !isWompiPrivateKey) {
    console.warn("[Wompi] Las llaves configuradas no tienen formato de Wompi. Verifique que sean llaves de Wompi (pub_xxx / prv_xxx)");
    return null;
  }

  const testMode = config.testMode ?? true;
  const apiUrl = testMode
    ? "https://sandbox.wompi.co/v1"
    : "https://production.wompi.co/v1";

  return {
    publicKey: config.publicKey,
    privateKey: config.privateKey,
    integritySecret: config.integritySecret,
    eventsSecret: config.eventsSecret || "",
    testMode,
    apiUrl,
  };
}

/**
 * Verificar si Wompi está configurado (tiene llaves en BD)
 */
export async function isWompiConfigured(): Promise<boolean> {
  const keys = await getWompiKeys();
  return keys !== null;
}

// ============================================================================
// INTEGRITY SIGNATURE
// ============================================================================

/**
 * Generar firma de integridad para el widget de checkout de Wompi.
 * Fórmula: SHA256(reference + amountInCents + currency + [expirationTime] + integritySecret)
 */
export function generateIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  integritySecret: string,
  expirationTime?: string
): string {
  let dataToSign = `${reference}${amountInCents}${currency}`;
  if (expirationTime) {
    dataToSign += expirationTime;
  }
  dataToSign += integritySecret;

  return crypto.createHash("sha256").update(dataToSign).digest("hex");
}

// ============================================================================
// REFERENCE GENERATOR
// ============================================================================

/**
 * Generar referencia única para transacciones.
 * Formato: {PREFIX}-{timestamp_base36}-{random}
 */
export function generatePaymentReference(prefix: string = "EVG"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// CHECKOUT URL BUILDER
// ============================================================================

/**
 * Construir URL de checkout de Wompi con todos los parámetros.
 */
export function buildCheckoutUrl(params: {
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  redirectUrl: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  expirationTime?: string;
}): string {
  const checkoutParams = new URLSearchParams({
    "public-key": params.publicKey,
    currency: params.currency,
    "amount-in-cents": params.amountInCents.toString(),
    reference: params.reference,
    "signature:integrity": params.signature,
    "redirect-url": params.redirectUrl,
    "customer-data:email": params.customerEmail,
  });

  if (params.customerName) {
    checkoutParams.append("customer-data:full-name", params.customerName);
  }
  if (params.customerPhone) {
    checkoutParams.append("customer-data:phone-number", params.customerPhone);
  }
  if (params.expirationTime) {
    checkoutParams.append("expiration-time", params.expirationTime);
  }

  return `https://checkout.wompi.co/p/?${checkoutParams.toString()}`;
}

// ============================================================================
// API CALLS (use private key from DB)
// ============================================================================

/**
 * Consultar estado de una transacción por su ID de Wompi
 */
export async function getTransactionStatus(
  transactionId: string,
  keys: WompiKeys
): Promise<any> {
  const response = await fetch(`${keys.apiUrl}/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${keys.privateKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error consultando transacción: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Consultar transacción por referencia
 */
export async function getTransactionByReference(
  reference: string,
  keys: WompiKeys
): Promise<any> {
  const response = await fetch(
    `${keys.apiUrl}/transactions?reference=${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${keys.privateKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Error consultando transacción: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verificar firma de webhook de Wompi.
 * 
 * Según la documentación de Wompi:
 * 1. Concatenar los valores de signature.properties del evento
 * 2. Concatenar el timestamp del evento
 * 3. Concatenar el events secret
 * 4. SHA256 del resultado
 * 5. Comparar con signature.checksum
 */
export function verifyWebhookChecksum(
  event: any,
  eventsSecret: string
): boolean {
  try {
    const { signature, timestamp } = event;
    if (!signature || !signature.properties || !signature.checksum) {
      return false;
    }

    // Obtener los valores de las propiedades indicadas
    let concatenated = "";
    for (const prop of signature.properties) {
      const value = getNestedValue(event, prop);
      concatenated += String(value);
    }

    // Agregar timestamp y events secret
    concatenated += timestamp;
    concatenated += eventsSecret;

    const expectedChecksum = crypto
      .createHash("sha256")
      .update(concatenated)
      .digest("hex");

    return expectedChecksum === signature.checksum;
  } catch (error) {
    console.error("[Wompi] Error verificando checksum:", error);
    return false;
  }
}

/**
 * Obtener valor anidado de un objeto usando notación de puntos
 * Ej: getNestedValue(obj, "data.transaction.id")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const WOMPI_TRANSACTION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
  VOIDED: "VOIDED",
  ERROR: "ERROR",
} as const;

export const WOMPI_PAYMENT_METHODS = {
  CARD: "CARD",
  PSE: "PSE",
  NEQUI: "NEQUI",
  BANCOLOMBIA_QR: "BANCOLOMBIA_QR",
  BANCOLOMBIA_TRANSFER: "BANCOLOMBIA_TRANSFER",
  EFECTY: "EFECTY",
} as const;
