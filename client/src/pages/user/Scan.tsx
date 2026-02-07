/**
 * Página de Escaneo QR para iniciar carga
 * Usa html5-qrcode para escaneo real con cámara
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  QrCode,
  Camera,
  Keyboard,
  Zap,
  ArrowLeft,
  Search,
  MapPin,
  X,
  Loader2,
  CheckCircle,
} from "lucide-react";

export default function ScanPage() {
  const [, setLocation] = useLocation();
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";

  // Buscar estación por código
  const searchStation = trpc.stations.listPublic.useQuery(undefined, {
    enabled: false,
  });

  // Limpiar el escáner al desmontar
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      // Importar dinámicamente html5-qrcode
      const { Html5Qrcode } = await import("html5-qrcode");
      
      // Crear instancia del escáner
      scannerRef.current = new Html5Qrcode(scannerContainerId);

      // Configuración del escáner
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      };

      // Iniciar escaneo con cámara trasera
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
      );
    } catch (err: any) {
      console.error("Error al iniciar escáner:", err);
      setIsScanning(false);
      
      if (err.message?.includes("Permission denied") || err.name === "NotAllowedError") {
        setCameraError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.");
      } else if (err.message?.includes("NotFoundError") || err.name === "NotFoundError") {
        setCameraError("No se encontró ninguna cámara en tu dispositivo.");
      } else {
        setCameraError("No se pudo acceder a la cámara. Intenta con el código manual.");
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.log("Escáner ya detenido");
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const onScanSuccess = (decodedText: string) => {
    // Detener el escáner al encontrar un código
    stopScanner();
    setScannedCode(decodedText);
    handleCodeFound(decodedText);
  };

  const onScanFailure = (error: string) => {
    // Ignorar errores de escaneo (son normales cuando no hay QR visible)
  };

  const handleCodeFound = async (rawCode: string) => {
    setIsSearching(true);
    
    // Extraer código de estación si es una URL
    let code = rawCode.trim();
    let isNumericId = false;
    
    // Si es una URL, extraer el código del path
    if (code.startsWith('http://') || code.startsWith('https://')) {
      try {
        const url = new URL(code);
        const pathParts = url.pathname.split('/').filter(Boolean);
        // Buscar el código en el path (puede ser /scan/CP001, /station/CP001 o /charging/60001)
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          // Si es /charging/:id, el ID es numérico y corresponde a un evseId
          if (pathParts[0] === 'charging' && /^\d+$/.test(lastPart)) {
            isNumericId = true;
            code = lastPart;
          } else {
            code = lastPart;
          }
        }
      } catch (e) {
        // Si no es una URL válida, usar el código tal cual
      }
    }
    
    toast.info("Código detectado", {
      description: code,
    });

    // Buscar la estación por el código OCPP, nombre, ID de estación o evseId
    try {
      const stations = await searchStation.refetch();
      let result: any = null;
      let matchedEvseId: number | null = null;
      
      // Si es un ID numérico de URL /charging/:id, buscar por evseId
      if (isNumericId) {
        const evseId = parseInt(code);
        for (const s of stations.data || []) {
          const st = (s as any).station || s;
          const evses = (s as any).evses || st.evses || [];
          const matchedEvse = evses.find((e: any) => e.id === evseId);
          if (matchedEvse) {
            result = s;
            matchedEvseId = evseId;
            break;
          }
        }
      }
      
      // Si no se encontró por evseId, buscar por código OCPP, nombre o ID de estación
      if (!result) {
        result = stations.data?.find(
          (s: any) => {
            const st = s.station || s;
            const searchCode = code.toUpperCase();
            return (
              st.ocppIdentity?.toUpperCase() === searchCode || 
              st.id.toString() === code ||
              st.name?.toUpperCase().includes(searchCode)
            );
          }
        );
      }

      if (result) {
        const station = (result as any).station || result;
        toast.success("Estación encontrada", {
          description: station.name,
        });
        // Redirigir a StartCharge con el código de la estación para iniciar el flujo de carga
        // Si tenemos evseId, pasarlo también para pre-seleccionar el conector
        const redirectUrl = matchedEvseId 
          ? `/start-charge?code=${station.ocppIdentity || station.id}&evseId=${matchedEvseId}`
          : `/start-charge?code=${station.ocppIdentity || station.id}`;
        setTimeout(() => {
          setLocation(redirectUrl);
        }, 1000);
      } else {
        toast.error("Estación no encontrada", {
          description: "El código escaneado no corresponde a ninguna estación registrada.",
        });
        setScannedCode(null);
        setIsSearching(false);
      }
    } catch (error) {
      toast.error("Error al buscar estación");
      setScannedCode(null);
      setIsSearching(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      toast.error("Ingresa un código de estación");
      return;
    }
    handleCodeFound(manualCode.trim());
  };

  const handleOpenCamera = () => {
    setShowManualInput(false);
    setCameraError(null);
    startScanner();
  };

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              stopScanner();
              setLocation("/map");
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Iniciar Carga</h1>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          {/* Estado de búsqueda con animación elaborada */}
          {isSearching && scannedCode && (
            <div className="flex flex-col items-center gap-6">
              {/* Spinner con anillos concéntricos */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Anillo exterior girando lento */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 border-r-emerald-400/30 animate-spin" style={{ animationDuration: '2s' }} />
                {/* Anillo medio girando en dirección opuesta */}
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-emerald-500 border-l-emerald-500/30 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                {/* Anillo interior con pulso */}
                <div className="absolute inset-4 rounded-full bg-emerald-500/10 animate-pulse" />
                {/* Ícono central */}
                <Zap className="h-10 w-10 text-emerald-400 drop-shadow-lg relative z-10" />
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                  Buscando estación...
                </h2>
                <p className="text-muted-foreground text-sm">
                  Código: <span className="font-mono text-emerald-400">{scannedCode}</span>
                </p>
              </div>

              {/* Pasos de progreso */}
              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-emerald-400">Código QR detectado</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  </div>
                  <span className="text-sm text-muted-foreground">Verificando estación en la red...</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <Zap className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground/50">Preparando sesión de carga</span>
                </div>
              </div>
            </div>
          )}

          {/* Escáner QR activo */}
          {isScanning && !scannedCode && (
            <>
              <div className="relative w-full max-w-xs">
                {/* Contenedor del escáner */}
                <div 
                  id={scannerContainerId} 
                  className="w-full rounded-2xl overflow-hidden"
                  style={{ minHeight: "300px" }}
                />
                
                {/* Overlay con esquinas */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-2 left-2 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                  <div className="absolute top-2 right-2 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                  <div className="absolute bottom-2 left-2 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                  <div className="absolute bottom-2 right-2 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-xl" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Escanea el código QR</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Apunta la cámara al código QR de la estación de carga
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => {
                    stopScanner();
                    setShowManualInput(true);
                  }}
                >
                  <Keyboard className="h-5 w-5" />
                  Ingresar código manual
                </Button>
                
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full gap-2 text-red-500"
                  onClick={stopScanner}
                >
                  <X className="h-5 w-5" />
                  Cancelar escaneo
                </Button>
              </div>
            </>
          )}

          {/* Vista inicial o error de cámara */}
          {!isScanning && !showManualInput && !scannedCode && (
            <>
              {/* Área de escaneo (placeholder) */}
              <div className="relative w-64 h-64 rounded-3xl border-4 border-primary/50 flex items-center justify-center bg-card/50 backdrop-blur-sm">
                <div className="absolute inset-4 border-2 border-dashed border-primary/30 rounded-2xl" />
                <QrCode className="h-24 w-24 text-primary/50" />
                
                {/* Esquinas decorativas */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
              </div>

              {cameraError ? (
                <div className="text-center space-y-2 max-w-xs">
                  <h2 className="text-xl font-semibold text-red-500">Error de cámara</h2>
                  <p className="text-muted-foreground text-sm">
                    {cameraError}
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold">Escanea el código QR</h2>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Apunta la cámara al código QR de la estación de carga para iniciar
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleOpenCamera}
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
          )}

          {/* Entrada manual */}
          {showManualInput && !scannedCode && (
            <>
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
                    onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  />
                </div>

                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleManualSubmit}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Zap className="h-5 w-5" />
                  )}
                  Buscar estación
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleOpenCamera}
                >
                  Volver a escanear QR
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Acceso rápido al mapa */}
        {!isScanning && (
          <div className="p-6">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <button
                  onClick={() => {
                    stopScanner();
                    setLocation("/map");
                  }}
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
        )}
      </div>
    </UserLayout>
  );
}
