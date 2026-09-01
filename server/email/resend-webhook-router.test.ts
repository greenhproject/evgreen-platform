import { afterEach, describe, expect, it, vi } from "vitest";

const { verifyWebhook, recordEvent, getWebhookSecret } = vi.hoisted(() => ({ verifyWebhook: vi.fn(), recordEvent: vi.fn(), getWebhookSecret: vi.fn() }));
vi.mock("./resend-client", () => ({
  getResendClient: async () => ({ webhooks: { verify: verifyWebhook } }),
  getResendWebhookSecret: getWebhookSecret,
}));
vi.mock("./letter-delivery-events", () => ({ recordLetterDeliveryEvent: recordEvent }));

import { handleResendWebhook } from "./resend-webhook-router";

function response() {
  const result: any = { statusCode: 200, body: undefined };
  result.status = vi.fn((code: number) => { result.statusCode = code; return result; });
  result.json = vi.fn((body: unknown) => { result.body = body; return result; });
  return result;
}

function request(overrides: Partial<any> = {}) {
  return {
    body: '{"type":"email.delivered"}',
    header: (name: string) => ({ "svix-id": "msg_test_001", "svix-timestamp": "1787082810", "svix-signature": "v1,test" } as Record<string, string>)[name] ?? "",
    ...overrides,
  } as any;
}

describe("webhook de entrega Resend", () => {
  afterEach(() => {
    verifyWebhook.mockReset();
    recordEvent.mockReset();
    getWebhookSecret.mockReset();
  });

  it("usa la clave obtenida de configuración cifrada y registra solo un payload cuya firma fue verificada", async () => {
    getWebhookSecret.mockResolvedValue("whsec_prueba_configurada");
    verifyWebhook.mockReturnValue({ type: "email.delivered", created_at: "2026-08-18T10:00:00.000Z", data: { email_id: "email-test" } });
    recordEvent.mockResolvedValue({ recorded: true, status: "DELIVERED" });
    const res = response();

    await handleResendWebhook(request(), res);

    expect(verifyWebhook).toHaveBeenCalledWith(expect.objectContaining({
      payload: '{"type":"email.delivered"}',
      webhookSecret: "whsec_prueba_configurada",
      headers: { id: "msg_test_001", timestamp: "1787082810", signature: "v1,test" },
    }));
    expect(recordEvent).toHaveBeenCalledWith("msg_test_001", expect.objectContaining({ type: "email.delivered" }));
    expect(res.statusCode).toBe(200);
  });

  it("rechaza la solicitud antes de procesarla cuando faltan cabeceras firmadas", async () => {
    getWebhookSecret.mockResolvedValue("whsec_prueba_configurada");
    const res = response();
    await handleResendWebhook(request({ header: () => "" }), res);
    expect(verifyWebhook).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("informa configuración pendiente sin verificar ni procesar eventos", async () => {
    getWebhookSecret.mockResolvedValue("");
    const res = response();
    await handleResendWebhook(request(), res);
    expect(verifyWebhook).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });
});
