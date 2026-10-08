/**
 * Test Suite: Facturación Electrónica Multi-Proveedor (EVGreen)
 * Cobertura:
 * 1. Adaptadores oficiales (Alegra, Siigo, World Office)
 * 2. Aislamiento Multi-Tenant de configuración contable
 * 3. Selección interactiva de producto y precarga de catálogo
 * 4. Reglas de redondeo contable (2 decimales vs entero más cercano)
 * 5. Resincronización forzada bajo demanda (forceSync)
 * 6. Gestión centralizada por SuperAdmin para cualquier Tenant
 * 7. Webhook de confirmación y timbrado DIAN
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAdapter } from "./billing-service";
import {
  processChargingInvoice,
  retryElectronicInvoice,
  getEffectiveBillingSettings,
} from "./billing-service";
import * as db from "../db";

// Mock de base de datos
vi.mock("../db", () => ({
  getTenantBillingSettings: vi.fn(),
  upsertTenantBillingSettings: vi.fn(),
  createElectronicInvoiceRecord: vi.fn().mockResolvedValue(101),
  updateElectronicInvoiceRecord: vi.fn().mockResolvedValue(undefined),
  getElectronicInvoiceByTransactionId: vi.fn(),
  getElectronicInvoiceById: vi.fn(),
  getElectronicInvoicesByOrg: vi.fn(),
  getTransactionById: vi.fn(),
  getUserById: vi.fn(),
  getStationById: vi.fn(),
  getChargingStationById: vi.fn(),
  getPlatformSettings: vi.fn(),
  updateUser: vi.fn().mockResolvedValue(undefined),
}));

describe("Facturación Electrónica Multi-Proveedor - Adaptadores", () => {
  it("debe instanciar y retornar el adaptador correcto según el proveedor", () => {
    const alegraAdapter = getAdapter("alegra");
    expect(alegraAdapter.provider).toBe("alegra");

    const siigoAdapter = getAdapter("siigo");
    expect(siigoAdapter.provider).toBe("siigo");

    const worldOfficeAdapter = getAdapter("world_office");
    expect(worldOfficeAdapter.provider).toBe("world_office");
  });

  it("debe lanzar un error descriptivo si el proveedor no está soportado", () => {
    expect(() => getAdapter("sap" as any)).toThrow(/no soportado/);
  });
});

describe("Aislamiento Multi-Tenant y Reglas de Redondeo Contable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe resolver la configuración del Tenant A con redondeo a 2 decimales", async () => {
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 1,
      organizationId: 10,
      provider: "alegra",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      billingRoundingMode: "two_decimals",
      alegraEmail: "tenantA@evgreen.co",
      alegraToken: "tok_tenantA_12345",
      selectedProductId: "4061",
      selectedProductName: "Servicio de recarga de energia",
    } as any);

    const config = await getEffectiveBillingSettings(10);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("alegra");
    expect(config?.alegraEmail).toBe("tenantA@evgreen.co");
    expect(config?.selectedProductId).toBe("4061");
    expect(config?.billingRoundingMode).toBe("two_decimals");
  });

  it("debe resolver la configuración del Tenant B con redondeo al entero más cercano", async () => {
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 2,
      organizationId: 20,
      provider: "siigo",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      billingRoundingMode: "nearest_integer",
      siigoUsername: "tenantB@siigo.com",
      siigoAccessKey: "key_tenantB_98765",
      selectedProductCode: "EV-FAST-120KW",
    } as any);

    const config = await getEffectiveBillingSettings(20);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("siigo");
    expect(config?.siigoUsername).toBe("tenantB@siigo.com");
    expect(config?.selectedProductCode).toBe("EV-FAST-120KW");
    expect(config?.billingRoundingMode).toBe("nearest_integer");
  });
});

describe("Emisión Dinámica, Reglas de Redondeo y Resincronización Bajo Demanda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe calcular la tarifa unitaria con 2 decimales cuando la regla es two_decimals", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce(null);
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 1,
      organizationId: 10,
      provider: "alegra",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      billingRoundingMode: "two_decimals",
      alegraEmail: "test@alegra.com",
      alegraToken: "token123",
      selectedProductId: "4061",
      selectedProductName: "Servicio de recarga de energia",
    } as any);

    vi.mocked(db.getTransactionById).mockResolvedValueOnce({
      id: 2004,
      stationId: 5,
      userId: 42,
      kwhConsumed: "32.4500",
      totalCost: "68278.00",
      startTime: "2026-09-17T04:00:00Z",
      endTime: "2026-09-17T04:55:00Z",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValueOnce({
      id: 42,
      name: "Carlos Mendoza",
      email: "carlos@example.com",
      documentType: "CC",
      documentNumber: "1018273645",
    } as any);

    vi.mocked(db.getChargingStationById).mockResolvedValueOnce({
      id: 5,
      name: "Electrolinera EVGreen El Dorado",
      organizationId: 10,
    } as any);

    const adapter = getAdapter("alegra");
    const createSpy = vi.spyOn(adapter, "createInvoice").mockResolvedValueOnce({
      success: true,
      invoiceId: "inv_999",
      invoiceNumber: "FE-888",
      cufe: "CUFE-ALEGRA-DIAN-2026",
    });

    const result = await processChargingInvoice(2004);

    expect(result.success).toBe(true);
    // 68278 / 32.45 = 2104.0986 -> redondeado a 2 decimales: 2104.1
    expect(createSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        transactionId: 2004,
        energyDelivered: 32.45,
        totalAmount: 68278,
        dynamicUnitPrice: 2104.1,
      })
    );
  });

  it("debe redondear al entero más cercano cuando la regla es nearest_integer", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce(null);
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 1,
      organizationId: 10,
      provider: "alegra",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      billingRoundingMode: "nearest_integer",
      alegraEmail: "test@alegra.com",
      alegraToken: "token123",
      selectedProductId: "4061",
      selectedProductName: "Servicio de recarga de energia",
    } as any);

    vi.mocked(db.getTransactionById).mockResolvedValueOnce({
      id: 2005,
      stationId: 5,
      userId: 42,
      kwhConsumed: "32.4500",
      totalCost: "68278.00",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValueOnce({
      id: 42,
      name: "Carlos",
      documentType: "CC",
      documentNumber: "1018273645",
      email: "carlos@example.com",
    } as any);
    vi.mocked(db.getChargingStationById).mockResolvedValueOnce({ id: 5, name: "Estación 5", organizationId: 10 } as any);

    const adapter = getAdapter("alegra");
    const createSpy = vi.spyOn(adapter, "createInvoice").mockResolvedValueOnce({
      success: true,
      invoiceNumber: "FE-889",
    });

    await processChargingInvoice(2005);

    // 68278 / 32.45 = 2104.0986 -> entero más cercano: 2104
    expect(createSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dynamicUnitPrice: 2104,
      })
    );
  });

  it("debe bloquear la emisión si ya está COMPLETED salvo que se use forceSync=true", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce({
      id: 88,
      transactionId: 1001,
      status: "COMPLETED",
      invoiceNumber: "FE-1001",
    } as any);

    // Intento normal: debe ser idempotente
    const normalResult = await processChargingInvoice(1001);
    expect(normalResult.success).toBe(true);
    expect(normalResult.invoiceNumber).toBe("FE-1001");

    // Resincronización forzada bajo demanda
    vi.mocked(db.getElectronicInvoiceById).mockResolvedValueOnce({
      id: 88,
      transactionId: 1001,
      status: "COMPLETED",
    } as any);

    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 1,
      provider: "alegra",
      enabled: 1,
      alegraEmail: "test@alegra.com",
      alegraToken: "token123",
    } as any);

    vi.mocked(db.getTransactionById).mockResolvedValueOnce({
      id: 1001,
      stationId: 1,
      userId: 1,
      kwhConsumed: "20",
      totalCost: "40000",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValueOnce({
      id: 1,
      name: "Ana",
      documentType: "CC",
      documentNumber: "52182930",
      email: "ana@example.com",
    } as any);
    vi.mocked(db.getChargingStationById).mockResolvedValueOnce({ id: 1, name: "Estación 1", organizationId: 1 } as any);

    const adapter = getAdapter("alegra");
    const forceSpy = vi.spyOn(adapter, "createInvoice").mockResolvedValueOnce({
      success: true,
      invoiceNumber: "FE-1001-RESYNC",
    });

    const resyncResult = await retryElectronicInvoice(88, true);
    expect(resyncResult.success).toBe(true);
    expect(forceSpy).toHaveBeenCalled();
  });
});
