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
  CatalogContact,
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
      alegraNumberTemplateId: tenantConfig.alegraNumberTemplateId || undefined,
      alegraNumberTemplateName: tenantConfig.alegraNumberTemplateName || undefined,
      alegraNumberTemplatePrefix: tenantConfig.alegraNumberTemplatePrefix || undefined,
      alegraNumberTemplateResolution: tenantConfig.alegraNumberTemplateResolution || undefined,
      alegraPaymentMethodId: tenantConfig.alegraPaymentMethodId || "transfer",
      billingRoundingMode: (tenantConfig.billingRoundingMode as any) || "two_decimals",
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
      alegraNumberTemplateId: undefined,
      alegraEmail: legacy.alegraEmail,
      alegraToken: legacy.alegraToken,
      alegraDefaultItemId: legacy.alegraDefaultItemId || undefined,
      alegraDefaultTaxId: legacy.alegraDefaultTaxId || undefined,
      alegraPaymentMethodId: legacy.alegraPaymentMethodId || "transfer",
      alegraPaymentAccountId: legacy.alegraPaymentAccountId || undefined,
      alegraUseElectronicStamp: 1,
      billingRoundingMode: "two_decimals",
    };
  }

  return null;
}

/**
 * Emite la factura de forma durable antes de cerrar el flujo de finalización.
 *
 * El proceso anterior usaba setImmediate y devolvía antes de iniciar la emisión.
 * En runtimes autoscalables esto podía terminar el request y apagar el proceso,
 * dejando la recarga sin registro de factura. El registro PROCESSING/FAILED y la
 * idempotencia de processChargingInvoice ya permiten reintentar sin duplicar.
 */
export async function queueChargingInvoice(transactionId: number): Promise<void> {
  try {
    await processChargingInvoice(transactionId);
  } catch (err: any) {
    console.error(`[BillingService] Error procesando factura para tx=${transactionId}:`, err.message);
    throw err;
  }
}

/**
 * Procesa la factura electrónica para una transacción completada.
 * Implementa guardia de idempotencia estricta para evitar duplicaciones.
 * Si options.forceSync es verdadero, permite re-emitir o actualizar el registro
 * incluso si existía un intento previo.
 */
export async function processChargingInvoice(
  transactionId: number,
  options?: { forceSync?: boolean }
): Promise<InvoiceResult> {
  console.log(`[BillingService] Procesando factura para transacción #${transactionId} (forceSync=${!!options?.forceSync})...`);

  // 1. Guardia de idempotencia: verificar si ya existe un registro
  const existingRecord = await db.getElectronicInvoiceByTransactionId(transactionId);
  if (existingRecord && !options?.forceSync) {
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

  // 5.1 Resolver datos fiscales: usuario real vs. cliente mostrador/fallback
  let finalCustomerName = userName;
  let finalCustomerEmail = userEmail;
  let finalCustomerPhone = userPhone;
  let finalCustomerDocType = userDocType;
  let finalCustomerDocNumber = userDocNumber;
  let finalCustomerFiscalAddress = (user as any)?.fiscalAddress || undefined;
  let finalCustomerFiscalCity = (user as any)?.fiscalCity || undefined;
  let finalCustomerFiscalDepartment = (user as any)?.fiscalDepartment || undefined;
  let finalCustomerKindOfPerson = (user as any)?.kindOfPerson || "PERSON_ENTITY";
  let finalCustomerRegime = (user as any)?.regime || "SIMPLIFIED_REGIME";
  let finalCustomerExternalContactId = settings.provider === "alegra" ? (user as any)?.alegraContactId
    : settings.provider === "siigo" ? (user as any)?.siigoCustomerId
    : (user as any)?.worldOfficeCustomerId || undefined;
  let customerSource: "USER" | "FALLBACK" = "USER";

  const userHasFiscalData = !!(userDocNumber && String(userDocNumber).trim().length > 0);
  if (!userHasFiscalData) {
    if (settings.fallbackCustomerEnabled && settings.fallbackCustomerDocumentNumber) {
      console.log(`[BillingService] Usuario #${tx.userId || 0} sin datos fiscales. Usando cliente mostrador configurado.`);
      customerSource = "FALLBACK";
      finalCustomerName = settings.fallbackCustomerName || "Consumidor Final (Mostrador)";
      finalCustomerEmail = settings.fallbackCustomerEmail || userEmail || "";
      finalCustomerDocType = settings.fallbackCustomerDocumentType || "CC";
      finalCustomerDocNumber = settings.fallbackCustomerDocumentNumber;
      finalCustomerFiscalAddress = settings.fallbackCustomerAddress || "Venta mostrador";
      finalCustomerFiscalCity = settings.fallbackCustomerCity || "Colombia";
      finalCustomerFiscalDepartment = settings.fallbackCustomerDepartment || "Colombia";
      finalCustomerKindOfPerson = settings.fallbackCustomerKindOfPerson || "PERSON_ENTITY";
      finalCustomerRegime = settings.fallbackCustomerRegime || "SIMPLIFIED_REGIME";
      finalCustomerExternalContactId = settings.fallbackCustomerId || undefined;
    } else {
      console.warn(`[BillingService] Usuario #${tx.userId || 0} no tiene datos fiscales y el tenant no tiene cliente mostrador activo.`);
      return {
        success: false,
        error: "El usuario no ha registrado sus datos fiscales en la app y el tenant no tiene activo un cliente mostrador de respaldo.",
      };
    }
  }

	  // Como en Colombia la venta de energía para vehículos eléctricos está excluida de IVA
	  // (Art. 424 E.T. y Concepto DIAN 7354 de 2025), EVGreen encapsula todo el servicio cobrado
	  // en un único concepto fiscal. La tarifa del catálogo en el software contable es solo referencial;
	  // el valor final inyectado corresponde exactamente al cobro total de la sesión.
  const roundedTotal = Math.round(totalCost);
  const rawUnitPrice = kwh > 0
    ? (roundedTotal / kwh)
    : (tx.appliedPricePerKwh ? parseFloat(String(tx.appliedPricePerKwh)) : roundedTotal);
  const effectivePricePerKwh = settings.billingRoundingMode === "nearest_integer"
    ? Math.round(rawUnitPrice)
    : Number(rawUnitPrice.toFixed(2));

  const startTime = tx.startTime ? new Date(tx.startTime) : new Date();
  const endTime = tx.endTime ? new Date(tx.endTime) : new Date();
  const durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));

  const canonicalInput: CanonicalInvoiceInput = {
    transactionId,
    userId: tx.userId || undefined,
    userName: finalCustomerName,
    userEmail: finalCustomerEmail,
    userPhone: finalCustomerPhone,
    userDocumentType: finalCustomerDocType,
    userDocumentNumber: finalCustomerDocNumber,
    userFiscalAddress: finalCustomerFiscalAddress,
    userFiscalCity: finalCustomerFiscalCity,
    userFiscalDepartment: finalCustomerFiscalDepartment,
    userKindOfPerson: finalCustomerKindOfPerson,
    userRegime: finalCustomerRegime,
    userExternalContactId: finalCustomerExternalContactId,
    customerSource,
    energyDelivered: kwh,
	    appliedPricePerKwh: effectivePricePerKwh,
	    dynamicUnitPrice: effectivePricePerKwh,
	    energyCost,
	    timeCost,
	    sessionCost,
	    overstayCost,
	    totalAmount: roundedTotal,
	    billedConceptDescription: `Servicio de recarga de energía - ${station?.name || "Estación EVGreen"}. Total cobrado: $${roundedTotal.toLocaleString("es-CO")} COP.`,
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
	      totalAmount: String(canonicalInput.totalAmount),
	      billedUnitPrice: String(canonicalInput.dynamicUnitPrice),
	      billedProductId: settings.selectedProductId || null,
	      billedProductName: settings.selectedProductName || "Servicio de recarga de energía",
	      customerSource,
	      customerName: finalCustomerName,
	      customerIdentification: finalCustomerDocNumber || null,
	      customerEmail: finalCustomerEmail || null,
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
	      billedUnitPrice: String(canonicalInput.dynamicUnitPrice),
	      billedProductId: settings.selectedProductId || null,
	      billedProductName: settings.selectedProductName || "Servicio de recarga de energía",
	      energyKwh: String(canonicalInput.energyDelivered),
	      customerName: finalCustomerName,
	      customerIdentification: finalCustomerDocNumber || null,
	      customerEmail: finalCustomerEmail || null,
	      customerSource,
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

      // Si el proveedor retornó CUFE de inmediato (modo síncrono), marcamos COMPLETED;
      // de lo contrario permanece en PROCESSING hasta que el webhook reciba la aprobación DIAN
      const isConfirmed = !!result.cufe;
      await db.updateElectronicInvoiceRecord(recordId, {
        status: isConfirmed ? "COMPLETED" : "PROCESSING",
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
export async function retryElectronicInvoice(invoiceRecordId: number, forceSync: boolean = false): Promise<InvoiceResult> {
  const record = await db.getElectronicInvoiceById(invoiceRecordId);
  if (!record) {
    return { success: false, error: "Registro de factura no encontrado" };
  }
  return processChargingInvoice(record.transactionId, { forceSync });
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
 * Configura automáticamente el webhook en el proveedor por API si éste lo soporta.
 */
export async function configureProviderWebhook(
  provider: BillingProviderType,
  settings: Record<string, any>,
  webhookUrl: string,
  secret?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const adapter = getAdapter(provider);
  if (!adapter.configureWebhook) {
    return {
      success: false,
      error: `El proveedor ${provider} no soporta registro automático de webhook por API.`,
    };
  }
  return adapter.configureWebhook(settings, webhookUrl, secret);
}

/**
 * Obtiene los catálogos del proveedor para parametrización en interfaz.
 */
export async function getProviderCatalogs(
  provider: BillingProviderType,
  settings: Record<string, any>,
  search?: string,
  contactsQuery?: string
): Promise<{
  items: CatalogItem[];
  taxes: CatalogTax[];
  paymentMethods: CatalogPaymentMethod[];
  bankAccounts: any[];
  documentTypes: CatalogDocumentType[];
  contacts: CatalogContact[];
}> {
  const adapter = getAdapter(provider);

  const [items, taxes, paymentMethods, bankAccounts, documentTypes, contacts] = await Promise.all([
    adapter.listItems ? adapter.listItems(settings, search).catch(() => []) : Promise.resolve([]),
    adapter.listTaxes ? adapter.listTaxes(settings).catch(() => []) : Promise.resolve([]),
    adapter.listPaymentMethods ? adapter.listPaymentMethods(settings).catch(() => []) : Promise.resolve([]),
    adapter.listBankAccounts ? adapter.listBankAccounts(settings).catch(() => []) : Promise.resolve([]),
    adapter.listDocumentTypes ? adapter.listDocumentTypes(settings).catch(() => []) : Promise.resolve([]),
    adapter.listContacts ? adapter.listContacts(settings, contactsQuery).catch(() => []) : Promise.resolve([]),
  ]);

  return { items, taxes, paymentMethods, bankAccounts, documentTypes, contacts };
}
