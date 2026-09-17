/**
 * Servicio Central de Facturación Electrónica Multi-Proveedor para EVGreen
 * Orquesta la emisión para Alegra, Siigo Nube y World Office Cloud
 * Garantiza idempotencia, aislamiento por organización y desacoplamiento con OCPP
 */

import * as db from "../db";
import type {
  BillingAdapter,
  BillingProviderType,
  CanonicalInvoiceInput,
  CatalogDocumentType,
  CatalogItem,
  CatalogPaymentMethod,
  CatalogTax,
  ConnectionTestResult,
  InvoiceResult,
} from "./types";
import { AlegraAdapter } from "./adapters/alegra-adapter";
import { SiigoAdapter } from "./adapters/siigo-adapter";
import { WorldOfficeAdapter } from "./adapters/world-office-adapter";

// Instancias de adaptadores disponibles
const adapters: Record<BillingProviderType, BillingAdapter> = {
  alegra: new AlegraAdapter(),
  siigo: new SiigoAdapter(),
  world_office: new WorldOfficeAdapter(),
};

/**
 * Obtiene el adaptador según el proveedor configurado.
 */
export function getAdapter(provider: BillingProviderType): BillingAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Proveedor de facturación no soportado: ${provider}`);
  }
  return adapter;
}

/**
 * Resuelve la configuración efectiva de facturación para una organización,
 * con fallback a platformSettings para compatibilidad previa.
 */
export async function getEffectiveBillingSettings(organizationId?: number | null): Promise<{
  provider: BillingProviderType;
  enabled: boolean;
  environment: "sandbox" | "production";
  autoInvoice: boolean;
  autoSendEmail: boolean;
  resolutionNumber?: string;
  [key: string]: any;
} | null> {
  // 1. Buscar en la tabla tenant_billing_settings por organización
  const tenantConfig = await db.getTenantBillingSettings(organizationId);

  if (tenantConfig && tenantConfig.enabled) {
    return {
      ...tenantConfig,
      provider: tenantConfig.provider as BillingProviderType,
      enabled: !!tenantConfig.enabled,
      environment: (tenantConfig.environment as any) || "production",
      autoInvoice: tenantConfig.autoInvoice !== 0,
      autoSendEmail: tenantConfig.autoSendEmail !== 0,
      resolutionNumber: tenantConfig.resolutionNumber || undefined,
    };
  }

  // 2. Fallback de compatibilidad con platform_settings (Alegra legacy)
  const legacy = await db.getPlatformSettings();
  if (legacy && legacy.alegraEnabled && legacy.alegraEmail && legacy.alegraToken) {
    return {
      provider: "alegra",
      enabled: true,
      environment: legacy.alegraTestMode ? "sandbox" : "production",
      autoInvoice: legacy.alegraAutoInvoice !== 0,
      autoSendEmail: true,
      resolutionNumber: legacy.alegraResolutionNumber || undefined,
      alegraEmail: legacy.alegraEmail,
      alegraToken: legacy.alegraToken,
      alegraDefaultItemId: legacy.alegraDefaultItemId || undefined,
      alegraDefaultTaxId: legacy.alegraDefaultTaxId || undefined,
      alegraPaymentMethodId: legacy.alegraPaymentMethodId || undefined,
      alegraPaymentAccountId: legacy.alegraPaymentAccountId || undefined,
      alegraUseElectronicStamp: 1,
    };
  }

  return null;
}

/**
 * Encola la emisión de factura electrónica de manera asíncrona y no bloqueante.
 * Diseñado para ser llamado desde CSMS StopTransaction sin retrasar la respuesta OCPP.
 */
export async function queueChargingInvoice(transactionId: number): Promise<void> {
  setImmediate(async () => {
    try {
      await processChargingInvoice(transactionId);
    } catch (err: any) {
      console.error(`[BillingService] Error procesando factura en background para tx=${transactionId}:`, err.message);
    }
  });
}

/**
 * Procesa la factura electrónica para una transacción completada.
 * Implementa guardia de idempotencia estricta para evitar duplicaciones.
 */
export async function processChargingInvoice(transactionId: number): Promise<InvoiceResult> {
  console.log(`[BillingService] Procesando factura para transacción #${transactionId}...`);

  // 1. Guardia de idempotencia: verificar si ya existe un registro
  const existingRecord = await db.getElectronicInvoiceByTransactionId(transactionId);
  if (existingRecord) {
    if (existingRecord.status === "COMPLETED") {
      console.log(`[BillingService] Transacción #${transactionId} ya tiene factura completada: ${existingRecord.invoiceNumber}`);
      return {
        success: true,
        invoiceId: existingRecord.externalInvoiceId || undefined,
        invoiceNumber: existingRecord.invoiceNumber || undefined,
        cufe: existingRecord.cufe || undefined,
        pdfUrl: existingRecord.pdfUrl || undefined,
      };
    }
    if (existingRecord.status === "PROCESSING") {
      console.warn(`[BillingService] Transacción #${transactionId} ya está en procesamiento.`);
      return { success: false, error: "La factura ya está en proceso de emisión" };
    }
  }

  // 2. Obtener datos de la transacción
  const tx = await db.getTransactionById(transactionId);
  if (!tx) {
    return { success: false, error: `Transacción #${transactionId} no encontrada` };
  }

  const kwh = parseFloat(String(tx.kwhConsumed || 0));
  const totalCost = parseFloat(String(tx.totalCost || 0));
  const energyCost = parseFloat(String(tx.energyCost || 0));
  const timeCost = parseFloat(String(tx.timeCost || 0));
  const sessionCost = parseFloat(String(tx.sessionCost || 0));
  const overstayCost = parseFloat(String(tx.overstayCost || 0));

  if (totalCost <= 0 && kwh <= 0) {
    console.log(`[BillingService] Transacción #${transactionId} no tiene monto facturable.`);
    return { success: false, error: "Transacción sin valor facturable" };
  }

  // 3. Resolver estación y organización propietaria
  const station = tx.stationId ? await db.getChargingStationById(tx.stationId) : null;
  const organizationId = station?.organizationId || null;

  // 4. Resolver configuración de facturación para la organización
  const settings = await getEffectiveBillingSettings(organizationId);
  if (!settings || !settings.enabled) {
    console.log(`[BillingService] Facturación electrónica desactivada para organización ${organizationId || 'global'}.`);
    return { success: false, error: "Facturación electrónica no habilitada para esta organización" };
  }

  if (!settings.autoInvoice) {
    console.log(`[BillingService] Facturación automática apagada en organización ${organizationId || 'global'}.`);
    return { success: false, error: "Facturación automática desactivada" };
  }

  // 5. Obtener usuario / cliente
  const user = tx.userId ? await db.getUserById(tx.userId) : null;
  const userName = user?.name || "Cliente EVGreen";
  const userEmail = user?.email || "";
  const userPhone = user?.phone || undefined;
  const userDocType = (user as any)?.documentType || "CC";
  const userDocNumber = (user as any)?.documentNumber || undefined;

  const appliedPricePerKwh = tx.appliedPricePerKwh
    ? parseFloat(String(tx.appliedPricePerKwh))
    : (kwh > 0 ? Math.round(energyCost / kwh) : 1800);

  const startTime = tx.startTime ? new Date(tx.startTime) : new Date();
  const endTime = tx.endTime ? new Date(tx.endTime) : new Date();
  const durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));

  const canonicalInput: CanonicalInvoiceInput = {
    transactionId,
    userId: tx.userId || undefined,
    userName,
    userEmail,
    userPhone,
    userDocumentType: userDocType,
    userDocumentNumber: userDocNumber,
    userFiscalAddress: (user as any)?.fiscalAddress || undefined,
    userFiscalCity: (user as any)?.fiscalCity || undefined,
    userFiscalDepartment: (user as any)?.fiscalDepartment || undefined,
    userKindOfPerson: (user as any)?.kindOfPerson || "PERSON_ENTITY",
    userRegime: (user as any)?.regime || "SIMPLIFIED_REGIME",
    userExternalContactId: settings.provider === "alegra" ? (user as any)?.alegraContactId
      : settings.provider === "siigo" ? (user as any)?.siigoCustomerId
      : (user as any)?.worldOfficeCustomerId || undefined,
    energyDelivered: kwh,
    appliedPricePerKwh,
    energyCost,
    timeCost,
    sessionCost,
    overstayCost,
    totalAmount: Math.round(totalCost),
    stationName: station?.name || "Estación EVGreen",
    stationAddress: station?.address || undefined,
    stationCity: station?.city || "Colombia",
    connectorType: (tx as any).connectorType || undefined,
    chargeType: (tx as any).chargeType || undefined,
    startTime,
    endTime,
    durationMinutes,
  };

  // 6. Crear o actualizar registro en base de datos como PROCESSING
  let recordId: number;
  if (existingRecord) {
    recordId = existingRecord.id;
    await db.updateElectronicInvoiceRecord(recordId, {
      status: "PROCESSING",
      provider: settings.provider,
      attempts: (existingRecord.attempts || 0) + 1,
      lastAttemptAt: new Date().toISOString(),
    });
  } else {
    recordId = await db.createElectronicInvoiceRecord({
      organizationId,
      transactionId,
      provider: settings.provider,
      status: "PROCESSING",
      totalAmount: String(canonicalInput.totalAmount),
      energyKwh: String(canonicalInput.energyDelivered),
      customerName: userName,
      customerIdentification: userDocNumber || null,
      customerEmail: userEmail || null,
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
    });
  }

  // 7. Invocar el adaptador correspondiente
  try {
    const adapter = getAdapter(settings.provider);
    const result = await adapter.createInvoice(settings, canonicalInput);

    if (result.success) {
      console.log(`[BillingService] Factura emitida exitosamente (${settings.provider}): #${result.invoiceNumber}`);

      await db.updateElectronicInvoiceRecord(recordId, {
        status: "COMPLETED",
        externalInvoiceId: result.invoiceId || null,
        invoiceNumber: result.invoiceNumber || null,
        cufe: result.cufe || null,
        externalContactId: result.externalContactId || null,
        pdfUrl: result.pdfUrl || null,
        xmlUrl: result.xmlUrl || null,
        errorMessage: null,
      });

      // Actualizar ID del contacto externo en el usuario si aplica
      if (result.externalContactId && user?.id) {
        try {
          if (settings.provider === "alegra") {
            await db.updateUser(user.id, { alegraContactId: result.externalContactId });
          } else if (settings.provider === "siigo") {
            await db.updateUser(user.id, { siigoCustomerId: result.externalContactId } as any);
          } else if (settings.provider === "world_office") {
            await db.updateUser(user.id, { worldOfficeCustomerId: result.externalContactId } as any);
          }
        } catch (uErr) {
          console.warn("[BillingService] Error actualizando contacto externo en usuario:", uErr);
        }
      }

      return result;
    } else {
      console.warn(`[BillingService] Emisión fallida (${settings.provider}) para tx #${transactionId}: ${result.error}`);
      await db.updateElectronicInvoiceRecord(recordId, {
        status: "FAILED",
        errorMessage: result.error || "Error al emitir factura",
      });
      return result;
    }
  } catch (adapterErr: any) {
    console.error(`[BillingService] Excepción en adaptador ${settings.provider}:`, adapterErr.message);
    await db.updateElectronicInvoiceRecord(recordId, {
      status: "FAILED",
      errorMessage: adapterErr.message || "Excepción en adaptador de facturación",
    });
    return {
      success: false,
      error: adapterErr.message,
    };
  }
}

/**
 * Reintenta manualmente la emisión de una factura electrónica fallida.
 */
export async function retryElectronicInvoice(invoiceRecordId: number): Promise<InvoiceResult> {
  const record = await db.getElectronicInvoiceById(invoiceRecordId);
  if (!record) {
    return { success: false, error: "Registro de factura no encontrado" };
  }
  return processChargingInvoice(record.transactionId);
}

/**
 * Prueba la conexión con las credenciales suministradas de un proveedor.
 */
export async function testProviderConnection(
  provider: BillingProviderType,
  settings: Record<string, any>
): Promise<ConnectionTestResult> {
  const adapter = getAdapter(provider);
  return adapter.testConnection(settings);
}

/**
 * Obtiene los catálogos del proveedor para parametrización en interfaz.
 */
export async function getProviderCatalogs(
  provider: BillingProviderType,
  settings: Record<string, any>
): Promise<{
  items: CatalogItem[];
  taxes: CatalogTax[];
  paymentMethods: CatalogPaymentMethod[];
  documentTypes: CatalogDocumentType[];
}> {
  const adapter = getAdapter(provider);

  const [items, taxes, paymentMethods, documentTypes] = await Promise.all([
    adapter.listItems ? adapter.listItems(settings).catch(() => []) : Promise.resolve([]),
    adapter.listTaxes ? adapter.listTaxes(settings).catch(() => []) : Promise.resolve([]),
    adapter.listPaymentMethods ? adapter.listPaymentMethods(settings).catch(() => []) : Promise.resolve([]),
    adapter.listDocumentTypes ? adapter.listDocumentTypes(settings).catch(() => []) : Promise.resolve([]),
  ]);

  return { items, taxes, paymentMethods, documentTypes };
}
