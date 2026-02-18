/**
 * Tests para la funcionalidad de MeterValues en tiempo real
 * 
 * Verifica:
 * - updateActiveSessionMeterData actualiza correctamente los campos
 * - Los nuevos campos (soc, currentPower, voltage, current) se inicializan correctamente
 * - La sesión activa se actualiza parcialmente (solo los campos proporcionados)
 * - Historial de potencia se acumula correctamente
 * - Notificación SoC objetivo se controla con socTargetNotified
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setActiveSession,
  getActiveSessionById,
  updateActiveSessionMeterData,
  removeActiveSession,
  getActiveSessionPowerHistory,
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
      powerHistory: [],
      socTargetNotified: false,
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
    expect(session!.powerHistory).toEqual([]);
    expect(session!.socTargetNotified).toBe(false);
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

describe("Historial de potencia (powerHistory)", () => {
  const testTransactionId = 88888;
  
  beforeEach(() => {
    removeActiveSession(testTransactionId);
    
    setActiveSession(testTransactionId, {
      transactionId: testTransactionId,
      userId: 1,
      stationId: 1,
      connectorId: 1,
      chargeMode: "percentage",
      targetValue: 80,
      startTime: new Date(),
      currentKwh: 0,
      currentCost: 0,
      pricePerKwh: 1800,
      soc: null,
      currentPower: 0,
      voltage: null,
      current: null,
      lastMeterUpdate: null,
      powerHistory: [],
      socTargetNotified: false,
    });
  });
  
  it("debe agregar puntos al historial de potencia con cada actualización", () => {
    updateActiveSessionMeterData(testTransactionId, {
      currentPower: 7.2,
      currentKwh: 0.5,
      soc: 25,
    });
    
    updateActiveSessionMeterData(testTransactionId, {
      currentPower: 6.8,
      currentKwh: 1.0,
      soc: 30,
    });
    
    updateActiveSessionMeterData(testTransactionId, {
      currentPower: 7.0,
      currentKwh: 1.5,
      soc: 35,
    });
    
    const session = getActiveSessionById(testTransactionId);
    expect(session!.powerHistory).toHaveLength(3);
    
    // Verificar estructura de cada punto
    expect(session!.powerHistory[0]).toMatchObject({
      power: 7.2,
      energy: 0.5,
      soc: 25,
    });
    expect(session!.powerHistory[0].timestamp).toBeGreaterThan(0);
    
    expect(session!.powerHistory[1]).toMatchObject({
      power: 6.8,
      energy: 1.0,
      soc: 30,
    });
    
    expect(session!.powerHistory[2]).toMatchObject({
      power: 7.0,
      energy: 1.5,
      soc: 35,
    });
  });
  
  it("debe limitar el historial a 360 puntos", () => {
    // Agregar 370 puntos
    for (let i = 0; i < 370; i++) {
      updateActiveSessionMeterData(testTransactionId, {
        currentPower: 7 + (i % 3) * 0.1,
        currentKwh: i * 0.01,
      });
    }
    
    const session = getActiveSessionById(testTransactionId);
    expect(session!.powerHistory.length).toBeLessThanOrEqual(360);
  });
  
  it("debe obtener historial de potencia con getActiveSessionPowerHistory", () => {
    updateActiveSessionMeterData(testTransactionId, {
      currentPower: 7.2,
      currentKwh: 0.5,
    });
    
    updateActiveSessionMeterData(testTransactionId, {
      currentPower: 6.5,
      currentKwh: 1.0,
    });
    
    const history = getActiveSessionPowerHistory(testTransactionId);
    expect(history).toHaveLength(2);
    expect(history[0].power).toBe(7.2);
    expect(history[1].power).toBe(6.5);
  });
  
  it("debe retornar array vacío si la sesión no existe", () => {
    const history = getActiveSessionPowerHistory(77777);
    expect(history).toEqual([]);
  });
  
  it("debe usar valores actuales de sesión cuando no se proporcionan en la actualización", () => {
    // Establecer valores iniciales
    updateActiveSessionMeterData(testTransactionId, {
      currentPower: 7.0,
      currentKwh: 2.0,
      soc: 50,
    });
    
    // Actualizar solo energía (power y soc deben usar valores actuales de la sesión)
    updateActiveSessionMeterData(testTransactionId, {
      currentKwh: 2.5,
    });
    
    const session = getActiveSessionById(testTransactionId);
    expect(session!.powerHistory).toHaveLength(2);
    
    // El segundo punto debe usar la potencia actual de la sesión (7.0)
    expect(session!.powerHistory[1].power).toBe(7.0);
    expect(session!.powerHistory[1].energy).toBe(2.5);
    expect(session!.powerHistory[1].soc).toBe(50);
  });
});

describe("Control de notificación SoC objetivo (socTargetNotified)", () => {
  const testTransactionId = 66666;
  
  beforeEach(() => {
    removeActiveSession(testTransactionId);
    
    setActiveSession(testTransactionId, {
      transactionId: testTransactionId,
      userId: 1,
      stationId: 1,
      connectorId: 1,
      chargeMode: "percentage",
      targetValue: 80,
      startTime: new Date(),
      currentKwh: 0,
      currentCost: 0,
      pricePerKwh: 1800,
      soc: null,
      currentPower: 0,
      voltage: null,
      current: null,
      lastMeterUpdate: null,
      powerHistory: [],
      socTargetNotified: false,
    });
  });
  
  it("debe inicializarse como false", () => {
    const session = getActiveSessionById(testTransactionId);
    expect(session!.socTargetNotified).toBe(false);
  });
  
  it("debe poder marcarse como true manualmente", () => {
    const session = getActiveSessionById(testTransactionId);
    session!.socTargetNotified = true;
    
    const updated = getActiveSessionById(testTransactionId);
    expect(updated!.socTargetNotified).toBe(true);
  });
  
  it("debe mantener socTargetNotified independiente de las actualizaciones de MeterData", () => {
    // Actualizar datos de carga no debe cambiar socTargetNotified
    updateActiveSessionMeterData(testTransactionId, {
      soc: 80,
      currentPower: 7.0,
    });
    
    const session = getActiveSessionById(testTransactionId);
    expect(session!.socTargetNotified).toBe(false);
    expect(session!.soc).toBe(80);
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
      powerHistory: [],
      socTargetNotified: false,
    });
    
    const session = getActiveSessionById(txId);
    expect(session).toBeDefined();
    expect(session!.chargeMode).toBe("percentage");
    expect(session!.targetValue).toBe(80);
    expect(session!.pricePerKwh).toBe(1500);
    expect(session!.soc).toBeNull();
    expect(session!.currentPower).toBe(0);
    expect(session!.powerHistory).toEqual([]);
    expect(session!.socTargetNotified).toBe(false);
    
    removeActiveSession(txId);
  });
});
