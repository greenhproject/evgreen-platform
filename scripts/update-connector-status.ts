/**
 * Script para actualizar el estado de los conectores a AVAILABLE
 */

import { drizzle } from "drizzle-orm/mysql2";
import { evses } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const db = drizzle(DATABASE_URL);

  // Ver estado actual
  const currentEvses = await db.select().from(evses);
  console.log("Estado actual de conectores:");
  currentEvses.forEach((e) => {
    console.log(`  EVSE ${e.id}: status = ${e.status}`);
  });

  // Actualizar todos a AVAILABLE
  await db.update(evses).set({ status: "AVAILABLE" });

  // Verificar
  const updatedEvses = await db.select().from(evses);
  console.log("\nEstado después de actualizar:");
  updatedEvses.forEach((e) => {
    console.log(`  EVSE ${e.id}: status = ${e.status}`);
  });

  console.log("\n✅ Conectores actualizados a AVAILABLE");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
