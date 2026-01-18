import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BannerItem {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  ctaText?: string;
  ctaUrl?: string;
  type: "INFO" | "PROMO" | "AD";
}

interface BannerProps {
  banners: BannerItem[];
  autoPlay?: boolean;
  interval?: number;
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
}

export function Banner({
  banners,
  autoPlay = true,
  interval = 5000,
  onClose,
  showCloseButton = true,
  className = "",
}: BannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoPlay || banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, interval, banners.length]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  if (!isVisible || banners.length === 0) return null;

  const currentBanner = banners[currentIndex];

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="relative"
          style={{
            backgroundColor: currentBanner.backgroundColor || "hsl(var(--primary))",
          }}
        >
          {currentBanner.imageUrl ? (
            <div className="relative h-32 md:h-40">
              <img
                src={currentBanner.imageUrl}
                alt={currentBanner.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="absolute inset-0 flex items-center p-4">
                <div className="text-white">
                  <h3 className="font-bold text-lg">{currentBanner.title}</h3>
                  {currentBanner.description && (
                    <p className="text-sm opacity-90 mt-1">{currentBanner.description}</p>
                  )}
                  {currentBanner.ctaText && (
                    <button className="mt-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium hover:bg-white/30 transition-colors">
                      {currentBanner.ctaText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="p-4 flex items-center justify-between"
              style={{ color: currentBanner.textColor || "white" }}
            >
              <div>
                <h3 className="font-bold">{currentBanner.title}</h3>
                {currentBanner.description && (
                  <p className="text-sm opacity-90">{currentBanner.description}</p>
                )}
              </div>
              {currentBanner.ctaText && (
                <button className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium hover:bg-white/30 transition-colors">
                  {currentBanner.ctaText}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Close button */}
      {showCloseButton && (
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-white w-4"
                  : "bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Splash Banner para mostrar al abrir la app
export function SplashBanner({
  banner,
  duration = 3000,
  onComplete,
}: {
  banner: BannerItem;
  duration?: number;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(timer);
        onComplete();
      }
    }, 50);

    return () => clearInterval(timer);
  }, [duration, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {banner.imageUrl ? (
        <div className="flex-1 relative">
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
            <h2 className="text-2xl font-bold text-white">{banner.title}</h2>
            {banner.description && (
              <p className="text-white/80 mt-2">{banner.description}</p>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex-1 flex items-center justify-center p-6"
          style={{ backgroundColor: banner.backgroundColor || "hsl(var(--primary))" }}
        >
          <div className="text-center" style={{ color: banner.textColor || "white" }}>
            <h2 className="text-3xl font-bold">{banner.title}</h2>
            {banner.description && (
              <p className="opacity-80 mt-3 text-lg">{banner.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-6 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Omitir
      </button>
    </motion.div>
  );
}

// Banner durante la carga del vehículo
export function ChargingBanner({
  banners,
  className = "",
}: {
  banners: BannerItem[];
  className?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 8000); // Cambiar cada 8 segundos durante la carga

    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const currentBanner = banners[currentIndex];

  return (
    <div className={`rounded-xl overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {currentBanner.imageUrl ? (
            <div className="relative h-40">
              <img
                src={currentBanner.imageUrl}
                alt={currentBanner.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <span className="text-xs text-white/60 uppercase tracking-wider">
                  Publicidad
                </span>
                <h3 className="font-bold text-white mt-1">{currentBanner.title}</h3>
                {currentBanner.ctaText && (
                  <button className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm font-medium">
                    {currentBanner.ctaText}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className="p-4"
              style={{
                backgroundColor: currentBanner.backgroundColor || "hsl(var(--card))",
                color: currentBanner.textColor || "hsl(var(--card-foreground))",
              }}
            >
              <span className="text-xs opacity-60 uppercase tracking-wider">
                Publicidad
              </span>
              <h3 className="font-bold mt-1">{currentBanner.title}</h3>
              {currentBanner.description && (
                <p className="text-sm opacity-80 mt-1">{currentBanner.description}</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2 bg-card">
          {banners.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === currentIndex ? "bg-primary w-3" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
