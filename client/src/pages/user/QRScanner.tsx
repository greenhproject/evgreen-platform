import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Camera,
  Flashlight,
  Keyboard,
  QrCode,
  X
} from "lucide-react";
import { toast } from "sonner";

export default function QRScanner() {
  const [, setLocation] = useLocation();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [flashOn, setFlashOn] = useState(false);

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      toast.error("Ingresa un código válido");
      return;
    }
    // Simular validación de código
    toast.success("Código válido. Iniciando carga...");
    setTimeout(() => {
      setLocation("/charging/1");
    }, 1000);
  };

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-black relative">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setLocation("/map")}
          >
            <X className="w-6 h-6" />
          </Button>
          <h1 className="text-white font-semibold">Escanear código QR</h1>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
          >
            <Camera className="w-6 h-6" />
          </Button>
        </div>

        {/* Área de escaneo simulada */}
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <div className="relative">
            {/* Marco de escaneo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-64 h-64 border-2 border-white/30 rounded-2xl relative"
            >
              {/* Esquinas verdes */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />

              {/* Línea de escaneo animada */}
              <motion.div
                className="absolute left-4 right-4 h-0.5 bg-primary shadow-glow"
                animate={{
                  top: ["10%", "90%", "10%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />

              {/* Icono central */}
              <div className="absolute inset-0 flex items-center justify-center">
                <QrCode className="w-16 h-16 text-white/20" />
              </div>
            </motion.div>

            {/* Instrucciones */}
            <p className="text-white/70 text-center mt-6 text-sm">
              Coloque el código QR dentro del marco para escanear
            </p>
          </div>
        </div>

        {/* Controles inferiores */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          {showManualInput ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
                <h3 className="text-white font-medium mb-3">Entrada manual</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ingresa el código del cargador"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                  <Button
                    className="gradient-primary text-white"
                    onClick={handleManualSubmit}
                  >
                    Validar
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-white/70"
                  onClick={() => setShowManualInput(false)}
                >
                  Cancelar
                </Button>
              </Card>
            </motion.div>
          ) : (
            <div className="flex justify-center gap-8">
              <Button
                variant="ghost"
                className="flex flex-col items-center gap-2 text-white hover:bg-white/10"
                onClick={() => setFlashOn(!flashOn)}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  flashOn ? "bg-primary" : "bg-white/20"
                }`}>
                  <Flashlight className="w-6 h-6" />
                </div>
                <span className="text-sm">Encender luz</span>
              </Button>

              <Button
                variant="ghost"
                className="flex flex-col items-center gap-2 text-white hover:bg-white/10"
                onClick={() => setShowManualInput(true)}
              >
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Keyboard className="w-6 h-6" />
                </div>
                <span className="text-sm">Entrada manual</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
