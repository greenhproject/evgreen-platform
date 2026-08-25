/**
 * Catálogo único de marcas para perfiles de vehículos y segmentación de EVGreen Ads.
 *
 * La lista de Grupo Vardí corresponde exclusivamente a su portafolio automotor
 * verificado el 25 de agosto de 2026; no incluye maquinaria, bicicletas ni accesorios.
 */
export const VARDI_VEHICLE_BRANDS = [
  "Chery",
  "Changan",
  "Deepal",
  "Farizon",
  "Geely",
  "Mazda",
  "Nissan",
  "Dodge",
  "Fiat",
  "Jeep",
  "RAM",
] as const;

/** Marcas que ya estaban disponibles en los perfiles de vehículos de EVGreen. */
export const EXISTING_VEHICLE_BRANDS = [
  "Tesla",
  "BYD",
  "Renault",
  "Nissan",
  "Chevrolet",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Volkswagen",
  "Hyundai",
  "Kia",
  "Ford",
  "Volvo",
  "Porsche",
] as const;

/**
 * Lista completa, deduplicada y estable para cualquier selector de marca de vehículo.
 * "Otro" se conserva como opción final para no bloquear el registro de nuevas marcas.
 */
export const VEHICLE_BRANDS = [
  ...new Set([...EXISTING_VEHICLE_BRANDS, ...VARDI_VEHICLE_BRANDS]),
  "Otro",
] as const;
