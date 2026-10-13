/**
 * Regresión para cleanupOrphanedTransactions (server/db.ts).
 *
 * Bug real encontrado el 2026-10-13 al probar qué pasa con una sesión de
 * carga activa cuando el proceso del servidor se reinicia (ver
 * docs/ocpp-restart-orphaned-transactions-2026-10-13.md para la
 * investigación completa, con evidencia de réplica manual contra un MySQL
 * local). El filtro original calculaba el cutoff con `new Date(...).toISOString()`
 * (siempre UTC) y lo comparaba contra `updatedAt`, una columna
 * CURRENT_TIMESTAMP/ON UPDATE generada por la propia base de datos — cuya
 * zona horaria depende de `@@session.time_zone`, no del proceso de Node.
 * Contra producción (TiDB Cloud, confirmado `@@system_time_zone = UTC`) esto
 * coincide por casualidad y no falla. Contra un MySQL local con
 * `time_zone=SYSTEM` en una máquina fuera de UTC (como cualquier entorno de
 * desarrollo en Colombia), el desfase hace que la condición se cumpla casi
 * de inmediato — en la réplica, cerró y cobró una sesión con 20 segundos de
 * iniciada que seguía cargando activamente.
 *
 * El fix mueve el cutoff a NOW() del propio servidor de BD (`sql` crudo),
 * eliminando la dependencia de cualquier reloj/zona horaria del proceso de
 * Node — correcto sin importar en qué zona horaria corra quien ejecute las
 * pruebas o el servidor.
 *
 * Esta prueba verifica el contrato correcto contra la base real: una
 * transacción con actividad reciente NUNCA debe cerrarse, y una
 * genuinamente vieja sí.
 */
import { afterEach, describe, expect, it } from "vitest";
import { getDb, cleanupOrphanedTransactions } from "./db";
import { transactions } from "../drizzle/schema";
import { eq, inArray, sql } from "drizzle-orm";

// EVSE/estación reales usados solo como referencia de FK (nunca se modifican).
const REAL_EVSE_ID = 150001;
const REAL_STATION_ID = 150001;
// userId claramente falso y sin wallet asociada: la rama de cobro de
// cleanupOrphanedTransactions revisa `wallet.length > 0` y no hace nada si
// no encuentra una — así esta prueba nunca mueve saldo real.
const FAKE_USER_ID = 999900002;

let insertedIds: number[] = [];

async function insertFixture(opts: { ocppTransactionId: string; ageMinutes: number }) {
  const db = (await getDb())!;
  const [result] = await db.insert(transactions).values({
    evseId: REAL_EVSE_ID,
    userId: FAKE_USER_ID,
    stationId: REAL_STATION_ID,
    ocppTransactionId: opts.ocppTransactionId,
    startTime: new Date(Date.now() - opts.ageMinutes * 60 * 1000).toISOString().slice(0, 19).replace("T", " "),
    kwhConsumed: "1.5000",
    totalCost: "2700.00",
    status: "IN_PROGRESS",
    transactionStatus: "IN_PROGRESS",
  } as any);
  const id = Number((result as any).insertId);
  insertedIds.push(id);

  if (opts.ageMinutes > 0) {
    // updatedAt es ON UPDATE CURRENT_TIMESTAMP — no se puede fijar vía
    // insert/update de Drizzle. Se retrasa con SQL crudo, en el reloj de la
    // propia BD (NOW() - INTERVAL ...), para simular una fila realmente
    // vieja sin depender del reloj de esta máquina.
    await db.execute(
      sql`UPDATE transactions SET updatedAt = (NOW() - INTERVAL ${opts.ageMinutes} MINUTE) WHERE id = ${id}`,
    );
  }
  return id;
}

afterEach(async () => {
  if (insertedIds.length === 0) return;
  const db = (await getDb())!;
  await db.delete(transactions).where(inArray(transactions.id, insertedIds));
  insertedIds = [];
});

describe("cleanupOrphanedTransactions — comparación de edad contra el reloj de la BD", () => {
  it("NO cierra una transacción recién actualizada (segundos de antigüedad)", async () => {
    const freshId = await insertFixture({ ocppTransactionId: `tz-fresh-${Date.now()}`, ageMinutes: 0 });

    await cleanupOrphanedTransactions(60);

    const db = (await getDb())!;
    const [row] = await db.select().from(transactions).where(eq(transactions.id, freshId));
    expect(row.status).toBe("IN_PROGRESS");
    expect(row.endTime).toBeNull();
  });

  it("SÍ cierra y liquida una transacción genuinamente vieja (61 min sin actividad)", async () => {
    const staleId = await insertFixture({ ocppTransactionId: `tz-stale-${Date.now()}`, ageMinutes: 61 });

    await cleanupOrphanedTransactions(60);

    const db = (await getDb())!;
    const [row] = await db.select().from(transactions).where(eq(transactions.id, staleId));
    expect(row.status).toBe("COMPLETED");
    expect(row.endTime).not.toBeNull();
  });

  it("deja intacta una fresca y cierra una vieja en la misma corrida (no es todo o nada)", async () => {
    const freshId = await insertFixture({ ocppTransactionId: `tz-mix-fresh-${Date.now()}`, ageMinutes: 0 });
    const staleId = await insertFixture({ ocppTransactionId: `tz-mix-stale-${Date.now()}`, ageMinutes: 90 });

    await cleanupOrphanedTransactions(60);

    const db = (await getDb())!;
    const [freshRow] = await db.select().from(transactions).where(eq(transactions.id, freshId));
    const [staleRow] = await db.select().from(transactions).where(eq(transactions.id, staleId));
    expect(freshRow.status).toBe("IN_PROGRESS");
    expect(staleRow.status).toBe("COMPLETED");
  });
});
