import { afterEach, describe, expect, it, vi } from "vitest";
import { AlegraAdapter } from "./adapters/alegra-adapter";

describe("AlegraAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normaliza contacto, método de pago, cuenta y resolución vigente", async () => {
    const requests: Array<{ url: string; body?: any }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, body });

      if (url.endsWith("/contacts?identification=1018273645")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/contacts")) {
        return new Response(JSON.stringify({ id: 1 }), { status: 200 });
      }
      if (url.endsWith("/items/1900")) {
        return new Response(JSON.stringify({
          id: "1900",
          name: "Servicio de recarga de energia",
          price: [{ price: 1 }],
          inventory: { unit: "service" },
          tax: [],
        }), { status: 200 });
      }
      if (url.endsWith("/number-templates")) {
        return new Response(JSON.stringify([
          {
            id: "21",
            name: "Factura vencida",
            documentType: "invoice",
            isElectronic: true,
            status: "active",
            isDefault: true,
            endDate: "2026-03-07",
          },
          {
            id: "23",
            name: "FACTURA ELECTRÓNICA DE VENTA",
            documentType: "invoice",
            isElectronic: true,
            status: "active",
            isDefault: false,
            startDate: "2026-03-13",
            endDate: "2028-03-13",
            resolutionNumber: "18764107155503",
          },
        ]), { status: 200 });
      }
      if (url.endsWith("/bank-accounts")) {
        return new Response(JSON.stringify([
          { id: "1", name: "Caja general", status: "active", type: "cash" },
        ]), { status: 200 });
      }
      if (url.endsWith("/invoices")) {
        return new Response(JSON.stringify({
          id: "invoice-1",
          numberTemplate: { fullNumber: "FV-250" },
        }), { status: 200 });
      }
      throw new Error(`Unexpected Alegra request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new AlegraAdapter();
    const result = await adapter.createInvoice({
      alegraEmail: "billing@example.com",
      alegraToken: "token",
      selectedProductId: "1900",
      selectedProductName: "Servicio de recarga de energia",
      alegraPaymentMethodId: "1",
      alegraPaymentAccountId: "11100502",
      alegraUseElectronicStamp: 1,
      autoSendEmail: 0,
    }, {
      transactionId: 1001,
      userName: "Andres Salas Lozano",
      userEmail: "andres@example.com",
      userDocumentType: "CC",
      userDocumentNumber: "1018273645",
      userKindOfPerson: "PERSON_ENTITY",
      userRegime: "SIMPLIFIED_REGIME",
      energyDelivered: 16.278,
      appliedPricePerKwh: 1423,
      energyCost: 23161,
      timeCost: 0,
      sessionCost: 0,
      overstayCost: 0,
      totalAmount: 23161,
      dynamicUnitPrice: 1423,
      billedConceptDescription: "Servicio de recarga de energia",
      stationName: "Estación EVGreen",
      startTime: new Date("2026-09-19T14:00:00Z"),
      endTime: new Date("2026-09-19T14:30:00Z"),
      durationMinutes: 30,
    });

    expect(result.success).toBe(true);
    const contactRequest = requests.find((request) => request.url.endsWith("/contacts"));
    expect(contactRequest?.body).toMatchObject({
      kindOfPerson: "PERSON_ENTITY",
      nameObject: { firstName: "Andres", lastName: "Salas Lozano" },
    });

    const invoiceRequest = requests.find((request) => request.url.endsWith("/invoices"));
    expect(invoiceRequest?.body).toMatchObject({
      client: 1,
      numberTemplate: { id: "23" },
      payments: [{ amount: 23161, paymentMethod: "cash", account: { id: 1 } }],
    });
    expect(invoiceRequest?.body.items).toEqual([
      expect.objectContaining({ id: 1900, quantity: 16.28, tax: [] }),
    ]);
  });

  it("registra las suscripciones REST con BasicAuth y evita duplicarlas", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith("/webhooks/subscriptions") && init?.method === "GET") {
        return new Response(JSON.stringify({ subscriptions: [] }), { status: 200 });
      }
      if (url.endsWith("/webhooks/subscriptions") && init?.method === "POST") {
        return new Response(JSON.stringify({ message: "Suscripción creada" }), { status: 200 });
      }
      throw new Error(`Unexpected webhook request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new AlegraAdapter();
    const result = await adapter.configureWebhook({
      alegraEmail: "billing@example.com",
      alegraToken: "rest-token",
    }, "https://evgreen.example/api/billing/webhook", "webhook-secret");

    expect(result.success).toBe(true);
    expect(requests.filter((request) => request.init?.method === "POST")).toHaveLength(2);
    expect(requests[0]?.init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("billing@example.com:rest-token").toString("base64")}`,
    });
    const postRequests = requests.filter((request) => request.init?.method === "POST");
    expect(JSON.parse(String(postRequests[1]?.init?.body))).toEqual({
      event: "edit-invoice",
      url: "evgreen.example/api/billing/webhook?secret=webhook-secret",
    });
  });
});
