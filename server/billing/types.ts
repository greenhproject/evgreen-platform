/**
 * Tipos e Interfaces de Facturación Electrónica Multi-Proveedor para EVGreen
 * Proveedores soportados: Alegra, Siigo Nube, World Office Cloud
 */

export type BillingProviderType = "alegra" | "siigo" | "world_office";

export interface CanonicalInvoiceInput {
  transactionId: number;
  // Datos del usuario / tercero fiscal
  userId?: number;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userDocumentType?: string; // 'CC', 'NIT', 'CE', 'PASAPORTE', 'TI', 'PEP'
  userDocumentNumber?: string;
  userFiscalAddress?: string;
  userFiscalCity?: string;
  userFiscalDepartment?: string;
  userKindOfPerson?: "PERSON_ENTITY" | "LEGAL_ENTITY" | string;
  userRegime?: "SIMPLIFIED_REGIME" | "COMMON_REGIME" | "NOT_RESPONSIBLE_FOR_IVA" | string;
  userExternalContactId?: string;
  customerSource?: "USER" | "FALLBACK";
  // Datos de la sesión de recarga y tarifa dinámica
  energyDelivered: number;     // kWh consumidos
  appliedPricePerKwh: number;  // COP/kWh aplicado en la sesión
  energyCost: number;          // COP energía
  timeCost: number;            // COP tiempo
  sessionCost: number;         // COP tarifa de conexión
  overstayCost: number;        // COP sobreestadía
  totalAmount: number;         // COP total
  dynamicUnitPrice: number;    // Tarifa efectiva facturada (total / cantidad o total directo)
  billedConceptDescription?: string;
  // Datos de la estación y conector
  stationName: string;
  stationAddress?: string;
  stationCity?: string;
  connectorType?: string;
  chargeType?: string;
  // Tiempos
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  cufe?: string;
  externalContactId?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  error?: string;
  rawResponse?: any;
}

export interface ConnectionTestResult {
  success: boolean;
  companyName?: string;
  identification?: string;
  message?: string;
  error?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  code?: string;
  price?: number;
  taxId?: string;
  taxName?: string;
  taxPercentage?: number;
  unit?: string;
  taxIncluded?: boolean;
  raw?: any;
}

export interface CatalogTax {
  id: string;
  name: string;
  percentage?: string | number;
}

export interface CatalogPaymentMethod {
  id: string;
  name: string;
}

export interface CatalogBankAccount {
  id: string;
  name: string;
  type?: string;
  status?: string;
  number?: string;
  raw?: any;
}

export interface CatalogDocumentType {
  id: string;
  name: string;
  prefix?: string;
  isElectronic?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
  startDate?: string;
  endDate?: string;
  resolutionNumber?: string;
  startNumber?: number;
  endNumber?: number;
  currentNumber?: number;
  documentType?: string;
  isCurrentValid?: boolean;
}

export interface CatalogContact {
  id: string;
  name: string;
  identification?: string;
  email?: string;
  phone?: string;
  kindOfPerson?: string;
  regime?: string;
  address?: string;
  city?: string;
  department?: string;
  type?: string[];
}

export interface BillingAdapter {
  provider: BillingProviderType;
  testConnection(settings: Record<string, any>): Promise<ConnectionTestResult>;
  createInvoice(settings: Record<string, any>, input: CanonicalInvoiceInput): Promise<InvoiceResult>;
  listItems?(settings: Record<string, any>, search?: string): Promise<CatalogItem[]>;
  getItemById?(settings: Record<string, any>, itemId: string): Promise<CatalogItem | null>;
  listTaxes?(settings: Record<string, any>): Promise<CatalogTax[]>;
  listPaymentMethods?(settings: Record<string, any>): Promise<CatalogPaymentMethod[]>;
  listBankAccounts?(settings: Record<string, any>): Promise<CatalogBankAccount[]>;
  listDocumentTypes?(settings: Record<string, any>): Promise<CatalogDocumentType[]>;
  listContacts?(settings: Record<string, any>, query?: string): Promise<CatalogContact[]>;
  getContactById?(settings: Record<string, any>, contactId: string): Promise<CatalogContact | null>;
  configureWebhook?(settings: Record<string, any>, webhookUrl: string, secret?: string): Promise<{ success: boolean; message?: string; error?: string }>;
}
