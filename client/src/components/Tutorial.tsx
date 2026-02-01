/**
 * Tutorial Interactivo - Guía paso a paso para nuevos usuarios
 * Con tooltips, highlights y animaciones
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  QrCode, 
  Plug, 
  Activity, 
  Receipt, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  CheckCircle2
} from "lucide-react";

// Pasos del tutorial
const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "¡Bienvenido a EVGreen!",
    description: "Te guiaremos paso a paso para que aprendas a usar la aplicación y cargar tu vehículo eléctrico de forma fácil y rápida.",
    icon: Sparkles,
    color: "from-emerald-500 to-green-600",
    targetSelector: null,
    position: "center",
  },
  {
    id: "map",
    title: "Encuentra estaciones cercanas",
    description: "Usa el mapa interactivo para encontrar las estaciones de carga más cercanas a tu ubicación. Puedes filtrar por tipo de conector y disponibilidad.",
    icon: MapPin,
    color: "from-blue-500 to-cyan-600",
    targetSelector: '[data-tutorial="map"]',
    position: "bottom",
  },
  {
    id: "scan",
    title: "Escanea el código QR",
    description: "Cuando llegues a la estación, escanea el código QR del cargador para iniciar el proceso de carga. También puedes ingresar el código manualmente.",
    icon: QrCode,
    color: "from-orange-500 to-amber-600",
    targetSelector: '[data-tutorial="scan"]',
    position: "top",
  },
  {
    id: "connector",
    title: "Selecciona el conector",
    description: "Elige el conector disponible que sea compatible con tu vehículo. Verás el tipo de conector, la potencia y el estado en tiempo real.",
    icon: Plug,
    color: "from-purple-500 to-violet-600",
    targetSelector: '[data-tutorial="connector"]',
    position: "bottom",
  },
  {
    id: "monitor",
    title: "Monitorea tu carga",
    description: "Mientras tu vehículo se carga, puedes ver el progreso en tiempo real: energía entregada, costo acumulado y tiempo restante estimado.",
    icon: Activity,
    color: "from-pink-500 to-rose-600",
    targetSelector: '[data-tutorial="monitor"]',
    position: "center",
  },
  {
    id: "history",
    title: "Revisa tu historial",
    description: "Accede a tu historial completo de cargas, facturas y estadísticas de consumo. Todo organizado para que tengas control total.",
    icon: Receipt,
    color: "from-teal-500 to-emerald-600",
    targetSelector: '[data-tutorial="history"]',
    position: "top",
  },
];

// Hook para manejar el estado del tutorial
export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem("evgreen_tutorial_completed");
    const skipped = localStorage.getItem("evgreen_tutorial_skipped");
    setHasCompletedTutorial(completed === "true" || skipped === "true");
  }, []);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setShowTutorial(true);
  }, []);

  const completeTutorial = useCallback(() => {
    localStorage.setItem("evgreen_tutorial_completed", "true");
    setHasCompletedTutorial(true);
    setShowTutorial(false);
  }, []);

  const skipTutorial = useCallback(() => {
    localStorage.setItem("evgreen_tutorial_skipped", "true");
    setHasCompletedTutorial(true);
    setShowTutorial(false);
  }, []);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem("evgreen_tutorial_completed");
    localStorage.removeItem("evgreen_tutorial_skipped");
    setHasCompletedTutorial(false);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTutorial();
    }
  }, [currentStep, completeTutorial]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  return {
    showTutorial,
    currentStep,
    hasCompletedTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    resetTutorial,
    nextStep,
    prevStep,
    totalSteps: TUTORIAL_STEPS.length,
  };
}

// Componente de highlight para elementos
const Highlight = ({ selector }: { selector: string | null }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    const element = document.querySelector(selector);
    if (element) {
      const updateRect = () => setRect(element.getBoundingClientRect());
      updateRect();
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect);
      return () => {
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect);
      };
    }
  }, [selector]);

  if (!rect) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed pointer-events-none z-[60]"
      style={{
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      }}
    >
      <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400 animate-pulse" />
      <motion.div
        className="absolute inset-0 rounded-2xl bg-emerald-400/10"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
};

// Componente de tooltip
const Tooltip = ({ 
  step, 
  onNext, 
  onPrev, 
  onSkip, 
  currentIndex, 
  totalSteps,
  targetSelector 
}: { 
  step: typeof TUTORIAL_STEPS[0];
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  currentIndex: number;
  totalSteps: number;
  targetSelector: string | null;
}) => {
  const [position, setPosition] = useState({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
  const Icon = step.icon;
  const isLastStep = currentIndex === totalSteps - 1;
  const isFirstStep = currentIndex === 0;

  useEffect(() => {
    if (!targetSelector || step.position === "center") {
      setPosition({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }

    const element = document.querySelector(targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const tooltipHeight = 280;
      const tooltipWidth = 340;
      const padding = 20;

      let top: string;
      let left: string;
      let transform: string;

      if (step.position === "bottom") {
        top = `${rect.bottom + padding}px`;
        left = `${rect.left + rect.width / 2}px`;
        transform = "translateX(-50%)";
      } else if (step.position === "top") {
        top = `${rect.top - tooltipHeight - padding}px`;
        left = `${rect.left + rect.width / 2}px`;
        transform = "translateX(-50%)";
      } else {
        top = "50%";
        left = "50%";
        transform = "translate(-50%, -50%)";
      }

      // Ajustar si se sale de la pantalla
      const leftNum = parseFloat(left);
      if (leftNum - tooltipWidth / 2 < padding) {
        left = `${tooltipWidth / 2 + padding}px`;
      } else if (leftNum + tooltipWidth / 2 > window.innerWidth - padding) {
        left = `${window.innerWidth - tooltipWidth / 2 - padding}px`;
      }

      setPosition({ top, left, transform });
    }
  }, [targetSelector, step.position]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed z-[70] w-[340px]"
      style={position}
    >
      <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header con gradiente */}
        <div className={`bg-gradient-to-r ${step.color} p-4`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{step.title}</h3>
              <p className="text-white/70 text-sm">Paso {currentIndex + 1} de {totalSteps}</p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-4">
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Indicadores de progreso */}
          <div className="flex gap-1.5 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-colors ${
                  i <= currentIndex ? "bg-emerald-500" : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Botones de navegación */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-gray-400 hover:text-white"
            >
              Saltar tutorial
            </Button>
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrev}
                  className="border-slate-600 text-gray-300 hover:bg-slate-800"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
              )}
              <Button
                size="sm"
                onClick={onNext}
                className={`bg-gradient-to-r ${step.color} hover:opacity-90 text-white`}
              >
                {isLastStep ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Finalizar
                  </>
                ) : (
                  <>
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Flecha indicadora */}
      {targetSelector && step.position !== "center" && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-slate-700 rotate-45 ${
            step.position === "bottom" ? "-top-2 border-t border-l" : "-bottom-2 border-b border-r"
          }`}
        />
      )}
    </motion.div>
  );
};

// Componente principal del Tutorial
export function Tutorial({
  show,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  totalSteps,
}: {
  show: boolean;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  totalSteps: number;
}) {
  const step = TUTORIAL_STEPS[currentStep];

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Overlay oscuro */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[55]"
            onClick={onSkip}
          />

          {/* Highlight del elemento objetivo */}
          <Highlight selector={step.targetSelector} />

          {/* Tooltip */}
          <Tooltip
            step={step}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            currentIndex={currentStep}
            totalSteps={totalSteps}
            targetSelector={step.targetSelector}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// Botón para iniciar el tutorial desde el perfil
export function TutorialButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="w-full justify-start gap-3 h-12 border-slate-700 hover:bg-slate-800"
    >
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="text-left">
        <p className="text-white font-medium">Ver tutorial</p>
        <p className="text-gray-400 text-xs">Aprende a usar la app</p>
      </div>
    </Button>
  );
}

export default Tutorial;
