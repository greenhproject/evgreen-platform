/**
 * Invoice Builder for EVGreen Charging Transactions
 * 
 * Builds Alegra invoices from completed charging transactions,
 * with discriminated line items for each billing concept.
 */

import type { AlegraCredentials, AlegraInvoice, AlegraInvoiceItem } from "./alegra-service";
import {
  syncContact,
  createInvoice,
  sendInvoiceByEmail,
  type AlegraInvoiceResponse,
} from "./alegra-service";

// ============================================================================
// TYPES
// ============================================================================

export interface ChargingTransactionData {
  transactionId: number;
  // User info
  userName: string;
  userEmail: string;
  userPhone?: string;
  userDocumentType?: string;
  userDocumentNumber?: string;
  userFiscalAddress?: string;
  userFiscalCity?: string;
  userFiscalDepartment?: string;
  userKindOfPerson?: string;
  userRegime?: string;
  userAlegraContactId?: string;
  // Transaction details
  energyDelivered: number;     // kWh
  appliedPricePerKwh: number;  // COP/kWh
  energyCost: number;          // COP
  timeCost: number;            // COP
  sessionCost: number;         // COP (connection fee)
  overstayCost: number;        // COP
  totalAmount: number;         // COP
  // Station info
  stationName: string;
  stationAddress?: string;
  stationCity?: string;
  connectorType?: string;
  chargeType?: string;
  // Dates
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  alegraContactId?: string;
  error?: string;
}

export interface AlegraConfig {
  credentials: AlegraCredentials;
  defaultItemId?: string;
  defaultTaxId?: string;
  autoInvoice: boolean;
  paymentMethodId?: string;
  paymentAccountId?: string;
}

// ============================================================================
// CONTACT SYNC
// ============================================================================

/**
 * Map document type from our system to Alegra's identification type
 */
function mapDocumentType(docType?: string): "CC" | "NIT" | "CE" | "TI" | "PA" | "PEP" | "DIE" {
  switch (docType) {
    case "CC": return "CC";
    case "NIT": return "NIT";
    case "CE": return "CE";
    case "PASAPORTE": return "PA";
    case "TI": return "TI";
    case "PEP": return "PEP";
    default: return "CC"; // Default to CC
  }
}

/**
 * Parse a full name into first/last name components
 */
function parseNameObject(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  } else if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  } else if (parts.length === 3) {
    return { firstName: parts[0], secondName: parts[1], lastName: parts[2] };
  } else {
    return {
      firstName: parts[0],
      secondName: parts[1],
      lastName: parts[2],
      secondLastName: parts.slice(3).join(" "),
    };
  }
}

/**
 * Sync user as a contact in Alegra
 */
async function syncUserContact(
  config: AlegraConfig,
  tx: ChargingTransactionData
): Promise<string> {
  const contactData = {
    name: tx.userName,
    identification: tx.userDocumentNumber || "",
    email: tx.userEmail,
    phonePrimary: tx.userPhone,
    kindOfPerson: (tx.userKindOfPerson as any) || "PERSON_ENTITY",
    regime: (tx.userRegime as any) || "SIMPLIFIED_REGIME",
    nameObject: parseNameObject(tx.userName),
    identificationObject: tx.userDocumentNumber ? {
      type: mapDocumentType(tx.userDocumentType),
      number: tx.userDocumentNumber,
    } : undefined,
    address: tx.userFiscalAddress ? {
      address: tx.userFiscalAddress,
      city: tx.userFiscalCity || "",
      department: tx.userFiscalDepartment || "",
      country: "Colombia",
    } : undefined,
    settings: {
      sendElectronicDocuments: true,
    },
  };

  // If we already have an Alegra contact ID, update it
  if (tx.userAlegraContactId) {
    try {
      const { updateContact } = await import("./alegra-service");
      await updateContact(config.credentials, tx.userAlegraContactId, contactData);
      return tx.userAlegraContactId;
    } catch (error) {
      console.warn(`[Alegra] Failed to update contact ${tx.userAlegraContactId}, will sync:`, error);
    }
  }

  return syncContact(config.credentials, contactData);
}

// ============================================================================
// INVOICE LINE ITEMS
// ============================================================================

/**
 * Build discriminated line items from a charging transaction
 */
function buildLineItems(
  tx: ChargingTransactionData,
  config: AlegraConfig
): AlegraInvoiceItem[] {
  const items: AlegraInvoiceItem[] = [];
  const taxArray = config.defaultTaxId ? [{ id: parseInt(config.defaultTaxId) }] : [];

  // 1. Energy cost (kWh consumed x tariff)
  if (tx.energyCost > 0 && tx.energyDelivered > 0) {
    const item: AlegraInvoiceItem = {
      description: `Servicio de carga de vehículo eléctrico - ${tx.stationName}. ${tx.energyDelivered.toFixed(2)} kWh a $${tx.appliedPricePerKwh.toLocaleString("es-CO")}/kWh. Conector: ${tx.connectorType || "N/A"}, Tipo: ${tx.chargeType || "N/A"}`,
      price: tx.appliedPricePerKwh,
      quantity: parseFloat(tx.energyDelivered.toFixed(2)),
      tax: taxArray,
    };
    // If we have a default item ID, use it
    if (config.defaultItemId) {
      item.id = parseInt(config.defaultItemId);
    } else {
      item.name = "Servicio de carga EV - Energía";
    }
    items.push(item);
  }

  // 2. Connection fee (session cost)
  if (tx.sessionCost > 0) {
    items.push({
      name: "Tarifa de conexión",
      description: `Tarifa de conexión por sesión de carga en ${tx.stationName}`,
      price: tx.sessionCost,
      quantity: 1,
      tax: taxArray,
    });
  }

  // 3. Time cost
  if (tx.timeCost > 0) {
    items.push({
      name: "Cargo por tiempo",
      description: `Cargo por tiempo de uso del cargador (${tx.durationMinutes} minutos)`,
      price: tx.timeCost,
      quantity: 1,
      tax: taxArray,
    });
  }

  // 4. Overstay penalty
  if (tx.overstayCost > 0) {
    items.push({
      name: "Penalización por sobreestadía",
      description: `Penalización por permanencia excesiva después de completar la carga en ${tx.stationName}`,
      price: tx.overstayCost,
      quantity: 1,
      tax: taxArray,
    });
  }

  return items;
}

// ============================================================================
// MAIN: Create Invoice for Charging Transaction
// ============================================================================

/**
 * Create a complete invoice in Alegra for a charging transaction.
 * 
 * Flow:
 * 1. Sync user as Alegra contact
 * 2. Build line items with discriminated concepts
 * 3. Create invoice with payment
 * 4. Send invoice by email
 */
export async function createChargingInvoice(
  config: AlegraConfig,
  tx: ChargingTransactionData
): Promise<InvoiceResult> {
  try {
    console.log(`[Alegra] Creating invoice for transaction #${tx.transactionId}`);

    // 1. Sync contact
    const alegraContactId = await syncUserContact(config, tx);
    console.log(`[Alegra] Contact synced: ${alegraContactId}`);

    // 2. Build line items
    const items = buildLineItems(tx, config);
    if (items.length === 0) {
      console.warn(`[Alegra] No billable items for transaction #${tx.transactionId}`);
      return { success: false, error: "No hay conceptos facturables", alegraContactId };
    }

    // 3. Build invoice
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // yyyy-MM-dd

    const invoice: AlegraInvoice = {
      date: dateStr,
      dueDate: dateStr, // De contado
      client: parseInt(alegraContactId),
      items,
      status: "open",
      stamp: { generateStamp: true }, // Facturación electrónica DIAN
      anotation: `Recibo de carga #${tx.transactionId} - Estación: ${tx.stationName}${tx.stationAddress ? ` (${tx.stationAddress})` : ""}. Fecha de carga: ${tx.startTime.toLocaleDateString("es-CO")} ${tx.startTime.toLocaleTimeString("es-CO")}. Duración: ${tx.durationMinutes} min. Energía: ${tx.energyDelivered.toFixed(2)} kWh.`,
      observations: `Transacción EVGreen #${tx.transactionId}. Generada automáticamente.`,
    };

    // Add payment if we have payment method configured
    if (config.paymentMethodId && tx.totalAmount > 0) {
      invoice.payments = [{
        date: dateStr,
        amount: tx.totalAmount,
        paymentMethod: config.paymentMethodId,
        ...(config.paymentAccountId ? { account: { id: parseInt(config.paymentAccountId) } } : {}),
      }];
    }

    // 4. Create invoice in Alegra
    const result = await createInvoice(config.credentials, invoice);
    console.log(`[Alegra] Invoice created: ${result.id} (${result.numberTemplate?.fullNumber || "N/A"})`);

    // 5. Send by email
    if (tx.userEmail) {
      const emails = [tx.userEmail];
      await sendInvoiceByEmail(config.credentials, result.id, emails, {
        sendCopyToUser: true,
        invoiceType: "original",
        emailMessage: {
          subject: `Factura de carga EVGreen #${tx.transactionId}`,
          body: `Estimado(a) ${tx.userName},\n\nAdjunto encontrará la factura electrónica correspondiente a su servicio de carga de vehículo eléctrico en la estación ${tx.stationName}.\n\nGracias por usar EVGreen.\nwww.evgreen.lat`,
        },
      });
    }

    return {
      success: true,
      invoiceId: result.id,
      invoiceNumber: result.numberTemplate?.fullNumber,
      alegraContactId,
    };
  } catch (error: any) {
    console.error(`[Alegra] Error creating invoice for transaction #${tx.transactionId}:`, error);
    return {
      success: false,
      error: error.message || "Error desconocido al crear factura",
    };
  }
}
