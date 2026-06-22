import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Zap, Clock, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

function formatCOP(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function formatDate(ts: any) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function formatDuration(start: any, end: any) {
  if (!start || !end) return "-";
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

export default function OrgTransactions() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading } = (trpc.organizations as any).getOrgTransactions.useQuery(
    { period, page, limit: LIMIT },
    { keepPreviousData: true }
  );

  const transactions: any[] = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  // Compute summary
  const totalKwh = transactions.reduce((s: number, t: any) => s + (parseFloat(t.energy_kwh) || 0), 0);
  const totalRevenue = transactions.reduce((s: number, t: any) => s + (parseFloat(t.total_cost) || 0), 0);
  const completed = transactions.filter((t: any) => t.status === "completed").length;

  const statusColor: Record<string, string> = {
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-green-400" /> Transacciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Historial de sesiones de carga de tus estaciones</p>
        </div>
        <Select value={period} onValueChange={(v: any) => { setPeriod(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="all">Todo el tiempo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total sesiones</p>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completadas</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{completed}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" /> kWh entregados</p>
            <p className="text-2xl font-bold mt-1">{totalKwh.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Ingresos</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{formatCOP(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Detalle de sesiones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay transacciones en este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Estación</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Usuario</th>
                    <th className="text-left px-4 py-3 font-medium">Inicio</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Duración</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">kWh</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-center px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any, i: number) => (
                    <tr key={tx.id || i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[120px]">{tx.station_name || `Estación #${tx.station_id}`}</p>
                        <p className="text-xs text-muted-foreground">#{tx.id}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="truncate max-w-[120px]">{tx.user_name || "Anónimo"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{tx.user_email || ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{formatDate(tx.start_time)}</td>
                      <td className="px-4 py-3 text-right text-xs hidden sm:table-cell">
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDuration(tx.start_time, tx.end_time)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="flex items-center justify-end gap-1">
                          <Zap className="h-3 w-3 text-yellow-400" />
                          {parseFloat(tx.energy_kwh || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-400">
                        {formatCOP(tx.total_cost || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${statusColor[tx.status] || statusColor.cancelled}`}>
                          {tx.status === "completed" ? "Completada" :
                           tx.status === "active" ? "Activa" :
                           tx.status === "failed" ? "Fallida" : "Cancelada"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages} · {total} sesiones
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                  disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                  disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
