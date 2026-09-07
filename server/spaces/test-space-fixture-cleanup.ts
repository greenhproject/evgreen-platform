import { inArray, or } from "drizzle-orm";
import {
  crowdfundingProjects,
  investorLeads,
  letterEmailEvents,
  siteContracts,
  spacePhotos,
  spaceStatusHistory,
  spaceSubmissions,
} from "../../drizzle/schema";
import { getDb } from "../db";

type CleanupSpaceQaFixturesInput = {
  createdIds?: Iterable<number>;
  fixtureEmails?: readonly string[];
};

/**
 * Elimina exclusivamente postulaciones creadas por pruebas de espacios.
 *
 * Se ejecuta antes y después de cada prueba para cubrir tanto una ejecución
 * normal como residuos dejados por una suite interrumpida. Por seguridad se
 * niega a borrar registros que ya tengan contrato o proyecto de inversión.
 */
export async function cleanupSpaceQaFixtures({
  createdIds = [],
  fixtureEmails = [],
}: CleanupSpaceQaFixturesInput): Promise<{ deletedIds: number[] }> {
  if (!process.env.VITEST) {
    throw new Error("El cleanup de fixtures de espacios solo puede ejecutarse desde Vitest.");
  }

  const ids = [...new Set([...createdIds].filter((id) => Number.isInteger(id) && id > 0))];
  const emails = [...new Set(fixtureEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (ids.length === 0 && emails.length === 0) return { deletedIds: [] };

  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible para limpiar fixtures de espacios.");

  const selected = ids.length > 0 && emails.length > 0
    ? await db.select({ id: spaceSubmissions.id })
        .from(spaceSubmissions)
        .where(or(inArray(spaceSubmissions.id, ids), inArray(spaceSubmissions.submitterEmail, emails)))
    : ids.length > 0
      ? await db.select({ id: spaceSubmissions.id })
          .from(spaceSubmissions)
          .where(inArray(spaceSubmissions.id, ids))
      : await db.select({ id: spaceSubmissions.id })
          .from(spaceSubmissions)
          .where(inArray(spaceSubmissions.submitterEmail, emails));

  const targetIds = [...new Set(selected.map((row) => row.id))];
  if (targetIds.length === 0) return { deletedIds: [] };

  const [linkedContract] = await db.select({ id: siteContracts.id })
    .from(siteContracts)
    .where(inArray(siteContracts.submissionId, targetIds))
    .limit(1);
  const [linkedProject] = await db.select({ id: crowdfundingProjects.id })
    .from(crowdfundingProjects)
    .where(inArray(crowdfundingProjects.spaceSubmissionId, targetIds))
    .limit(1);

  if (linkedContract || linkedProject) {
    throw new Error(
      `Cleanup QA bloqueado: las postulaciones ${targetIds.join(", ")} tienen contrato o proyecto vinculado.`,
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(letterEmailEvents).where(inArray(letterEmailEvents.submissionId, targetIds));
    await tx.delete(spaceStatusHistory).where(inArray(spaceStatusHistory.submissionId, targetIds));
    await tx.delete(investorLeads).where(inArray(investorLeads.spaceId, targetIds));
    await tx.delete(spacePhotos).where(inArray(spacePhotos.submissionId, targetIds));
    await tx.delete(spaceSubmissions).where(inArray(spaceSubmissions.id, targetIds));
  });

  return { deletedIds: targetIds };
}
