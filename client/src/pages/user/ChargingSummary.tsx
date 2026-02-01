/**
 * ChargingSummary - Pantalla de resumen post-carga
 * 
 * Muestra:
 * - Detalles completos de la transacción
 * - kWh totales, costo final, duración
 * - Información de la estación y conector
 * - Opciones para compartir (WhatsApp, Email)
 * - Opción de descargar recibo como imagen
 */

import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Zap, 
  Clock, 
  DollarSign, 
  Battery, 
  MapPin,
  Share2,
  Download,
  MessageCircle,
  Mail,
  Home,
  Receipt,
  Calendar,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import html2canvas from "html2canvas";

// Componente de banner publicitario para el resumen
function ChargingSummaryBanner() {
  const { data: banners } = trpc.banners.getActive.useQuery({ 
    type: "charging_session" 
  });
  
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 8000); // Rotar cada 8 segundos
    
    return () => clearInterval(interval);
  }, [banners]);
  
  if (!banners || banners.length === 0) {
    // Banner por defecto si no hay banners configurados
    return (
      <div className="w-full rounded-xl overflow-hidden shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 p-4">
        <div className="text-center text-white">
          <p className="font-bold text-lg">¡Gracias por cargar con EVGreen!</p>
          <p className="text-sm opacity-90">Contribuyes a un futuro más sostenible</p>
        </div>
      </div>
    );
  }
  
  const banner = banners[currentBannerIndex];
  
  return (
    <div className="w-full rounded-xl overflow-hidden shadow-lg">
      {banner.imageUrl ? (
        <img 
          src={banner.imageUrl} 
          alt={banner.title}
          className="w-full h-24 object-cover"
        />
      ) : (
        <div className="w-full h-24 bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center p-4">
          <div className="text-center text-white">
            <p className="font-bold text-lg">{banner.title}</p>
            {banner.description && (
              <p className="text-sm opacity-90">{banner.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Formatear tiempo
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} minutos`;
}

// Formatear moneda COP
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Formatear fecha
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default function ChargingSummary() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Obtener detalles de la transacción
  const { data: transaction, isLoading, error } = trpc.transactions.getById.useQuery(
    { id: parseInt(transactionId || "0") },
    { enabled: !!transactionId && !!user }
  );
  
  // Compartir por WhatsApp
  const shareWhatsApp = () => {
    if (!transaction) return;
    
    const message = `🔋 *Resumen de Carga EVGreen*\n\n` +
      `📍 Estación: ${transaction.stationName}\n` +
      `⚡ Energía: ${transaction.kwhConsumed} kWh\n` +
      `💰 Total: ${formatCurrency(transaction.totalCost || 0)}\n` +
      `⏱️ Duración: ${formatDuration(transaction.durationMinutes)}\n` +
      `📅 Fecha: ${formatDate(transaction.startTime)}\n\n` +
      `¡Carga tu vehículo eléctrico con EVGreen! 🚗⚡`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };
  
  // Compartir por Email
  const shareEmail = () => {
    if (!transaction) return;
    
    const subject = `Resumen de Carga EVGreen - ${formatDate(transaction.startTime)}`;
    const body = `Resumen de Carga EVGreen\n\n` +
      `Estación: ${transaction.stationName}\n` +
      `Energía consumida: ${transaction.kwhConsumed} kWh\n` +
      `Total pagado: ${formatCurrency(transaction.totalCost || 0)}\n` +
      `Duración: ${formatDuration(transaction.durationMinutes)}\n` +
      `Fecha: ${formatDate(transaction.startTime)}\n\n` +
      `Gracias por usar EVGreen para cargar tu vehículo eléctrico.`;
    
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };
  
  // Descargar recibo como imagen
  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    
    try {
      toast.info("Generando recibo...");
      
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      
      const link = document.createElement("a");
      link.download = `recibo-evgreen-${transactionId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast.success("Recibo descargado");
    } catch (err) {
      toast.error("Error al generar el recibo");
      console.error(err);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando resumen...</p>
        </div>
      </div>
    );
  }
  
  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Transacción no encontrada</h2>
            <p className="text-muted-foreground mb-4">
              No pudimos encontrar los detalles de esta transacción.
            </p>
            <Button onClick={() => setLocation("/map")}>
              <Home className="w-4 h-4 mr-2" />
              Ir al mapa
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background pb-24">
      {/* Header de éxito */}
      <div className="bg-emerald-600 text-white p-6 pb-12 rounded-b-3xl shadow-lg text-center">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold mb-1">¡Carga Completada!</h1>
        <p className="text-white/80">Tu vehículo ha sido cargado exitosamente</p>
      </div>
      
      {/* Recibo (para captura) */}
      <div className="px-4 -mt-6">
        <div ref={receiptRef} className="bg-background rounded-2xl shadow-xl overflow-hidden">
          {/* Encabezado del recibo */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6" />
                <span className="font-bold text-lg">EVGreen</span>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                <Receipt className="w-3 h-3 mr-1" />
                Recibo #{transaction.id}
              </Badge>
            </div>
          </div>
          
          {/* Información de la estación */}
          <div className="p-4 border-b">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold">{transaction.stationName}</p>
                <p className="text-sm text-muted-foreground">
                  Conector {transaction.connectorId} • {transaction.connectorType || "Type 2"}
                </p>
              </div>
            </div>
          </div>
          
          {/* Métricas principales */}
          <div className="p-4 grid grid-cols-2 gap-4">
            {/* Energía */}
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
              <Battery className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-600">
                {transaction.kwhConsumed}
              </p>
              <p className="text-xs text-muted-foreground">kWh</p>
            </div>
            
            {/* Duración */}
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
              <Clock className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-purple-600">
                {formatDuration(transaction.durationMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">Duración</p>
            </div>
          </div>
          
          {/* Detalles de la transacción */}
          <div className="px-4 pb-4">
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha y hora</span>
                  <span className="font-medium">{formatDate(transaction.startTime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tarifa aplicada</span>
                  <span className="font-medium">{formatCurrency(transaction.pricePerKwh || 800)}/kWh</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Energía consumida</span>
                  <span className="font-medium">{transaction.kwhConsumed} kWh</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total pagado</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(transaction.totalCost || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Footer del recibo */}
          <div className="px-4 pb-4">
            <div className="text-center text-xs text-muted-foreground">
              <p>Gracias por usar EVGreen</p>
              <p>www.evgreen.lat</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Banner publicitario */}
      <div className="px-4 mt-6">
        <ChargingSummaryBanner />
      </div>
      
      {/* Acciones */}
      <div className="px-4 mt-6 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Compartir recibo
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            onClick={shareWhatsApp}
          >
            <MessageCircle className="w-5 h-5 text-green-600" />
            <span className="text-xs">WhatsApp</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            onClick={shareEmail}
          >
            <Mail className="w-5 h-5 text-blue-600" />
            <span className="text-xs">Email</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            onClick={downloadReceipt}
          >
            <Download className="w-5 h-5 text-purple-600" />
            <span className="text-xs">Descargar</span>
          </Button>
        </div>
        
        {/* Botón principal */}
        <Button
          size="lg"
          className="w-full mt-6 h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setLocation("/map")}
        >
          <Home className="w-5 h-5 mr-2" />
          Volver al mapa
        </Button>
      </div>
    </div>
  );
}
