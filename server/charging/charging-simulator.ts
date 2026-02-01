/**
 * Charging Simulator - Simula el ciclo completo de carga para usuarios de prueba
 * 
 * Este módulo permite simular todo el flujo de carga cuando no hay un cargador físico
 * conectado, útil para demos y pruebas del sistema.
 * 
 * El ciclo de carga simulado:
 * 1. Conectando (5 segundos) - Esperando conexión del vehículo
 * 2. Preparando (3 segundos) - Verificando conexión
 * 3. Cargando (variable) - Simulando carga con MeterValues periódicos
 * 4. Completado - Finalizando transacción
 */

import * as db from "../db";
import { nanoid } from "nanoid";

// Emails de usuarios de prueba que activan la simulación
const TEST_USER_EMAILS = [
  "info@greenhproject.com",
  "test@evgreen.lat",
  "demo@evgreen.lat",
];

// Sesiones de simulación activas
interface SimulationSession {
  userId: number;
  stationId: number;
  evseId: number;
  connectorId: number;
  transactionId: number;
  startTime: Date;
  meterStart: number;
  currentMeter: number;
  targetKwh: number;
  pricePerKwh: number;
  chargeMode: "fixed_amount" | "percentage" | "full_charge";
  targetValue: number;
  status: "connecting" | "preparing" | "charging" | "finishing" | "completed";
  intervalId?: NodeJS.Timeout;
  callbacks: {
    onStatusChange?: (status: string, data: any) => void;
    onMeterValue?: (kwh: number, cost: number) => void;
    onComplete?: (summary: any) => void;
  };
}

const activeSimulations = new Map<number, SimulationSession>();

/**
 * Verifica si un usuario es de prueba y debe usar simulación
 */
export function isTestUser(email: string): boolean {
  return TEST_USER_EMAILS.includes(email.toLowerCase());
}

/**
 * Verifica si hay una simulación activa para un usuario
 */
export function hasActiveSimulation(userId: number): boolean {
  return activeSimulations.has(userId);
}

/**
 * Obtiene el estado actual de una simulación
 */
export function getSimulationStatus(userId: number): SimulationSession | null {
  return activeSimulations.get(userId) || null;
}

/**
 * Inicia una simulación de carga para un usuario de prueba
 */
export async function startSimulation(params: {
  userId: number;
  userEmail: string;
  stationId: number;
  evseId: number;
  connectorId: number;
  chargeMode: "fixed_amount" | "percentage" | "full_charge";
  targetValue: number;
  pricePerKwh: number;
  callbacks?: SimulationSession["callbacks"];
}): Promise<{ transactionId: number; sessionId: string }> {
  const {
    userId,
    userEmail,
    stationId,
    evseId,
    connectorId,
    chargeMode,
    targetValue,
    pricePerKwh,
    callbacks = {},
  } = params;

  // Verificar que es usuario de prueba
  if (!isTestUser(userEmail)) {
    throw new Error("Solo usuarios de prueba pueden usar el simulador");
  }

  // Verificar que no hay simulación activa
  if (activeSimulations.has(userId)) {
    throw new Error("Ya hay una simulación activa para este usuario");
  }

  // Calcular kWh objetivo según modo de carga
  let targetKwh = 0;
  const batteryCapacity = 60; // kWh promedio

  switch (chargeMode) {
    case "fixed_amount":
      targetKwh = targetValue / pricePerKwh;
      break;
    case "percentage":
      const currentPercent = 20; // Asumimos 20% inicial
      targetKwh = ((targetValue - currentPercent) / 100) * batteryCapacity;
      break;
    case "full_charge":
      targetKwh = 0.8 * batteryCapacity; // 80% de la batería
      break;
  }

  // Limitar a un máximo razonable para demo (15 kWh = ~1 minuto de simulación)
  targetKwh = Math.min(targetKwh, 15);
  
  // Mínimo 2 kWh para que la simulación tenga sentido
  targetKwh = Math.max(targetKwh, 2);

  const meterStart = Math.floor(Math.random() * 10000); // Valor inicial aleatorio
  const ocppTransactionId = nanoid();

  // Crear transacción en BD
  const transactionId = await db.createTransaction({
    evseId,
    userId,
    stationId,
    ocppTransactionId,
    startTime: new Date(),
    status: "IN_PROGRESS",
    meterStart: String(meterStart),
  });

  // Actualizar estado del EVSE
  await db.updateEvseStatus(evseId, "CHARGING");

  // Crear sesión de simulación
  const session: SimulationSession = {
    userId,
    stationId,
    evseId,
    connectorId,
    transactionId,
    startTime: new Date(),
    meterStart,
    currentMeter: meterStart,
    targetKwh,
    pricePerKwh,
    chargeMode,
    targetValue,
    status: "connecting",
    callbacks,
  };

  activeSimulations.set(userId, session);

  // Iniciar ciclo de simulación
  startSimulationCycle(session);

  console.log(`[Simulator] Started simulation for user ${userId}, target: ${targetKwh} kWh`);

  return {
    transactionId,
    sessionId: ocppTransactionId,
  };
}

/**
 * Ejecuta el ciclo de simulación
 */
function startSimulationCycle(session: SimulationSession): void {
  // Fase 1: Conectando (5 segundos)
  session.status = "connecting";
  notifyStatusChange(session, "connecting", { message: "Esperando conexión del vehículo..." });

  setTimeout(() => {
    if (!activeSimulations.has(session.userId)) return;

    // Fase 2: Preparando (3 segundos)
    session.status = "preparing";
    notifyStatusChange(session, "preparing", { message: "Verificando conexión..." });

    setTimeout(() => {
      if (!activeSimulations.has(session.userId)) return;

      // Fase 3: Cargando
      session.status = "charging";
      notifyStatusChange(session, "charging", { message: "Carga en progreso" });

      // Enviar MeterValues cada 5 segundos
      const kwhPerInterval = session.targetKwh / 12; // Completar en ~1 minuto
      let intervalCount = 0;

      session.intervalId = setInterval(async () => {
        if (!activeSimulations.has(session.userId)) {
          clearInterval(session.intervalId);
          return;
        }

        intervalCount++;
        
        // Incrementar medidor
        const kwhIncrement = kwhPerInterval * (0.8 + Math.random() * 0.4); // Variación aleatoria
        session.currentMeter += kwhIncrement * 1000; // Convertir a Wh

        const currentKwh = (session.currentMeter - session.meterStart) / 1000;
        const currentCost = currentKwh * session.pricePerKwh;

        // Guardar MeterValue en BD
        await db.createMeterValue({
          transactionId: session.transactionId,
          evseId: session.evseId,
          timestamp: new Date(),
          energyKwh: String(currentKwh),
          powerKw: String(7 + Math.random() * 3), // Potencia variable 7-10 kW
        });

        // Notificar progreso
        if (session.callbacks.onMeterValue) {
          session.callbacks.onMeterValue(currentKwh, currentCost);
        }

        console.log(`[Simulator] User ${session.userId}: ${currentKwh.toFixed(2)} kWh, $${Math.round(currentCost)}`);

        // Verificar si se completó
        if (currentKwh >= session.targetKwh) {
          clearInterval(session.intervalId);
          await completeSimulation(session);
        }
      }, 5000);
    }, 3000);
  }, 5000);
}

/**
 * Completa la simulación y finaliza la transacción
 */
async function completeSimulation(session: SimulationSession): Promise<void> {
  session.status = "finishing";
  notifyStatusChange(session, "finishing", { message: "Finalizando carga..." });

  const endTime = new Date();
  const kwhConsumed = (session.currentMeter - session.meterStart) / 1000;
  const totalCost = kwhConsumed * session.pricePerKwh;
  const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

  // Actualizar transacción en BD
  await db.updateTransaction(session.transactionId, {
    endTime,
    meterEnd: String(session.currentMeter),
    kwhConsumed: String(kwhConsumed),
    totalCost: String(totalCost),
    status: "COMPLETED",
    stopReason: "Local",
  });

  // Actualizar estado del EVSE
  await db.updateEvseStatus(session.evseId, "AVAILABLE");

  // Descontar del saldo del usuario
  const wallet = await db.getWalletByUserId(session.userId);
  if (wallet) {
    const currentBalance = parseFloat(wallet.balance);
    const newBalance = Math.max(0, currentBalance - totalCost);
    await db.updateWalletBalance(session.userId, String(newBalance));

    // Registrar transacción de billetera
    await db.createWalletTransaction({
      walletId: wallet.id,
      userId: session.userId,
      type: "CHARGE_PAYMENT",
      amount: String(-totalCost),
      balanceBefore: String(currentBalance),
      balanceAfter: String(newBalance),
      description: `Carga de ${kwhConsumed.toFixed(2)} kWh`,
      referenceId: session.transactionId,
      referenceType: "TRANSACTION",
      status: "COMPLETED",
    });
  }

  // Crear notificación
  await db.createNotification({
    userId: session.userId,
    title: "Carga completada",
    message: `Has cargado ${kwhConsumed.toFixed(2)} kWh. Total: $${Math.round(totalCost).toLocaleString()}`,
    type: "CHARGING",
    referenceId: session.transactionId,
  });

  // Notificar completado
  const summary = {
    transactionId: session.transactionId,
    kwhConsumed: Math.round(kwhConsumed * 100) / 100,
    totalCost: Math.round(totalCost),
    duration,
    pricePerKwh: session.pricePerKwh,
    stationId: session.stationId,
  };

  session.status = "completed";
  notifyStatusChange(session, "completed", summary);

  if (session.callbacks.onComplete) {
    session.callbacks.onComplete(summary);
  }

  // Limpiar sesión
  activeSimulations.delete(session.userId);

  console.log(`[Simulator] Completed simulation for user ${session.userId}:`, summary);
}

/**
 * Detiene una simulación manualmente
 */
export async function stopSimulation(userId: number): Promise<{
  transactionId: number;
  kwhConsumed: number;
  totalCost: number;
} | null> {
  const session = activeSimulations.get(userId);
  if (!session) {
    return null;
  }

  // Limpiar intervalo
  if (session.intervalId) {
    clearInterval(session.intervalId);
  }

  // Completar la transacción con los valores actuales
  await completeSimulation(session);

  const kwhConsumed = (session.currentMeter - session.meterStart) / 1000;
  const totalCost = kwhConsumed * session.pricePerKwh;

  return {
    transactionId: session.transactionId,
    kwhConsumed: Math.round(kwhConsumed * 100) / 100,
    totalCost: Math.round(totalCost),
  };
}

/**
 * Notifica cambio de estado
 */
function notifyStatusChange(session: SimulationSession, status: string, data: any): void {
  if (session.callbacks.onStatusChange) {
    session.callbacks.onStatusChange(status, data);
  }
}

/**
 * Obtiene información de simulación activa para mostrar en UI
 */
export function getActiveSimulationInfo(userId: number): {
  status: string;
  currentKwh: number;
  currentCost: number;
  targetKwh: number;
  progress: number;
  elapsedSeconds: number;
  pricePerKwh: number;
  chargeMode: "fixed_amount" | "percentage" | "full_charge";
  targetValue: number;
} | null {
  const session = activeSimulations.get(userId);
  if (!session) {
    return null;
  }

  const currentKwh = (session.currentMeter - session.meterStart) / 1000;
  const currentCost = currentKwh * session.pricePerKwh;
  const progress = Math.min(100, (currentKwh / session.targetKwh) * 100);
  const elapsedSeconds = Math.floor((Date.now() - session.startTime.getTime()) / 1000);

  return {
    status: session.status,
    currentKwh: Math.round(currentKwh * 100) / 100,
    currentCost: Math.round(currentCost),
    targetKwh: session.targetKwh,
    progress: Math.round(progress),
    elapsedSeconds,
    pricePerKwh: session.pricePerKwh,
    chargeMode: session.chargeMode,
    targetValue: session.targetValue,
  };
}
