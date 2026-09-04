import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";
import { getDb } from "../server/db";

const baseUrl = process.env.CONTRACT_BASE_URL || "http://127.0.0.1:3000";
const expectedCodes = (process.env.CONTRACT_EXPECTED_CODES || "SPE-2026-2B84F6,SPE-2026-17327B,SPE-2026-13A2AE,SPE-2026-764056,SPE-2026-60BFB6,SPE-2026-0127,SPE-2026-0067")
  .split(",")
  .map(code => code.trim())
  .filter(Boolean);

async function request(pathname: string, token: string) {
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.json?.message || JSON.stringify(payload);
    throw new Error(`${pathname} respondió ${response.status}: ${message}`);
  }
  return payload?.result?.data?.json ?? payload?.result?.data;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("La base activa no está disponible.");
  const [admin] = await db.select({ openId: users.openId, name: users.name })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(users.id)
    .limit(1);
  if (!admin?.openId) throw new Error("No existe una cuenta Admin para la validación.");
  const token = await sdk.createSessionToken(admin.openId, { name: admin.name || "QA Admin", expiresInMs: 5 * 60 * 1000 });
  const spaces = await request("contracts.listEligibleSpaces", token);
  const byCode = new Map(spaces.map((space: any) => [space.code, space]));
  const missingCodes = expectedCodes.filter(code => !byCode.has(code));
  if (missingCodes.length) throw new Error(`Faltan espacios formalizados en el endpoint: ${missingCodes.join(", ")}`);

  const digital = spaces.filter((space: any) => space.formalizationSource === "DIGITAL_LETTER");
  const manual = spaces.filter((space: any) => space.formalizationSource === "MANUAL_FORMALIZATION");
  if (!digital.length || !manual.length) throw new Error("El endpoint no distingue correctamente firma digital y formalización manual.");
  if (spaces.some((space: any) => !space.formalizedAt || !space.eligibilityReason)) throw new Error("Hay espacios sin fecha u origen de formalización explicable.");

  console.log(JSON.stringify({
    baseUrl,
    totalFormalized: spaces.length,
    availableForContract: spaces.filter((space: any) => space.canCreateContract).length,
    protectedByExistingContract: spaces.filter((space: any) => !space.canCreateContract).length,
    digitalLetters: digital.map((space: any) => space.code),
    manualFormalizations: manual.map((space: any) => space.code),
    missingCodes,
  }, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
