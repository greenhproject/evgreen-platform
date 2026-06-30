/**
 * Página de Escaneo QR para iniciar carga
 * - Capacitor nativo: @capacitor/camera + jsQR (no requiere getUserMedia/HTTPS)
 * - Web fallback: html5-qrcode con cámara del navegador
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Capacitor } from "@capacitor/core";
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
  RefreshCw,
} from "lucide-react";

const isNative = Capacitor.isNativePlatform();

export default function ScanPage() {
  const [, setLocation] = useLocation();
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [nativeScanStatus, setNativeScanStatus] = useState<"idle" | "scanning" | "done">("idle");
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";

  const searchStation = trpc.stations.listPublic.useQuery(undefined, {
    enabled: false,
  });

  useEffect(() => {
    return () => {
      stopWebScanner();
    };
  }, []);

  // ─── ESCANEO NATIVO (Capacitor iOS/Android) ───────────────────────────────

  const startNativeScan = async () => {
    setCameraError(null);
    setIsScanning(true);
    setNativeScanStatus("scanning");

    try {
      const { Camera: CapCamera, CameraResultType, CameraSource } = await import("@capacitor/camera");

      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      if (!photo.dataUrl) throw new Error("NO_IMAGE");

      // Decodificar QR desde la imagen
      const code = await decodeQRFromDataUrl(photo.dataUrl);

      if (!code) {
        setNativeScanStatus("idle");
        setIsScanning(false);
        setCameraError("No se encontró ningún código QR en la imagen. Intenta de nuevo enfocando directamente el código.");
        return;
      }

      setNativeScanStatus("done");
      setIsScanning(false);
      onScanSuccess(code);
    } catch (err: any) {
      setNativeScanStatus("idle");
      setIsScanning(false);

      if (err?.message === "User cancelled photos app" || err?.message?.includes("cancelled")) {
        // Usuario canceló — no mostrar error
        return;
      }
      if (err?.message === "NO_IMAGE") {
        setCameraError("No se pudo obtener la imagen. Intenta de nuevo.");
        return;
      }
      console.error("[QR] Error cámara nativa:", err);
      setCameraError(`Error al acceder a la cámara: ${err?.message || "Error desconocido"}`);
    }
  };

  const decodeQRFromDataUrl = (dataUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        import("jsqr").then(({ default: jsQR }) => {
          const result = jsQR(imageData.data, imageData.width, imageData.height);
          resolve(result?.data ?? null);
        }).catch(() => resolve(null));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };

  // ─── ESCANEO WEB (html5-qrcode) ───────────────────────────────────────────

  const startWebScanner = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("UNSUPPORTED");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        stream.getTracks().forEach(t => t.stop());
      } catch (permErr: any) {
        if (permErr.name === "NotAllowedError") throw new Error("PERMISSION_DENIED");
        if (permErr.name === "NotFoundError") throw new Error("NOT_FOUND");
        throw permErr;
      }

      const { Html5Qrcode } = await import("html5-qrcode");
      scannerRef.current = new Html5Qrcode(scannerContainerId);
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        onScanSuccess,
        () => {}
      );
    } catch (err: any) {
      setIsScanning(false);
      const msg = err?.message || "";
      if (msg === "PERMISSION_DENIED") setCameraError("Permiso de cámara denegado. Permite el acceso en la configuración del navegador.");
      else if (msg === "NOT_FOUND") setCameraError("No se encontró ninguna cámara en tu dispositivo.");
      else if (msg === "UNSUPPORTED") setCameraError("Tu navegador no soporta acceso a la cámara. Usa HTTPS y un navegador actualizado.");
      else setCameraError(`No se pudo acceder a la cámara (${err?.name || "Error"}). Usa el código manual.`);
    }
  };

  const stopWebScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ya detenido */ }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanner = () => {
    if (isNative) startNativeScan();
    else startWebScanner();
  };

  const stopScanner = () => {
    if (!isNative) stopWebScanner();
    else setIsScanning(false);
  };

  // ─── LÓGICA COMÚN ─────────────────────────────────────────────────────────

  const onScanSuccess = (decodedText: string) => {
    stopWebScanner();
    setScannedCode(decodedText);
    handleCodeFound(decodedText);
  };

  const handleCodeFound = async (rawCode: string) => {
    setIsSearching(true);

    let code = rawCode.trim();
    let isNumericId = false;

    if (code.startsWith("http://") || code.startsWith("https://")) {
      try {
        const url = new URL(code);
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          if (pathParts[0] === "charging" && /^\d+$/.test(lastPart)) {
            isNumericId = true;
            code = lastPart;
          } else {
            code = lastPart;
          }
        }
      } catch { /* usar rawCode */ }
    }

    toast.info("Código detectado", { description: code });

    try {
      const stations = await searchStation.refetch();
      let result: any = null;
      let matchedEvseId: number | null = null;

      if (isNumericId) {
        const evseId = parseInt(code);
        for (const s of stations.data || []) {
          const evses = (s as any).evses || (s as any).station?.evses || [];
          if (evses.find((e: any) => e.id === evseId)) {
            result = s;
            matchedEvseId = evseId;
            break;
          }
        }
      }

      if (!result) {
        result = stations.data?.find((s: any) => {
          const st = s.station || s;
          const sc = code.toUpperCase();
          return st.ocppIdentity?.toUpperCase() === sc || st.id.toString() === code || st.name?.toUpperCase().includes(sc);
        });
      }

      if (result) {
        const station = (result as any).station || result;
        toast.success("Estación encontrada", { description: station.name });
        const redirectUrl = matchedEvseId
          ? `/start-charge?code=${station.ocppIdentity || station.id}&evseId=${matchedEvseId}`
          : `/start-charge?code=${station.ocppIdentity || station.id}`;
        setTimeout(() => setLocation(redirectUrl), 1000);
      } else {
        toast.error("Estación no encontrada", { description: "El código escaneado no corresponde a ninguna estación registrada." });
        setScannedCode(null);
        setIsSearching(false);
      }
    } catch {
      toast.error("Error al buscar estación");
      setScannedCode(null);
      setIsSearching(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) { toast.error("Ingresa un código de estación"); return; }
    handleCodeFound(manualCode.trim());
  };

  // ─── UI ───────────────────────────────────────────────────────────────────

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { stopScanner(); setLocation("/map"); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Iniciar Carga</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          {/* Buscando estación */}
          {isSearching && scannedCode && (
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 border-r-emerald-400/30 animate-spin" style={{ animationDuration: "2s" }} />
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-emerald-500 border-l-emerald-500/30 animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
                <div className="absolute inset-4 rounded-full bg-emerald-500/10 animate-pulse" />
                <Zap className="h-10 w-10 text-emerald-400 drop-shadow-lg relative z-10" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">Buscando estación...</h2>
                <p className="text-muted-foreground text-sm">Código: <span className="font-mono text-emerald-400">{scannedCode}</span></p>
              </div>
              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-white" /></div>
                  <span className="text-sm text-emerald-400">Código QR detectado</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"><Loader2 className="w-4 h-4 text-emerald-400 animate-spin" /></div>
                  <span className="text-sm text-muted-foreground">Verificando estación en la red...</span>
                </div>
              </div>
            </div>
          )}

          {/* Escáner web activo (solo en browser) */}
          {!isNative && isScanning && !scannedCode && (
            <>
              <div className="relative w-full max-w-xs">
                <div id={scannerContainerId} className="w-full rounded-2xl overflow-hidden" style={{ minHeight: "300px" }} />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-2 left-2 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                  <div className="absolute top-2 right-2 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                  <div className="absolute bottom-2 left-2 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                  <div className="absolute bottom-2 right-2 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-xl" />
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button variant="outline" size="lg" className="w-full gap-2" onClick={() => { stopWebScanner(); setShowManualInput(true); }}>
                  <Keyboard className="h-5 w-5" />Ingresar código manual
                </Button>
                <Button variant="ghost" size="lg" className="w-full gap-2 text-red-500" onClick={stopWebScanner}>
                  <X className="h-5 w-5" />Cancelar escaneo
                </Button>
              </div>
            </>
          )}

          {/* Vista inicial / error */}
          {!isScanning && !showManualInput && !scannedCode && (
            <>
              <div className="relative w-64 h-64 rounded-3xl border-4 border-primary/50 flex items-center justify-center bg-card/50 backdrop-blur-sm">
                <div className="absolute inset-4 border-2 border-dashed border-primary/30 rounded-2xl" />
                <QrCode className="h-24 w-24 text-primary/50" />
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
              </div>

              {cameraError ? (
                <div className="text-center space-y-2 max-w-xs">
                  <h2 className="text-xl font-semibold text-red-500">Error de cámara</h2>
                  <p className="text-muted-foreground text-sm">{cameraError}</p>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold">Escanea el código QR</h2>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    {isNative
                      ? "Toca 'Abrir cámara', apunta al código QR de la estación y toma la foto"
                      : "Apunta la cámara al código QR de la estación de carga para iniciar"}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button size="lg" className="w-full gap-2" onClick={startScanner}>
                  {cameraError ? <RefreshCw className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                  {cameraError ? "Intentar de nuevo" : "Abrir cámara"}
                </Button>
                <Button variant="outline" size="lg" className="w-full gap-2" onClick={() => setShowManualInput(true)}>
                  <Keyboard className="h-5 w-5" />Ingresar código manual
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
                <p className="text-muted-foreground text-sm max-w-xs">Ingresa el código que aparece en la estación de carga</p>
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
                    autoFocus
                  />
                </div>
                <Button size="lg" className="w-full gap-2" onClick={handleManualSubmit} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                  Buscar estación
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => { setShowManualInput(false); setCameraError(null); }}>
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
                <button onClick={() => { stopScanner(); setLocation("/map"); }} className="flex items-center gap-4 w-full text-left">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">¿No tienes el código?</p>
                    <p className="text-sm text-muted-foreground">Busca estaciones cercanas en el mapa</p>
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
