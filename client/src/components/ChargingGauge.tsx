/**
 * ChargingGauge - Indicador circular animado para mostrar progreso de carga
 * 
 * Características:
 * - SVG circular con animación suave
 * - Colores dinámicos según el nivel de carga
 * - Muestra porcentaje en el centro
 * - Efecto de brillo/glow animado
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ChargingGaugeProps {
  /** Porcentaje actual de carga (0-100) */
  percentage: number;
  /** Porcentaje objetivo de carga (0-100) */
  targetPercentage?: number;
  /** Tamaño del gauge en píxeles */
  size?: number;
  /** Grosor del arco en píxeles */
  strokeWidth?: number;
  /** Mostrar animación de carga activa */
  isCharging?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

export function ChargingGauge({
  percentage,
  targetPercentage = 100,
  size = 280,
  strokeWidth = 20,
  isCharging = true,
  className,
}: ChargingGaugeProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  // Animar el porcentaje suavemente
  useEffect(() => {
    const duration = 1000; // 1 segundo
    const startTime = Date.now();
    const startValue = animatedPercentage;
    const endValue = percentage;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;
      
      setAnimatedPercentage(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [percentage]);
  
  // Calcular dimensiones del SVG
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calcular offset para el arco de progreso (empezar desde arriba)
  const progressOffset = circumference - (animatedPercentage / 100) * circumference;
  const targetOffset = circumference - (targetPercentage / 100) * circumference;
  
  // Determinar color según el nivel de carga
  const getColor = (pct: number) => {
    if (pct < 20) return { main: "#ef4444", glow: "#fca5a5" }; // Rojo
    if (pct < 50) return { main: "#f59e0b", glow: "#fcd34d" }; // Amarillo
    if (pct < 80) return { main: "#22c55e", glow: "#86efac" }; // Verde
    return { main: "#10b981", glow: "#6ee7b7" }; // Verde esmeralda
  };
  
  const colors = getColor(animatedPercentage);
  
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* SVG del gauge */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Definiciones de gradientes y filtros */}
        <defs>
          {/* Gradiente para el arco de progreso */}
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.main} />
            <stop offset="100%" stopColor={colors.glow} />
          </linearGradient>
          
          {/* Filtro de brillo */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Filtro de sombra suave */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>
        
        {/* Fondo del gauge (círculo completo) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        
        {/* Arco del objetivo (si es diferente de 100%) */}
        {targetPercentage < 100 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={targetOffset}
            strokeLinecap="round"
            className="text-muted/40"
          />
        )}
        
        {/* Arco de progreso actual */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          filter="url(#glow)"
          className="transition-all duration-300"
        />
        
        {/* Punto indicador al final del arco */}
        {animatedPercentage > 0 && (
          <circle
            cx={center + radius * Math.cos((animatedPercentage / 100) * 2 * Math.PI - Math.PI / 2)}
            cy={center + radius * Math.sin((animatedPercentage / 100) * 2 * Math.PI - Math.PI / 2)}
            r={strokeWidth / 2 + 2}
            fill={colors.main}
            filter="url(#shadow)"
            className={cn(
              "transition-all duration-300",
              isCharging && "animate-pulse"
            )}
          />
        )}
      </svg>
      
      {/* Contenido central */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Porcentaje grande */}
        <div className="flex items-baseline">
          <span 
            className="text-5xl font-bold tabular-nums"
            style={{ color: colors.main }}
          >
            {Math.round(animatedPercentage)}
          </span>
          <span className="text-2xl font-medium text-muted-foreground ml-1">%</span>
        </div>
        
        {/* Indicador de carga activa */}
        {isCharging && (
          <div className="flex items-center gap-2 mt-2">
            <div className="relative">
              <div 
                className="w-2 h-2 rounded-full animate-ping absolute"
                style={{ backgroundColor: colors.main }}
              />
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors.main }}
              />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Cargando...
            </span>
          </div>
        )}
        
        {/* Objetivo si es diferente de 100% */}
        {targetPercentage < 100 && (
          <div className="text-xs text-muted-foreground mt-1">
            Objetivo: {targetPercentage}%
          </div>
        )}
      </div>
    </div>
  );
}

export default ChargingGauge;
