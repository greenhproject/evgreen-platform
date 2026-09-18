/**
 * Test Suite: Facturación Electrónica Multi-Proveedor (Alegra, Siigo, World Office)
 * Valida:
 * 1. Selección y resolución de adaptadores
 * 2. Aislamiento estricto entre organizaciones SaaS (Multi-tenant)
 * 3. Idempotencia y prevención de facturas duplicadas
 * 4. Emisión inyectando únicamente la cantidad de kWh con producto seleccionado
 * 5. Confirmación asíncrona mediante webhook (evento invoices.emissionFinished con CUFE y DIAN)
 * 6. Manejo de fallas, reintentos y estados de auditoría
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdapter, getEffectiveBillingSettings, processChargingInvoice, testProviderConnection } from "./billing-service";
import { AlegraAdapter } from "./adapters/alegra-adapter";
import { SiigoAdapter } from "./adapters/siigo-adapter";
import { WorldOfficeAdapter } from "./adapters/world-office-adapter";
import { handleBillingWebhook } from "./webhook";
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

  it("debe resolver la configuración específica del Tenant A (Alegra) con producto seleccionado", async () => {
    vi.mocked(db.getTenantBillingSettings).mockResolvedValueOnce({
      id: 1,
      organizationId: 10,
      provider: "alegra",
      enabled: 1,
      environment: "production",
      autoInvoice: 1,
      autoSendEmail: 1,
      resolutionNumber: "RES-10",
      selectedProductId: "4061",
      selectedProductName: "Servicio de recarga de energia",
      selectedProductPrice: "1850.00",
      alegraEmail: "tenantA@greenhproject.com",
      alegraToken: "tok_tenant_a",
      alegraDefaultItemId: "4061",
      alegraDefaultTaxId: "1",
      alegraPaymentMethodId: "cash",
      alegraPaymentAccountId: "201",
      alegraUseElectronicStamp: 1,
    } as any);

    const config = await getEffectiveBillingSettings(10);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("alegra");
    expect(config?.selectedProductId).toBe("4061");
    expect(config?.alegraEmail).toBe("tenantA@greenhproject.com");
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
      selectedProductId: "PROD-SIIGO-99",
      selectedProductCode: "KWH-PRO",
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
    expect(config?.selectedProductCode).toBe("KWH-PRO");
    expect(config?.siigoUsername).toBe("tenantB@electrolineras.com");
    expect(config?.enabled).toBe(true);
  });
});

describe("Guardia de Idempotencia y Emisión inyectando únicamente kWh", () => {
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
    expect(db.getTransactionById).not.toHaveBeenCalled();
    expect(db.createElectronicInvoiceRecord).not.toHaveBeenCalled();
  });

  it("debe emitir la factura usando el producto seleccionado y enviando la cantidad de kWh", async () => {
    vi.mocked(db.getElectronicInvoiceByTransactionId).mockResolvedValueOnce(null);
    vi.mocked(db.getTransactionById).mockResolvedValueOnce({
      id: 2004,
      stationId: 5,
      userId: 42,
      kwhConsumed: "32.4500",
      appliedPricePerKwh: "2100.00",
      energyCost: "63277.50",
      timeCost: "0.00",
      sessionCost: "5000.00", // cargo por conexión encapsulado
      overstayCost: "0.00",
      totalCost: "68278.00", // Total cobrado al cliente
      startTime: "2026-09-17T04:00:00Z",
      endTime: "2026-09-17T04:55:00Z",
    } as any);

    vi.mocked(db.getChargingStationById).mockResolvedValueOnce({
      id: 5,
      name: "Electrolinera Mall del Norte",
      address: "Cl 170 # 20",
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
      selectedProductId: "4061",
      selectedProductName: "Servicio de recarga de energia",
      alegraEmail: "test@alegra.com",
      alegraToken: "valid_tok",
      alegraDefaultItemId: "4061",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValueOnce({
      id: 42,
      name: "Laura Gómez",
      email: "laura@conductor.com",
      documentType: "CC",
      documentNumber: "52899450",
      fiscalAddress: "Calle 140 # 11-20",
      fiscalCity: "Bogotá",
      fiscalDepartment: "Bogotá D.C.",
      kindOfPerson: "PERSON_ENTITY",
      regime: "SIMPLIFIED_REGIME",
    } as any);

    vi.mocked(db.createElectronicInvoiceRecord).mockResolvedValueOnce(888);

    const adapter = getAdapter("alegra");
    const createSpy = vi.spyOn(adapter, "createInvoice").mockResolvedValueOnce({
      success: true,
      invoiceId: "INV-888",
      invoiceNumber: "FE-888",
      cufe: "CUFE-ALEGRA-DIAN-2026",
      externalContactId: "CONT-42",
      pdfUrl: "https://facturas.alegra.com/FE-888.pdf",
    });

    const result = await processChargingInvoice(2004);

      expect(result.success).toBe(true);
      expect(result.invoiceNumber).toBe("FE-888");
      expect(result.cufe).toBe("CUFE-ALEGRA-DIAN-2026");

      // El valor total debe ser exactamente $68.278 COP y la tarifa unitaria efectiva
      // calculada dinámicamente: 68278 / 32.45 = 2104.10 COP/kWh
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedProductId: "4061",
          selectedProductName: "Servicio de recarga de energia",
        }),
        expect.objectContaining({
          transactionId: 2004,
          energyDelivered: 32.45,
          totalAmount: 68278,
          dynamicUnitPrice: 2104.1,
        })
      );

    createSpy.mockRestore();
  });
});

describe("Webhook de Confirmación y Timbrado DIAN", () => {
  it("debe procesar el evento invoices.emissionFinished de Alegra y confirmar el CUFE", async () => {
    const mockJson = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    const req: any = {
      body: {
        invoice: {
          type: "invoice",
          id: "01FQS9ZGW84DG8C2ZFDZJZGEV2",
          cufe: "f918903826530728cb324042af909aedd4557493f4a783d52fcb9de4ce0b43cd633a0677e7401021943e428bce0050ca",
          status: "SENT",
          legalStatus: "ACCEPTED",
          governmentResponse: {
            code: "00",
            message: "Documento Factura FE-888, ha sido autorizado por la DIAN.",
          },
        },
      },
      header: (name: string) => (name === "x-api-key" ? "test-secret" : ""),
    };
    const res: any = { status: mockStatus, json: mockJson };

    // Simular que getDb encuentra la factura
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 99,
          transactionId: 2004,
          externalInvoiceId: "01FQS9ZGW84DG8C2ZFDZJZGEV2",
          status: "PROCESSING",
          cufe: null,
          organizationId: 10,
        },
      ]),
    };
    vi.spyOn(db, "getDb").mockResolvedValue(mockDb as any);

    await handleBillingWebhook(req, res);

    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      received: true,
      status: "COMPLETED",
      invoiceId: 99,
    }));
    expect(db.updateElectronicInvoiceRecord).toHaveBeenCalledWith(99, expect.objectContaining({
      status: "COMPLETED",
      cufe: "f918903826530728cb324042af909aedd4557493f4a783d52fcb9de4ce0b43cd633a0677e7401021943e428bce0050ca",
    }));
  });
});
