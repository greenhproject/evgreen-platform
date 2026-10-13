export type PendingSpacePhoto = {
  file: File;
  preview: string;
  photoType: string;
  isCover?: boolean;
  isConceptual?: boolean;
};

/**
 * Retira una foto que todavía no ha llegado al servidor.
 *
 * En creación se exige una portada mientras quede al menos una fotografía.
 * Durante edición, una foto persistida puede conservar la portada y por eso
 * esta reparación se deja desactivada mediante `ensureCover`.
 */
export function removePendingSpacePhoto<T extends PendingSpacePhoto>(
  photos: readonly T[],
  index: number,
  options: { ensureCover: boolean },
): { photos: T[]; removed: T | null } {
  if (!Number.isInteger(index) || index < 0 || index >= photos.length) {
    return { photos: [...photos], removed: null };
  }

  const removed = photos[index];
  const remaining = photos.filter((_, currentIndex) => currentIndex !== index);
  if (!options.ensureCover || remaining.length === 0) {
    return { photos: remaining, removed };
  }

  const nextCoverIndex = remaining.findIndex((photo) => Boolean(photo.isCover));
  if (nextCoverIndex >= 0) {
    return { photos: remaining, removed };
  }

  return {
    photos: remaining.map((photo, currentIndex) => ({
      ...photo,
      isCover: currentIndex === 0,
    })),
    removed,
  };
}

/** Garantiza que la selección local solo tenga una foto de portada. */
export function setPendingSpacePhotoCover<T extends PendingSpacePhoto>(
  photos: readonly T[],
  index: number,
): T[] {
  if (!Number.isInteger(index) || index < 0 || index >= photos.length) return [...photos];
  return photos.map((photo, currentIndex) => ({
    ...photo,
    isCover: currentIndex === index,
  }));
}
