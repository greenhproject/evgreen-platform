/**
 * QRRedirect - Componente para manejar redirección desde códigos QR
 * 
 * Cuando un usuario escanea un QR con la cámara nativa del teléfono,
 * este componente captura el código y redirige a StartCharge.
 * 
 * URL: /c/:code -> /start-charge?code=:code
 */

import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Zap } from "lucide-react";

export default function QRRedirect() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (code) {
      // Redirigir a StartCharge con el código
      setLocation(`/start-charge?code=${code}`);
    } else {
      // Si no hay código, ir al escáner
      setLocation("/scan");
    }
  }, [code, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
        <Zap className="h-10 w-10 text-primary animate-pulse" />
      </div>
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-lg font-medium">Cargando estación...</span>
      </div>
      {code && (
        <p className="text-muted-foreground text-sm mt-2">
          Código: {code}
        </p>
      )}
    </div>
  );
}
