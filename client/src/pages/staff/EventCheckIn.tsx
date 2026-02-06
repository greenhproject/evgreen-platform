import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Building2,
  Mail,
  Phone,
  CreditCard,
  Zap,
  Camera,
  StopCircle,
} from "lucide-react";

export default function EventCheckIn() {
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkInMutation = trpc.event.checkIn.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      if (data.success) {
        toast.success(data.message);
      } else if (data.alreadyCheckedIn) {
        toast.warning(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
      setLastResult({ success: false, message: error.message });
    },
  });

  const guestQuery = trpc.event.getGuestByQR.useQuery(
    { qrCode: scannedCode || "" },
    { enabled: !!scannedCode }
  );

  const startScanning = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      // Importar html5-qrcode dinámicamente
      const { Html5Qrcode } = await import("html5-qrcode");
      
      // Usar un enfoque más simple: escanear frames del video
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        try {
          const imageData = canvas.toDataURL("image/png");
          const html5QrCode = new Html5Qrcode("qr-reader-hidden");
          const result = await html5QrCode.scanFileV2(
            dataURLtoFile(imageData, "frame.png"),
            false
          );
          
          if (result && result.decodedText) {
            // Extraer código QR del URL o usar directamente
            let code = result.decodedText;
            if (code.includes("/event-checkin/")) {
              code = code.split("/event-checkin/").pop() || code;
            }
            
            setScannedCode(code);
            stopScanning();
            
            // Realizar check-in automáticamente
            checkInMutation.mutate({ qrCode: code });
          }
          
          await html5QrCode.clear();
        } catch {
          // No se encontró QR en este frame, continuar escaneando
        }
      }, 1000);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }, [checkInMutation]);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  }, []);

  // Función para convertir dataURL a File
  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // Entrada manual de código QR
  const [manualCode, setManualCode] = useState("");
  const handleManualCheckIn = () => {
    if (!manualCode.trim()) return;
    setScannedCode(manualCode.trim());
    checkInMutation.mutate({ qrCode: manualCode.trim() });
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const guest = lastResult?.guest || guestQuery.data;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-8 w-8 text-green-500" />
          <h1 className="text-2xl font-bold">Check-in del Evento</h1>
        </div>
        <p className="text-muted-foreground">
          Escanea el código QR de la invitación o ingresa el código manualmente
        </p>
      </div>

      {/* Scanner */}
      <Card className="border-green-500/20">
        <CardContent className="p-4 space-y-4">
          {/* Video preview */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{ display: scanning ? "block" : "none" }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div id="qr-reader-hidden" className="hidden" />
            
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                <ScanLine className="h-16 w-16 text-green-500/50" />
                <p className="text-muted-foreground text-sm">
                  Presiona para iniciar el escáner
                </p>
              </div>
            )}

            {scanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-[15%] border-2 border-green-500/50 rounded-lg">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg" />
                </div>
              </div>
            )}
          </div>

          {/* Botones de control */}
          <div className="flex gap-2">
            {!scanning ? (
              <Button
                onClick={startScanning}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Camera className="mr-2 h-4 w-4" />
                Iniciar Escáner
              </Button>
            ) : (
              <Button
                onClick={stopScanning}
                variant="destructive"
                className="flex-1"
              >
                <StopCircle className="mr-2 h-4 w-4" />
                Detener Escáner
              </Button>
            )}
          </div>

          {/* Entrada manual */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ingresa código QR manualmente (ej: EVG-XXXXXXXX-XXXX)"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleManualCheckIn()}
            />
            <Button
              onClick={handleManualCheckIn}
              disabled={!manualCode.trim() || checkInMutation.isPending}
              variant="outline"
            >
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado del check-in */}
      {lastResult && (
        <Card
          className={`border-2 ${
            lastResult.success
              ? "border-green-500/50 bg-green-500/5"
              : lastResult.alreadyCheckedIn
              ? "border-yellow-500/50 bg-yellow-500/5"
              : "border-red-500/50 bg-red-500/5"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              {lastResult.success ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : lastResult.alreadyCheckedIn ? (
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <h3 className="font-bold text-lg">
                  {lastResult.success
                    ? "Check-in Exitoso"
                    : lastResult.alreadyCheckedIn
                    ? "Ya Registrado"
                    : "Error"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {lastResult.message}
                </p>
              </div>
            </div>

            {guest && (
              <div className="space-y-3 mt-4 pt-4 border-t border-border/40">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{guest.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{guest.email}</span>
                  </div>
                  {guest.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{guest.phone}</span>
                    </div>
                  )}
                  {guest.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{guest.company}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {guest.founderSlot && (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                      Cupo Fundador #{guest.founderSlot}
                    </Badge>
                  )}
                  {guest.investmentPackage && (
                    <Badge variant="outline">
                      <CreditCard className="mr-1 h-3 w-3" />
                      {guest.investmentPackage === "AC"
                        ? "AC Básico"
                        : guest.investmentPackage === "DC_INDIVIDUAL"
                        ? "DC Individual"
                        : "Colectivo"}
                    </Badge>
                  )}
                  <Badge
                    variant={
                      guest.status === "CHECKED_IN"
                        ? "default"
                        : guest.status === "CONFIRMED"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {guest.status === "CHECKED_IN"
                      ? "Registrado"
                      : guest.status === "CONFIRMED"
                      ? "Confirmado"
                      : guest.status}
                  </Badge>
                </div>
              </div>
            )}

            {/* Botón para nuevo escaneo */}
            <Button
              onClick={() => {
                setLastResult(null);
                setScannedCode(null);
                setManualCode("");
              }}
              className="w-full mt-4 bg-green-600 hover:bg-green-700"
            >
              <ScanLine className="mr-2 h-4 w-4" />
              Escanear Siguiente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {checkInMutation.isPending && (
        <Card className="border-blue-500/20">
          <CardContent className="p-4 flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Procesando check-in...</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
