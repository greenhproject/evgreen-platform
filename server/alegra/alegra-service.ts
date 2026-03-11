/**
 * Alegra API Integration Service
 * Facturación Electrónica DIAN para EVGreen
 * 
 * API Docs: https://developer.alegra.com/reference
 * Auth: Basic Auth (email:token base64)
 */

const ALEGRA_API_BASE = "https://api.alegra.com/api/v1";

// ============================================================================
// TYPES
// ============================================================================

export interface AlegraCredentials {
  email: string;
  token: string;
}

export interface AlegraContact {
  id?: string;
  name: string;
  identification: string;
  email?: string;
  phonePrimary?: string;
  mobile?: string;
  kindOfPerson?: "PERSON_ENTITY" | "LEGAL_ENTITY";
  regime?: "SIMPLIFIED_REGIME" | "COMMON_REGIME" | "NOT_RESPONSIBLE_FOR_IVA";
  nameObject?: {
    firstName?: string;
    secondName?: string;
    lastName?: string;
    secondLastName?: string;
  };
  identificationObject?: {
    type: "CC" | "NIT" | "CE" | "TI" | "PA" | "DIE" | "PEP" | "NIT_OTRO_PAIS";
    number: string;
    dv?: number;
  };
  address?: {
    address?: string;
    city?: string;
    department?: string;
    country?: string;
  };
  settings?: {
    sendElectronicDocuments?: boolean;
  };
}

export interface AlegraInvoiceItem {
  id?: number;        // ID del ítem en Alegra (si existe)
  name?: string;       // Nombre del ítem (si no tiene ID)
  description?: string;
  price: number;
  quantity: number;
  tax?: Array<{ id: number }>;
}

export interface AlegraInvoice {
  id?: string;
  date: string;        // yyyy-MM-dd
  dueDate: string;     // yyyy-MM-dd
  client: { id: number } | number;
  items: AlegraInvoiceItem[];
  status?: "open" | "draft";
  anotation?: string;  // Visible en el PDF
  observations?: string; // Notas internas
  payments?: Array<{
    date: string;
    amount: number;
    paymentMethod: string;
    account?: { id: number };
  }>;
  numberTemplate?: { id: string };
  stamp?: { generateStamp: boolean }; // Para facturación electrónica DIAN
}

export interface AlegraInvoiceResponse {
  id: string;
  numberTemplate?: { number: string; prefix: string; fullNumber: string };
  client: { id: string; name: string };
  total: number;
  status: string;
  date: string;
  pdf?: string; // URL del PDF
}

// ============================================================================
// HELPER: Make authenticated request
// ============================================================================

async function alegraRequest<T>(
  credentials: AlegraCredentials,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: any
): Promise<T> {
  const authToken = Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64");
  
  const headers: Record<string, string> = {
    "Authorization": `Basic ${authToken}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  const url = `${ALEGRA_API_BASE}${endpoint}`;
  console.log(`[Alegra] ${method} ${url}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Alegra] Error ${response.status}: ${errorText}`);
    throw new Error(`Alegra API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data as T;
}

// ============================================================================
// CONTACTS
// ============================================================================

/**
 * Search for a contact by identification number
 */
export async function findContactByIdentification(
  credentials: AlegraCredentials,
  identification: string
): Promise<AlegraContact | null> {
  try {
    const contacts = await alegraRequest<AlegraContact[]>(
      credentials,
      "GET",
      `/contacts?identification=${encodeURIComponent(identification)}`
    );
    return contacts.length > 0 ? contacts[0] : null;
  } catch (error) {
    console.error("[Alegra] Error searching contact:", error);
    return null;
  }
}

/**
 * Create a new contact in Alegra
 */
export async function createContact(
  credentials: AlegraCredentials,
  contact: AlegraContact
): Promise<AlegraContact> {
  return alegraRequest<AlegraContact>(
    credentials,
    "POST",
    "/contacts",
    contact
  );
}

/**
 * Update an existing contact in Alegra
 */
export async function updateContact(
  credentials: AlegraCredentials,
  contactId: string,
  contact: Partial<AlegraContact>
): Promise<AlegraContact> {
  return alegraRequest<AlegraContact>(
    credentials,
    "PUT",
    `/contacts/${contactId}`,
    contact
  );
}

/**
 * Create or update a contact based on identification number.
 * Returns the Alegra contact ID.
 */
export async function syncContact(
  credentials: AlegraCredentials,
  contactData: AlegraContact
): Promise<string> {
  // First, try to find existing contact
  if (contactData.identification) {
    const existing = await findContactByIdentification(credentials, contactData.identification);
    if (existing?.id) {
      // Update existing contact
      console.log(`[Alegra] Updating existing contact ${existing.id}`);
      const updated = await updateContact(credentials, existing.id, contactData);
      return updated.id || existing.id;
    }
  }

  // Create new contact
  console.log(`[Alegra] Creating new contact: ${contactData.name}`);
  const created = await createContact(credentials, contactData);
  if (!created.id) {
    throw new Error("Alegra did not return a contact ID");
  }
  return created.id;
}

// ============================================================================
// INVOICES
// ============================================================================

/**
 * Create an invoice in Alegra
 */
export async function createInvoice(
  credentials: AlegraCredentials,
  invoice: AlegraInvoice
): Promise<AlegraInvoiceResponse> {
  return alegraRequest<AlegraInvoiceResponse>(
    credentials,
    "POST",
    "/invoices",
    invoice
  );
}

/**
 * Get an invoice by ID
 */
export async function getInvoice(
  credentials: AlegraCredentials,
  invoiceId: string
): Promise<AlegraInvoiceResponse> {
  return alegraRequest<AlegraInvoiceResponse>(
    credentials,
    "GET",
    `/invoices/${invoiceId}`
  );
}

/**
 * Send an invoice by email through Alegra
 */
export async function sendInvoiceByEmail(
  credentials: AlegraCredentials,
  invoiceId: string,
  emails: string[],
  options?: {
    sendCopyToUser?: boolean;
    invoiceType?: "original" | "copy";
    emailMessage?: { subject?: string; body?: string };
  }
): Promise<boolean> {
  try {
    await alegraRequest(
      credentials,
      "POST",
      `/invoices/${invoiceId}/email`,
      {
        emails,
        sendCopyToUser: options?.sendCopyToUser ?? true,
        invoiceType: options?.invoiceType ?? "original",
        ...(options?.emailMessage ? { emailMessage: options.emailMessage } : {}),
      }
    );
    console.log(`[Alegra] Invoice ${invoiceId} sent to ${emails.join(", ")}`);
    return true;
  } catch (error) {
    console.error(`[Alegra] Error sending invoice ${invoiceId} by email:`, error);
    return false;
  }
}

// ============================================================================
// ITEMS
// ============================================================================

/**
 * Create a service item in Alegra
 */
export async function createItem(
  credentials: AlegraCredentials,
  item: {
    name: string;
    description?: string;
    price: number;
    type: "service" | "product";
    tax?: Array<{ id: number }>;
  }
): Promise<{ id: string; name: string }> {
  return alegraRequest(credentials, "POST", "/items", item);
}

/**
 * List items (products/services)
 */
export async function listItems(
  credentials: AlegraCredentials,
  search?: string
): Promise<Array<{ id: string; name: string; price: any[] }>> {
  const query = search ? `?name=${encodeURIComponent(search)}` : "";
  return alegraRequest(credentials, "GET", `/items${query}`);
}

/**
 * List available taxes
 */
export async function listTaxes(
  credentials: AlegraCredentials
): Promise<Array<{ id: string; name: string; percentage: string; type: string }>> {
  return alegraRequest(credentials, "GET", "/taxes");
}

/**
 * List payment methods
 */
export async function listPaymentMethods(
  credentials: AlegraCredentials
): Promise<Array<{ id: string; name: string }>> {
  return alegraRequest(credentials, "GET", "/payment-methods");
}

/**
 * List bank accounts
 */
export async function listBankAccounts(
  credentials: AlegraCredentials
): Promise<Array<{ id: string; name: string }>> {
  return alegraRequest(credentials, "GET", "/bank-accounts");
}

// ============================================================================
// TEST CONNECTION
// ============================================================================

/**
 * Test the Alegra API connection with given credentials
 */
export async function testConnection(
  credentials: AlegraCredentials
): Promise<{ success: boolean; companyName?: string; error?: string }> {
  try {
    const company = await alegraRequest<{ name: string; identification: string }>(
      credentials,
      "GET",
      "/company"
    );
    return { success: true, companyName: company.name };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
