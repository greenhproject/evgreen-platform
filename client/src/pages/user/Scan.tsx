/**
 * Página de Escaneo QR para iniciar carga
 */

import { useState } from "react";
import { useLocation } from "wouter";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  QrCode,
  Camera,
  Keyboard,
  Zap,
  ArrowLeft,
  Search,
  MapPin,
} from "lucide-react";

export default function ScanPage() {
  const [, setLocation] = useLocation();
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const handleScan = () => {
    toast.info("Función de escaneo QR", {
      description: "Esta función requiere acceso a la cámara del dispositivo. Por ahora, usa el código manual.",
    });
    setShowManualInput(true);
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      toast.error("Ingresa un código de estación");
      return;
    }
    
    // Buscar estación por código
    toast.info("Buscando estación...", {
      description: `Código: ${manualCode}`,
    });
    
    // Por ahora redirigir al mapa
    setTimeout(() => {
      setLocation("/map");
    }, 1500);
  };

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/map")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Iniciar Carga</h1>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
          {!showManualInput ? (
            <>
              {/* Área de escaneo */}
              <div className="relative w-64 h-64 rounded-3xl border-4 border-primary/50 flex items-center justify-center bg-card/50 backdrop-blur-sm">
                <div className="absolute inset-4 border-2 border-dashed border-primary/30 rounded-2xl" />
                <QrCode className="h-24 w-24 text-primary/50" />
                
                {/* Esquinas decorativas */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Escanea el código QR</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Apunta la cámara al código QR de la estación de carga para iniciar
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleScan}
                >
                  <Camera className="h-5 w-5" />
                  Abrir cámara
                </Button>
                
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => setShowManualInput(true)}
                >
                  <Keyboard className="h-5 w-5" />
                  Ingresar código manual
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Entrada manual */}
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-10 w-10 text-primary" />
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Código de estación</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Ingresa el código que aparece en la estación de carga
                </p>
              </div>

              <div className="w-full max-w-xs space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Ej: GEV-MOSQUERA-001"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    className="pl-10 h-12 text-center font-mono text-lg"
                  />
                </div>

                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleManualSubmit}
                >
                  <Zap className="h-5 w-5" />
                  Buscar estación
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowManualInput(false)}
                >
                  Volver a escanear QR
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Acceso rápido al mapa */}
        <div className="p-6">
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <button
                onClick={() => setLocation("/map")}
                className="flex items-center gap-4 w-full text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">¿No tienes el código?</p>
                  <p className="text-sm text-muted-foreground">
                    Busca estaciones cercanas en el mapa
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </UserLayout>
  );
}
