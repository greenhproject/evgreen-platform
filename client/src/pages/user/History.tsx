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
  Loader2
} from "lucide-react";
import { AIInsightCard } from "@/components/AIInsightCard";
import { toast } from "sonner";
import html2canvas from "html2canvas";

// Tipo para transacción con estación
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

  // Abrir recibo
  const openReceipt = (tx: TransactionWithStation) => {
    setSelectedTransaction(tx);
    setIsReceiptOpen(true);
  };

  // Compartir por WhatsApp
  const shareWhatsApp = () => {
    if (!selectedTransaction) return;
    
    const message = `🔋 *Resumen de Carga EVGreen*\n\n` +
      `📍 Estación: ${selectedTransaction.station?.name || "Estación"}\n` +
      `⚡ Energía: ${parseFloat(selectedTransaction.kwhConsumed || "0").toFixed(2)} kWh\n` +
      `💰 Total: ${formatCurrency(selectedTransaction.totalCost || 0)}\n` +
      `⏱️ Duración: ${formatDuration(selectedTransaction.startTime, selectedTransaction.endTime)}\n` +
      `📅 Fecha: ${formatDate(selectedTransaction.startTime)}\n\n` +
      `¡Carga tu vehículo eléctrico con EVGreen! 🚗⚡`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // Compartir por Email
  const shareEmail = () => {
    if (!selectedTransaction) return;
    
    const subject = `Recibo de Carga EVGreen - ${formatDate(selectedTransaction.startTime)}`;
    const body = `Resumen de Carga EVGreen\n\n` +
      `Estación: ${selectedTransaction.station?.name || "Estación"}\n` +
      `Energía consumida: ${parseFloat(selectedTransaction.kwhConsumed || "0").toFixed(2)} kWh\n` +
      `Total pagado: ${formatCurrency(selectedTransaction.totalCost || 0)}\n` +
      `Duración: ${formatDuration(selectedTransaction.startTime, selectedTransaction.endTime)}\n` +
      `Fecha: ${formatDate(selectedTransaction.startTime)}\n\n` +
      `Gracias por usar EVGreen para cargar tu vehículo eléctrico.`;
    
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  // Descargar recibo como imagen
  const downloadReceipt = async () => {
    if (!receiptRef.current || !selectedTransaction) return;
    
    try {
      setIsGenerating(true);
      toast.info("Generando recibo...");
      
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      
      const link = document.createElement("a");
      link.download = `recibo-evgreen-${selectedTransaction.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast.success("Recibo descargado");
    } catch (err) {
      toast.error("Error al generar el recibo");
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

      {/* Modal de recibo */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Recibo de Carga
            </DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <>
              {/* Recibo para captura */}
              <div ref={receiptRef} className="bg-white p-4">
                {/* Encabezado del recibo */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 -mx-4 -mt-4 p-4 text-white rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-6 h-6" />
                      <span className="font-bold text-lg">EVGreen</span>
                    </div>
                    <Badge className="bg-white/20 text-white border-0">
                      <Receipt className="w-3 h-3 mr-1" />
                      #{selectedTransaction.id}
                    </Badge>
                  </div>
                </div>
                
                {/* Información de la estación */}
                <div className="py-4 border-b">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-emerald-100">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedTransaction.station?.name || "Estación"}</p>
                      <p className="text-sm text-gray-500">
                        {selectedTransaction.station?.address || selectedTransaction.station?.city || "Colombia"}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Métricas principales */}
                <div className="py-4 grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <Battery className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-blue-600">
                      {parseFloat(selectedTransaction.kwhConsumed || "0").toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">kWh</p>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-xl">
                    <Clock className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-purple-600">
                      {formatDuration(selectedTransaction.startTime, selectedTransaction.endTime)}
                    </p>
                    <p className="text-xs text-gray-500">Duración</p>
                  </div>
                </div>
                
                {/* Detalles */}
                <div className="py-4 space-y-3 border-t border-dashed">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fecha y hora</span>
                    <span className="font-medium text-gray-900">{formatDate(selectedTransaction.startTime)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Estado</span>
                    {getStatusBadge(selectedTransaction.status)}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Total pagado</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(selectedTransaction.totalCost || 0)}
                    </span>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="text-center text-xs text-gray-400 pt-4 border-t">
                  <p>Gracias por usar EVGreen</p>
                  <p>www.evgreen.lat</p>
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
                    <span className="text-xs">Descargar</span>
                  </Button>
                </div>
              </div>
            </>
          )}
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
