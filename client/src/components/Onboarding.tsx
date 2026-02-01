import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  MapPin, 
  QrCode, 
  Wallet, 
  History, 
  ChevronRight, 
  ChevronLeft,
  Sparkles
} from "lucide-react";

interface OnboardingSlide {
  id: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  iconBg: string;
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    icon: <Zap className="w-16 h-16" />,
    title: "Bienvenido a",
    subtitle: "EVGreen",
    description: "La plataforma líder de carga para vehículos eléctricos en Colombia. Carga rápida, segura y al mejor precio.",
    gradient: "from-emerald-600 via-green-500 to-teal-400",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600"
  },
  {
    id: 2,
    icon: <MapPin className="w-16 h-16" />,
    title: "Encuentra",
    subtitle: "Estaciones cercanas",
    description: "Localiza las estaciones de carga más cercanas a tu ubicación. Filtra por tipo de conector, potencia y disponibilidad.",
    gradient: "from-blue-600 via-indigo-500 to-purple-400",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600"
  },
  {
    id: 3,
    icon: <QrCode className="w-16 h-16" />,
    title: "Escanea",
    subtitle: "y carga al instante",
    description: "Simplemente escanea el código QR de la estación para iniciar tu sesión de carga. Sin complicaciones, sin esperas.",
    gradient: "from-orange-500 via-amber-500 to-yellow-400",
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-600"
  },
  {
    id: 4,
    icon: <Wallet className="w-16 h-16" />,
    title: "Gestiona tu",
    subtitle: "Billetera digital",
    description: "Recarga tu saldo fácilmente con múltiples métodos de pago. Controla tus gastos y aprovecha promociones exclusivas.",
    gradient: "from-pink-500 via-rose-500 to-red-400",
    iconBg: "bg-gradient-to-br from-pink-500 to-rose-600"
  },
  {
    id: 5,
    icon: <History className="w-16 h-16" />,
    title: "Revisa tu",
    subtitle: "Historial completo",
    description: "Accede a todas tus sesiones de carga, consumo de energía y estadísticas. Optimiza tu experiencia de carga.",
    gradient: "from-cyan-500 via-teal-500 to-emerald-400",
    iconBg: "bg-gradient-to-br from-cyan-500 to-teal-600"
  }
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  };

  const handleComplete = () => {
    localStorage.setItem("evgreen_onboarding_completed", "true");
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const slide = slides[currentSlide];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    })
  };

  const iconVariants = {
    initial: { scale: 0, rotate: -180 },
    animate: { 
      scale: 1, 
      rotate: 0,
      transition: { 
        type: "spring" as const, 
        stiffness: 200, 
        damping: 15,
        delay: 0.2 
      }
    },
    exit: { scale: 0, rotate: 180 }
  };

  const textVariants = {
    initial: { y: 20, opacity: 0 },
    animate: (delay: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: delay * 0.1 + 0.3, duration: 0.5 }
    })
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-hidden">
      {/* Fondo animado con gradiente */}
      <motion.div 
        className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} opacity-10`}
        key={`bg-${currentSlide}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />

      {/* Partículas decorativas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-2 h-2 rounded-full bg-gradient-to-r ${slide.gradient}`}
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: window.innerHeight + 20,
              opacity: 0.3
            }}
            animate={{ 
              y: -20,
              opacity: [0.3, 0.6, 0.3],
              transition: { 
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }
            }}
          />
        ))}
      </div>

      {/* Botón de saltar */}
      <motion.button
        className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors z-10"
        onClick={handleSkip}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Saltar
      </motion.button>

      {/* Contenido principal */}
      <div className="relative h-full flex flex-col items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex flex-col items-center text-center max-w-md"
          >
            {/* Icono animado */}
            <motion.div
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`${slide.iconBg} p-8 rounded-3xl shadow-2xl mb-8 text-white`}
            >
              {slide.icon}
            </motion.div>

            {/* Título */}
            <motion.h2
              custom={1}
              variants={textVariants}
              initial="initial"
              animate="animate"
              className="text-2xl font-medium text-muted-foreground mb-1"
            >
              {slide.title}
            </motion.h2>

            {/* Subtítulo */}
            <motion.h1
              custom={2}
              variants={textVariants}
              initial="initial"
              animate="animate"
              className={`text-4xl font-bold mb-6 bg-gradient-to-r ${slide.gradient} bg-clip-text text-transparent`}
            >
              {slide.subtitle}
            </motion.h1>

            {/* Descripción */}
            <motion.p
              custom={3}
              variants={textVariants}
              initial="initial"
              animate="animate"
              className="text-muted-foreground text-lg leading-relaxed"
            >
              {slide.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* Indicadores de progreso */}
        <div className="absolute bottom-32 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className="p-1"
            >
              <motion.div
                className={`h-2 rounded-full transition-colors ${
                  index === currentSlide 
                    ? `bg-gradient-to-r ${slide.gradient}` 
                    : "bg-muted-foreground/30"
                }`}
                animate={{
                  width: index === currentSlide ? 32 : 8
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </button>
          ))}
        </div>

        {/* Botones de navegación */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-between items-center px-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className={`${currentSlide === 0 ? "opacity-0" : "opacity-100"} transition-opacity`}
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Anterior
          </Button>

          <Button
            size="lg"
            onClick={nextSlide}
            className={`bg-gradient-to-r ${slide.gradient} hover:opacity-90 text-white shadow-lg`}
          >
            {currentSlide === slides.length - 1 ? (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Comenzar
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook para verificar si el usuario ha completado el onboarding
 */
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem("evgreen_onboarding_completed");
    setShowOnboarding(!completed);
    setIsLoading(false);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem("evgreen_onboarding_completed", "true");
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem("evgreen_onboarding_completed");
    setShowOnboarding(true);
  };

  return { showOnboarding, isLoading, completeOnboarding, resetOnboarding };
}

export default Onboarding;
