/**
 * Tests para la funcionalidad de MeterValues en tiempo real
 * 
 * Verifica:
 * - updateActiveSessionMeterData actualiza correctamente los campos
 * - Los nuevos campos (soc, currentPower, voltage, current) se inicializan correctamente
 * - La sesión activa se actualiza parcialmente (solo los campos proporcionados)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setActiveSession,
  getActiveSessionById,
  updateActiveSessionMeterData,
  removeActiveSession,
} from "./charging-router";

describe("updateActiveSessionMeterData", () => {
  const testTransactionId = 99999;
  
  beforeEach(() => {
    // Limpiar sesión anterior
    removeActiveSession(testTransactionId);
    
    // Crear sesión activa de prueba con todos los campos nuevos
    setActiveSession(testTransactionId, {
      transactionId: testTransactionId,
      userId: 1,
      stationId: 1,
      connectorId: 1,
      chargeMode: "full_charge",
      targetValue: 100,
      startTime: new Date(),
      currentKwh: 0,
      currentCost: 0,
      pricePerKwh: 1800,
      soc: null,
      currentPower: 0,
      voltage: null,
      current: null,
      lastMeterUpdate: null,
    });
  });
  
  it("debe inicializar sesión con campos de MeterValues en null/0", () => {
    const session = getActiveSessionById(testTransactionId);
    expect(session).toBeDefined();
    expect(session!.soc).toBeNull();
    expect(session!.currentPower).toBe(0);
    expect(session!.voltage).toBeNull();
    expect(session!.current).toBeNull();
    expect(session!.lastMeterUpdate).toBeNull();
  });
  
  it("debe actualizar SoC real del vehículo", () => {
    const result = updateActiveSessionMeterData(testTransactionId, {
      soc: 78,
    });
    
    expect(result).toBe(true);
    const session = getActiveSessionById(testTransactionId);
    expect(session!.soc).toBe(78);
    expect(session!.lastMeterUpdate).toBeInstanceOf(Date);
  });
  
  it("debe actualizar potencia real de carga", () => {
    updateActiveSessionMeterData(testTransactionId, {
      currentPower: 6.8,
    });
    
    const session = getActiveSessionById(testTransactionId);
    expect(session!.currentPower).toBe(6.8);
  });
  
  it("debe actualizar todos los campos de MeterValues simultáneamente", () => {
    updateActiveSessionMeterData(testTransactionId, {
      currentKwh: 5.23,
      currentCost: 12500,
      soc: 82,
      currentPower: 7.2,
      voltage: 230.5,
      current: 31.3,
    });
    
    const session = getActiveSessionById(testTransactionId);
    expect(session!.currentKwh).toBe(5.23);
    expect(session!.currentCost).toBe(12500);
    expect(session!.soc).toBe(82);
    expect(session!.currentPower).toBe(7.2);
    expect(session!.voltage).toBe(230.5);
    expect(session!.current).toBe(31.3);
    expect(session!.lastMeterUpdate).toBeInstanceOf(Date);
  });
  
  it("debe actualizar solo los campos proporcionados sin afectar los demás", () => {
    // Primera actualización: solo energía
    updateActiveSessionMeterData(testTransactionId, {
      currentKwh: 2.5,
      currentCost: 4500,
    });
    
    let session = getActiveSessionById(testTransactionId);
    expect(session!.currentKwh).toBe(2.5);
    expect(session!.soc).toBeNull(); // No se proporcionó, debe seguir null
    expect(session!.currentPower).toBe(0); // No se proporcionó
    
    // Segunda actualización: solo SoC y potencia
    updateActiveSessionMeterData(testTransactionId, {
      soc: 65,
      currentPower: 6.5,
    });
    
    session = getActiveSessionById(testTransactionId);
    expect(session!.currentKwh).toBe(2.5); // No cambió
    expect(session!.currentCost).toBe(4500); // No cambió
    expect(session!.soc).toBe(65);
    expect(session!.currentPower).toBe(6.5);
  });
  
  it("debe retornar false si la sesión no existe", () => {
    const result = updateActiveSessionMeterData(88888, {
      soc: 50,
    });
    
    expect(result).toBe(false);
  });
  
  it("debe permitir actualizar SoC a null (cargador dejó de reportar)", () => {
    // Primero establecer un SoC
    updateActiveSessionMeterData(testTransactionId, { soc: 75 });
    expect(getActiveSessionById(testTransactionId)!.soc).toBe(75);
    
    // Luego actualizarlo a null
    updateActiveSessionMeterData(testTransactionId, { soc: null });
    expect(getActiveSessionById(testTransactionId)!.soc).toBeNull();
  });
  
  it("debe calcular costo incluyendo tarifa de conexión", () => {
    // Simular una actualización con costo que incluye tarifa de conexión
    const pricePerKwh = 1800;
    const connectionFee = 2000;
    const kwhConsumed = 5;
    const totalCost = (kwhConsumed * pricePerKwh) + connectionFee;
    
    updateActiveSessionMeterData(testTransactionId, {
      currentKwh: kwhConsumed,
      currentCost: totalCost,
    });
    
    const session = getActiveSessionById(testTransactionId);
    expect(session!.currentCost).toBe(11000); // 5 * 1800 + 2000
  });
});

describe("Sesión activa con campos completos", () => {
  it("debe crear sesión con todos los campos requeridos", () => {
    const txId = 77777;
    removeActiveSession(txId);
    
    setActiveSession(txId, {
      transactionId: txId,
      userId: 2,
      stationId: 3,
      connectorId: 1,
      chargeMode: "percentage",
      targetValue: 80,
      startTime: new Date(),
      currentKwh: 0,
      currentCost: 0,
      pricePerKwh: 1500,
      soc: null,
      currentPower: 0,
      voltage: null,
      current: null,
      lastMeterUpdate: null,
    });
    
    const session = getActiveSessionById(txId);
    expect(session).toBeDefined();
    expect(session!.chargeMode).toBe("percentage");
    expect(session!.targetValue).toBe(80);
    expect(session!.pricePerKwh).toBe(1500);
    expect(session!.soc).toBeNull();
    expect(session!.currentPower).toBe(0);
    
    removeActiveSession(txId);
  });
});
