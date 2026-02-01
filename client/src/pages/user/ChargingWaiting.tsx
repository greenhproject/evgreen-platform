import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Plug, Car, Zap, X, Loader2, CheckCircle2, AlertCircle, Battery, BatteryCharging } from "lucide-react";
import { toast } from "sonner";
import { ChargingBanner } from "@/components/ChargingBanner";

type ConnectionStatus = "waiting" | "connecting" | "connected" | "error";

export default function ChargingWaiting() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<ConnectionStatus>("waiting");
  const [dots, setDots] = useState("");
  const [pulseScale, setPulseScale] = useState(1);
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Obtener sesión activa
  const { data: session, refetch } = trpc.charging.getActiveSession.useQuery(undefined, {
    refetchInterval: 2000, // Verificar cada 2 segundos
  });
  
  // Cancelar carga
  const cancelMutation = trpc.charging.stopCharge.useMutation({
    onSuccess: () => {
      toast.success("Carga cancelada");
      navigate("/map");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // Animación de puntos suspensivos
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  // Animación de pulso
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale(prev => prev === 1 ? 1.15 : 1);
    }, 800);
    return () => clearInterval(interval);
  }, []);
  
  // Animación de progreso de conexión
  useEffect(() => {
    if (status === "waiting" || status === "connecting") {
      const interval = setInterval(() => {
        setConnectionProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 2;
        });
      }, 100);
      return () => clearInterval(interval);
    } else if (status === "connected") {
      setConnectionProgress(100);
    }
  }, [status]);
  
  // Animación de partículas de energía
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = 300;
    canvas.height = 300;
    
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      color: string;
    }> = [];
    
    const createParticle = () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 20;
      return {
        x: 150 + Math.cos(angle) * radius,
        y: 150 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.5,
        color: Math.random() > 0.5 ? "#10b981" : "#34d399"
      };
    };
    
    let animationId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Agregar nuevas partículas
      if (particles.length < 30 && (status === "waiting" || status === "connecting")) {
        particles.push(createParticle());
      }
      
      // Actualizar y dibujar partículas
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // Mover hacia el centro cuando está conectando
        if (status === "connecting" || status === "connected") {
          const dx = 150 - p.x;
          const dy = 150 - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          p.vx += (dx / dist) * 0.3;
          p.vy += (dy / dist) * 0.3;
        }
        
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.01;
        
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [status]);
  
  // Detectar cambio de estado
  useEffect(() => {
    if (session) {
      // Si hay energía consumida, el vehículo está conectado y cargando
      if (session.currentKwh > 0) {
        setStatus("connected");
        setShowParticles(true);
        // Esperar un momento y navegar al monitor
        setTimeout(() => {
          navigate("/charging-monitor");
        }, 2000);
      } else if (session.status === "IN_PROGRESS") {
        setStatus("connecting");
      }
    }
  }, [session, navigate]);
  
  const handleCancel = () => {
    if (session?.transactionId) {
      cancelMutation.mutate({ sessionId: String(session.transactionId) });
    } else {
      navigate("/map");
    }
  };
  
  const getStatusMessage = () => {
    switch (status) {
      case "waiting":
        return "Esperando conexión";
      case "connecting":
        return "Conectando";
      case "connected":
        return "¡Conectado!";
      case "error":
        return "Error de conexión";
      default:
        return "Esperando";
    }
  };
  
  const getStatusDescription = () => {
    switch (status) {
      case "waiting":
        return "Conecta el cable de carga a tu vehículo";
      case "connecting":
        return "Estableciendo comunicación con el cargador...";
      case "connected":
        return "Iniciando sesión de carga...";
      case "error":
        return "No se pudo establecer conexión. Intenta de nuevo.";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between relative z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-semibold text-white">Conectando</h1>
        <div className="w-10" />
      </div>
      
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 relative">
        {/* Canvas de partículas */}
        <canvas
          ref={canvasRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: 300, height: 300, marginTop: -60 }}
        />
        
        {/* Animación de conexión principal */}
        <div className="relative mb-8 z-10">
          {/* Anillos pulsantes */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[1, 2, 3].map((ring) => (
              <div
                key={ring}
                className={`absolute rounded-full border-2 transition-all duration-1000 ${
                  status === "connected" 
                    ? "border-emerald-400/60" 
                    : "border-emerald-500/30"
                }`}
                style={{
                  width: `${150 + ring * 40}px`,
                  height: `${150 + ring * 40}px`,
                  transform: `scale(${status === "connected" ? 1.1 : pulseScale})`,
                  opacity: 1 - ring * 0.2,
                  animationDelay: `${ring * 200}ms`,
                }}
              />
            ))}
          </div>
          
          {/* Círculo de progreso */}
          <svg className="absolute -inset-4 w-[190px] h-[190px]" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(16, 185, 129, 0.2)"
              strokeWidth="2"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${connectionProgress * 2.83} 283`}
              transform="rotate(-90 50 50)"
              className="transition-all duration-100"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#6ee7b7" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Círculo principal */}
          <div 
            className={`relative w-[150px] h-[150px] rounded-full flex items-center justify-center transition-all duration-500 ${
              status === "connected"
                ? "bg-gradient-to-br from-emerald-500/40 to-emerald-600/40 border-2 border-emerald-400"
                : "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border-2 border-emerald-500/50"
            }`}
          >
            {/* Contenido del círculo según estado */}
            {status === "waiting" && (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 mb-2">
                  <Car className="w-10 h-10 text-emerald-400 animate-pulse" />
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        style={{
                          animation: "dotPulse 1.5s infinite",
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                  <Plug className="w-8 h-8 text-emerald-400" />
                </div>
                <Battery className="w-6 h-6 text-gray-500" />
              </div>
            )}
            
            {status === "connecting" && (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Car className="w-10 h-10 text-emerald-400" />
                  <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex items-center">
                    <div className="w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500 animate-pulse" />
                    <Plug className="w-6 h-6 text-emerald-400 animate-pulse" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="text-xs text-emerald-400">Conectando</span>
                </div>
              </div>
            )}
            
            {status === "connected" && (
              <div className="flex flex-col items-center animate-bounce-slow">
                <div className="relative">
                  <BatteryCharging className="w-12 h-12 text-emerald-400" />
                  <Zap className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 fill-yellow-400 animate-pulse" />
                </div>
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mt-1" />
              </div>
            )}
            
            {status === "error" && (
              <div className="flex flex-col items-center">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <span className="text-xs text-red-400 mt-1">Error</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Estado y mensaje */}
        <div className="text-center mb-8 z-10">
          <h2 className={`text-3xl font-bold mb-2 transition-colors duration-500 ${
            status === "connected" ? "text-emerald-400" : "text-white"
          }`}>
            {getStatusMessage()}{status !== "connected" && status !== "error" ? dots : ""}
          </h2>
          <p className="text-gray-400 text-lg">
            {getStatusDescription()}
          </p>
        </div>
        
        {/* Pasos de conexión */}
        <div className="w-full max-w-sm mb-6 z-10">
          <div className="flex items-center justify-between px-4">
            {[
              { label: "Iniciando", done: true },
              { label: "Conectando", done: status === "connecting" || status === "connected" },
              { label: "Cargando", done: status === "connected" },
            ].map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all duration-500 ${
                  step.done 
                    ? "bg-emerald-500 text-white" 
                    : "bg-gray-700 text-gray-500"
                }`}>
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-sm">{index + 1}</span>
                  )}
                </div>
                <span className={`text-xs ${step.done ? "text-emerald-400" : "text-gray-500"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          {/* Línea de progreso */}
          <div className="relative h-1 bg-gray-700 rounded-full mt-2 mx-8">
            <div 
              className="absolute h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ 
                width: status === "connected" ? "100%" : status === "connecting" ? "50%" : "0%" 
              }}
            />
          </div>
        </div>
        
        {/* Información de la estación */}
        {session && (
          <Card className="w-full max-w-sm bg-gray-800/50 border-gray-700 backdrop-blur-sm z-10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-500 ${
                  status === "connected" 
                    ? "bg-emerald-500/30" 
                    : "bg-emerald-500/20"
                }`}>
                  <Zap className={`w-6 h-6 ${
                    status === "connected" ? "text-emerald-300" : "text-emerald-400"
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-white">{session.stationName}</p>
                  <p className="text-sm text-gray-400">
                    Conector {session.connectorId} • {session.connectorType}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tarifa actual</span>
                  <span className="text-emerald-400 font-medium">
                    ${session.pricePerKwh?.toFixed(2) || "0.00"}/kWh
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-400">Modo de carga</span>
                  <span className="text-white">
                    {(session.chargeMode as string) === "full_charge" && "Carga completa"}
                    {(session.chargeMode as string) === "fixed_amount" && `$${(session as any).targetAmount?.toFixed(0) || "--"}`}
                    {(session.chargeMode as string) === "target_percentage" && `${session.targetPercentage || "--"}%`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Botón cancelar */}
        <div className="mt-6 z-10">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8"
          >
            {cancelMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Cancelar
          </Button>
        </div>
      </div>
      
      {/* Banner publicitario */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <ChargingBanner />
      </div>
      
      {/* Estilos de animación */}
      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
