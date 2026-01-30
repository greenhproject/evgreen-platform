import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, QrCode, Smartphone, Copy, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

interface StationQRCodeProps {
  stationCode: string;
  stationName: string;
  stationAddress?: string;
  onClose?: () => void;
}

export function StationQRCode({ stationCode, stationName, stationAddress, onClose }: StationQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  
  // El QR contiene una URL corta que funciona con cualquier escáner
  // Formato: https://evgreen.lat/c/CP001 - redirige automáticamente a StartCharge
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://evgreen.lat';
  const qrContent = `${baseUrl}/c/${stationCode}`;
  
  useEffect(() => {
    generateQR();
  }, [stationCode]);
  
  const generateQR = async () => {
    if (!canvasRef.current) return;
    
    try {
      // Generar QR con alta calidad - solo el código de estación
      await QRCode.toCanvas(canvasRef.current, qrContent, {
        width: 280,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H", // Alta corrección de errores
      });
      
      // Guardar como data URL para descarga
      const dataUrl = canvasRef.current.toDataURL("image/png");
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("Error generando QR:", err);
      toast.error("Error al generar código QR");
    }
  };
  
  const downloadQR = () => {
    if (!qrDataUrl) return;
    
    // Crear canvas más grande para impresión con diseño profesional
    const printCanvas = document.createElement("canvas");
    const ctx = printCanvas.getContext("2d");
    if (!ctx) return;
    
    // Tamaño para impresión (300 DPI equivalente)
    const width = 400;
    const height = 550;
    printCanvas.width = width;
    printCanvas.height = height;
    
    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    
    // Borde verde
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    // Logo/Título
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("⚡ EVGreen", width / 2, 55);
    
    // Subtítulo
    ctx.fillStyle = "#666666";
    ctx.font = "16px Arial";
    ctx.fillText("Escanea para cargar tu vehículo", width / 2, 85);
    
    // Cargar imagen QR
    const qrImg = new Image();
    qrImg.onload = () => {
      // Dibujar QR centrado
      const qrSize = 260;
      const qrX = (width - qrSize) / 2;
      const qrY = 110;
      
      // Borde del QR
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      
      // Código de estación
      ctx.fillStyle = "#111827";
      ctx.font = "bold 28px monospace";
      ctx.fillText(stationCode, width / 2, qrY + qrSize + 45);
      
      // Nombre de estación
      ctx.fillStyle = "#4b5563";
      ctx.font = "14px Arial";
      const truncatedName = stationName.length > 35 ? stationName.substring(0, 35) + "..." : stationName;
      ctx.fillText(truncatedName, width / 2, qrY + qrSize + 75);
      
      // Instrucciones
      ctx.fillStyle = "#9ca3af";
      ctx.font = "12px Arial";
      ctx.fillText("O ingresa el código manualmente en la app", width / 2, height - 35);
      ctx.fillText("www.evgreen.lat", width / 2, height - 18);
      
      // Descargar
      const link = document.createElement("a");
      link.download = `qr-${stationCode}.png`;
      link.href = printCanvas.toDataURL("image/png");
      link.click();
      
      toast.success("QR descargado para impresión");
    };
    qrImg.src = qrDataUrl;
  };
  
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(stationCode);
      setCopied(true);
      toast.success("Código copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Error al copiar");
    }
  };
  
  const printQR = () => {
    // Crear ventana de impresión
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Permite ventanas emergentes para imprimir");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR ${stationCode} - EVGreen</title>
        <style>
          @page { size: 100mm 140mm; margin: 0; }
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .container {
            border: 3px solid #10b981;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            max-width: 300px;
          }
          .logo {
            color: #10b981;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .subtitle {
            color: #666;
            font-size: 12px;
            margin-bottom: 15px;
          }
          .qr-container {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 8px;
            display: inline-block;
          }
          .qr-container img {
            display: block;
            width: 200px;
            height: 200px;
          }
          .code {
            font-family: monospace;
            font-size: 24px;
            font-weight: bold;
            color: #111;
            margin: 15px 0 5px;
            letter-spacing: 2px;
          }
          .station-name {
            color: #666;
            font-size: 11px;
            margin-bottom: 15px;
          }
          .footer {
            color: #999;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ EVGreen</div>
          <div class="subtitle">Escanea para cargar tu vehículo</div>
          <div class="qr-container">
            <img src="${qrDataUrl}" alt="QR Code" />
          </div>
          <div class="code">${stationCode}</div>
          <div class="station-name">${stationName}</div>
          <div class="footer">
            O ingresa el código manualmente en la app<br/>
            www.evgreen.lat
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };
  
  return (
    <div className="space-y-6">
      {/* Vista previa del QR */}
      <div className="flex flex-col items-center">
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <canvas ref={canvasRef} className="block" />
        </div>
        
        {/* Código de estación */}
        <div className="mt-4 flex items-center gap-2">
          <Badge variant="outline" className="text-lg font-mono px-4 py-2">
            {stationCode}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={copyCode}
            title="Copiar código"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2 text-center">
          {stationName}
        </p>
      </div>
      
      {/* Acciones */}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={downloadQR} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Descargar PNG
        </Button>
        <Button onClick={printQR} variant="outline" className="flex items-center gap-2">
          <Printer className="w-4 h-4" />
          Imprimir
        </Button>
      </div>
      
      {/* Instrucciones */}
      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Instrucciones de uso
          </h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Descarga o imprime el código QR</li>
            <li>Instala el QR en un lugar visible del cargador</li>
            <li>Los usuarios pueden escanear con la app EVGreen</li>
            <li>También pueden ingresar el código <strong>{stationCode}</strong> manualmente</li>
          </ol>
        </CardContent>
      </Card>
      
      {/* Info del QR */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-1">El QR contiene el código:</p>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{qrContent}</code>
      </div>
    </div>
  );
}

export default StationQRCode;
