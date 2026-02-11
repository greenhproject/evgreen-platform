/**
 * ChargingSummary - Pantalla de resumen post-carga
 * 
 * Muestra:
 * - Detalles completos de la transacción
 * - kWh totales, costo final, duración
 * - Información de la estación y conector
 * - Opciones para compartir (WhatsApp, Email)
 * - Opción de descargar recibo como PDF profesional
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
  AlertCircle,
  FileText
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { jsPDF } from "jspdf";
import { EVGREEN_LOGO_BASE64 } from "@/assets/evgreen-logo-base64";

// Componente de banner publicitario para el resumen
function ChargingSummaryBanner() {
  const { data: banners } = trpc.banners.getActive.useQuery({ 
    type: "CHARGING" 
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

// Formatear fecha corta para el PDF
function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ChargingSummary() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Obtener detalles de la transacción
  const { data: transaction, isLoading, error } = trpc.transactions.getById.useQuery(
    { id: parseInt(transactionId || "0") },
    { enabled: !!transactionId && !!user }
  );
  
  // Estado para controlar la animación de confetti
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Efecto para lanzar confetti cuando se carga la transacción
  useEffect(() => {
    if (transaction && !showConfetti) {
      setShowConfetti(true);
      
      // Lanzar confetti de celebración
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
      
      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };
      
      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        
        const particleCount = 50 * (timeLeft / duration);
        
        // Confetti desde la izquierda
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6']
        });
        
        // Confetti desde la derecha
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6']
        });
      }, 250);
      
      // Limpiar intervalo después de la duración
      setTimeout(() => clearInterval(interval), duration);
    }
  }, [transaction, showConfetti]);
  
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
  
  // Generar y descargar recibo PDF profesional
  const downloadReceiptPdf = async () => {
    if (!transaction) return;
    
    setIsGeneratingPdf(true);
    toast.info("Generando recibo PDF...");
    
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let y = margin;
      
      // Colores de la marca
      const primaryColor: [number, number, number] = [16, 185, 129]; // emerald-500
      const darkColor: [number, number, number] = [31, 41, 55]; // gray-800
      const lightGray: [number, number, number] = [156, 163, 175]; // gray-400
      const white: [number, number, number] = [255, 255, 255];
      
      // Header con gradiente simulado (rectángulo verde)
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 55, "F");
      
      // Logo de EVGreen (imagen real)
      try {
        // Agregar logo en el header (45mm de ancho, proporcional)
        doc.addImage(EVGREEN_LOGO_BASE64, "PNG", margin, 8, 45, 25);
      } catch (logoError) {
        // Fallback a texto si falla la imagen
        console.warn("No se pudo cargar el logo, usando texto", logoError);
        doc.setTextColor(...white);
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text("EVGreen", margin, 25);
      }
      
      // Subtítulo (a la derecha del logo)
      doc.setTextColor(...white);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Recibo de Carga Eléctrica", margin, 42);
      
      // Número de recibo (esquina superior derecha)
      doc.setFontSize(10);
      doc.text(`Recibo #${transaction.id}`, pageWidth - margin, 20, { align: "right" });
      doc.text(formatDateShort(transaction.startTime), pageWidth - margin, 30, { align: "right" });
      
      y = 70;
      
      // Sección: Información del cliente
      doc.setTextColor(...darkColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Información del Cliente", margin, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...lightGray);
      doc.text("Nombre:", margin, y);
      doc.setTextColor(...darkColor);
      doc.text(user?.name || "Cliente EVGreen", margin + 25, y);
      y += 6;
      
      doc.setTextColor(...lightGray);
      doc.text("Email:", margin, y);
      doc.setTextColor(...darkColor);
      doc.text(user?.email || "-", margin + 25, y);
      y += 12;
      
      // Línea separadora
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      // Sección: Información de la estación
      doc.setTextColor(...darkColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Estación de Carga", margin, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...lightGray);
      doc.text("Estación:", margin, y);
      doc.setTextColor(...darkColor);
      doc.text(transaction.stationName, margin + 25, y);
      y += 6;
      
      doc.setTextColor(...lightGray);
      doc.text("Conector:", margin, y);
      doc.setTextColor(...darkColor);
      doc.text(`#${transaction.connectorId} - ${transaction.connectorType || "Type 2"}`, margin + 25, y);
      y += 12;
      
      // Línea separadora
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      // Sección: Detalles de la carga (en un recuadro)
      doc.setFillColor(249, 250, 251); // gray-50
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 50, 3, 3, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Detalles de la Carga", margin + 5, y + 10);
      
      // Columna izquierda
      const col1X = margin + 5;
      const col2X = pageWidth / 2 + 5;
      let detailY = y + 20;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      // Energía
      doc.setTextColor(...lightGray);
      doc.text("Energía consumida:", col1X, detailY);
      doc.setTextColor(...primaryColor);
      doc.setFont("helvetica", "bold");
      doc.text(`${transaction.kwhConsumed} kWh`, col1X + 40, detailY);
      
      // Duración
      doc.setTextColor(...lightGray);
      doc.setFont("helvetica", "normal");
      doc.text("Duración:", col2X, detailY);
      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "bold");
      doc.text(formatDuration(transaction.durationMinutes), col2X + 25, detailY);
      
      detailY += 8;
      
      // Tarifa
      doc.setTextColor(...lightGray);
      doc.setFont("helvetica", "normal");
      doc.text("Tarifa aplicada:", col1X, detailY);
      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "bold");
      doc.text(`${formatCurrency(transaction.pricePerKwh || 800)}/kWh`, col1X + 40, detailY);
      
      // Fecha inicio
      doc.setTextColor(...lightGray);
      doc.setFont("helvetica", "normal");
      doc.text("Fecha:", col2X, detailY);
      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "bold");
      doc.text(formatDateShort(transaction.startTime), col2X + 25, detailY);
      
      y += 60;
      
      // Total a pagar (destacado)
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 25, 3, 3, "F");
      
      doc.setTextColor(...white);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("TOTAL PAGADO", margin + 10, y + 10);
      
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(transaction.totalCost || 0), pageWidth - margin - 10, y + 16, { align: "right" });
      
      y += 35;
      
      // Información adicional
      doc.setTextColor(...lightGray);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Este documento es un comprobante de pago por el servicio de carga eléctrica.", margin, y);
      y += 5;
      doc.text("Conserve este recibo para cualquier reclamación o consulta.", margin, y);
      
      y += 15;
      
      // Línea separadora
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      // Footer
      doc.setTextColor(...darkColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("EVGreen - Movilidad Eléctrica Sostenible", pageWidth / 2, y, { align: "center" });
      y += 5;
      
      doc.setTextColor(...lightGray);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("www.evgreen.lat | soporte@evgreen.lat", pageWidth / 2, y, { align: "center" });
      y += 4;
      doc.text("Green House Project S.A.S. - NIT: 901.XXX.XXX-X", pageWidth / 2, y, { align: "center" });
      
      // Guardar PDF
      doc.save(`recibo-evgreen-${transaction.id}.pdf`);
      
      toast.success("Recibo PDF descargado exitosamente");
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Error al generar el recibo PDF");
    } finally {
      setIsGeneratingPdf(false);
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
      
      {/* Recibo visual */}
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
            onClick={downloadReceiptPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            ) : (
              <FileText className="w-5 h-5 text-purple-600" />
            )}
            <span className="text-xs">PDF</span>
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
