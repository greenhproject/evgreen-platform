/**
 * Adaptador de Facturación Electrónica para Alegra (Colombia)
 * API Docs: https://developer.alegra.com/reference
 */

import type {
  BillingAdapter,
  CanonicalInvoiceInput,
  CatalogDocumentType,
  CatalogItem,
  CatalogPaymentMethod,
  CatalogTax,
  ConnectionTestResult,
  InvoiceResult,
} from "../types";

const ALEGRA_API_BASE = "https://api.alegra.com/api/v1";

interface AlegraCredentials {
  email: string;
  token: string;
}

function getAuthHeader(credentials: AlegraCredentials): string {
  const token = Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64");
  return `Basic ${token}`;
}

async function alegraRequest<T>(
  credentials: AlegraCredentials,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: any
): Promise<T> {
  const url = `${ALEGRA_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: getAuthHeader(credentials),
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AlegraAdapter] Error ${response.status} en ${endpoint}: ${errorText}`);
    throw new Error(`Alegra API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

function mapDocumentType(docType?: string): string {
  switch (docType) {
    case "CC": return "CC";
    case "NIT": return "NIT";
    case "CE": return "CE";
    case "PASAPORTE": return "PA";
    case "TI": return "TI";
    case "PEP": return "PEP";
    default: return "CC";
  }
}

export class AlegraAdapter implements BillingAdapter {
  readonly provider = "alegra" as const;

  async testConnection(settings: Record<string, any>): Promise<ConnectionTestResult> {
    try {
      const email = settings.alegraEmail;
      const token = settings.alegraToken;

      if (!email || !token) {
        return { success: false, error: "Credenciales incompletas (correo o token faltante)" };
      }

      const company = await alegraRequest<{ name: string; identification?: string }>(
        { email, token },
        "GET",
        "/company"
      );

      return {
        success: true,
        companyName: company.name,
        identification: company.identification,
        message: `Conexión exitosa con ${company.name}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Error al conectar con Alegra",
      };
    }
  }

  async listItems(settings: Record<string, any>, search?: string): Promise<CatalogItem[]> {
    try {
      const credentials = { email: settings.alegraEmail, token: settings.alegraToken };
      const query = search ? `?query=${encodeURIComponent(search)}&limit=30` : "?limit=30";
      const raw = await alegraRequest<any[]>(credentials, "GET", `/items${query}`);
      const itemsList = Array.isArray(raw) ? raw : (raw as any)?.data || [];
      return (itemsList || []).map((it: any) => {
        const firstTax = Array.isArray(it.tax) && it.tax.length > 0 ? it.tax[0] : null;
        const unitPrice = Array.isArray(it.price) ? it.price[0]?.price : it.price;
        return {
          id: String(it.id),
          name: it.name,
          code: it.reference || undefined,
          price: typeof unitPrice === "number" ? unitPrice : (unitPrice ? parseFloat(unitPrice) : 0),
          taxId: firstTax?.id ? String(firstTax.id) : undefined,
          taxName: firstTax?.name || undefined,
          taxPercentage: firstTax?.percentage !== undefined ? parseFloat(String(firstTax.percentage)) : undefined,
          unit: it.inventory?.unit || "unidad",
          raw: it,
        };
      });
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing items:", e.message);
      return [];
    }
  }

  async getItemById(settings: Record<string, any>, itemId: string): Promise<CatalogItem | null> {
    try {
      const credentials = { email: settings.alegraEmail, token: settings.alegraToken };
      const it = await alegraRequest<any>(credentials, "GET", `/items/${encodeURIComponent(itemId)}`);
      if (!it || !it.id) return null;
      const firstTax = Array.isArray(it.tax) && it.tax.length > 0 ? it.tax[0] : null;
      const unitPrice = Array.isArray(it.price) ? it.price[0]?.price : it.price;
      return {
        id: String(it.id),
        name: it.name,
        code: it.reference || undefined,
        price: typeof unitPrice === "number" ? unitPrice : (unitPrice ? parseFloat(unitPrice) : 0),
        taxId: firstTax?.id ? String(firstTax.id) : undefined,
        taxName: firstTax?.name || undefined,
        taxPercentage: firstTax?.percentage !== undefined ? parseFloat(String(firstTax.percentage)) : undefined,
        unit: it.inventory?.unit || "unidad",
        raw: it,
      };
    } catch (e: any) {
      console.warn(`[AlegraAdapter] Error fetching item ${itemId}:`, e.message);
      return null;
    }
  }

  async listTaxes(settings: Record<string, any>): Promise<CatalogTax[]> {
    try {
      const credentials = { email: settings.alegraEmail, token: settings.alegraToken };
      const raw = await alegraRequest<any[]>(credentials, "GET", "/taxes");
      return (raw || []).map((t) => ({
        id: String(t.id),
        name: t.name,
        percentage: t.percentage,
      }));
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing taxes:", e.message);
      return [];
    }
  }

  async listPaymentMethods(settings: Record<string, any>): Promise<CatalogPaymentMethod[]> {
    try {
      const credentials = { email: settings.alegraEmail, token: settings.alegraToken };
      const raw = await alegraRequest<any[]>(credentials, "GET", "/payment-methods");
      return (raw || []).map((pm) => ({
        id: String(pm.id),
        name: pm.name,
      }));
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing payment methods:", e.message);
      return [];
    }
  }

  async listDocumentTypes(settings: Record<string, any>): Promise<CatalogDocumentType[]> {
    try {
      const credentials = { email: settings.alegraEmail, token: settings.alegraToken };
      const raw = await alegraRequest<any[]>(credentials, "GET", "/number-templates");
      return (raw || []).map((nt) => ({
        id: String(nt.id),
        name: nt.name,
        prefix: nt.prefix || undefined,
        isElectronic: !!nt.isElectronic,
      }));
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing number templates:", e.message);
      return [];
    }
  }

  private async syncContact(credentials: AlegraCredentials, input: CanonicalInvoiceInput): Promise<string> {
    const identification = input.userDocumentNumber || "";
    if (identification) {
      try {
        const existing = await alegraRequest<any[]>(
          credentials,
          "GET",
          `/contacts?identification=${encodeURIComponent(identification)}`
        );
        if (existing && existing.length > 0 && existing[0].id) {
          return String(existing[0].id);
        }
      } catch (err) {
        console.warn("[AlegraAdapter] Contact lookup warning:", err);
      }
    }

    // Crear contacto nuevo
    const payload = {
      name: input.userName || "Cliente EVGreen",
      identification: identification || undefined,
      email: input.userEmail,
      phonePrimary: input.userPhone,
      kindOfPerson: input.userKindOfPerson || "PERSON_ENTITY",
      regime: input.userRegime || "SIMPLIFIED_REGIME",
      identificationObject: identification ? {
        type: mapDocumentType(input.userDocumentType),
        number: identification,
      } : undefined,
      address: input.userFiscalAddress ? {
        address: input.userFiscalAddress,
        city: input.userFiscalCity || "Bogotá",
        department: input.userFiscalDepartment || "Cundinamarca",
        country: "Colombia",
      } : undefined,
    };

    const created = await alegraRequest<any>(credentials, "POST", "/contacts", payload);
    return String(created.id);
  }

  async createInvoice(settings: Record<string, any>, input: CanonicalInvoiceInput): Promise<InvoiceResult> {
    try {
      const credentials: AlegraCredentials = {
        email: settings.alegraEmail,
        token: settings.alegraToken,
      };

      if (!credentials.email || !credentials.token) {
        return { success: false, error: "Credenciales de Alegra no configuradas" };
      }

      // 1. Sincronizar o encontrar contacto
      let contactId = input.userExternalContactId;
      if (!contactId) {
        contactId = await this.syncContact(credentials, input);
      }

      // 2. Construir ítems discriminados
      const targetItemId = settings.selectedProductId || settings.alegraDefaultItemId;
      let itemTaxId = settings.alegraDefaultTaxId;
      let itemName = settings.selectedProductName || "Servicio de recarga de energía";

      // Consultar el producto configurado en Alegra para tomar su nombre e impuesto
      if (targetItemId) {
        try {
          const liveItem = await this.getItemById(settings, String(targetItemId));
          if (liveItem) {
            if (liveItem.name) itemName = liveItem.name;
            if (liveItem.taxId) {
              itemTaxId = liveItem.taxId;
            }
          }
        } catch (itemErr: any) {
          console.warn(`[AlegraAdapter] Usando snapshot local para item ${targetItemId}:`, itemErr.message);
        }
      }

      const taxArray = itemTaxId ? [{ id: parseInt(itemTaxId) }] : [];
      const energyQuantity = parseFloat(input.energyDelivered.toFixed(2));

      // Tarifa dinámica: EVGreen encapsula todo el servicio cobrado en un solo concepto.
      // Si hay kWh registrados, inyectamos cantidad = kWh y precio = total / kWh para respetar
      // la unidad física y dar la suma exacta cobrada. Si no hay kWh, cantidad = 1 y precio = total.
      const hasKwh = energyQuantity > 0;
      const billedQuantity = hasKwh ? energyQuantity : 1;
      const billedPrice = hasKwh
        ? Number((input.totalAmount / energyQuantity).toFixed(2))
        : input.totalAmount;

      const energyLine: any = {
        price: billedPrice,
        quantity: billedQuantity,
        description: input.billedConceptDescription || `${itemName} - Estación: ${input.stationName}. Cantidad: ${billedQuantity} kWh`,
        tax: taxArray,
      };

      if (targetItemId) {
        energyLine.id = parseInt(String(targetItemId));
      } else {
        energyLine.name = itemName;
      }

      const items = [energyLine];

      if (items.length === 0) {
        return { success: false, error: "No hay conceptos facturables en la transacción" };
      }

      const todayStr = new Date().toISOString().split("T")[0];

      const invoicePayload: any = {
        date: todayStr,
        dueDate: todayStr,
        client: parseInt(contactId),
        items,
        status: "open",
        stamp: { generateStamp: settings.alegraUseElectronicStamp !== 0 },
        anotation: `Recibo de carga EVGreen #${input.transactionId}. Estación: ${input.stationName}. Energía: ${input.energyDelivered.toFixed(2)} kWh.`,
        observations: `Transacción EVGreen #${input.transactionId}.`,
      };

      if (settings.resolutionNumber) {
        invoicePayload.numberTemplate = { id: settings.resolutionNumber };
      }

      if (settings.alegraPaymentMethodId && input.totalAmount > 0) {
        invoicePayload.payments = [{
          date: todayStr,
          amount: input.totalAmount,
          paymentMethod: settings.alegraPaymentMethodId,
          ...(settings.alegraPaymentAccountId ? { account: { id: parseInt(settings.alegraPaymentAccountId) } } : {}),
        }];
      }

      const created = await alegraRequest<any>(credentials, "POST", "/invoices", invoicePayload);

      // Enviar por email si está configurado
      if (settings.autoSendEmail !== 0 && input.userEmail) {
        try {
          await alegraRequest(credentials, "POST", `/invoices/${created.id}/email`, {
            emails: [input.userEmail],
            sendCopyToUser: true,
            emailMessage: {
              subject: `Factura Electrónica de carga EVGreen #${input.transactionId}`,
              body: `Hola ${input.userName},\n\nAdjuntamos la factura electrónica correspondiente a tu recarga de ${input.energyDelivered.toFixed(2)} kWh en ${input.stationName}.\n\nGracias por impulsar la movilidad eléctrica con EVGreen.`,
            },
          });
        } catch (mailErr) {
          console.warn(`[AlegraAdapter] Could not send email for invoice ${created.id}:`, mailErr);
        }
      }

      return {
        success: true,
        invoiceId: String(created.id),
        invoiceNumber: created.numberTemplate?.fullNumber || String(created.id),
        externalContactId: contactId,
        pdfUrl: created.pdf || undefined,
        rawResponse: created,
      };
    } catch (error: any) {
      console.error("[AlegraAdapter] Invoice creation error:", error.message);
      return {
        success: false,
        error: error.message || "Error al crear factura en Alegra",
      };
    }
  }
}
