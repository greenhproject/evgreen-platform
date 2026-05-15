import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from '@capacitor/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Obtiene la URL base de la API para Capacitor o Web
 */
export function getBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  if (Capacitor.isNativePlatform()) {
    // Usar la URL de producción por defecto si no hay variable de entorno
    return "https://app.evgreen.lat";
  }

  return window.location.origin;
}

/**
 * Construye una URL de API absoluta si es necesario (Capacitor)
 */
export function getApiUrl(path: string) {
  const base = getBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
