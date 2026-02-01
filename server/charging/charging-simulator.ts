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
import { sendChargingCompleteNotification } from "../firebase/fcm";

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
  powerKw: number; // Potencia real del cargador en kW
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
  
  // Obtener la potencia real del EVSE desde la base de datos
  const evseData = await db.getEvseById(evseId);
  const realPowerKw = evseData?.powerKw ? parseFloat(evseData.powerKw) : 7; // Default 7 kW si no hay datos
  console.log(`[Simulator] EVSE ${evseId} potencia real: ${realPowerKw} kW`);

  // Calcular kWh objetivo según modo de carga
  let targetKwh = 0;
  const batteryCapacity = 60; // kWh promedio de batería EV
  const currentBatteryPercent = 20; // Asumimos 20% inicial de batería

  switch (chargeMode) {
    case "fixed_amount":
      // Monto fijo: calcular kWh que se pueden comprar con ese monto
      targetKwh = targetValue / pricePerKwh;
      console.log(`[Simulator] Modo monto fijo: $${targetValue} / $${pricePerKwh}/kWh = ${targetKwh.toFixed(2)} kWh`);
      break;
    case "percentage":
      // Porcentaje: calcular kWh necesarios para llegar al porcentaje objetivo
      // Si el usuario quiere cargar hasta 55%, y está en 20%, necesita 35% de la batería
      const percentToCharge = Math.max(0, targetValue - currentBatteryPercent);
      targetKwh = (percentToCharge / 100) * batteryCapacity;
      console.log(`[Simulator] Modo porcentaje: objetivo ${targetValue}%, actual ${currentBatteryPercent}%, cargar ${percentToCharge}% = ${targetKwh.toFixed(2)} kWh`);
      break;
    case "full_charge":
      // Carga completa: cargar hasta el 100% (desde 20% = 80% de la batería)
      targetKwh = ((100 - currentBatteryPercent) / 100) * batteryCapacity;
      console.log(`[Simulator] Modo carga completa: desde ${currentBatteryPercent}% hasta 100% = ${targetKwh.toFixed(2)} kWh`);
      break;
  }

  // Para demo: escalar el tiempo de simulación
  // En lugar de limitar kWh, ajustamos la velocidad de carga
  // Queremos que la simulación dure entre 30 segundos y 2 minutos
  const simulationDurationSeconds = Math.min(120, Math.max(30, targetKwh * 3)); // 3 segundos por kWh
  
  // Guardar el targetKwh real para cálculos de costo
  const realTargetKwh = targetKwh;
  
  // Para simulación rápida, usamos un targetKwh escalado pero mantenemos los cálculos reales
  // Limitamos a 15 kWh máximo para que la simulación no dure más de 1 minuto
  targetKwh = Math.min(targetKwh, 15);
  
  // Mínimo 2 kWh para que la simulación tenga sentido visual
  targetKwh = Math.max(targetKwh, 2);
  
  console.log(`[Simulator] Target final para simulación: ${targetKwh.toFixed(2)} kWh (real: ${realTargetKwh.toFixed(2)} kWh)`);
  console.log(`[Simulator] Duración estimada: ${simulationDurationSeconds} segundos`);

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
    powerKw: realPowerKw, // Potencia real del cargador
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

      // Usar la potencia real del cargador para calcular la velocidad de carga
      // kWh por intervalo de 5 segundos = potencia * (5/3600) horas
      // Para simulación acelerada, multiplicamos por un factor de aceleración
      const accelerationFactor = 60; // 1 minuto real = 1 hora simulada
      const intervalSeconds = 5;
      const realKwhPerInterval = session.powerKw * (intervalSeconds / 3600) * accelerationFactor;
      
      console.log(`[Simulator] Potencia: ${session.powerKw} kW, kWh por intervalo: ${realKwhPerInterval.toFixed(3)} kWh`);
      
      let intervalCount = 0;

      session.intervalId = setInterval(async () => {
        if (!activeSimulations.has(session.userId)) {
          clearInterval(session.intervalId);
          return;
        }

        intervalCount++;
        
        // Incrementar medidor usando la potencia real con variación aleatoria (±10%)
        const kwhIncrement = realKwhPerInterval * (0.9 + Math.random() * 0.2);
        session.currentMeter += kwhIncrement * 1000; // Convertir a Wh

        const currentKwh = (session.currentMeter - session.meterStart) / 1000;
        const currentCost = currentKwh * session.pricePerKwh;
        
        // Calcular potencia actual con variación realista (±5% de la potencia nominal)
        const currentPower = session.powerKw * (0.95 + Math.random() * 0.1);

        // Guardar MeterValue en BD
        await db.createMeterValue({
          transactionId: session.transactionId,
          evseId: session.evseId,
          timestamp: new Date(),
          energyKwh: String(currentKwh),
          powerKw: String(currentPower.toFixed(2)),
        });

        // Notificar progreso
        if (session.callbacks.onMeterValue) {
          session.callbacks.onMeterValue(currentKwh, currentCost);
        }

        console.log(`[Simulator] User ${session.userId}: ${currentKwh.toFixed(2)} kWh, $${Math.round(currentCost)}, Power: ${currentPower.toFixed(1)} kW`);

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

  // Crear notificación en BD
  await db.createNotification({
    userId: session.userId,
    title: "Carga completada",
    message: `Has cargado ${kwhConsumed.toFixed(2)} kWh. Total: $${Math.round(totalCost).toLocaleString()}`,
    type: "CHARGING",
    referenceId: session.transactionId,
  });
  
  // Enviar notificación push si el usuario tiene token FCM
  try {
    const user = await db.getUserById(session.userId);
    if (user?.fcmToken) {
      const station = await db.getChargingStationById(session.stationId);
      await sendChargingCompleteNotification(user.fcmToken, {
        stationName: station?.name || "Estación EVGreen",
        energyDelivered: kwhConsumed,
        totalCost: Math.round(totalCost),
        duration,
      });
      console.log(`[Simulator] Push notification sent to user ${session.userId}`);
    }
  } catch (error) {
    console.error(`[Simulator] Error sending push notification:`, error);
  }

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
  powerKw: number;
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
    powerKw: session.powerKw,
    chargeMode: session.chargeMode,
    targetValue: session.targetValue,
  };
}
