/**
 * ActiveChargingBanner - Banner flotante que aparece en todas las páginas de usuario
 * cuando hay una sesión de carga activa, permitiendo volver al monitor de carga.
 * 
 * Se oculta automáticamente cuando el usuario ya está en /charging-monitor.
 */
import { useLocation, Link } from "wouter";
import { useActiveChargingSession } from "@/hooks/useActiveChargingSession";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export function ActiveChargingBanner() {
  const [location] = useLocation();
  const { hasActiveSession, session } = useActiveChargingSession();
  const [elapsedText, setElapsedText] = useState("");

  // No mostrar en páginas de carga (monitor, summary, waiting, start-charge)
  const chargingPages = [
    "/charging-monitor",
    "/charging-summary",
    "/charging-waiting",
    "/start-charge",
  ];
  const isOnChargingPage = chargingPages.some(p => location.startsWith(p));

  // Actualizar tiempo transcurrido
  useEffect(() => {
    if (!session?.startTime) return;

    const updateElapsed = () => {
      const start = new Date(session.startTime).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        setElapsedText(`${hrs}h ${remainMins}m`);
      } else {
        setElapsedText(`${mins}m ${secs.toString().padStart(2, "0")}s`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session?.startTime]);

  if (!hasActiveSession || isOnChargingPage) return null;

  const sessionAny = session as any;
  const kwhConsumed = sessionAny?.kwhConsumed ?? sessionAny?.currentKwh ?? 0;
  const currentCost = sessionAny?.currentCost ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="fixed top-[56px] left-0 right-0 z-40"
      >
        <Link href="/charging-monitor">
          <a className="block">
            <div className="mx-2 mt-1 rounded-xl overflow-hidden shadow-lg shadow-emerald-900/30 border border-emerald-500/30">
              {/* Fondo con gradiente animado */}
              <div className="relative bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 px-4 py-3">
                {/* Efecto de pulso de fondo */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                
                <div className="relative flex items-center justify-between">
                  {/* Icono + Info */}
                  <div className="flex items-center gap-3">
                    {/* Icono con pulso */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" style={{ animationDuration: "2s" }} />
                      <div className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <Zap className="w-5 h-5 text-white" fill="currentColor" />
                      </div>
                    </div>
                    
                    {/* Texto */}
                    <div>
                      <p className="text-white font-bold text-sm">
                        Carga en progreso
                      </p>
                      <p className="text-emerald-100 text-xs">
                        {elapsedText && `${elapsedText}`}
                        {kwhConsumed > 0 && ` • ${kwhConsumed.toFixed(1)} kWh`}
                        {currentCost > 0 && ` • $${Math.round(currentCost).toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {/* Botón ir al monitor */}
                  <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5 backdrop-blur-sm">
                    <span className="text-white text-xs font-semibold">Ver</span>
                    <ChevronRight className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </a>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
