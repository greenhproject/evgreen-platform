/**
 * StartCharge - Flujo de inicio de carga de vehículo eléctrico
 * 
 * Pasos:
 * 1. Escanear QR de la estación
 * 2. Seleccionar conector disponible
 * 3. Elegir modo de carga (valor fijo, porcentaje, completa)
 * 4. Confirmar y comenzar carga
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  QrCode, 
  Zap, 
  Battery, 
  DollarSign, 
  Percent, 
  BatteryFull,
  MapPin,
  Plug,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";

type Step = "scan" | "select_connector" | "charge_options" | "confirm";
type ChargeMode = "fixed_amount" | "percentage" | "full_charge";

export default function StartCharge() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user } = useAuth();
  
  // Obtener código de la URL si viene de escaneo QR
  const urlParams = new URLSearchParams(searchString);
  const codeFromUrl = urlParams.get("code");
  
  const [step, setStep] = useState<Step>(codeFromUrl ? "scan" : "scan");
  const [stationCode, setStationCode] = useState(codeFromUrl || "");
  const [autoSearchDone, setAutoSearchDone] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<number | null>(null);
  const [chargeMode, setChargeMode] = useState<ChargeMode>("full_charge");
  const [targetValue, setTargetValue] = useState(80); // % o $ según el modo
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner-container";
  
  // Query para obtener estación por código
  const stationQuery = trpc.charging.getStationByCode.useQuery(
    { code: stationCode },
    { enabled: stationCode.length > 0 && step === "scan" }
  );
  
  // Query para obtener conectores disponibles
  const connectorsQuery = trpc.charging.getAvailableConnectors.useQuery(
    { stationId: stationQuery.data?.station.id || 0 },
    { enabled: !!stationQuery.data?.station.id && step === "select_connector" }
  );
  
  // Query para validar saldo y obtener estimación
  const estimateQuery = trpc.charging.validateAndEstimate.useQuery(
    {
      stationId: stationQuery.data?.station.id || 0,
      connectorId: selectedConnector || 0,
      chargeMode,
      targetValue: chargeMode === "full_charge" ? 100 : targetValue,
    },
    { 
      enabled: !!stationQuery.data?.station.id && selectedConnector !== null && step === "charge_options",
      refetchInterval: 10000, // Actualizar cada 10 segundos
    }
  );
  
  // Mutation para iniciar carga
  const startChargeMutation = trpc.charging.startCharge.useMutation({
    onSuccess: (data) => {
      toast.success("¡Carga iniciada!", {
        description: "Conecta tu vehículo al cargador",
      });
      // Redirigir a la pantalla de espera de conexión
      setLocation(`/charging-waiting?stationId=${stationQuery.data?.station.id}&connectorId=${selectedConnector}`);
    },
    onError: (error) => {
      toast.error("Error al iniciar carga", {
        description: error.message,
      });
      setIsStarting(false);
    },
  });
  
  // Manejar escaneo de QR o entrada manual
  const handleStationSearch = () => {
    if (stationCode.length < 2) {
      toast.error("Ingresa un código válido");
      return;
    }
    stationQuery.refetch();
  };
  
  // Extraer código de estación del texto escaneado
  const extractStationCode = (scannedText: string): string => {
    // Si es una URL, extraer el código
    if (scannedText.includes('/c/')) {
      const match = scannedText.match(/\/c\/([^/?]+)/);
      if (match) return match[1].toUpperCase();
    }
    if (scannedText.includes('/scan/')) {
      const match = scannedText.match(/\/scan\/([^/?]+)/);
      if (match) return match[1].toUpperCase();
    }
    if (scannedText.includes('/charging/')) {
      const match = scannedText.match(/\/charging\/([^/?]+)/);
      if (match) return match[1].toUpperCase();
    }
    // Si no es URL, devolver el texto como está
    return scannedText.toUpperCase().trim();
  };
  
  // Feedback de escaneo exitoso: sonido elegante y vibración sutil
  const playScanFeedback = useCallback(() => {
    // Vibración corta y sutil (50ms)
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    // Sonido elegante usando Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Crear un sonido de "ding" elegante con dos tonos armónicos
      const playTone = (frequency: number, startTime: number, duration: number, volume: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        // Envelope suave para un sonido elegante
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      // Acorde de éxito: Do mayor (C5 + E5 + G5) con fade elegante
      playTone(523.25, now, 0.15, 0.12);       // C5
      playTone(659.25, now + 0.02, 0.13, 0.08); // E5
      playTone(783.99, now + 0.04, 0.11, 0.06); // G5
      
      // Cerrar el contexto después de que termine el sonido
      setTimeout(() => {
        audioContext.close();
      }, 200);
    } catch (error) {
      // Si falla el audio, al menos la vibración ya se ejecutó
      console.log('Audio feedback not available');
    }
  }, []);
  
  // Iniciar escáner QR
  const startScanner = useCallback(async () => {
    setScannerError(null);
    
    try {
      // Crear instancia del escáner si no existe
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }
      
      // Verificar si ya está escaneando
      if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        return;
      }
      
      setIsScanning(true);
      
      await scannerRef.current.start(
        { facingMode: "environment" }, // Cámara trasera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // QR escaneado exitosamente
          const code = extractStationCode(decodedText);
          
          // Feedback: sonido elegante + vibración sutil
          playScanFeedback();
          
          setStationCode(code);
          stopScanner();
          toast.success("Código escaneado", {
            description: `Estación: ${code}`,
          });
          // Buscar la estación automáticamente
          setTimeout(() => {
            stationQuery.refetch();
          }, 100);
        },
        (errorMessage) => {
          // Error de escaneo (ignorar, es normal mientras busca)
        }
      );
    } catch (error: any) {
      setIsScanning(false);
      if (error.message?.includes('Permission denied') || error.name === 'NotAllowedError') {
        setScannerError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara.");
      } else if (error.message?.includes('not found') || error.name === 'NotFoundError') {
        setScannerError("No se encontró una cámara disponible.");
      } else {
        setScannerError("Error al iniciar la cámara. Intenta de nuevo.");
      }
      console.error("Error starting scanner:", error);
    }
  }, [stationQuery]);
  
  // Detener escáner QR
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setIsScanning(false);
  }, []);
  
  // Limpiar escáner al desmontar o cambiar de paso
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
            scannerRef.current.stop();
          }
        } catch (error) {
          // Ignorar errores al limpiar
        }
      }
    };
  }, []);
  
  // Detener escáner cuando se cambia de paso
  useEffect(() => {
    if (step !== "scan" && isScanning) {
      stopScanner();
    }
  }, [step, isScanning, stopScanner]);
  
  // Auto-buscar si viene con código desde URL (escaneo QR)
  useEffect(() => {
    if (codeFromUrl && !autoSearchDone) {
      setAutoSearchDone(true);
      // La query se ejecutará automáticamente porque stationCode ya tiene valor
    }
  }, [codeFromUrl, autoSearchDone]);
  
  // Avanzar al siguiente paso cuando se encuentra la estación
  useEffect(() => {
    if (stationQuery.data && step === "scan") {
      if (!stationQuery.data.isOnline) {
        toast.error("Estación desconectada", {
          description: "Esta estación no está disponible en este momento",
        });
        return;
      }
      setStep("select_connector");
    }
  }, [stationQuery.data, step]);
  
  // Seleccionar conector
  const handleSelectConnector = (connectorId: number) => {
    console.log("[StartCharge] Selecting connector:", connectorId);
    setSelectedConnector(connectorId);
    setStep("charge_options");
  };
  
  // Iniciar carga
  const handleStartCharge = async () => {
    if (!stationQuery.data || selectedConnector === null) return;
    
    setIsStarting(true);
    startChargeMutation.mutate({
      stationId: stationQuery.data.station.id,
      connectorId: selectedConnector,
      chargeMode,
      targetValue: chargeMode === "full_charge" ? 100 : targetValue,
    });
  };
  
  // Obtener color según nivel de demanda
  const getDemandColor = (level: string) => {
    switch (level) {
      case "LOW": return "text-green-500";
      case "NORMAL": return "text-blue-500";
      case "HIGH": return "text-orange-500";
      case "SURGE": return "text-red-500";
      default: return "text-gray-500";
    }
  };
  
  // Obtener icono según nivel de demanda
  const getDemandIcon = (level: string) => {
    switch (level) {
      case "LOW": return <TrendingDown className="h-4 w-4" />;
      case "HIGH": 
      case "SURGE": return <TrendingUp className="h-4 w-4" />;
      default: return <Minus className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-8 pb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Iniciar Carga</h1>
          <p className="text-muted-foreground">
            {step === "scan" && "Escanea el código QR de la estación"}
            {step === "select_connector" && "Selecciona un conector disponible"}
            {step === "charge_options" && "Configura tu sesión de carga"}
            {step === "confirm" && "Confirma para iniciar"}
          </p>
        </div>
        
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {["scan", "select_connector", "charge_options", "confirm"].map((s, i) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                step === s ? "w-8 bg-primary" : 
                ["scan", "select_connector", "charge_options", "confirm"].indexOf(step) > i 
                  ? "w-4 bg-primary/50" 
                  : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>
        
        {/* Step 1: Scan QR */}
        {step === "scan" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Identificar Estación
              </CardTitle>
              <CardDescription>
                Escanea el código QR o ingresa el ID de la estación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Scanner */}
              <div className="relative">
                {/* Contenedor del escáner */}
                <div 
                  id={scannerContainerId}
                  className={`aspect-square bg-black rounded-lg overflow-hidden ${
                    !isScanning ? 'hidden' : ''
                  }`}
                />
                
                {/* Estado inicial - botón para iniciar */}
                {!isScanning && !scannerError && (
                  <div 
                    className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-primary/30 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    onClick={startScanner}
                  >
                    <div className="text-center p-4">
                      <div className="relative mb-4">
                        <QrCode className="h-16 w-16 mx-auto text-primary/70" />
                        <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                          <Zap className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Toca para escanear
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Apunta al código QR de la estación
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Error de escáner */}
                {scannerError && (
                  <div className="aspect-square bg-destructive/10 rounded-lg flex flex-col items-center justify-center border-2 border-destructive/30 p-4">
                    <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                    <p className="text-sm text-destructive text-center mb-4">
                      {scannerError}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setScannerError(null);
                        startScanner();
                      }}
                    >
                      Intentar de nuevo
                    </Button>
                  </div>
                )}
                
                {/* Botón para detener escaneo */}
                {isScanning && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
                    onClick={stopScanner}
                  >
                    Cancelar escaneo
                  </Button>
                )}
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    O ingresa manualmente
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="station-code">ID de Estación</Label>
                <div className="flex gap-2">
                  <Input
                    id="station-code"
                    placeholder="Ej: CP001 o 1"
                    value={stationCode}
                    onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleStationSearch()}
                  />
                  <Button 
                    onClick={handleStationSearch}
                    disabled={stationQuery.isLoading}
                  >
                    {stationQuery.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {stationQuery.error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {stationQuery.error.message}
                </div>
              )}
              
              {/* Botón para volver al mapa */}
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => setLocation("/map")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al mapa
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Step 2: Select Connector */}
        {step === "select_connector" && stationQuery.data && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {stationQuery.data.station.name}
                  </CardTitle>
                  <CardDescription>
                    {stationQuery.data.station.address}
                  </CardDescription>
                </div>
                <Badge variant={stationQuery.data.isOnline ? "default" : "destructive"}>
                  {stationQuery.data.isOnline ? "En línea" : "Desconectada"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>Selecciona un conector</Label>
              
              {connectorsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : connectorsQuery.data && connectorsQuery.data.length > 0 ? (
                <div className="grid gap-3">
                  {connectorsQuery.data.map((connector, index) => {
                    // Traducir estado a español
                    const getStatusText = (status: string) => {
                      const statusMap: Record<string, string> = {
                        'AVAILABLE': 'Disponible',
                        'OCCUPIED': 'Ocupado',
                        'CHARGING': 'Cargando',
                        'FAULTED': 'En falla',
                        'UNAVAILABLE': 'No disponible',
                        'RESERVED': 'Reservado',
                        'PREPARING': 'Preparando',
                        'FINISHING': 'Finalizando',
                        'SUSPENDED_EV': 'Suspendido (EV)',
                        'SUSPENDED_EVSE': 'Suspendido (EVSE)',
                      };
                      return statusMap[status?.toUpperCase()] || status;
                    };
                    
                    return (
                      <button
                        key={connector.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("[StartCharge] Button clicked, connector:", connector);
                          if (connector.isAvailable) {
                            handleSelectConnector(connector.connectorId);
                          } else {
                            console.log("[StartCharge] Connector not available, status:", connector.status);
                          }
                        }}
                        disabled={!connector.isAvailable}
                        className={`p-4 rounded-lg border-2 transition-all text-left w-full ${
                          connector.isAvailable
                            ? "border-primary/30 hover:border-primary hover:bg-primary/5 cursor-pointer active:scale-[0.98]"
                            : "border-muted bg-muted/50 cursor-not-allowed opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              connector.isAvailable ? "bg-green-500/10" : "bg-muted"
                            }`}>
                              <Plug className={`h-5 w-5 ${
                                connector.isAvailable ? "text-green-500" : "text-muted-foreground"
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium">Conector {connector.connectorNumber || connector.connectorId}</p>
                              <p className="text-sm text-muted-foreground">
                                {connector.type?.replace('_', ' ')} • {Number(connector.powerKw).toFixed(0)} kW
                              </p>
                            </div>
                          </div>
                          <Badge variant={connector.isAvailable ? "default" : "secondary"}>
                            {getStatusText(connector.status)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Plug className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay conectores disponibles</p>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setStep("scan");
                  setStationCode("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Buscar otra estación
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Step 3: Charge Options */}
        {step === "charge_options" && stationQuery.data && (
          <div className="space-y-4">
            {/* Wallet Balance Card */}
            <Card className={`${
              estimateQuery.data?.hasSufficientBalance 
                ? "border-green-500/30 bg-green-500/5" 
                : "border-destructive/30 bg-destructive/5"
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className={`h-5 w-5 ${
                      estimateQuery.data?.hasSufficientBalance ? "text-green-500" : "text-destructive"
                    }`} />
                    <div>
                      <p className="text-sm text-muted-foreground">Tu saldo</p>
                      <p className="text-xl font-bold">
                        ${estimateQuery.data?.balance.toLocaleString() || 0} COP
                      </p>
                    </div>
                  </div>
                  {!estimateQuery.data?.hasSufficientBalance && (
                    <Button size="sm" onClick={() => setLocation("/user/wallet")}>
                      Recargar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Price Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm">Tarifa actual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      ${estimateQuery.data?.pricePerKwh.toLocaleString() || 0}/kWh
                    </span>
                    {estimateQuery.data && (
                      <span className={`flex items-center gap-1 text-xs ${getDemandColor(estimateQuery.data.demandLevel)}`}>
                        {getDemandIcon(estimateQuery.data.demandLevel)}
                        {estimateQuery.data.demandLevel}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Charge Mode Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Cómo quieres cargar?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setChargeMode("fixed_amount");
                      setTargetValue(50000);
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      chargeMode === "fixed_amount"
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <DollarSign className={`h-6 w-6 mx-auto mb-1 ${
                      chargeMode === "fixed_amount" ? "text-primary" : "text-muted-foreground"
                    }`} />
                    <p className="text-xs font-medium">Valor fijo</p>
                  </button>
                  
                  <button
                    onClick={() => {
                      setChargeMode("percentage");
                      setTargetValue(80);
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      chargeMode === "percentage"
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <Percent className={`h-6 w-6 mx-auto mb-1 ${
                      chargeMode === "percentage" ? "text-primary" : "text-muted-foreground"
                    }`} />
                    <p className="text-xs font-medium">Porcentaje</p>
                  </button>
                  
                  <button
                    onClick={() => setChargeMode("full_charge")}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      chargeMode === "full_charge"
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <BatteryFull className={`h-6 w-6 mx-auto mb-1 ${
                      chargeMode === "full_charge" ? "text-primary" : "text-muted-foreground"
                    }`} />
                    <p className="text-xs font-medium">Completa</p>
                  </button>
                </div>
                
                {/* Slider for fixed_amount or percentage */}
                {chargeMode !== "full_charge" && (
                  <div className="space-y-4 pt-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-primary">
                        {chargeMode === "fixed_amount" 
                          ? `$${targetValue.toLocaleString()}`
                          : `${targetValue}%`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {chargeMode === "fixed_amount" ? "COP" : "de batería"}
                      </p>
                    </div>
                    
                    <Slider
                      value={[targetValue]}
                      onValueChange={(v) => setTargetValue(v[0])}
                      min={chargeMode === "fixed_amount" ? 10000 : 30}
                      max={chargeMode === "fixed_amount" ? 200000 : 100}
                      step={chargeMode === "fixed_amount" ? 5000 : 5}
                      className="py-4"
                    />
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{chargeMode === "fixed_amount" ? "$10,000" : "30%"}</span>
                      <span>{chargeMode === "fixed_amount" ? "$200,000" : "100%"}</span>
                    </div>
                  </div>
                )}
                
                {/* Estimation */}
                {estimateQuery.data && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3 mt-4">
                    <p className="text-sm font-medium text-muted-foreground">Estimación</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <Battery className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-bold">{estimateQuery.data.estimatedKwh}</p>
                        <p className="text-xs text-muted-foreground">kWh</p>
                      </div>
                      <div>
                        <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-bold">{estimateQuery.data.estimatedTime}</p>
                        <p className="text-xs text-muted-foreground">minutos</p>
                      </div>
                      <div>
                        <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-bold">${estimateQuery.data.estimatedCost.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">COP</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Action buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setStep("select_connector");
                  setSelectedConnector(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Atrás
              </Button>
              <Button 
                className="flex-1"
                onClick={handleStartCharge}
                disabled={
                  isStarting || 
                  !estimateQuery.data?.hasSufficientBalance ||
                  estimateQuery.isLoading
                }
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Iniciar Carga
                  </>
                )}
              </Button>
            </div>
            
            {!estimateQuery.data?.hasSufficientBalance && estimateQuery.data && (
              <p className="text-center text-sm text-destructive">
                Te faltan ${estimateQuery.data.shortfall.toLocaleString()} COP para esta carga
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
