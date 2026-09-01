import { describe, expect, it, vi } from "vitest";
import { getLocationDedupeKey, recordOcpiOutboxAttempt, sanitizeOcpiOutboxError, stageOcpiEvent } from "./ocpi-outbox";

describe("cola persistente OCPI", () => {
  it("usa una clave estable por Location para deduplicar actualizaciones de la misma estación", () => {
    expect(getLocationDedupeKey(42)).toBe("SIEM:LOCATION_UPSERT:station:42");
    expect(getLocationDedupeKey(42)).toBe(getLocationDedupeKey(42));
    expect(getLocationDedupeKey(43)).not.toBe(getLocationDedupeKey(42));
  });

  it("conserva el tenant, reemplaza el snapshot pendiente de forma idempotente y no hace tráfico externo", async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
    const db = { insert: vi.fn(() => ({ values })) };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(stageOcpiEvent(db, {
      eventType: "LOCATION_UPSERT",
      organizationId: 77,
      stationId: 42,
      dedupeKey: getLocationDedupeKey(42),
      payload: { id: "EVG42", name: "Diamante" },
    })).resolves.toEqual({ staged: true, externalRequest: false });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 77,
      stationId: 42,
      dedupeKey: "SIEM:LOCATION_UPSERT:station:42",
      status: "PENDING",
      payload: { id: "EVG42", name: "Diamante" },
    }));
    expect(onDuplicateKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      set: expect.objectContaining({ organizationId: 77, stationId: 42, status: "PENDING", payload: { id: "EVG42", name: "Diamante" } }),
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("registra estados de despacho sin conservar tokens en el error ni hacer solicitudes externas", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const db = { update: vi.fn(() => ({ set })) };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(recordOcpiOutboxAttempt(db, { id: 9, success: false, error: "HTTP 401 Token secreto-ocpi-123?api_key=otra-clave" })).resolves.toEqual({ status: "FAILED", externalRequest: false });
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ status: "FAILED", lastError: expect.not.stringContaining("secreto-ocpi-123") }));
    expect(sanitizeOcpiOutboxError("Bearer super-secreto")).toBe("Bearer [REDACTED]");

    await expect(recordOcpiOutboxAttempt(db, { id: 9, success: true })).resolves.toEqual({ status: "SENT", externalRequest: false });
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ status: "SENT", lastError: null, sentAt: expect.any(String) }));
    await expect(recordOcpiOutboxAttempt(db, { id: 9, success: false, terminal: true, error: "validación no recuperable" })).resolves.toEqual({ status: "DEAD", externalRequest: false });
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ status: "DEAD" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
