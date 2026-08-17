import { describe, expect, it, vi } from "vitest";
import { deliverWebhook, dispatchOrganizationWebhookEvent, filterTenantWebhookSubscriptions, isSafeWebhookUrl } from "./webhook-dispatcher";

const subscriptions = [
  { id: 1, organizationId: 10, url: "https://tenant-a.example/hooks", events: ["charging.completed"], secret: "tenant-a-secret" },
  { id: 2, organizationId: 20, url: "https://tenant-b.example/hooks", events: ["charging.completed"], secret: "tenant-b-secret" },
  { id: 3, organizationId: 10, url: "https://tenant-a.example/other", events: ["station.online"], secret: null },
  { id: 4, organizationId: 10, url: "http://localhost:3000/hook", events: ["charging.completed"], secret: null },
];

describe("webhook dispatcher tenant isolation", () => {
  it("accepts HTTPS public URLs and rejects local or plaintext endpoints", () => {
    expect(isSafeWebhookUrl("https://partner.example/webhooks")).toBe(true);
    expect(isSafeWebhookUrl("http://partner.example/webhooks")).toBe(false);
    expect(isSafeWebhookUrl("https://localhost/webhooks")).toBe(false);
    expect(isSafeWebhookUrl("https://10.0.0.2/webhooks")).toBe(false);
  });

  it("selects only event subscriptions owned by the emitting tenant", () => {
    const selected = filterTenantWebhookSubscriptions(subscriptions, 10, "charging.completed");
    expect(selected.map((subscription) => subscription.id)).toEqual([1]);
  });

  it("signs and delivers an event only to the selected webhook", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await expect(deliverWebhook(subscriptions[0], "charging.completed", { transactionId: 77 }, fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("https://tenant-a.example/hooks");
    expect(request.headers["x-evgreen-event"]).toBe("charging.completed");
    expect(request.headers["x-evgreen-signature"]).toMatch(/^sha256=/);
  });

  it("dispatches a completed charge only to the emitting tenant subscription", async () => {
    const where = vi.fn().mockResolvedValue(subscriptions);
    const database = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    } as any;
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await dispatchOrganizationWebhookEvent(10, "charging.completed", { eventId: "charging.completed:77" }, {
      getDatabase: vi.fn().mockResolvedValue(database) as any,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://tenant-a.example/hooks");
  });
});
