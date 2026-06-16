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
  if (envUrl) return envUrl.replace(/\/$/, "");

  // Si no hay envUrl, usamos el origen de la ventana (web)
  // o lanzamos un error claro en lugar de usar una IP vieja
  if (Capacitor.isNativePlatform()) {
    console.error("VITE_API_URL no está definida. La comunicación con el servidor fallará.");
    return "";
  }

  return window.location.origin;
}

/**
 * Construye una URL de API absoluta si es necesario (Capacitor)
 */
export function getApiUrl(path: string) {
  const base = getBaseUrl().replace(/\/$/, ""); // Asegurar que no hay barra al final
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
