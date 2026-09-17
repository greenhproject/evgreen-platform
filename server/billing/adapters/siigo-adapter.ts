/**
 * Adaptador de Facturación Electrónica para Siigo Nube (Colombia)
 * API Docs: https://developers.siigo.com/docs/siigoapi/
 * API Base: https://api.siigo.com/v1
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

const SIIGO_API_BASE = "https://api.siigo.com/v1";

interface TokenCache {
  token: string;
  expiresAt: number; // timestamp ms
}

// Caché de tokens en memoria por username
const tokenCacheMap = new Map<string, TokenCache>();

export class SiigoAdapter implements BillingAdapter {
  readonly provider = "siigo" as const;

  /**
   * Obtiene o renueva el token JWT de acceso para Siigo.
   */
  private async getAccessToken(settings: Record<string, any>): Promise<string> {
    const username = settings.siigoUsername;
    const accessKey = settings.siigoAccessKey;

    if (!username || !accessKey) {
      throw new Error("Credenciales de Siigo incompletas (username o access_key faltante)");
    }

    const cached = tokenCacheMap.get(username);
    if (cached && cached.expiresAt > Date.now() + 60 * 1000) {
      return cached.token;
    }

    const response = await fetch(`${SIIGO_API_BASE}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username,
        access_key: accessKey,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[SiigoAdapter] Error autenticando con Siigo: ${err}`);
      throw new Error(`Error de autenticación Siigo (${response.status}): ${err}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in?: number };
    const ttlSeconds = data.expires_in || 86400; // 24 horas por defecto
    tokenCacheMap.set(username, {
      token: data.access_token,
      expiresAt: Date.now() + (ttlSeconds - 300) * 1000, // Margen de 5 minutos
    });

    return data.access_token;
  }

  private async request<T>(
    settings: Record<string, any>,
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    body?: any,
    idempotencyKey?: string
  ): Promise<T> {
    const token = await this.getAccessToken(settings);
    const partnerId = settings.siigoPartnerId || "EVGreenSaaS";

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Partner-Id": partnerId,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey.slice(0, 30);
    }

    const url = `${SIIGO_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SiigoAdapter] Error ${response.status} en ${endpoint}: ${errText}`);
      throw new Error(`Siigo API error (${response.status}): ${errText}`);
    }

    return response.json() as Promise<T>;
  }

  async testConnection(settings: Record<string, any>): Promise<ConnectionTestResult> {
    try {
      if (!settings.siigoUsername || !settings.siigoAccessKey) {
        return { success: false, error: "Credenciales incompletas (username o access_key faltante)" };
      }

      await this.getAccessToken(settings);

      // Consultar perfil de la empresa o tipos de documentos para comprobar permisos
      const docTypes = await this.request<any[]>(settings, "GET", "/document-types?type=FV");

      return {
        success: true,
        companyName: `Empresa Siigo (${settings.siigoUsername})`,
        message: `Conexión exitosa con Siigo Nube (${docTypes?.length || 0} tipos de factura encontrados)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Error al conectar con Siigo Nube",
      };
    }
  }

  async listItems(settings: Record<string, any>, search?: string): Promise<CatalogItem[]> {
    try {
      const query = search ? `?code=${encodeURIComponent(search)}` : "?page_size=30";
      const raw = await this.request<{ results: any[] }>(settings, "GET", `/products${query}`);
      const list = raw?.results || (Array.isArray(raw) ? raw : []);
      return list.map((p: any) => {
        const firstTax = Array.isArray(p.taxes) && p.taxes.length > 0 ? p.taxes[0] : null;
        const priceVal = Array.isArray(p.prices) ? p.prices[0]?.price_list?.[0]?.value : undefined;
        return {
          id: String(p.id),
          name: p.name,
          code: p.code,
          price: typeof priceVal === "number" ? priceVal : (priceVal ? parseFloat(priceVal) : 0),
          taxId: firstTax?.id ? String(firstTax.id) : undefined,
          taxName: firstTax?.name || undefined,
          taxPercentage: firstTax?.percentage !== undefined ? parseFloat(String(firstTax.percentage)) : undefined,
          unit: p.unit?.name || p.unit?.code || "Unidad",
          taxIncluded: !!p.tax_included,
          raw: p,
        };
      });
    } catch (e: any) {
      console.warn("[SiigoAdapter] Error listing products:", e.message);
      return [];
    }
  }

  async getItemById(settings: Record<string, any>, itemId: string): Promise<CatalogItem | null> {
    try {
      const p = await this.request<any>(settings, "GET", `/products/${encodeURIComponent(itemId)}`);
      if (!p || !p.id) return null;
      const firstTax = Array.isArray(p.taxes) && p.taxes.length > 0 ? p.taxes[0] : null;
      const priceVal = Array.isArray(p.prices) ? p.prices[0]?.price_list?.[0]?.value : undefined;
      return {
        id: String(p.id),
        name: p.name,
        code: p.code,
        price: typeof priceVal === "number" ? priceVal : (priceVal ? parseFloat(priceVal) : 0),
        taxId: firstTax?.id ? String(firstTax.id) : undefined,
        taxName: firstTax?.name || undefined,
        taxPercentage: firstTax?.percentage !== undefined ? parseFloat(String(firstTax.percentage)) : undefined,
        unit: p.unit?.name || p.unit?.code || "Unidad",
        taxIncluded: !!p.tax_included,
        raw: p,
      };
    } catch (e: any) {
      console.warn(`[SiigoAdapter] Error fetching product ${itemId}:`, e.message);
      return null;
    }
  }

  async listTaxes(settings: Record<string, any>): Promise<CatalogTax[]> {
    try {
      const raw = await this.request<any[]>(settings, "GET", "/taxes");
      return (raw || []).map((t) => ({
        id: String(t.id),
        name: t.name,
        percentage: t.percentage,
      }));
    } catch (e: any) {
      console.warn("[SiigoAdapter] Error listing taxes:", e.message);
      return [];
    }
  }

  async listPaymentMethods(settings: Record<string, any>): Promise<CatalogPaymentMethod[]> {
    try {
      const raw = await this.request<any[]>(settings, "GET", "/payment-types?document_type=FV");
      return (raw || []).map((pt) => ({
        id: String(pt.id),
        name: pt.name,
      }));
    } catch (e: any) {
      console.warn("[SiigoAdapter] Error listing payment methods:", e.message);
      return [];
    }
  }

  async listDocumentTypes(settings: Record<string, any>): Promise<CatalogDocumentType[]> {
    try {
      const raw = await this.request<any[]>(settings, "GET", "/document-types?type=FV");
      return (raw || []).map((dt) => ({
        id: String(dt.id),
        name: dt.name,
        isElectronic: !!dt.electronic_type,
      }));
    } catch (e: any) {
      console.warn("[SiigoAdapter] Error listing document types:", e.message);
      return [];
    }
  }

  private mapIdType(docType?: string): string {
    switch (docType) {
      case "CC": return "13";
      case "NIT": return "31";
      case "CE": return "22";
      case "PASAPORTE": return "41";
      case "TI": return "12";
      case "PEP": return "47";
      default: return "13"; // Cédula de ciudadanía
    }
  }

  private async syncCustomer(settings: Record<string, any>, input: CanonicalInvoiceInput): Promise<string> {
    const identification = input.userDocumentNumber || "222222222222"; // Consumidor final si no tiene cédula
    try {
      const existing = await this.request<{ results: any[] }>(
        settings,
        "GET",
        `/customers?identification=${encodeURIComponent(identification)}`
      );
      if (existing?.results && existing.results.length > 0) {
        return existing.results[0].identification;
      }
    } catch (e) {
      console.warn("[SiigoAdapter] Customer lookup warning:", e);
    }

    // Crear cliente en Siigo
    const nameParts = (input.userName || "Cliente EVGreen").trim().split(/\s+/);
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "EVGreen";

    const customerPayload = {
      person_type: input.userKindOfPerson === "LEGAL_ENTITY" ? "Company" : "Person",
      id_type: this.mapIdType(input.userDocumentType),
      identification,
      name: [firstName, lastName],
      commercial_name: input.userName || "Cliente EVGreen",
      fiscal_responsibilities: [{ code: input.userRegime === "COMMON_REGIME" ? "O-13" : "R-99-PN" }],
      address: {
        address: input.userFiscalAddress || "Calle 100 # 15-20",
        city: {
          country_code: "Co",
          state_code: "11",
          city_code: "11001", // Bogotá por defecto
        },
      },
      contacts: [{
        first_name: firstName,
        last_name: lastName,
        email: input.userEmail || "factura@evgreen.lat",
        phone: input.userPhone ? { number: input.userPhone } : undefined,
      }],
    };

    try {
      const created = await this.request<any>(settings, "POST", "/customers", customerPayload);
      return created.identification || identification;
    } catch (createErr: any) {
      console.warn("[SiigoAdapter] Failed to create customer, falling back to identification:", createErr.message);
      return identification;
    }
  }

  async createInvoice(settings: Record<string, any>, input: CanonicalInvoiceInput): Promise<InvoiceResult> {
    try {
      if (!settings.siigoUsername || !settings.siigoAccessKey) {
        return { success: false, error: "Credenciales de Siigo no configuradas" };
      }

      // 1. Sincronizar cliente
      const customerIdentification = await this.syncCustomer(settings, input);

      // 2. Líneas de factura
      const targetCode = settings.selectedProductCode || settings.siigoProductCode || "EV-KWH-01";
      let itemPrice = input.appliedPricePerKwh;
      let itemTaxId = settings.siigoTaxId;
      let itemName = settings.selectedProductName || "Servicio de recarga de energía";

      // Intentar obtener el producto configurado en Siigo Nube
      if (settings.selectedProductId || targetCode) {
        try {
          const liveProduct = await this.getItemById(settings, String(settings.selectedProductId || targetCode));
          if (liveProduct) {
            if (liveProduct.name) itemName = liveProduct.name;
            if (liveProduct.price !== undefined && liveProduct.price > 0) itemPrice = liveProduct.price;
            if (liveProduct.taxId) itemTaxId = liveProduct.taxId;
          }
        } catch (siigoItemErr: any) {
          console.warn("[SiigoAdapter] Usando snapshot para producto:", siigoItemErr.message);
        }
      }

      const taxArray = itemTaxId ? [{ id: parseInt(itemTaxId) }] : [];
      const energyQuantity = parseFloat(input.energyDelivered.toFixed(2));
      if (energyQuantity <= 0) {
        return { success: false, error: "La cantidad de energía (kWh) debe ser mayor a cero" };
      }

      const items = [{
        code: targetCode,
        description: `${itemName} - Estación: ${input.stationName}. Cantidad: ${energyQuantity} kWh`,
        quantity: energyQuantity,
        price: itemPrice,
        taxes: taxArray,
      }];

      const todayStr = new Date().toISOString().split("T")[0];
      const docId = settings.siigoDocumentId ? parseInt(settings.siigoDocumentId) : 1;
      const sellerId = settings.siigoSellerId ? parseInt(settings.siigoSellerId) : undefined;
      const paymentTypeId = settings.siigoPaymentTypeId ? parseInt(settings.siigoPaymentTypeId) : 1;

      const invoicePayload: any = {
        document: { id: docId },
        date: todayStr,
        customer: { identification: customerIdentification },
        items,
        payments: [{
          id: paymentTypeId,
          value: input.totalAmount,
          due_date: todayStr,
        }],
        observations: `Recibo de carga EVGreen #${input.transactionId}. Estación: ${input.stationName}.`,
        stamp: {
          send: settings.siigoStamp !== 0,
        },
        mail: {
          send: settings.siigoMail !== 0 && !!input.userEmail,
        },
      };

      if (sellerId) {
        invoicePayload.seller = sellerId;
      }

      const idempotencyKey = `evg-tx-${input.transactionId}-${Date.now().toString(36)}`;
      const result = await this.request<any>(settings, "POST", "/invoices", invoicePayload, idempotencyKey);

      return {
        success: true,
        invoiceId: String(result.id),
        invoiceNumber: result.name || result.number ? `${result.prefix || ""}${result.number || result.name}` : String(result.id),
        cufe: result.cufe || undefined,
        externalContactId: customerIdentification,
        pdfUrl: result.public_url || undefined,
        rawResponse: result,
      };
    } catch (error: any) {
      console.error("[SiigoAdapter] Error creating invoice:", error.message);
      return {
        success: false,
        error: error.message || "Error al emitir factura en Siigo",
      };
    }
  }
}
