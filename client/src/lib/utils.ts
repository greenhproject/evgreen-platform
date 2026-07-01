import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detecta si se está ejecutando en una plataforma nativa Capacitor (iOS/Android).
 * Usa window.Capacitor en lugar de importar el módulo para evitar romper el bundle web.
 */
function isCapacitorNative(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true;
}

/**
 * Obtiene la URL base de la API para Capacitor o Web
 */
export function getBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (isCapacitorNative()) {
    console.error("VITE_API_URL no está definida. La comunicación con el servidor fallará.");
    return "";
  }

  return window.location.origin;
}

/**
 * Construye una URL de API absoluta si es necesario (Capacitor)
 */
export function getApiUrl(path: string) {
  const base = getBaseUrl().replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
