import { createHash } from "node:crypto";
import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { spaceSubmissions } from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  settings: vi.fn(),
  storageGet: vi.fn(),
  storagePut: vi.fn(),
  fetch: vi.fn(),
  signedPdf: vi.fn(),
  allyPdf: vi.fn(),
  prospectoPdf: vi.fn(),
  score: vi.fn(),
  resend: vi.fn(),
  sendEmail: vi.fn(),
  emailParams: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("../db", () => ({ getDb: mocks.getDb, getPlatformSettings: mocks.settings }));
vi.mock("../storage", () => ({ storageGet: mocks.storageGet, storagePut: mocks.storagePut }));
vi.mock("./letter-pdf-service", () => ({ generateSignedLetterPdf: mocks.signedPdf }));
vi.mock("./ally-space-pdf-service", () => ({ generateAllySpacePdf: mocks.allyPdf }));
vi.mock("./prospecto-pdf-service", () => ({ generateProspectoPdf: mocks.prospectoPdf }));
vi.mock("./space-ai-scoring", () => ({ scoreSpaceInvestment: mocks.score }));
vi.mock("../email/resend-client", () => ({ getResendClient: mocks.resend }));
vi.mock("../utils/email-helper", () => ({ buildEmailParams: mocks.emailParams }));
vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notify }));

import { spacesRouter } from "./spaces-router";

const MAX_BYTES = 20 * 1024 * 1024;
const STORED_KEY = "spaces/cartas-firmadas/SPE-2026-0018-private.pdf";
const PROXY_URL = "https://storage.example.invalid/original.pdf?signature=private-download-token";
const LEGACY_URL = "https://legacy.example.invalid/do-not-fetch.pdf";
const DOWNLOAD_ERROR = "No se pudo descargar el PDF firmado original. Inténtalo de nuevo.";
// Binary bytes, signer timestamp, metadata and trailing bytes must survive the download unchanged.
const ORIGINAL_PDF = Buffer.concat([
  Buffer.from("%PDF-1.7\n%"),
  Buffer.from([0xe2, 0xe3, 0xcf, 0xd3, 0x00, 0xff]),
  Buffer.from("\n1 0 obj << /Signer (Fixture) /SignedAt (2026-08-18 11:00:00) >> endobj\n%%EOF\n"),
]);

function context(role: string | null = "admin"): TrpcContext {
  return {
    user: role ? { id: 9, role, openId: "signed-letter-isolated", name: "Synthetic caller" } : null,
    req: { headers: {}, protocol: "https", socket: {} },
    res: {},
  } as TrpcContext;
}

function response(bytes: Uint8Array = ORIGINAL_PDF, headers: Record<string, string> = {}) {
  return new Response(bytes as BodyInit, { headers: { "content-type": "application/pdf", ...headers } });
}

function memoryDb(overrides: Record<string, unknown> = {}, missing = false) {
  const space: Record<string, any> = {
    id: 18,
    code: "SPE-2026-0018",
    letterAcceptedAt: "2026-08-18 11:00:00",
    signedLetterPdfKey: STORED_KEY,
    signedLetterPdfUrl: LEGACY_URL,
    letterSignerName: "Original signer",
    letterSignerDocument: "Original identity",
    letterSignerIp: "192.0.2.18",
    letterSignerUserAgent: "Original browser",
    spaceStatus: "letter_accepted",
    submitterUserId: 500, // Caller is not the submission's owner: the commercial guard is the agreed authorization.
    crowdfundingProjectId: 42,
    estimatedInvestmentCop: "800000000",
    ...overrides,
  };
  const original = structuredClone(space);
  const from = vi.fn((table: any, fields: Record<string, unknown>) => {
    expect(getTableName(table)).toBe("space_submissions");
    const query = {
      where: vi.fn(() => query),
      limit: vi.fn(async () => missing ? [] : [Object.fromEntries(Object.keys(fields).map(key => [key, space[key]]))]),
    };
    return query;
  });
  const db = {
    select: vi.fn((fields: Record<string, unknown>) => ({ from: (table: any) => from(table, fields) })),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
  mocks.getDb.mockResolvedValue(db);
  return { db, from, space, original };
}

let state: ReturnType<typeof memoryDb>;
function download(role: string | null = "admin", input: unknown = { id: 18 }) {
  return spacesRouter.createCaller(context(role)).admin.downloadSignedLetterPdf(input as { id: number });
}

async function expectDownloadError() {
  const error = await download().then(() => { throw new Error("Expected download failure"); }, error => error);
  expect(error).toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: DOWNLOAD_ERROR });
  expect(error.cause).toBeUndefined();
  for (const secret of [STORED_KEY, PROXY_URL, LEGACY_URL, "private-download-token", "https://"]) {
    expect(error.message).not.toContain(secret);
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.storageGet.mockResolvedValue({ key: STORED_KEY, url: PROXY_URL });
  mocks.fetch.mockImplementation(async () => response());
  mocks.resend.mockResolvedValue({ emails: { send: mocks.sendEmail } });
  state = memoryDb();
});

afterEach(() => {
  // This guard applies to every success and failure: a download must never alter business records.
  expect(state.space).toEqual(state.original);
  for (const operation of [state.db.update, state.db.insert, state.db.delete, state.db.transaction,
    mocks.settings, mocks.storagePut, mocks.signedPdf, mocks.allyPdf, mocks.prospectoPdf,
    mocks.score, mocks.resend, mocks.sendEmail, mocks.emailParams, mocks.notify]) {
    expect(operation).not.toHaveBeenCalled();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("spaces.admin.downloadSignedLetterPdf — isolated original-document download", () => {
  it("is a mutation with strict positive integer ID input", () => {
    expect(spacesRouter._def.procedures["admin.downloadSignedLetterPdf"]._def.type).toBe("mutation");
  });

  it.each(["admin", "staff", "comercial"])("allows %s without an owner filter and returns no URL", async role => {
    const result = await download(role);
    expect(result).toEqual({
      fileName: "Carta-Intencion-Firmada-SPE-2026-0018.pdf",
      base64: ORIGINAL_PDF.toString("base64"),
      mimeType: "application/pdf",
    });
    expect(Object.keys(result).sort()).toEqual(["base64", "fileName", "mimeType"]);
    expect(JSON.stringify(result)).not.toMatch(/https?:\/\/|private-download-token/);
    expect(mocks.storageGet).toHaveBeenCalledTimes(1);
    expect(mocks.storageGet).toHaveBeenCalledWith(STORED_KEY);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(PROXY_URL, { signal: expect.any(AbortSignal) });
  });

  it.each([[null, "UNAUTHORIZED"], ["user", "FORBIDDEN"], ["investor", "FORBIDDEN"], ["technician", "FORBIDDEN"]])(
    "blocks %s before database or storage access", async (role, code) => {
      await expect(download(role)).rejects.toMatchObject({ code });
      expect(mocks.getDb).not.toHaveBeenCalled();
      expect(mocks.storageGet).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    {}, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: "18" }, { id: null },
    { id: Number.NaN }, { id: Number.POSITIVE_INFINITY }, { id: 18, url: PROXY_URL },
    { id: 18, key: STORED_KEY }, { id: 18, signedLetterPdfUrl: LEGACY_URL }, { id: 18, force: true },
  ])("rejects invalid or extra input %j before database access", async input => {
    await expect(download("admin", input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.storageGet).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("selects only id, code, acceptance timestamp and storage key", async () => {
    await download();
    expect(state.db.select).toHaveBeenCalledTimes(1);
    expect(state.db.select).toHaveBeenCalledWith({
      id: spaceSubmissions.id,
      code: spaceSubmissions.code,
      letterAcceptedAt: spaceSubmissions.letterAcceptedAt,
      signedLetterPdfKey: spaceSubmissions.signedLetterPdfKey,
    });
    expect(state.from).toHaveBeenCalledTimes(1);
    const query = state.from.mock.results[0].value;
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.where).toHaveBeenCalledTimes(1);
    const sqlParts = query.where.mock.calls[0][0].queryChunks;
    expect(sqlParts).toContain(spaceSubmissions.id);
    expect(sqlParts.some((part: any) => part?.value === 18)).toBe(true);
  });

  it("preserves exact bytes, SHA-256, original signer timestamp and database values across repeated downloads", async () => {
    const first = Buffer.from((await download()).base64, "base64");
    const second = Buffer.from((await download()).base64, "base64");
    expect(first.equals(ORIGINAL_PDF)).toBe(true);
    expect(second.equals(first)).toBe(true);
    expect(createHash("sha256").update(first).digest("hex")).toBe(createHash("sha256").update(ORIGINAL_PDF).digest("hex"));
    expect(first.toString("latin1")).toContain("2026-08-18 11:00:00");
    expect(state.space.letterAcceptedAt).toBe("2026-08-18 11:00:00");
  });

  it("preserves binary bytes when PDF magic and metadata span multiple stream chunks", async () => {
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(ORIGINAL_PDF.subarray(0, 2));
        controller.enqueue(ORIGINAL_PDF.subarray(2, 5));
        controller.enqueue(ORIGINAL_PDF.subarray(5, 19));
        controller.enqueue(ORIGINAL_PDF.subarray(19));
        controller.close();
      },
    })));
    expect(Buffer.from((await download()).base64, "base64").equals(ORIGINAL_PDF)).toBe(true);
  });

  it.each(["published", "funded", "in_construction", "operational"])("still downloads the original in later stage %s", async spaceStatus => {
    state = memoryDb({ spaceStatus });
    expect(Buffer.from((await download()).base64, "base64").equals(ORIGINAL_PDF)).toBe(true);
  });

  it("returns NOT_FOUND for a missing submission without external calls", async () => {
    state = memoryDb({}, true);
    await expect(download()).rejects.toMatchObject({ code: "NOT_FOUND", message: "Postulación no encontrada" });
    expect(mocks.storageGet).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns a clear precondition for missing acceptance even if a key exists", async () => {
    state = memoryDb({ letterAcceptedAt: null });
    await expect(download()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "La carta de intención aún no ha sido firmada." });
    expect(mocks.storageGet).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([null, "", "   "])("never regenerates or falls back to the legacy URL when key is %j", async signedLetterPdfKey => {
    state = memoryDb({ signedLetterPdfKey });
    await expect(download()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "La carta está firmada, pero su PDF original no está disponible." });
    expect(mocks.storageGet).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("resolves the persisted key even when the legacy URL is absent", async () => {
    state = memoryDb({ signedLetterPdfUrl: null });
    expect((await download()).base64).toBe(ORIGINAL_PDF.toString("base64"));
    expect(mocks.storageGet).toHaveBeenCalledWith(STORED_KEY);
  });

  it.each([
    ["SPE/2026\\0018\r\n../../Á Bogotá", "SPE-2026-0018-A-Bogota"],
    ["../../\r\n", "espacio"],
    ["x".repeat(120), "x".repeat(80)],
    ["Espacio: \"Centro\" <A>", "Espacio-Centro-A"],
  ])("sanitizes filename segment %j", async (code, expected) => {
    state = memoryDb({ code });
    const result = await download();
    expect(result.fileName).toBe(`Carta-Intencion-Firmada-${expected}.pdf`);
    expect(result.fileName).not.toMatch(/[\\/\r\n<>:\"]/);
  });

  it("conceals storage errors and does not try the legacy URL", async () => {
    mocks.storageGet.mockRejectedValue(new Error(`Proxy failed ${STORED_KEY} ${PROXY_URL}`));
    await expectDownloadError();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "/manus-storage/legacy.pdf", "file:///etc/passwd", "data:application/pdf;base64,cGRm"])(
    "rejects invalid proxy URL %j without fetching", async url => {
      mocks.storageGet.mockResolvedValue({ key: STORED_KEY, url });
      await expectDownloadError();
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([403, 404, 500, 503])("conceals HTTP %i failures without regeneration", async status => {
    mocks.fetch.mockResolvedValue(new Response("provider error with secret URL", { status }));
    await expectDownloadError();
    expect(mocks.storageGet).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("conceals fetch/network errors", async () => {
    mocks.fetch.mockRejectedValue(new Error(`Network failed ${PROXY_URL}`));
    await expectDownloadError();
  });

  it("aborts fetch at 20 seconds and clears the timer", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    mocks.fetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      signal = init.signal;
      signal!.addEventListener("abort", () => reject(new DOMException(`Timeout ${PROXY_URL}`, "AbortError")), { once: true });
    }));
    const check = expectDownloadError();
    await vi.advanceTimersByTimeAsync(19_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await check;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also bounds stalled body consumption by the same 20-second timeout", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementation(async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(ORIGINAL_PDF);
        init.signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
      },
    })));
    const check = expectDownloadError();
    await vi.advanceTimersByTimeAsync(20_000);
    await check;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    Buffer.from("<html>Login required</html>"), Buffer.alloc(0), Buffer.from("%PDF"),
    Buffer.from("not a PDF"), Buffer.from(" \n%PDF-1.7"), Buffer.from([0xa5, 0x50, 0x44, 0x46, 0x2d]),
  ])("rejects empty, HTML or invalid PDF magic bytes %j", async bytes => {
    mocks.fetch.mockResolvedValue(response(bytes));
    await expectDownloadError();
  });

  it("accepts PDF bytes with generic MIME type without modifying them", async () => {
    mocks.fetch.mockResolvedValue(new Response(ORIGINAL_PDF, { headers: { "content-type": "application/octet-stream" } }));
    expect((await download()).base64).toBe(ORIGINAL_PDF.toString("base64"));
  });

  it("rejects a missing body", async () => {
    mocks.fetch.mockResolvedValue(new Response(null));
    await expectDownloadError();
  });

  it.each([String(MAX_BYTES + 1), "-1", "invalid", "Infinity"])("rejects excessive or invalid Content-Length %s before reading", async length => {
    const read = vi.fn();
    mocks.fetch.mockResolvedValue({ ok: true, headers: new Headers({ "content-length": length }), body: { getReader: read } });
    await expectDownloadError();
    expect(read).not.toHaveBeenCalled();
  });

  it("accepts an original PDF exactly at the 20 MiB boundary", async () => {
    const bytes = Buffer.alloc(MAX_BYTES, 0x61);
    ORIGINAL_PDF.copy(bytes);
    mocks.fetch.mockResolvedValue(response(bytes, { "content-length": String(MAX_BYTES) }));
    const downloaded = Buffer.from((await download()).base64, "base64");
    expect(downloaded.byteLength).toBe(MAX_BYTES);
    expect(downloaded.equals(bytes)).toBe(true);
  });

  it.each([undefined, "8"])("enforces streamed size limit even with Content-Length %s", async length => {
    const chunk = Buffer.alloc(1024 * 1024, 0x61);
    const read = vi.fn()
      .mockResolvedValueOnce({ done: false, value: ORIGINAL_PDF })
      .mockImplementation(async () => ({ done: false, value: chunk }));
    const releaseLock = vi.fn();
    mocks.fetch.mockResolvedValue({ ok: true, headers: new Headers(length ? { "content-length": length } : {}), body: { getReader: () => ({ read, releaseLock }) } });
    await expectDownloadError();
    expect(read).toHaveBeenCalledTimes(21);
    expect(releaseLock).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("conceals body read errors and releases the reader", async () => {
    const releaseLock = vi.fn();
    mocks.fetch.mockResolvedValue({ ok: true, headers: new Headers(), body: { getReader: () => ({
      read: vi.fn().mockRejectedValue(new Error(`Read failed ${PROXY_URL}`)), releaseLock,
    }) } });
    await expectDownloadError();
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it("clears the 20-second timer after a successful download", async () => {
    vi.useFakeTimers();
    expect((await download()).base64).toBe(ORIGINAL_PDF.toString("base64"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not call storage when the database is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(download()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
    expect(mocks.storageGet).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
