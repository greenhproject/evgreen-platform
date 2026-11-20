import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../client/public/sw.js", import.meta.url), "utf8");
function storage() {
  const entries = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (key: string) => entries.get(key)),
    put: vi.fn(async (key: string, value: Response) => { entries.set(key, value); }),
    keys: vi.fn(async () => [...entries.keys()]),
    delete: vi.fn(async (key: string) => entries.delete(key)),
  };
  return { cache, entries, caches: { open: vi.fn(async () => cache), keys: vi.fn(async () => ['evgreen-push-events-v1', 'old-assets']), delete: vi.fn(async () => true) } };
}
function worker(store = storage()) {
  const listeners = new Map<string, Function>();
  const showNotification = vi.fn(async (_title: string, _options: any) => undefined);
  const postMessage = vi.fn();
  const self = {
    location: { origin: 'https://app.example.test' },
    addEventListener: (name: string, handler: Function) => listeners.set(name, handler),
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => [{ postMessage }]), claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(source, { self, caches: store.caches, Response, URL, Date, console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }, Promise, setTimeout });
  const emit = async (payload: any) => {
    let completion: Promise<unknown> = Promise.resolve();
    listeners.get('push')!({ data: { json: () => payload }, waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
    await completion;
  };
  return { store, showNotification, postMessage, emit, listeners };
}
const payload = (eventId: string, occurredAt = new Date().toISOString()) => ({
  title: 'Carga iniciada', body: 'Sesión y tarifa congelada',
  data: { type: 'charging_started', eventId, occurredAt, notificationTag: 'charging-started:42' },
});

describe('presentación idempotente de inicio de carga', () => {
  it('muestra una sola vez dos entregas concurrentes del mismo evento', async () => {
    const app = worker();
    await Promise.all([app.emit(payload('charging.started:1')), app.emit(payload('charging.started:1'))]);
    expect(app.showNotification).toHaveBeenCalledTimes(1);
    expect(app.postMessage).toHaveBeenCalledTimes(1);
  });
  it('conserva los eventos vistos al reiniciar el worker', async () => {
    const store = storage();
    await worker(store).emit(payload('charging.started:1'));
    const restarted = worker(store);
    await restarted.emit(payload('charging.started:1'));
    expect(restarted.showNotification).not.toHaveBeenCalled();
  });
  it('la activación conserva sólo la caché de IDs, no assets antiguos', async () => {
    const app = worker();
    let completion: Promise<unknown> = Promise.resolve();
    app.listeners.get('activate')!({ waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
    await completion;
    expect(app.store.caches.delete).toHaveBeenCalledWith('old-assets');
    expect(app.store.caches.delete).not.toHaveBeenCalledWith('evgreen-push-events-v1');
  });
  it('descarta el inicio de ayer aunque el proveedor lo entregue hoy', async () => {
    const app = worker();
    await app.emit(payload('charging.started:1', new Date(Date.now() - 86_400_000).toISOString()));
    expect(app.showNotification).not.toHaveBeenCalled();
  });
  it('dos sesiones distintas son eventos distintos y reemplazan el aviso viejo con el mismo tag', async () => {
    const app = worker();
    await app.emit(payload('charging.started:1'));
    await app.emit(payload('charging.started:2'));
    expect(app.showNotification).toHaveBeenCalledTimes(2);
    expect(app.showNotification.mock.calls[1]?.[1]).toMatchObject({ tag: 'charging-started:42', renotify: false });
  });
  it('limita el almacenamiento de IDs a 200', async () => {
    const app = worker();
    for (let id = 1; id <= 205; id++) await app.emit(payload(`charging.started:${id}`));
    expect(app.store.entries.size).toBe(200);
  });
  it('sigue entregando avisos sin eventId y mantiene las alertas críticas', async () => {
    const app = worker();
    await app.emit({ title: 'Saldo bajo', body: 'Recarga', data: { type: 'low_balance' } });
    expect(app.showNotification.mock.calls[0]?.[1]).toMatchObject({ tag: 'low_balance', renotify: true, requireInteraction: true });
  });
  it('no bloquea la entrega si la caché local falla', async () => {
    const app = worker();
    app.store.caches.open.mockRejectedValue(new Error('Storage unavailable'));
    await app.emit(payload('charging.started:1'));
    expect(app.showNotification).toHaveBeenCalledTimes(1);
  });
});
