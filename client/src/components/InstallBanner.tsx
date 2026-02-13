import { useState, useEffect } from "react";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Banner flotante de instalación PWA.
 * - En Android/Desktop: muestra botón que dispara el prompt nativo de instalación.
 * - En iOS: muestra instrucciones para agregar al Home Screen.
 * - Si ya está instalada: no muestra nada.
 * 
 * Se muestra como banner fijo en la parte inferior de la pantalla.
 */
export function InstallBanner() {
  const { canInstall, isInstalled, isIOS, installApp } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Mostrar el banner después de 3 segundos para no ser intrusivo
  useEffect(() => {
    // Verificar si fue descartado previamente en esta sesión
    const wasDismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // No mostrar si ya está instalada, fue descartada, o no hay soporte
  if (isInstalled || dismissed || !showBanner) return null;
  if (!canInstall && !isIOS) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "true");
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    const success = await installApp();
    if (success) {
      handleDismiss();
    }
  };

  return (
    <>
      {/* Banner flotante inferior */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 animate-in slide-in-from-bottom duration-500"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      >
        <div className="max-w-lg mx-auto bg-gradient-to-r from-emerald-900/95 to-green-800/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl shadow-emerald-900/50">
          <div className="flex items-center gap-3">
            {/* Ícono de la app */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <img
                src="/icons/icon-96x96.png"
                alt="EVGreen"
                className="w-10 h-10 object-contain"
              />
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">
                Instala EVGreen
              </div>
              <div className="text-emerald-200/70 text-xs mt-0.5">
                Acceso rápido desde tu pantalla de inicio
              </div>
            </div>

            {/* Botón instalar */}
            <Button
              onClick={handleInstall}
              size="sm"
              className="bg-white text-emerald-900 hover:bg-emerald-50 font-semibold text-xs px-4 rounded-xl shadow-lg flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Instalar
            </Button>

            {/* Botón cerrar */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-emerald-300/50 hover:text-white transition-colors p-1"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de instrucciones para iOS */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-gradient-to-b from-gray-900 to-gray-950 border-t border-emerald-500/30 rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <img src="/icons/icon-96x96.png" alt="EVGreen" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <div className="text-white font-semibold">Instalar EVGreen</div>
                  <div className="text-gray-400 text-xs">en tu iPhone/iPad</div>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pasos */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold">
                  1
                </div>
                <div className="flex-1 pt-1">
                  <div className="text-white text-sm font-medium flex items-center gap-2">
                    Toca el botón <Share className="w-4 h-4 text-blue-400" /> Compartir
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    En la barra inferior de Safari
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold">
                  2
                </div>
                <div className="flex-1 pt-1">
                  <div className="text-white text-sm font-medium flex items-center gap-2">
                    Selecciona <Plus className="w-4 h-4 text-gray-300" /> "Agregar a inicio"
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    Desplázate hacia abajo en el menú
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold">
                  3
                </div>
                <div className="flex-1 pt-1">
                  <div className="text-white text-sm font-medium">
                    Toca "Agregar" para confirmar
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    EVGreen aparecerá en tu pantalla de inicio
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <Button
                onClick={() => setShowIOSModal(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Botón de instalación para usar inline en la landing page.
 * Más prominente que el banner, diseñado para la sección hero o CTA.
 */
export function InstallButton({ className = "" }: { className?: string }) {
  const { canInstall, isInstalled, isIOS, installApp } = useInstallPWA();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Si ya está instalada, no mostrar
  if (isInstalled) return null;
  // Si no puede instalar y no es iOS, no mostrar
  if (!canInstall && !isIOS) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    await installApp();
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outline"
        size="lg"
        className={`border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-2 rounded-full ${className}`}
      >
        <Smartphone className="w-5 h-5" />
        Descargar App
      </Button>

      {/* Modal iOS reutilizado */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-gradient-to-b from-gray-900 to-gray-950 border-t border-emerald-500/30 rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <img src="/icons/icon-96x96.png" alt="EVGreen" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <div className="text-white font-semibold">Instalar EVGreen</div>
                  <div className="text-gray-400 text-xs">en tu iPhone/iPad</div>
                </div>
              </div>
              <button onClick={() => setShowIOSModal(false)} className="text-gray-500 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold">1</div>
                <div className="flex-1 pt-1">
                  <div className="text-white text-sm font-medium flex items-center gap-2">Toca el botón <Share className="w-4 h-4 text-blue-400" /> Compartir</div>
                  <div className="text-gray-400 text-xs mt-1">En la barra inferior de Safari</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold">2</div>
                <div className="flex-1 pt-1">
                  <div className="text-white text-sm font-medium flex items-center gap-2">Selecciona <Plus className="w-4 h-4 text-gray-300" /> "Agregar a inicio"</div>
                  <div className="text-gray-400 text-xs mt-1">Desplázate hacia abajo en el menú</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold">3</div>
                <div className="flex-1 pt-1">
                  <div className="text-white text-sm font-medium">Toca "Agregar" para confirmar</div>
                  <div className="text-gray-400 text-xs mt-1">EVGreen aparecerá en tu pantalla de inicio</div>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-800">
              <Button onClick={() => setShowIOSModal(false)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl">Entendido</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
