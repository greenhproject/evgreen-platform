export type PublicProjectPhoto = {
  url: string;
  type: string;
  caption?: string | null;
};

/**
 * Resuelve una galería pública sin exponer metadatos privados del espacio.
 * Los proyectos nuevos reciben `inheritedPhotos`; los snapshots históricos
 * mantienen compatibilidad mediante `spaceInheritanceSnapshot.photos`.
 */
export function resolveInheritedProjectPhotos(project: unknown): PublicProjectPhoto[] {
  const candidate = project as {
    inheritedPhotos?: unknown;
    spaceInheritanceSnapshot?: { photos?: unknown } | string | null;
  } | null;

  const normalize = (value: unknown): PublicProjectPhoto[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((photo): photo is PublicProjectPhoto => (
      typeof photo?.url === "string" && photo.url.trim().length > 0 &&
      typeof photo?.type === "string" && photo.type.trim().length > 0
    ));
  };

  const direct = normalize(candidate?.inheritedPhotos);
  if (direct.length > 0) return direct;

  let snapshot = candidate?.spaceInheritanceSnapshot;
  if (typeof snapshot === "string") {
    try { snapshot = JSON.parse(snapshot); } catch { return []; }
  }
  return normalize(typeof snapshot === "object" && snapshot ? snapshot.photos : undefined);
}
