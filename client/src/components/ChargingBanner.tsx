import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChargingBannerProps {
  className?: string;
}

export function ChargingBanner({ className = "" }: ChargingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  
  // Obtener banners activos de tipo CHARGING
  const { data: banners, isLoading } = trpc.banners.getActive.useQuery(
    { type: "CHARGING" },
    { refetchOnWindowFocus: false }
  );
  
  const recordImpression = trpc.banners.recordImpression.useMutation();
  const recordClick = trpc.banners.recordClick.useMutation();
  
  // Rotación automática de banners cada 8 segundos
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [banners]);
  
  // Registrar impresión cuando se muestra un banner
  useEffect(() => {
    if (banners && banners.length > 0 && !dismissed) {
      const currentBanner = banners[currentIndex];
      if (currentBanner) {
        recordImpression.mutate({ 
          bannerId: currentBanner.id, 
          context: "charging_session" 
        });
      }
    }
  }, [currentIndex, banners, dismissed]);
  
  if (isLoading || !banners || banners.length === 0 || dismissed) {
    return null;
  }
  
  const currentBanner = banners[currentIndex];
  
  const handleClick = () => {
    if (currentBanner.linkUrl) {
      recordClick.mutate({ bannerId: currentBanner.id });
      window.open(currentBanner.linkUrl, "_blank");
    }
  };
  
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };
  
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentBanner.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative overflow-hidden rounded-xl ${className}`}
      >
        {/* Banner Image/Content */}
        <div 
          className="relative cursor-pointer group"
          onClick={handleClick}
        >
          {currentBanner.imageUrl ? (
            <img 
              src={currentBanner.imageUrlMobile || currentBanner.imageUrl}
              alt={currentBanner.title}
              className="w-full h-32 sm:h-40 object-cover rounded-xl"
            />
          ) : (
            <div className="w-full h-32 sm:h-40 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
              <span className="text-lg font-semibold">{currentBanner.title}</span>
            </div>
          )}
          
          {/* Overlay con información */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent rounded-xl">
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
              <h3 className="text-white font-semibold text-sm sm:text-base line-clamp-1">
                {currentBanner.title}
              </h3>
              {currentBanner.subtitle && (
                <p className="text-white/80 text-xs sm:text-sm line-clamp-1 mt-0.5">
                  {currentBanner.subtitle}
                </p>
              )}
              {currentBanner.ctaText && currentBanner.linkUrl && (
                <div className="flex items-center gap-1 mt-2 text-primary text-xs sm:text-sm font-medium">
                  <span>{currentBanner.ctaText}</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
          
          {/* Botón de cerrar */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 bg-black/50 hover:bg-black/70 text-white rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
          >
            <X className="w-3 h-3" />
          </Button>
          
          {/* Navegación si hay múltiples banners */}
          {banners.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handlePrev}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
        
        {/* Indicadores de página */}
        {banners.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {banners.map((_, index) => (
              <button
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  index === currentIndex 
                    ? "bg-primary w-4" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        )}
        
        {/* Etiqueta de publicidad */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/50 rounded text-[10px] text-white/70">
          Publicidad
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
