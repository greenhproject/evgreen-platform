/**
 * Test Suite: Facturación Electrónica Multi-Proveedor (Alegra, Siigo, World Office)
 * Valida:
 * 1. Selección y resolución de adaptadores
 * 2. Aislamiento estricto entre organizaciones SaaS (Multi-tenant)
 * 3. Idempotencia y prevención de facturas duplicadas
 * 4. Cálculo de líneas de energía (kWh x tarifa) y conceptos adicionales
 * 5. Manejo de fallas, reintentos y estados de auditoría
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdapter, getEffectiveBillingSettings, processChargingInvoice, testProviderConnection } from "./billing-service";
import { AlegraAdapter } from "./adapters/alegra-adapter";
import { SiigoAdapter } from "./adapters/siigo-adapter";
import { WorldOfficeAdapter } from "./adapters/world-office-adapter";
import type { CanonicalInvoiceInput } from "./types";
import * as db from "../db";

// Mock de base de datos
vi.mock("../db", async () => {
  const actual = await vi.importActual<any>("../db");
  return {
    ...actual,
    getTenantBillingSettings: vi.fn(),
    upsertTenantBillingSettings: vi.fn(),
    getPlatformSettings: vi.fn(),
    getTransactionById: vi.fn(),
    getChargingStationById: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    getElectronicInvoiceByTransactionId: vi.fn(),
    createElectronicInvoiceRecord: vi.fn(),
    updateElectronicInvoiceRecord: vi.fn(),
    getElectronicInvoiceById: vi.fn(),
    getElectronicInvoicesByOrg: vi.fn(),
  };
});

describe("Facturación Electrónica Multi-Proveedor - Adaptadores", () => {
  it("debe instanciar y retornar el adaptador correcto según el proveedor", () => {
    const alegra = getAdapter("alegra");
    expect(alegra).toBeInstanceOf(AlegraAdapter);
    expect(alegra.provider).toBe("alegra");

    const siigo = getAdapter("siigo");
    expect(siigo).toBeInstanceOf(SiigoAdapter);
    expect(siigo.provider).toBe("siigo");

    const worldOffice = getAdapter("world_office");
    expect(worldOffice).toBeInstanceOf(WorldOfficeAdapter);
    expect(worldOffice.provider).toBe("world_office");
  });

  it("debe lanzar un error descriptivo si el proveedor no está soportado", () => {
    expect(() => getAdapter("otro_proveedor" as any)).toThrow(/no soportado/i);
  });
});

describe("Aislamiento Multi-Tenant de Configuración", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe resolver la configuración específica del Tenant A (Alegra)", async () => {
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 1,
      organizationId: 10,
      provider: "alegra",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      resolutionNumber: "RES-10",
      alegraEmail: "tenantA@greenhproject.com",
      alegraToken: "tok_tenant_a",
      alegraDefaultItemId: "101",
      alegraDefaultTaxId: "1",
      alegraPaymentMethodId: "cash",
      alegraPaymentAccountId: "201",
      alegraUseElectronicStamp: 1,
    } as any);

    const config = await getEffectiveBillingSettings(10);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("alegra");
    expect(config?.alegraEmail).toBe("tenantA@greenhproject.com");
    expect(config?.resolutionNumber).toBe("RES-10");
    expect(config?.enabled).toBe(true);
  });

  it("debe resolver la configuración específica del Tenant B (Siigo Nube)", async () => {
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 2,
      organizationId: 20,
      provider: "siigo",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      resolutionNumber: "RES-20",
      siigoUsername: "tenantB@electrolineras.com",
      siigoAccessKey: "key_tenant_b",
      siigoPartnerId: "EVGreenTenantB",
      siigoDocumentId: "24",
      siigoSellerId: "5",
      siigoPaymentTypeId: "1",
      siigoProductCode: "KWH-PRO",
      siigoTaxId: "2",
      siigoStamp: 1,
      siigoMail: 1,
    } as any);

    const config = await getEffectiveBillingSettings(20);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("siigo");
    expect(config?.siigoUsername).toBe("tenantB@electrolineras.com");
    expect(config?.siigoProductCode).toBe("KWH-PRO");
    expect(config?.enabled).toBe(true);
  });

  it("debe usar fallback a platformSettings cuando una organización no tiene config propia", async () => {
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce(null);
    vi.mocked(db.getPlatformSettings).mockResolvedValueOnce({
      alegraEnabled: 1,
      alegraEmail: "global@greenhproject.com",
      alegraToken: "global_token",
      alegraTestMode: 0,
      alegraAutoInvoice: 1,
      alegraDefaultItemId: "1",
      alegraResolutionNumber: "GLOBAL-RES",
    } as any);

    const config = await getEffectiveBillingSettings(99);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("alegra");
    expect(config?.alegraEmail).toBe("global@greenhproject.com");
    expect(config?.resolutionNumber).toBe("GLOBAL-RES");
  });
});

describe("Guardia de Idempotencia y Flujo de Emisión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no debe emitir factura duplicada si la transacción ya tiene factura COMPLETED", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce({
      id: 50,
      transactionId: 1001,
      status: "COMPLETED",
      invoiceNumber: "FE-1001",
      externalInvoiceId: "INV-999",
      cufe: "CUFE1234567890ABCDEF",
      pdfUrl: "https://facturas.alegra.com/FE-1001.pdf",
    } as any);

    const result = await processChargingInvoice(1001);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBe("FE-1001");
    expect(result.cufe).toBe("CUFE1234567890ABCDEF");
    // No debe haber llamado a crear nuevo registro ni a consultar la transacción
    expect(db.getTransactionById).not.toHaveBeenCalled();
    expect(db.createElectronicInvoiceRecord).not.toHaveBeenCalled();
  });

  it("debe detenerse si la factura ya se encuentra en estado PROCESSING", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce({
      id: 51,
      transactionId: 1002,
      status: "PROCESSING",
    } as any);

    const result = await processChargingInvoice(1002);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/en proceso/i);
    expect(db.getTransactionById).not.toHaveBeenCalled();
  });

  it("debe omitir la emisión si la transacción no tiene monto ni energía facturable", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce(null);
    vi.mocked(db.getTransactionById).mockResolvedValueOnce({
      id: 1003,
      kwhConsumed: "0.0000",
      totalCost: "0.00",
    } as any);

    const result = await processChargingInvoice(1003);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sin valor facturable/i);
  });

  it("debe procesar exitosamente la recarga de energía calculando kWh x tarifa unitaria", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce(null);
    vi.mocked(db.getTransactionById).mockResolvedValueOnce({
      id: 1004,
      stationId: 5,
      userId: 42,
      kwhConsumed: "25.5000",
      appliedPricePerKwh: "1850.00",
      energyCost: "47175.00",
      timeCost: "0.00",
      sessionCost: "2500.00",
      overstayCost: "0.00",
      totalCost: "49675.00",
      startTime: "2026-09-17T04:00:00Z",
      endTime: "2026-09-17T04:45:00Z",
    } as any);

    vi.mocked(db.getChargingStationById).mockResolvedValueOnce({
      id: 5,
      name: "Electrolinera Autopista Norte",
      address: "Autopista Norte # 170",
      city: "Bogotá",
      organizationId: 10,
    } as any);

    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 1,
      organizationId: 10,
      provider: "alegra",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      alegraEmail: "test@alegra.com",
      alegraToken: "valid_tok",
      alegraDefaultItemId: "1",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValueOnce({
      id: 42,
      name: "Carlos Mendoza",
      email: "carlos@conductor.com",
      documentType: "CC",
      documentNumber: "1020304050",
      fiscalAddress: "Calle 127 # 19-30",
      fiscalCity: "Bogotá",
      fiscalDepartment: "Bogotá D.C.",
      kindOfPerson: "PERSON_ENTITY",
      regime: "SIMPLIFIED_REGIME",
    } as any);

    vi.mocked(db.createElectronicInvoiceRecord).mockResolvedValueOnce(777);

    // Mock del adaptador
    const adapter = getAdapter("alegra");
    const createSpy = vi.spyOn(adapter, "createInvoice").mockResolvedValueOnce({
      success: true,
      invoiceId: "INV-777",
      invoiceNumber: "FE-777",
      cufe: "CUFE-VALID-2026-MOCK",
      externalContactId: "CONT-42",
      pdfUrl: "https://facturas.alegra.com/FE-777.pdf",
    });

    const result = await processChargingInvoice(1004);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBe("FE-777");
    expect(result.cufe).toBe("CUFE-VALID-2026-MOCK");

    // Verificar que se registró en BD con estado COMPLETED
    expect(db.updateElectronicInvoiceRecord).toHaveBeenCalledWith(777, expect.objectContaining({
      status: "COMPLETED",
      invoiceNumber: "FE-777",
      cufe: "CUFE-VALID-2026-MOCK",
      externalContactId: "CONT-42",
    }));

    // Verificar que los datos canónicos pasados al adaptador son exactos
    expect(createSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        transactionId: 1004,
        userName: "Carlos Mendoza",
        userDocumentNumber: "1020304050",
        energyDelivered: 25.5,
        appliedPricePerKwh: 1850,
        totalAmount: 49675,
        stationName: "Electrolinera Autopista Norte",
      })
    );

    createSpy.mockRestore();
  });
});

describe("Prueba de Conexión de Proveedores", () => {
  it("debe retornar error de credenciales faltantes si se llama sin tokens", async () => {
    const resAlegra = await testProviderConnection("alegra", {});
    expect(resAlegra.success).toBe(false);
    expect(resAlegra.error).toMatch(/incompletas/i);

    const resSiigo = await testProviderConnection("siigo", {});
    expect(resSiigo.success).toBe(false);
    expect(resSiigo.error).toMatch(/incompletas/i);

    const resWO = await testProviderConnection("world_office", {});
    expect(resWO.success).toBe(false);
    expect(resWO.error).toMatch(/no configurado/i);
  });
});
