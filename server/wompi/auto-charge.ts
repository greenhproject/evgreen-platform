/**
 * Auto-cobro desde tarjeta guardada cuando el saldo de billetera es insuficiente.
 * 
 * Se usa al completar una sesión de carga cuando el costo total excede el saldo disponible.
 * Flujo:
 * 1. Verificar si el usuario tiene tarjeta inscrita (wompiPaymentSourceId)
 * 2. Calcular el déficit (costo - saldo actual)
 * 3. Cobrar el déficit + un margen extra a la tarjeta vía Wompi API
 * 4. Acreditar el monto cobrado a la billetera
 * 5. Luego el flujo normal descuenta el costo total de la billetera
 */

import { getWompiKeys, generatePaymentReference, generateIntegritySignature } from "./config";
import { getAcceptanceToken } from "./recurring-billing";
import * as db from "../db";

// Monto mínimo de auto-recarga (Wompi requiere mínimo $10,000 COP para transacciones con tarjeta)
const MIN_AUTO_CHARGE = 10000;
// Margen extra para evitar saldo negativo inmediato después de la carga
const AUTO_CHARGE_MARGIN = 5000;

export interface AutoChargeResult {
  success: boolean;
  amountCharged: number;
  newBalance: number;
  reference?: string;
  error?: string;
}

/**
 * Intentar auto-cobrar desde la tarjeta guardada del usuario si el saldo es insuficiente.
 * 
 * @param userId - ID del usuario
 * @param requiredAmount - Monto total que se necesita cobrar de la billetera
 * @returns Resultado del auto-cobro, o null si no aplica (saldo suficiente o sin tarjeta)
 */
export async function autoChargeIfNeeded(
  userId: number,
  requiredAmount: number
): Promise<AutoChargeResult | null> {
  // Obtener billetera actual
  const wallet = await db.getWalletByUserId(userId);
  if (!wallet) return null;

  const currentBalance = parseFloat(wallet.balance?.toString() || "0");

  // Si el saldo es suficiente, no necesitamos auto-cobrar
  if (currentBalance >= requiredAmount) {
    return null;
  }

  // Verificar si el usuario tiene tarjeta inscrita con payment source
  const subscription = await db.getUserSubscription(userId);
  if (!subscription?.wompiPaymentSourceId) {
    console.log(`[AutoCharge] Usuario ${userId}: saldo insuficiente ($${currentBalance} < $${requiredAmount}) pero sin tarjeta inscrita`);
    return null;
  }

  // Obtener email del usuario
  const user = await db.getUserById(userId);
  const customerEmail = user?.email || "";

  // Obtener llaves de Wompi
  const keys = await getWompiKeys();
  if (!keys) {
    console.log(`[AutoCharge] Wompi no configurado, no se puede auto-cobrar`);
    return null;
  }

  // Calcular monto a cobrar: déficit + margen, con mínimo de $10,000
  const deficit = requiredAmount - currentBalance;
  const chargeAmount = Math.max(MIN_AUTO_CHARGE, Math.ceil((deficit + AUTO_CHARGE_MARGIN) / 1000) * 1000);
  const amountInCents = chargeAmount * 100;

  const reference = generatePaymentReference("ATC"); // ATC = Auto-Charge

  console.log(`[AutoCharge] Usuario ${userId}: saldo $${currentBalance}, costo $${requiredAmount}, cobrando $${chargeAmount} a tarjeta ****${subscription.cardLastFour || "????"}`);

  try {
    // Obtener acceptance token (obligatorio según API de Wompi)
    const acceptanceData = await getAcceptanceToken();
    if (!acceptanceData?.acceptanceToken) {
      console.error(`[AutoCharge] No se pudo obtener acceptance token`);
      return {
        success: false,
        amountCharged: 0,
        newBalance: currentBalance,
        reference,
        error: "No se pudo obtener token de aceptación de Wompi",
      };
    }

    // Generar firma de integridad (obligatoria según API de Wompi)
    const signature = generateIntegritySignature(
      reference,
      amountInCents,
      "COP",
      keys.integritySecret
    );

    // Crear transacción directa con payment source en Wompi
    const response = await fetch(`${keys.apiUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.privateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents: amountInCents,
        currency: "COP",
        payment_source_id: parseInt(subscription.wompiPaymentSourceId),
        reference,
        customer_email: customerEmail,
        signature,
        acceptance_token: acceptanceData.acceptanceToken,
        payment_method: {
          type: "CARD",
          installments: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[AutoCharge] Error API Wompi (${response.status}):`, errorBody);
      return {
        success: false,
        amountCharged: 0,
        newBalance: currentBalance,
        reference,
        error: `Error en cobro automático: ${response.status}`,
      };
    }

    const result = await response.json();
    const tx = result.data;

    console.log(`[AutoCharge] Transacción Wompi: ${tx.id} - Estado: ${tx.status}`);

    // Guardar transacción en BD
    try {
      await db.createWompiTransaction({
        userId,
        reference,
        amountInCents,
        currency: "COP",
        type: "WALLET_RECHARGE",
        customerEmail,
        description: `Auto-recarga por saldo insuficiente - $${chargeAmount.toLocaleString()} COP`,
        integritySignature: "",
      });
      await db.updateWompiTransactionByReference(reference, {
        wompiTransactionId: tx.id,
        status: tx.status,
        paymentMethodType: tx.payment_method_type || "CARD",
        processedAt: new Date(),
      });
    } catch (dbErr) {
      console.warn("[AutoCharge] Error guardando transacción:", dbErr);
    }

    // Si fue aprobada, acreditar la billetera
    if (tx.status === "APPROVED") {
      const newBalance = currentBalance + chargeAmount;
      await db.updateWalletBalance(userId, newBalance.toString());

      // Registrar transacción de billetera
      await db.createWalletTransaction({
        walletId: wallet.id,
        userId,
        type: "WOMPI_RECHARGE",
        amount: chargeAmount.toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        description: `Auto-recarga con tarjeta ****${subscription.cardLastFour || ""}: ${reference}`,
        status: "COMPLETED",
      });

      // Notificación al usuario
      try {
        await db.createNotification({
          userId,
          title: "Auto-recarga exitosa",
          message: `Se cobraron $${chargeAmount.toLocaleString()} COP a tu tarjeta ****${subscription.cardLastFour || ""} porque tu saldo era insuficiente para completar la carga.`,
          type: "PAYMENT",
          data: JSON.stringify({
            key: `auto-charge-${reference}`,
            amount: chargeAmount,
            reference,
            reason: "insufficient_balance",
          }),
        });
      } catch (notifErr) {
        console.warn("[AutoCharge] Error creando notificación:", notifErr);
      }

      console.log(`[AutoCharge] Éxito: $${chargeAmount} cobrados, nuevo saldo: $${newBalance}`);

      return {
        success: true,
        amountCharged: chargeAmount,
        newBalance,
        reference,
      };
    } else if (tx.status === "PENDING") {
      // Transacción pendiente - el webhook se encargará
      console.log(`[AutoCharge] Transacción pendiente: ${reference}`);
      return {
        success: false,
        amountCharged: 0,
        newBalance: currentBalance,
        reference,
        error: "El cobro está pendiente de confirmación",
      };
    } else {
      // Rechazada
      console.log(`[AutoCharge] Transacción rechazada: ${tx.status}`);
      return {
        success: false,
        amountCharged: 0,
        newBalance: currentBalance,
        reference,
        error: `Cobro rechazado: ${tx.status}`,
      };
    }
  } catch (error: any) {
    console.error(`[AutoCharge] Error:`, error);
    return {
      success: false,
      amountCharged: 0,
      newBalance: currentBalance,
      reference,
      error: error.message || "Error en auto-cobro",
    };
  }
}
