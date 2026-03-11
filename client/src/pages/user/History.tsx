import { useState, useRef, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Zap,
  Clock,
  MapPin,
  Battery,
  Calendar,
  TrendingUp,
  ChevronRight,
  Receipt,
  Download,
  Share2,
  MessageCircle,
  Mail,
  X,
  CheckCircle2,
  Loader2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { AIInsightCard } from "@/components/AIInsightCard";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { savePdfCrossPlatform } from "@/lib/pdf-download";

// Tipo para transacción con estación (extendido con campos de costos)
interface TransactionWithStation {
  id: number;
  stationId: number;
  evseId: number;
  userId: number;
  status: string;
  startTime: Date;
  endTime: Date | null;
  kwhConsumed: string | null;
  totalCost: string | null;
  energyCost: string | null;
  timeCost: string | null;
  sessionCost: string | null;
  overstayCost: string | null;
  appliedPricePerKwh: string | null;
  chargeMode: string | null;
  startMethod: string | null;
  stopReason: string | null;
  createdAt: Date;
  station?: {
    id: number;
    name: string;
    city: string;
    address: string;
  };
}

export default function UserHistory() {
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithStation | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Obtener historial de transacciones y estadísticas mensuales
  const { data: historyData, isLoading } = trpc.dashboard.userTransactionHistory.useQuery({ limit: 50 });
  const { data: monthlyStats } = trpc.dashboard.userMonthlyStats.useQuery();
  
  // Extraer transacciones del formato de respuesta
  const transactions = historyData?.map(item => ({
    ...item.transaction,
    station: item.station,
  })) as TransactionWithStation[] | undefined;

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (startTime: Date | string, endTime: Date | string | null) => {
    if (!endTime) return "-";
    const start = new Date(startTime);
    const end = new Date(endTime);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: "bg-primary/10 text-primary",
      IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    const labels: Record<string, string> = {
      COMPLETED: "Completada",
      IN_PROGRESS: "En progreso",
      FAILED: "Fallida",
      CANCELLED: "Cancelada",
    };
    return (
      <Badge className={styles[status] || "bg-gray-100"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getChargeModeLabel = (mode: string | null) => {
    if (!mode) return "Carga completa";
    const labels: Record<string, string> = {
      full_charge: "Carga completa",
      fixed_amount: "Monto fijo",
      percentage: "Porcentaje",
    };
    return labels[mode] || mode;
  };

  const getStartMethodLabel = (method: string | null) => {
    if (!method) return "App";
    const labels: Record<string, string> = {
      QR: "Código QR",
      NFC: "Tarjeta NFC",
      APP: "Aplicación",
      RFID: "RFID",
      REMOTE: "Remoto",
    };
    return labels[method] || method;
  };

  // Construir líneas de conceptos del recibo
  const getReceiptLineItems = (tx: TransactionWithStation) => {
    const items: { concept: string; detail: string; amount: number }[] = [];
    
    const kwhConsumed = parseFloat(tx.kwhConsumed || "0");
    const pricePerKwh = parseFloat(tx.appliedPricePerKwh || "0");
    const energyCost = parseFloat(tx.energyCost || "0");
    const timeCost = parseFloat(tx.timeCost || "0");
    const sessionCost = parseFloat(tx.sessionCost || "0");
    const overstayCost = parseFloat(tx.overstayCost || "0");

    // Energía consumida
    if (energyCost > 0 || kwhConsumed > 0) {
      const detail = pricePerKwh > 0
        ? `${kwhConsumed.toFixed(2)} kWh x ${formatCurrency(pricePerKwh)}/kWh`
        : `${kwhConsumed.toFixed(2)} kWh`;
      items.push({ concept: "Energía consumida", detail, amount: energyCost });
    }

    // Cargo por tiempo
    if (timeCost > 0) {
      items.push({ concept: "Cargo por tiempo", detail: "Tarifa por minuto", amount: timeCost });
    }

    // Cargo por sesión/conexión
    if (sessionCost > 0) {
      items.push({ concept: "Cargo por conexión", detail: "Tarifa fija por sesión", amount: sessionCost });
    }

    // Penalización por sobreestadía
    if (overstayCost > 0) {
      items.push({ concept: "Penalización sobreestadía", detail: "Tiempo excedido post-carga", amount: overstayCost });
    }

    // Si no hay conceptos individuales, mostrar el total como único concepto
    if (items.length === 0) {
      const total = parseFloat(tx.totalCost || "0");
      items.push({ concept: "Servicio de carga", detail: `${kwhConsumed.toFixed(2)} kWh`, amount: total });
    }

    return items;
  };

  // Abrir recibo
  const openReceipt = (tx: TransactionWithStation) => {
    setSelectedTransaction(tx);
    setIsReceiptOpen(true);
  };

  // Compartir por WhatsApp
  const shareWhatsApp = () => {
    if (!selectedTransaction) return;
    const items = getReceiptLineItems(selectedTransaction);
    let message = `🔋 *Recibo de Carga EVGreen #${selectedTransaction.id}*\n\n` +
      `📍 ${selectedTransaction.station?.name || "Estación"}\n` +
      `📅 ${formatDate(selectedTransaction.startTime)}\n` +
      `⏱️ Duración: ${formatDuration(selectedTransaction.startTime, selectedTransaction.endTime)}\n\n` +
      `*Detalle del cobro:*\n`;
    items.forEach(item => {
      message += `  • ${item.concept}: ${formatCurrency(item.amount)}\n`;
    });
    message += `\n💰 *Total: ${formatCurrency(selectedTransaction.totalCost || 0)}*\n\n` +
      `¡Carga tu vehículo eléctrico con EVGreen! 🚗⚡`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // Compartir por Email
  const shareEmail = () => {
    if (!selectedTransaction) return;
    const items = getReceiptLineItems(selectedTransaction);
    const subject = `Recibo de Carga EVGreen #${selectedTransaction.id} - ${formatDate(selectedTransaction.startTime)}`;
    let body = `Recibo de Carga EVGreen #${selectedTransaction.id}\n\n` +
      `Estación: ${selectedTransaction.station?.name || "Estación"}\n` +
      `Dirección: ${selectedTransaction.station?.address || selectedTransaction.station?.city || "Colombia"}\n` +
      `Fecha: ${formatDate(selectedTransaction.startTime)}\n` +
      `Duración: ${formatDuration(selectedTransaction.startTime, selectedTransaction.endTime)}\n\n` +
      `--- Detalle del Cobro ---\n`;
    items.forEach(item => {
      body += `${item.concept}: ${formatCurrency(item.amount)} (${item.detail})\n`;
    });
    body += `\nTOTAL: ${formatCurrency(selectedTransaction.totalCost || 0)}\n\n` +
      `Gracias por usar EVGreen.\nwww.evgreen.lat`;
    
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  // Descargar recibo como PDF
  const downloadReceipt = async () => {
    if (!selectedTransaction) return;
    
    try {
      setIsGenerating(true);
      toast.info("Generando PDF...");
      
      const tx = selectedTransaction;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header verde
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, pageWidth, 35, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("EVGreen", 15, 18);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("NIT: 901.447.678-0", 15, 26);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Recibo #${tx.id}`, pageWidth - 15, 18, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(formatDate(tx.startTime), pageWidth - 15, 26, { align: "right" });
      
      let y = 45;
      
      // Información de la estación
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Estación de Carga", 15, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(tx.station?.name || "Estación", 15, y);
      y += 5;
      doc.setTextColor(120, 120, 120);
      doc.text(tx.station?.address || tx.station?.city || "Colombia", 15, y);
      y += 10;
      
      // Información de la sesión
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Información de la Sesión", 15, y);
      y += 7;
      
      const sessionInfo = [
        ["Energía consumida", `${parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh`],
        ["Duración", formatDuration(tx.startTime, tx.endTime)],
        ["Modo de carga", getChargeModeLabel(tx.chargeMode)],
        ["Método de inicio", getStartMethodLabel(tx.startMethod)],
        ["Estado", tx.status === "COMPLETED" ? "Completada" : tx.status],
      ];
      
      if (tx.appliedPricePerKwh && parseFloat(tx.appliedPricePerKwh) > 0) {
        sessionInfo.splice(1, 0, ["Tarifa aplicada", `${formatCurrency(tx.appliedPricePerKwh)}/kWh`]);
      }
      
      if (tx.endTime) {
        sessionInfo.push(["Inicio", formatDate(tx.startTime)]);
        sessionInfo.push(["Fin", formatDate(tx.endTime)]);
      }
      
      autoTable(doc, {
        startY: y,
        head: [],
        body: sessionInfo,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 55, textColor: [100, 100, 100] },
          1: { cellWidth: 120 },
        },
        margin: { left: 15, right: 15 },
      });
      
      y = (doc as any).lastAutoTable.finalY + 10;
      
      // Tabla de conceptos del cobro
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalle del Cobro", 15, y);
      y += 3;
      
      const items = getReceiptLineItems(tx);
      const tableBody = items.map(item => [
        item.concept,
        item.detail,
        formatCurrency(item.amount),
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [["Concepto", "Detalle", "Valor"]],
        body: tableBody,
        theme: "striped",
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 55 },
          1: { cellWidth: 75 },
          2: { halign: "right", cellWidth: 45 },
        },
        margin: { left: 15, right: 15 },
      });
      
      y = (doc as any).lastAutoTable.finalY + 5;
      
      // Total
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(15, y, pageWidth - 30, 14, 2, 2, "F");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("TOTAL", 20, y + 9);
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(14);
      doc.text(formatCurrency(tx.totalCost || 0), pageWidth - 20, y + 9, { align: "right" });
      
      y += 22;
      
      // Nota legal
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Este documento es un comprobante de servicio de carga de veh\u00edculo el\u00e9ctrico.", 15, y);
      y += 4;
      doc.text("Green House Project S.A.S. - NIT: 901.447.678-0 | www.evgreen.lat", 15, y);
      y += 4;
      doc.text("Energ\u00eda para recarga de VE excluida de IVA (Concepto DIAN 840 de 2021)", 15, y);
      
      savePdfCrossPlatform(doc, `recibo-evgreen-${tx.id}.pdf`);
      toast.success("Recibo PDF descargado");
    } catch (err) {
      toast.error("Error al generar el PDF");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Usar estadísticas mensuales del servidor
  const stats = {
    totalCharges: monthlyStats?.sessions || 0,
    totalKwh: monthlyStats?.kwhConsumed || 0,
    totalSpent: monthlyStats?.totalSpent || 0,
  };

  // Filtrar transacciones por estado
  const completedTransactions = transactions?.filter(tx => tx.status === "COMPLETED");
  const pendingTransactions = transactions?.filter(tx => tx.status === "IN_PROGRESS");

  return (
    <UserLayout title="Historial de cargas" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-3 sm:p-4 text-center">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary mx-auto mb-1 sm:mb-2" />
              <div className="text-lg sm:text-2xl font-bold">{stats.totalCharges}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Cargas</div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-3 sm:p-4 text-center">
              <Battery className="w-5 h-5 sm:w-6 sm:h-6 text-secondary mx-auto mb-1 sm:mb-2" />
              <div className="text-lg sm:text-2xl font-bold">{stats.totalKwh.toFixed(1)}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">kWh</div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-3 sm:p-4 text-center">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground mx-auto mb-1 sm:mb-2" />
              <div className="text-sm sm:text-lg font-bold truncate">{formatCurrency(stats.totalSpent)}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Total</div>
            </Card>
          </motion.div>
        </div>

        {/* Sugerencia de IA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AIInsightCard 
            type="history"
            onAskAI={(question) => {
              const chatButton = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
              if (chatButton) chatButton.click();
            }}
          />
        </motion.div>

        {/* Lista de transacciones */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="completed">Completadas</TabsTrigger>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : transactions?.length === 0 ? (
              <Card className="p-8 text-center">
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Sin cargas aún</h3>
                <p className="text-muted-foreground text-sm">
                  Cuando realices tu primera carga, aparecerá aquí
                </p>
              </Card>
            ) : (
              transactions?.map((tx, index) => (
                <TransactionCard
                  key={tx.id}
                  transaction={tx}
                  index={index}
                  formatCurrency={formatCurrency}
                  formatDuration={formatDuration}
                  getStatusBadge={getStatusBadge}
                  onViewReceipt={() => openReceipt(tx)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-3">
            {completedTransactions?.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Sin cargas completadas</h3>
                <p className="text-muted-foreground text-sm">
                  Las cargas completadas aparecerán aquí
                </p>
              </Card>
            ) : (
              completedTransactions?.map((tx, index) => (
                <TransactionCard
                  key={tx.id}
                  transaction={tx}
                  index={index}
                  formatCurrency={formatCurrency}
                  formatDuration={formatDuration}
                  getStatusBadge={getStatusBadge}
                  onViewReceipt={() => openReceipt(tx)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {pendingTransactions?.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Sin cargas pendientes</h3>
                <p className="text-muted-foreground text-sm">
                  No tienes cargas en progreso actualmente
                </p>
              </Card>
            ) : (
              pendingTransactions?.map((tx, index) => (
                <TransactionCard
                  key={tx.id}
                  transaction={tx}
                  index={index}
                  formatCurrency={formatCurrency}
                  formatDuration={formatDuration}
                  getStatusBadge={getStatusBadge}
                  onViewReceipt={() => openReceipt(tx)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de recibo con conceptos discriminados */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Recibo de Carga
            </DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (() => {
            const tx = selectedTransaction;
            const items = getReceiptLineItems(tx);
            const total = parseFloat(tx.totalCost || "0");
            
            return (
              <>
                {/* Recibo visual */}
                <div ref={receiptRef} className="p-4">
                  {/* Encabezado */}
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 -mx-4 -mt-4 p-4 text-white rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-6 h-6" />
                        <span className="font-bold text-lg">EVGreen</span>
                      </div>
                      <Badge className="bg-white/20 text-white border-0">
                        <Receipt className="w-3 h-3 mr-1" />
                        #{tx.id}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/70 mt-1">NIT: 901.447.678-0</p>
                  </div>
                  
                  {/* Estación */}
                  <div className="py-3 border-b">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{tx.station?.name || "Estación"}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.station?.address || tx.station?.city || "Colombia"}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Métricas principales */}
                  <div className="py-3 grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <Battery className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-xl font-bold text-blue-600">
                        {parseFloat(tx.kwhConsumed || "0").toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">kWh</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <Clock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-xl font-bold text-purple-600">
                        {formatDuration(tx.startTime, tx.endTime)}
                      </p>
                      <p className="text-xs text-muted-foreground">Duración</p>
                    </div>
                  </div>
                  
                  {/* Info de sesión */}
                  <div className="py-3 space-y-2 border-t text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha</span>
                      <span className="font-medium">{formatDate(tx.startTime)}</span>
                    </div>
                    {tx.appliedPricePerKwh && parseFloat(tx.appliedPricePerKwh) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tarifa aplicada</span>
                        <span className="font-medium">{formatCurrency(tx.appliedPricePerKwh)}/kWh</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modo de carga</span>
                      <span className="font-medium">{getChargeModeLabel(tx.chargeMode)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Método de inicio</span>
                      <span className="font-medium">{getStartMethodLabel(tx.startMethod)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estado</span>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                  
                  {/* Conceptos discriminados */}
                  <div className="py-3 border-t">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Detalle del Cobro
                    </h4>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className={`flex justify-between items-start text-sm ${
                          item.concept === "Penalización sobreestadía" ? "text-red-500" : ""
                        }`}>
                          <div className="flex-1">
                            <p className={`font-medium ${
                              item.concept === "Penalización sobreestadía" ? "text-red-500" : ""
                            }`}>
                              {item.concept === "Penalización sobreestadía" && (
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                              )}
                              {item.concept}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.detail}</p>
                          </div>
                          <span className={`font-semibold ml-3 ${
                            item.concept === "Penalización sobreestadía" ? "text-red-500" : ""
                          }`}>
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Total */}
                  <div className="py-3 border-t border-dashed">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base">Total</span>
                      <span className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="text-center text-xs text-muted-foreground pt-3 border-t">
                    <p>Gracias por usar EVGreen</p>
                    <p>www.evgreen.lat</p>
                    <p className="mt-1 text-[10px]">Energía para recarga de VE excluida de IVA (Concepto DIAN 840)</p>
                  </div>
                </div>
                
                {/* Acciones */}
                <div className="p-4 bg-muted/30 space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Compartir recibo</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 gap-2"
                      onClick={shareWhatsApp}
                    >
                      <MessageCircle className="w-5 h-5 text-green-600" />
                      <span className="text-xs">WhatsApp</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 gap-2"
                      onClick={shareEmail}
                    >
                      <Mail className="w-5 h-5 text-blue-600" />
                      <span className="text-xs">Email</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3 gap-2"
                      onClick={downloadReceipt}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-purple-600" />
                      )}
                      <span className="text-xs">PDF</span>
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}

// Componente de tarjeta de transacción
function TransactionCard({
  transaction,
  index,
  formatCurrency,
  formatDuration,
  getStatusBadge,
  onViewReceipt,
}: {
  transaction: TransactionWithStation;
  index: number;
  formatCurrency: (amount: string | number) => string;
  formatDuration: (start: Date | string, end: Date | string | null) => string;
  getStatusBadge: (status: string) => ReactNode;
  onViewReceipt: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card 
        className="p-4 cursor-pointer hover:shadow-md transition-shadow"
        onClick={onViewReceipt}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">{transaction.station?.name || "Estación"}</h4>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {transaction.station?.city || "Colombia"}
              </p>
            </div>
          </div>
          {getStatusBadge(transaction.status)}
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Energía</div>
            <div className="font-medium">
              {parseFloat(transaction.kwhConsumed || "0").toFixed(2)} kWh
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Duración</div>
            <div className="font-medium">
              {formatDuration(transaction.startTime, transaction.endTime)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">Total</div>
            <div className="font-semibold text-primary">
              {formatCurrency(transaction.totalCost || 0)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(transaction.createdAt).toLocaleDateString("es-CO", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="flex items-center gap-1 text-primary">
            <Receipt className="w-3 h-3" />
            <span>Ver recibo</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
