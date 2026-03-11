/**
 * ChargingSummary - Pantalla de resumen post-carga
 * 
 * Muestra:
 * - Detalles completos de la transacción con conceptos discriminados
 * - kWh totales, tarifa aplicada, costo energía, tarifa conexión, penalizaciones
 * - Información de la estación y conector
 * - Opciones para compartir (WhatsApp, Email)
 * - Descarga de recibo como PDF profesional con jsPDF + AutoTable
 */

import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Zap, 
  Clock, 
  Battery, 
  MapPin,
  Download,
  MessageCircle,
  Mail,
  Home,
  Receipt,
  Loader2,
  AlertCircle,
  FileText,
  AlertTriangle,
  Plug,
  Timer,
  Wallet
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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
    }, 8000);
    
    return () => clearInterval(interval);
  }, [banners]);
  
  if (!banners || banners.length === 0) {
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
  return `${mins} min`;
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

// Traducir modo de carga
function getChargeModeLabel(mode: string): string {
  switch (mode) {
    case "fixed_amount": return "Monto fijo";
    case "percentage": return "Porcentaje de batería";
    case "full_charge": return "Carga completa";
    default: return "Carga completa";
  }
}

// Traducir método de inicio
function getStartMethodLabel(method: string): string {
  switch (method) {
    case "QR": return "Código QR";
    case "NFC": return "Tarjeta NFC";
    case "APP": return "Aplicación";
    case "RFID": return "Tarjeta RFID";
    default: return "Aplicación";
  }
}

// Traducir razón de parada
function getStopReasonLabel(reason: string): string {
  switch (reason) {
    case "REMOTE": return "Detenida desde la app";
    case "LOCAL": return "Detenida en el cargador";
    case "ENERGY_LIMIT": return "Límite de energía alcanzado";
    case "AMOUNT_LIMIT": return "Monto máximo alcanzado";
    case "SOC_LIMIT": return "Porcentaje de batería alcanzado";
    case "TIMEOUT": return "Tiempo máximo alcanzado";
    case "EV_DISCONNECTED": return "Vehículo desconectado";
    default: return reason || "Completada";
  }
}

// Tipo de conector legible
function getConnectorLabel(type: string): string {
  switch (type) {
    case "TYPE_1": return "Tipo 1 (J1772)";
    case "TYPE_2": return "Tipo 2 (Mennekes)";
    case "CCS1": return "CCS Combo 1";
    case "CCS2": return "CCS Combo 2";
    case "CHADEMO": return "CHAdeMO";
    case "TESLA": return "Tesla";
    case "GB_T": return "GB/T";
    default: return type;
  }
}

// Interfaz para los conceptos del recibo
interface ReceiptLineItem {
  concept: string;
  detail: string;
  amount: number;
  isWarning?: boolean;
  isSubtotal?: boolean;
}

export default function ChargingSummary() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const parsedTxId = parseInt(transactionId || "0");
  
  // Obtener detalles de la transacción con retry automático
  const { data: transaction, isLoading, error } = trpc.transactions.getById.useQuery(
    { id: parsedTxId },
    { 
      enabled: !!transactionId && parsedTxId > 0 && !!user,
      retry: 5,
      retryDelay: (attemptIndex) => Math.min(1000 * (attemptIndex + 1), 5000),
      refetchInterval: (query) => {
        const data = query.state.data as { status?: string } | undefined;
        if (data?.status === "IN_PROGRESS") return 3000;
        return false;
      },
    }
  );
  
  // Estado para controlar la animación de confetti
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Efecto para lanzar confetti cuando se carga la transacción completada
  useEffect(() => {
    if (transaction && transaction.status !== "IN_PROGRESS" && !showConfetti) {
      setShowConfetti(true);
      
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
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6']
        });
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6']
        });
      }, 250);
      
      setTimeout(() => clearInterval(interval), duration);
    }
  }, [transaction, showConfetti]);
  
  // Construir los conceptos del recibo
  const buildLineItems = (): ReceiptLineItem[] => {
    if (!transaction) return [];
    
    const items: ReceiptLineItem[] = [];
    const kwhNum = parseFloat(transaction.kwhConsumed);
    const appliedPrice = transaction.appliedPricePerKwh || transaction.pricePerKwh || 0;
    
    // 1. Energía consumida (concepto principal)
    const calculatedEnergyCost = transaction.energyCost > 0 
      ? transaction.energyCost 
      : kwhNum * appliedPrice;
    
    items.push({
      concept: "Energía consumida",
      detail: `${transaction.kwhConsumed} kWh × ${formatCurrency(appliedPrice)}/kWh`,
      amount: calculatedEnergyCost,
    });
    
    // 2. Tarifa de tiempo (si aplica)
    if (transaction.timeCost > 0) {
      items.push({
        concept: "Cargo por tiempo",
        detail: `${formatDuration(transaction.durationMinutes)} de uso`,
        amount: transaction.timeCost,
      });
    }
    
    // 3. Tarifa de conexión/sesión (si aplica)
    if (transaction.sessionCost > 0) {
      items.push({
        concept: "Tarifa de conexión",
        detail: "Cargo fijo por sesión de carga",
        amount: transaction.sessionCost,
      });
    }
    
    // 4. Penalización por sobreestadía (si aplica)
    if (transaction.overstayCost > 0) {
      items.push({
        concept: "Penalización por sobreestadía",
        detail: `Cargo por permanecer conectado después de completar la carga`,
        amount: transaction.overstayCost,
        isWarning: true,
      });
    }
    
    return items;
  };
  
  // Compartir por WhatsApp
  const shareWhatsApp = () => {
    if (!transaction) return;
    
    const items = buildLineItems();
    let detailLines = items.map(i => 
      `  • ${i.concept}: ${formatCurrency(i.amount)}`
    ).join("\n");
    
    const message = `🔋 *Recibo de Carga EVGreen #${transaction.id}*\n\n` +
      `📍 ${transaction.stationName}\n` +
      `📅 ${formatDate(transaction.startTime)}\n\n` +
      `*Detalle del cobro:*\n${detailLines}\n\n` +
      `💰 *Total: ${formatCurrency(transaction.totalCost || 0)}*\n\n` +
      `⚡ ${transaction.kwhConsumed} kWh | ⏱️ ${formatDuration(transaction.durationMinutes)}\n\n` +
      `¡Carga tu vehículo eléctrico con EVGreen! 🚗⚡`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };
  
  // Compartir por Email
  const shareEmail = () => {
    if (!transaction) return;
    
    const items = buildLineItems();
    let detailLines = items.map(i => 
      `  - ${i.concept}: ${formatCurrency(i.amount)}`
    ).join("\n");
    
    const subject = `Recibo de Carga EVGreen #${transaction.id} - ${formatDate(transaction.startTime)}`;
    const body = `Recibo de Carga EVGreen #${transaction.id}\n\n` +
      `Estación: ${transaction.stationName}\n` +
      `Fecha: ${formatDate(transaction.startTime)}\n\n` +
      `Detalle del cobro:\n${detailLines}\n\n` +
      `Total pagado: ${formatCurrency(transaction.totalCost || 0)}\n\n` +
      `Energía: ${transaction.kwhConsumed} kWh\n` +
      `Duración: ${formatDuration(transaction.durationMinutes)}\n\n` +
      `Gracias por usar EVGreen para cargar tu vehículo eléctrico.\n` +
      `www.evgreen.lat`;
    
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
      const margin = 20;
      let y = 0;
      
      // Colores de la marca
      const primaryColor: [number, number, number] = [16, 185, 129]; // emerald-500
      const darkColor: [number, number, number] = [31, 41, 55]; // gray-800
      const lightGray: [number, number, number] = [107, 114, 128]; // gray-500
      const white: [number, number, number] = [255, 255, 255];
      const warningColor: [number, number, number] = [220, 38, 38]; // red-600
      
      // ═══════════════════════════════════════════════
      // HEADER - Barra verde con logo y datos del recibo
      // ═══════════════════════════════════════════════
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 50, "F");
      
      // Logo
      try {
        doc.addImage(EVGREEN_LOGO_BASE64, "PNG", margin, 6, 40, 22);
      } catch {
        doc.setTextColor(...white);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("EVGreen", margin, 22);
      }
      
      // Datos del recibo (esquina derecha)
      doc.setTextColor(...white);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE CARGA", pageWidth - margin, 14, { align: "right" });
      doc.setFontSize(16);
      doc.text(`#${transaction.id}`, pageWidth - margin, 24, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(formatDateShort(transaction.startTime), pageWidth - margin, 32, { align: "right" });
      
      // Subtítulo
      doc.setFontSize(8);
      doc.text("Carga de Vehículo Eléctrico", margin, 35);
      doc.text("www.evgreen.lat", margin, 40);
      
      y = 58;
      
      // ═══════════════════════════════════════════════
      // SECCIÓN: Información del Cliente
      // ═══════════════════════════════════════════════
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 2, 2, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("CLIENTE", margin + 4, y + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(user?.name || "Cliente EVGreen", margin + 4, y + 13);
      doc.setFontSize(8);
      doc.setTextColor(...lightGray);
      doc.text(user?.email || "", margin + 4, y + 18);
      
      // Método de pago (derecha)
      doc.setTextColor(...darkColor);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("MÉTODO DE PAGO", pageWidth - margin - 4, y + 6, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Billetera EVGreen", pageWidth - margin - 4, y + 13, { align: "right" });
      
      y += 28;
      
      // ═══════════════════════════════════════════════
      // SECCIÓN: Información de la Estación
      // ═══════════════════════════════════════════════
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 28, 2, 2, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("ESTACIÓN DE CARGA", margin + 4, y + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(transaction.stationName, margin + 4, y + 13);
      doc.setFontSize(8);
      doc.setTextColor(...lightGray);
      const address = [transaction.stationAddress, transaction.stationCity].filter(Boolean).join(", ");
      if (address) doc.text(address, margin + 4, y + 18);
      doc.text(`Conector #${transaction.connectorId} • ${getConnectorLabel(transaction.connectorType)} • ${transaction.chargeType}`, margin + 4, y + 23);
      
      y += 34;
      
      // ═══════════════════════════════════════════════
      // SECCIÓN: Datos de la Sesión de Carga
      // ═══════════════════════════════════════════════
      doc.setTextColor(...darkColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Datos de la Sesión", margin, y + 2);
      y += 7;
      
      // Tabla de datos de sesión
      const sessionData = [
        ["Fecha y hora de inicio", formatDateShort(transaction.startTime)],
        ["Fecha y hora de fin", transaction.endTime ? formatDateShort(transaction.endTime) : "-"],
        ["Duración total", formatDuration(transaction.durationMinutes)],
        ["Energía consumida", `${transaction.kwhConsumed} kWh`],
        ["Modo de carga", getChargeModeLabel(transaction.chargeMode)],
        ["Método de inicio", getStartMethodLabel(transaction.startMethod)],
      ];
      
      if (transaction.stopReason) {
        sessionData.push(["Razón de finalización", getStopReasonLabel(transaction.stopReason)]);
      }
      
      autoTable(doc, {
        startY: y,
        head: [],
        body: sessionData,
        theme: "plain",
        styles: {
          fontSize: 9,
          cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
          textColor: darkColor,
        },
        columnStyles: {
          0: { fontStyle: "normal", textColor: lightGray, cellWidth: 55 },
          1: { fontStyle: "bold", halign: "right" },
        },
        margin: { left: margin, right: margin },
      });
      
      y = (doc as any).lastAutoTable.finalY + 8;
      
      // ═══════════════════════════════════════════════
      // SECCIÓN: Detalle del Cobro (TABLA PRINCIPAL)
      // ═══════════════════════════════════════════════
      doc.setTextColor(...darkColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalle del Cobro", margin, y + 2);
      y += 7;
      
      // Construir filas de la tabla de cobros
      const lineItems = buildLineItems();
      const chargeRows: (string | { content: string; styles: any })[][] = [];
      
      lineItems.forEach((item) => {
        if (item.isWarning) {
          chargeRows.push([
            { content: `⚠ ${item.concept}`, styles: { textColor: warningColor, fontStyle: "bold" } },
            { content: item.detail, styles: { textColor: warningColor, fontSize: 7 } },
            { content: formatCurrency(item.amount), styles: { textColor: warningColor, fontStyle: "bold", halign: "right" } },
          ]);
        } else {
          chargeRows.push([
            item.concept,
            { content: item.detail, styles: { fontSize: 7, textColor: lightGray } },
            { content: formatCurrency(item.amount), styles: { halign: "right", fontStyle: "bold" } },
          ]);
        }
      });
      
      autoTable(doc, {
        startY: y,
        head: [["Concepto", "Detalle", "Valor"]],
        body: chargeRows,
        theme: "striped",
        headStyles: {
          fillColor: [31, 41, 55],
          textColor: white,
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        },
        styles: {
          fontSize: 9,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          textColor: darkColor,
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 35, halign: "right" },
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        margin: { left: margin, right: margin },
      });
      
      y = (doc as any).lastAutoTable.finalY + 4;
      
      // ═══════════════════════════════════════════════
      // TOTAL DESTACADO
      // ═══════════════════════════════════════════════
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 18, 2, 2, "F");
      
      doc.setTextColor(...white);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL PAGADO", margin + 6, y + 11);
      
      doc.setFontSize(18);
      doc.text(formatCurrency(transaction.totalCost || 0), pageWidth - margin - 6, y + 12, { align: "right" });
      
      y += 26;
      
      // ═══════════════════════════════════════════════
      // NOTAS Y DISCLAIMER
      // ═══════════════════════════════════════════════
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      
      doc.setTextColor(...lightGray);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Este documento es un comprobante de pago por el servicio de carga eléctrica.", margin, y);
      y += 4;
      doc.text("Conserve este recibo para cualquier reclamación o consulta.", margin, y);
      y += 4;
      doc.text(`Tarifa base de la estación: ${formatCurrency(transaction.pricePerKwh)}/kWh`, margin, y);
      if (transaction.appliedPricePerKwh && transaction.appliedPricePerKwh !== transaction.pricePerKwh) {
        y += 4;
        doc.text(`Tarifa dinámica aplicada al momento de la carga: ${formatCurrency(transaction.appliedPricePerKwh)}/kWh`, margin, y);
      }
      
      y += 10;
      
      // ═══════════════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════════════
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("EVGreen - Movilidad Eléctrica Sostenible", pageWidth / 2, y, { align: "center" });
      y += 4;
      
      doc.setTextColor(...lightGray);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("www.evgreen.lat | soporte@evgreen.lat", pageWidth / 2, y, { align: "center" });
      y += 3;
      doc.text("Green House Project S.A.S.", pageWidth / 2, y, { align: "center" });
      
      // Guardar PDF
      doc.save(`recibo-evgreen-${transaction.id}.pdf`);
      
      toast.success("Recibo PDF descargado exitosamente");
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Error al generar el recibo PDF. Intenta de nuevo.");
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
  
  // Si la transacción está en progreso, mostrar pantalla de espera
  if (transaction?.status === "IN_PROGRESS") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Finalizando carga...</h2>
          <p className="text-muted-foreground mb-4">
            Esperando confirmación del cargador. Esto puede tomar unos segundos.
          </p>
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
            <div className="flex flex-col gap-2">
              <Button onClick={() => setLocation("/map")}>
                <Home className="w-4 h-4 mr-2" />
                Ir al mapa
              </Button>
              <Button variant="outline" onClick={() => setLocation("/charging-history")}>
                <FileText className="w-4 h-4 mr-2" />
                Ver historial de cargas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const lineItems = buildLineItems();
  const subtotalEnergy = lineItems.find(i => i.concept === "Energía consumida")?.amount || 0;
  const hasExtraCharges = lineItems.length > 1;
  const hasOverstay = transaction.overstayCost > 0;
  
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
              <div className="flex-1">
                <p className="font-semibold">{transaction.stationName}</p>
                <p className="text-sm text-muted-foreground">
                  Conector {transaction.connectorId} • {getConnectorLabel(transaction.connectorType)} • {transaction.chargeType}
                </p>
                {transaction.stationAddress && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {transaction.stationAddress}{transaction.stationCity ? `, ${transaction.stationCity}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Métricas principales */}
          <div className="p-4 grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
              <Battery className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-blue-600">
                {transaction.kwhConsumed}
              </p>
              <p className="text-xs text-muted-foreground">kWh</p>
            </div>
            
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
              <Clock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-purple-600">
                {formatDuration(transaction.durationMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">Duración</p>
            </div>
            
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
              <Plug className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-xs font-bold text-amber-600 leading-tight">
                {getChargeModeLabel(transaction.chargeMode)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Modo</p>
            </div>
          </div>
          
          {/* ═══════════════════════════════════════════ */}
          {/* DETALLE DEL COBRO - Conceptos discriminados */}
          {/* ═══════════════════════════════════════════ */}
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Detalle del Cobro
              </h3>
            </div>
            
            <Card className="border-dashed">
              <CardContent className="p-0">
                {/* Líneas de concepto */}
                {lineItems.map((item, index) => (
                  <div key={index}>
                    <div className={`px-4 py-3 ${item.isWarning ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-3">
                          <div className="flex items-center gap-1.5">
                            {item.isWarning && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <span className={`text-sm font-medium ${item.isWarning ? 'text-red-600 dark:text-red-400' : ''}`}>
                              {item.concept}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                        </div>
                        <span className={`text-sm font-semibold whitespace-nowrap ${item.isWarning ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                    {index < lineItems.length - 1 && <Separator />}
                  </div>
                ))}
                
                {/* Separador antes del total */}
                <div className="border-t-2 border-dashed" />
                
                {/* TOTAL */}
                <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-base">Total pagado</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(transaction.totalCost || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Información adicional de la sesión */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="w-3 h-3" />
                <span>Inicio: {formatDateShort(transaction.startTime)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="w-3 h-3" />
                <span>Fin: {transaction.endTime ? formatDateShort(transaction.endTime) : "-"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>Tarifa: {formatCurrency(transaction.appliedPricePerKwh || transaction.pricePerKwh)}/kWh</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Plug className="w-3 h-3" />
                <span>Inicio: {getStartMethodLabel(transaction.startMethod)}</span>
              </div>
              {transaction.stopReason && (
                <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Fin: {getStopReasonLabel(transaction.stopReason)}</span>
                </div>
              )}
            </div>
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
              <Download className="w-5 h-5 text-purple-600" />
            )}
            <span className="text-xs">Descargar PDF</span>
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
