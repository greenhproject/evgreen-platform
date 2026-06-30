import { useState, useEffect, useCallback } from "react";
import { isCapacitorNative } from "@/const";

/**
 * Hook para manejar la instalación de la PWA en Android/Desktop.
 * Captura el evento `beforeinstallprompt` del navegador y expone
 * una función para disparar el prompt de instalación nativo.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

interface UseInstallPWAReturn {
  /** Si la PWA puede ser instalada (el navegador soporta y no está ya instalada) */
  canInstall: boolean;
  /** Si la PWA ya está instalada (modo standalone) */
  isInstalled: boolean;
  /** Si el dispositivo es iOS (requiere instrucciones manuales) */
  isIOS: boolean;
  /** Si es Android */
  isAndroid: boolean;
  /** Disparar el prompt de instalación nativo */
  installApp: () => Promise<boolean>;
}

export function useInstallPWA(): UseInstallPWAReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Detectar plataforma
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(userAgent);

  // Verificar si ya está instalada (modo standalone)
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);
  }, []);

  // Capturar el evento beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detectar cuando se instala
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[PWA] Error al instalar:", error);
      return false;
    }
  }, [deferredPrompt]);

  // En Capacitor native ya es una app instalada — nunca mostrar el banner PWA
  const inNative = isCapacitorNative();

  return {
    canInstall: !!deferredPrompt && !isInstalled && !inNative,
    isInstalled: isInstalled || inNative,
    isIOS: isIOS && !inNative,
    isAndroid: isAndroid && !inNative,
    installApp,
  };
}
