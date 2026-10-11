export const PHOTO_TYPE_LABELS = {
  general: "Vista general",
  entrance: "Acceso",
  access_road: "Vía de acceso",
  parking: "Zona de parqueo",
  parking_area: "Área de parqueo",
  electrical: "Infraestructura eléctrica",
  electrical_panel: "Tablero eléctrico",
  transformer: "Transformador",
  surroundings: "Alrededores",
  other: "Otra",
} as const;

export type PhotoType = keyof typeof PHOTO_TYPE_LABELS;

export function getPhotoTypeLabel(type: string | null | undefined): string {
  if (!type) return PHOTO_TYPE_LABELS.general;
  return PHOTO_TYPE_LABELS[type as PhotoType] ?? type.replaceAll("_", " ");
}

export function getPhotoMarkerLabel(type: string | null | undefined, caption?: string | null): string {
  const typeLabel = getPhotoTypeLabel(type);
  const cleanCaption = caption?.trim();
  return cleanCaption ? `${typeLabel} · ${cleanCaption}` : typeLabel;
}
