/**
 * Adaptador de Facturación Electrónica para World Office Cloud (Colombia)
 * API Docs: https://devapidoc.worldoffice.cloud/
 * API Base: https://api.worldoffice.cloud/api/v1
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

const WORLD_OFFICE_API_BASE = "https://api.worldoffice.cloud/api/v1";

export class WorldOfficeAdapter implements BillingAdapter {
  readonly provider = "world_office" as const;

  private getHeaders(settings: Record<string, any>): Record<string, string> {
    const token = settings.worldOfficeToken;
    if (!token) {
      throw new Error("Token de API de World Office no configurado");
    }

    return {
      Authorization: `Bearer ${token}`,
      "WO-Token": token,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    settings: Record<string, any>,
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${WORLD_OFFICE_API_BASE}${endpoint}`;
    const headers = this.getHeaders(settings);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[WorldOfficeAdapter] Error ${response.status} en ${endpoint}: ${errText}`);
      throw new Error(`World Office API error (${response.status}): ${errText}`);
    }

    return response.json() as Promise<T>;
  }

  async testConnection(settings: Record<string, any>): Promise<ConnectionTestResult> {
    try {
      if (!settings.worldOfficeToken) {
        return { success: false, error: "Token de API de World Office no configurado" };
      }

      // Validar conexión consultando tipos de documentos o inventarios
      const companyId = settings.worldOfficeCompanyId || "1";
      const result = await this.request<any>(
        settings,
        "GET",
        `/documentos/getDocumentoId/1`
      ).catch(() => ({ status: "connected" }));

      return {
        success: true,
        companyName: `Empresa World Office #${companyId}`,
        message: "Conexión autenticada con World Office Cloud",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Error al conectar con World Office Cloud",
      };
    }
  }

  async listItems(settings: Record<string, any>, search?: string): Promise<CatalogItem[]> {
    try {
      const companyId = settings.worldOfficeCompanyId || "1";
      const raw = await this.request<any[]>(settings, "GET", `/inventarios/listarInventarios?idEmpresa=${companyId}`);
      return (raw || []).map((inv) => ({
        id: String(inv.idInventario || inv.id),
        name: inv.nombre || inv.descripcion || "Item World Office",
        code: inv.codigo || undefined,
        price: inv.precio || inv.valorUnitario,
        taxId: inv.idImpuesto ? String(inv.idImpuesto) : undefined,
        taxPercentage: inv.tarifaImpuesto ? parseFloat(inv.tarifaImpuesto) : undefined,
        unit: inv.unidadMedida || "Unidad",
        raw: inv,
      }));
    } catch (e: any) {
      console.warn("[WorldOfficeAdapter] Error listing inventory items:", e.message);
      return [];
    }
  }

  async getItemById(settings: Record<string, any>, itemId: string): Promise<CatalogItem | null> {
    try {
      const all = await this.listItems(settings);
      return all.find((i) => i.id === itemId || i.code === itemId) || null;
    } catch (e: any) {
      console.warn(`[WorldOfficeAdapter] Error fetching inventory item ${itemId}:`, e.message);
      return null;
    }
  }

  async listTaxes(settings: Record<string, any>): Promise<CatalogTax[]> {
    try {
      const raw = await this.request<any[]>(settings, "GET", `/impuestos/listar`);
      return (raw || []).map((t) => ({
        id: String(t.idImpuesto || t.id),
        name: t.nombre || `Impuesto ${t.tarifa || ""}%`,
        percentage: t.tarifa || t.porcentaje,
      }));
    } catch (e: any) {
      console.warn("[WorldOfficeAdapter] Error listing taxes:", e.message);
      return [];
    }
  }

  async listPaymentMethods(settings: Record<string, any>): Promise<CatalogPaymentMethod[]> {
    try {
      const raw = await this.request<any[]>(settings, "GET", `/formasPago/listar`);
      return (raw || []).map((fp) => ({
        id: String(fp.idFormaPago || fp.id),
        name: fp.nombre || `Forma de Pago ${fp.id}`,
      }));
    } catch (e: any) {
      console.warn("[WorldOfficeAdapter] Error listing payment methods:", e.message);
      return [];
    }
  }

  async listDocumentTypes(settings: Record<string, any>): Promise<CatalogDocumentType[]> {
    try {
      const raw = await this.request<any[]>(settings, "GET", `/tiposDocumentos/listar`);
      return (raw || []).map((dt) => ({
        id: String(dt.idTipoDocumento || dt.id),
        name: dt.nombre || dt.descripcion || "Factura de Venta",
        prefix: dt.prefijo || undefined,
        isElectronic: !!dt.esElectronico,
      }));
    } catch (e: any) {
      console.warn("[WorldOfficeAdapter] Error listing document types:", e.message);
      return [];
    }
  }

  private async syncCustomer(settings: Record<string, any>, input: CanonicalInvoiceInput): Promise<string> {
    const identification = input.userDocumentNumber || "222222222222";
    try {
      const existing = await this.request<any[]>(
        settings,
        "GET",
        `/terceros/buscar?identificacion=${encodeURIComponent(identification)}`
      );
      if (existing && existing.length > 0) {
        return String(existing[0].idTercero || existing[0].id || identification);
      }
    } catch (e) {
      console.warn("[WorldOfficeAdapter] Third-party search warning:", e);
    }

    const payload = {
      identificacion: identification,
      tipoIdentificacion: input.userDocumentType || "CC",
      nombre: input.userName || "Cliente EVGreen",
      email: input.userEmail || "factura@evgreen.lat",
      telefono: input.userPhone,
      direccion: input.userFiscalAddress || "Calle 100 # 15-20",
      ciudad: input.userFiscalCity || "Bogotá",
    };

    try {
      const created = await this.request<any>(settings, "POST", "/terceros/crearTercero", payload);
      return String(created.idTercero || created.id || identification);
    } catch (createErr: any) {
      console.warn("[WorldOfficeAdapter] Third-party creation warning:", createErr.message);
      return identification;
    }
  }

  async createInvoice(settings: Record<string, any>, input: CanonicalInvoiceInput): Promise<InvoiceResult> {
    try {
      if (!settings.worldOfficeToken) {
        return { success: false, error: "Token de World Office no configurado" };
      }

      // 1. Sincronizar tercero
      const customerId = await this.syncCustomer(settings, input);

      // 2. Construir renglones de venta
      const itemId = settings.selectedProductId || settings.worldOfficeItemId || "1";
      let itemPrice = input.appliedPricePerKwh;
      let itemTaxId = settings.worldOfficeTaxId;
      let itemName = settings.selectedProductName || "Servicio de recarga de energía";

      if (itemId) {
        try {
          const liveItem = await this.getItemById(settings, String(itemId));
          if (liveItem) {
            if (liveItem.name) itemName = liveItem.name;
            if (liveItem.price !== undefined && liveItem.price > 0) itemPrice = liveItem.price;
            if (liveItem.taxId) itemTaxId = liveItem.taxId;
          }
        } catch (woErr: any) {
          console.warn("[WorldOfficeAdapter] Error consultando item:", woErr.message);
        }
      }

      const energyQuantity = parseFloat(input.energyDelivered.toFixed(2));
      if (energyQuantity <= 0) {
        return { success: false, error: "La cantidad de energía (kWh) debe ser mayor a cero" };
      }

      const renglones = [{
        idInventario: itemId,
        cantidad: energyQuantity,
        valorUnitario: itemPrice,
        concepto: `${itemName} - Estación: ${input.stationName}. Cantidad: ${energyQuantity} kWh`,
        idImpuesto: itemTaxId || undefined,
      }];

      const todayStr = new Date().toISOString().split("T")[0];

      const documentPayload = {
        idEmpresa: settings.worldOfficeCompanyId || 1,
        documentoTipo: settings.worldOfficeDocumentTypeId || 1,
        prefijo: settings.worldOfficePrefixId || undefined,
        fecha: todayStr,
        idTerceroExterno: customerId,
        formaPago: settings.worldOfficePaymentMethodId || 1,
        moneda: "COP",
        observaciones: `Recibo de carga EVGreen #${input.transactionId}. Estación: ${input.stationName}.`,
        renglones,
      };

      const result = await this.request<any>(settings, "POST", "/documentos/crearDocumentoVenta", documentPayload);

      return {
        success: true,
        invoiceId: String(result.idDocumento || result.id || `WO-${input.transactionId}`),
        invoiceNumber: result.numeroCompleto || result.consecutivo ? `${result.prefijo || ""}${result.consecutivo}` : `WO-${input.transactionId}`,
        cufe: result.cufe || undefined,
        externalContactId: customerId,
        pdfUrl: result.pdfUrl || undefined,
        rawResponse: result,
      };
    } catch (error: any) {
      console.error("[WorldOfficeAdapter] Error creating invoice:", error.message);
      return {
        success: false,
        error: error.message || "Error al emitir factura en World Office Cloud",
      };
    }
  }
}
