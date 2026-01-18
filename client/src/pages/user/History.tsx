import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  Clock,
  MapPin,
  Battery,
  Calendar,
  TrendingUp,
  ChevronRight
} from "lucide-react";

export default function UserHistory() {
  const { data: transactions, isLoading } = trpc.transactions.getMyHistory.useQuery({
    limit: 50,
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: "bg-primary/10 text-primary",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      FAILED: "bg-red-100 text-red-700",
      CANCELLED: "bg-gray-100 text-gray-700",
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

  // Calcular estadísticas
  const stats = transactions?.reduce(
    (acc, tx: any) => {
      if (tx.status === "COMPLETED") {
        acc.totalCharges++;
        acc.totalKwh += parseFloat(tx.kwhConsumed || tx.energyDeliveredKwh || "0");
        acc.totalSpent += parseFloat(tx.totalCost || tx.totalAmount || "0");
      }
      return acc;
    },
    { totalCharges: 0, totalKwh: 0, totalSpent: 0 }
  ) || { totalCharges: 0, totalKwh: 0, totalSpent: 0 };

  return (
    <UserLayout title="Historial de cargas" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-4 text-center">
              <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.totalCharges}</div>
              <div className="text-xs text-muted-foreground">Cargas</div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 text-center">
              <Battery className="w-6 h-6 text-secondary mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.totalKwh.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">kWh</div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 text-center">
              <TrendingUp className="w-6 h-6 text-accent-foreground mx-auto mb-2" />
              <div className="text-lg font-bold">{formatCurrency(stats.totalSpent)}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </Card>
          </motion.div>
        </div>

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
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4 card-interactive">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{(tx as any).station?.name || "Estación"}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {(tx as any).station?.city || "Colombia"}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(tx.status)}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Energía</div>
                        <div className="font-medium">
                          {parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Duración</div>
                        <div className="font-medium">
                          {tx.endTime && tx.startTime
                            ? `${Math.round(
                                (new Date(tx.endTime).getTime() -
                                  new Date(tx.startTime).getTime()) /
                                  60000
                              )} min`
                            : "-"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-semibold text-primary">
                          {formatCurrency((tx as any).totalAmount || tx.kwhConsumed || 0)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(tx.createdAt).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <p className="text-center text-muted-foreground py-8">
              Filtrando cargas completadas...
            </p>
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <p className="text-center text-muted-foreground py-8">
              No hay cargas pendientes
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </UserLayout>
  );
}
