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
      const query = search ? `?name=${encodeURIComponent(search)}` : "";
      const raw = await alegraRequest<any[]>(credentials, "GET", `/items${query}`);
      return (raw || []).map((it) => ({
        id: String(it.id),
        name: it.name,
        code: it.reference || undefined,
        price: Array.isArray(it.price) ? it.price[0]?.price : it.price,
      }));
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing items:", e.message);
      return [];
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
      const items: any[] = [];
      const taxArray = settings.alegraDefaultTaxId ? [{ id: parseInt(settings.alegraDefaultTaxId) }] : [];

      // Ítem 1: Servicio de recarga de energía (kWh)
      if (input.energyDelivered > 0 || input.energyCost > 0) {
        const energyLine: any = {
          price: input.appliedPricePerKwh,
          quantity: parseFloat(input.energyDelivered.toFixed(2)),
          description: `Servicio de recarga de energía - ${input.stationName}. ${input.energyDelivered.toFixed(2)} kWh a $${input.appliedPricePerKwh.toLocaleString("es-CO")}/kWh.`,
          tax: taxArray,
        };
        if (settings.alegraDefaultItemId) {
          energyLine.id = parseInt(settings.alegraDefaultItemId);
        } else {
          energyLine.name = "Servicio de recarga de energía";
        }
        items.push(energyLine);
      }

      // Ítems adicionales (cargo por sesión, tiempo, sobreestadía) si existen
      if (input.sessionCost > 0) {
        items.push({
          name: "Tarifa de conexión",
          description: `Tarifa de conexión en ${input.stationName}`,
          price: input.sessionCost,
          quantity: 1,
          tax: taxArray,
        });
      }
      if (input.timeCost > 0) {
        items.push({
          name: "Cargo por tiempo",
          description: `Cargo por tiempo de uso (${input.durationMinutes} min)`,
          price: input.timeCost,
          quantity: 1,
          tax: taxArray,
        });
      }
      if (input.overstayCost > 0) {
        items.push({
          name: "Penalización por sobreestadía",
          description: `Permanencia excesiva en conector de ${input.stationName}`,
          price: input.overstayCost,
          quantity: 1,
          tax: taxArray,
        });
      }

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
