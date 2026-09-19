/**
 * Adaptador de Facturación Electrónica para Alegra (Colombia)
 * API Docs: https://developer.alegra.com/reference
 */

import type {
  BillingAdapter,
  CanonicalInvoiceInput,
  CatalogBankAccount,
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
    case "PASAPORTE": return "PP";
    case "TI": return "TI";
    case "PEP": return "PEP";
    default: return "CC";
  }
}

function splitNaturalPersonName(name: string): { firstName: string; lastName: string; secondName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Cliente", lastName: "EVGreen" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "EVGreen" };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  if (parts.length === 3) {
    // En Colombia: [Primer Nombre] [Primer Apellido] [Segundo Apellido]
    // Alegra requiere firstName y lastName; secondName es opcional
    return {
      firstName: parts[0],
      secondName: undefined,
      lastName: `${parts[1]} ${parts[2]}`,
    };
  }
  return {
    firstName: parts[0],
    secondName: parts[1],
    lastName: parts.slice(2).join(" "),
  };
}

function mapColombiaPaymentMethod(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  const mapping: Record<string, string> = {
    "1": "CASH",
    "2": "DEBIT_TRANSFER",
    "3": "BANK_DEPOSIT",
    "4": "CHECK",
    "5": "CREDIT_CARD",
    "6": "DEBIT_CARD",
    "CASH": "CASH",
    "EFECTIVO": "CASH",
    "TRANSFER": "DEBIT_TRANSFER",
    "DEBIT_TRANSFER": "DEBIT_TRANSFER",
    "TRANSFERENCIA": "DEBIT_TRANSFER",
    "DEPOSIT": "BANK_DEPOSIT",
    "BANK_DEPOSIT": "BANK_DEPOSIT",
    "CONSIGNACION": "BANK_DEPOSIT",
    "CONSIGNACIÓN": "BANK_DEPOSIT",
    "CHECK": "CHECK",
    "CHEQUE": "CHECK",
    "CREDIT-CARD": "CREDIT_CARD",
    "CREDIT_CARD": "CREDIT_CARD",
    "TARJETA DE CREDITO": "CREDIT_CARD",
    "TARJETA DE CRÉDITO": "CREDIT_CARD",
    "DEBIT-CARD": "DEBIT_CARD",
    "DEBIT_CARD": "DEBIT_CARD",
    "TARJETA DE DEBITO": "DEBIT_CARD",
    "TARJETA DE DÉBITO": "DEBIT_CARD",
  };
  return mapping[raw] || "DEBIT_TRANSFER";
}

function normalizePaymentMethod(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "1": "cash",
    "2": "transfer",
    "3": "deposit",
    "4": "check",
    "5": "credit-card",
    "6": "debit-card",
    "efectivo": "cash",
    "consignacion": "deposit",
    "consignación": "deposit",
    "transferencia": "transfer",
    "cheque": "check",
    "tarjeta de credito": "credit-card",
    "tarjeta de crédito": "credit-card",
    "tarjeta de debito": "debit-card",
    "tarjeta de débito": "debit-card",
    "transefer": "transfer",
  };
  return aliases[normalized] || (['cash', 'check', 'transfer', 'deposit', 'credit-card', 'debit-card'].includes(normalized) ? normalized : "transfer");
}

function parsePositiveInteger(value: unknown): number | undefined {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
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
        id: String(pm.type || pm.id),
        name: pm.name,
      }));
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing payment methods:", e.message);
      return [];
    }
  }

  async listBankAccounts(settings: Record<string, any>): Promise<CatalogBankAccount[]> {
    try {
      const credentials = { email: settings.alegraEmail, token: settings.alegraToken };
      const raw = await alegraRequest<any[]>(credentials, "GET", "/bank-accounts");
      return (raw || []).map((account) => ({
        id: String(account.id),
        name: account.name,
        type: account.type,
        status: account.status,
        number: account.number || undefined,
        raw: account,
      }));
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing bank accounts:", e.message);
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
        isActive: nt.status === "active",
        isDefault: !!nt.isDefault,
        startDate: nt.startDate || undefined,
        endDate: nt.endDate || undefined,
        resolutionNumber: nt.resolutionNumber || undefined,
      }));
    } catch (e: any) {
      console.warn("[AlegraAdapter] Error listing number templates:", e.message);
      return [];
    }
  }

  async configureWebhook(
    settings: Record<string, any>,
    webhookUrl: string,
    secret?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!settings.alegraEmail || !settings.alegraToken) {
      return {
        success: false,
        error: "Se requieren el correo y el API Token REST de Alegra para configurar el webhook.",
      };
    }

    try {
      // La API REST estándar sí permite crear suscripciones de webhook con las
      // mismas credenciales Basic utilizadas para productos y facturas. El
      // E-Provider Bearer no es necesario para esta operación.
      const credentials: AlegraCredentials = {
        email: settings.alegraEmail,
        token: settings.alegraToken,
      };
      const current = await alegraRequest<any>(credentials, "GET", "/webhooks/subscriptions");
      const subscriptions = Array.isArray(current) ? current : (current?.subscriptions || []);
      // Alegra documenta una URL HTTP completa, pero su API REST rechaza
      // explícitamente los prefijos http:// y https:// (400). Conservamos el
      // dominio y la ruta en el formato que acepta su endpoint.
      const normalizedWebhookUrl = webhookUrl.trim().replace(/^https?:\/\//i, "");
      const securedUrl = secret
        ? `${normalizedWebhookUrl}${normalizedWebhookUrl.includes("?") ? "&" : "?"}secret=${encodeURIComponent(secret)}`
        : normalizedWebhookUrl;
      const events = ["new-invoice", "edit-invoice"] as const;
      const missingEvents = events.filter((event) => !subscriptions.some((subscription: any) =>
        subscription.event === event && String(subscription.url || "").replace(/^https?:\/\//i, "") === securedUrl
      ));

      for (const event of missingEvents) {
        await alegraRequest<any>(credentials, "POST", "/webhooks/subscriptions", {
          event,
          url: securedUrl,
        });
      }

      return {
        success: true,
        message: missingEvents.length > 0
          ? `Webhook REST registrado en Alegra para: ${missingEvents.join(" y ")}.`
          : "El webhook REST ya estaba registrado en Alegra.",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "No se pudo registrar el webhook REST en Alegra.",
      };
    }
  }

  private async resolveNumberTemplateId(credentials: AlegraCredentials, configuredValue?: unknown): Promise<string | undefined> {
    try {
      const raw = await alegraRequest<any[]>(credentials, "GET", "/number-templates");
      const today = new Date().toISOString().slice(0, 10);
      const validElectronic = (raw || []).filter((template) => {
        if (template.documentType !== "invoice" || !template.isElectronic || template.status !== "active") return false;
        if (template.startDate && today < String(template.startDate).slice(0, 10)) return false;
        if (template.endDate && today > String(template.endDate).slice(0, 10)) return false;
        return true;
      });

      const configured = String(configuredValue ?? "").trim();
      const explicit = configured
        ? validElectronic.find((template) => String(template.id) === configured || String(template.resolutionNumber || "") === configured)
        : undefined;
      const selected = explicit
        || validElectronic.find((template) => template.isDefault)
        || [...validElectronic].sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")))[0];

      if (selected?.id) {
        console.log(`[AlegraAdapter] Resolución electrónica seleccionada: ${selected.id} (${selected.name || selected.prefix || "sin nombre"})`);
        return String(selected.id);
      }
    } catch (error: any) {
      console.warn("[AlegraAdapter] No se pudo consultar la numeración electrónica:", error.message);
    }
    return undefined;
  }

  private async resolvePaymentAccountId(credentials: AlegraCredentials, configuredValue?: unknown): Promise<number | undefined> {
    try {
      const raw = await alegraRequest<any[]>(credentials, "GET", "/bank-accounts");
      const configured = String(configuredValue ?? "").trim();
      const exact = configured
        ? (raw || []).find((account) => [account.id, account.number, account.code, account.accounting?.code].some((value) => String(value ?? "") === configured))
        : undefined;
      const fallback = exact
        || (raw || []).find((account) => account.status === "active" && account.isDefault)
        || (raw || []).find((account) => account.status === "active" && /caja\s*general|principal/i.test(String(account.name || "")))
        || (raw || []).find((account) => account.status === "active");
      const accountId = parsePositiveInteger(fallback?.id);
      if (accountId) {
        if (configured && String(fallback.id) !== configured) {
          console.warn(`[AlegraAdapter] Cuenta configurada '${configured}' no es un ID válido; se usará '${fallback.name}' (#${fallback.id}).`);
        }
        return accountId;
      }
    } catch (error: any) {
      console.warn("[AlegraAdapter] No se pudo resolver la cuenta de pago:", error.message);
    }
    return undefined;
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
      ...((input.userKindOfPerson || "PERSON_ENTITY") === "PERSON_ENTITY"
        ? { nameObject: splitNaturalPersonName(input.userName || "Cliente EVGreen") }
        : {}),
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

      const parsedTaxId = parsePositiveInteger(itemTaxId);
      const taxArray = parsedTaxId ? [{ id: parsedTaxId }] : [];
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
        client: parsePositiveInteger(contactId) ?? contactId,
        items,
        status: "open",
        // Requisitos DIAN Colombia (Facturación electrónica 2.1 en Alegra)
        // 'paymentForm' (CASH = Contado, CREDIT = Crédito) es obligatorio
        paymentForm: "CASH",
        paymentMethod: mapColombiaPaymentMethod(settings.alegraPaymentMethodId),
        stamp: { generateStamp: settings.alegraUseElectronicStamp !== 0 },
        anotation: `Recibo de carga EVGreen #${input.transactionId}. Estación: ${input.stationName}. Energía: ${input.energyDelivered.toFixed(2)} kWh.`,
        observations: `Transacción EVGreen #${input.transactionId}.`,
      };

      const numberTemplateId = await this.resolveNumberTemplateId(credentials, settings.resolutionNumber);
      if (numberTemplateId) {
        invoicePayload.numberTemplate = { id: numberTemplateId };
      }

      if (input.totalAmount > 0) {
        const paymentAccountId = await this.resolvePaymentAccountId(credentials, settings.alegraPaymentAccountId);
        invoicePayload.payments = [{
          date: todayStr,
          amount: input.totalAmount,
          paymentMethod: normalizePaymentMethod(settings.alegraPaymentMethodId),
          ...(paymentAccountId ? { account: { id: paymentAccountId } } : {}),
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
