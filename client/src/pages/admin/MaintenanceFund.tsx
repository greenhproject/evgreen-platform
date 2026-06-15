/**
 * Fondo de Mantenimiento - Panel Administrativo
 * Gestión del fondo de mantenimiento para estaciones colectivas (crowdfunding)
 * Muestra: balance acumulado, historial de movimientos, formulario de retiro,
 * gráficos de tendencia mensual, umbral de alerta configurable, reporte consolidado
 * @author Green House Project
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

// Cast financial router to bypass TS inference issues with buildFinancialRouter pattern
const financialTrpc = trpc.financial as any;

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Wrench, DollarSign, TrendingUp, TrendingDown, Plus,
  ArrowUpCircle, ArrowDownCircle, Building2, Wallet,
  FileText, CheckCircle2, AlertTriangle, Search,
  Loader2, History, PiggyBank, ShieldCheck, ChevronRight,
  Download, FileSpreadsheet, BarChart3, Settings2, Bell,
  Save, LayoutGrid
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

// ============================================================================
// TYPES & HELPERS
// ============================================================================

const MAINTENANCE_TYPES = [
  { value: "preventivo", label: "Preventivo", description: "Mantenimiento programado regular" },
  { value: "correctivo", label: "Correctivo", description: "Reparación de fallas o averías" },
];

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminMaintenanceFund() {
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("stations");

  // Get collective stations (those with crowdfunding projects)
  const collectiveStationsQuery = financialTrpc.getCollectiveStations.useQuery();
  const collectiveStations = collectiveStationsQuery.data || [];

  // Filter stations by search
  const filteredStations = useMemo(() => {
    if (!searchTerm.trim()) return collectiveStations;
    const term = searchTerm.toLowerCase();
    return collectiveStations.filter((s: any) =>
      s.name.toLowerCase().includes(term) ||
      s.city?.toLowerCase().includes(term) ||
      s.address?.toLowerCase().includes(term)
    );
  }, [collectiveStations, searchTerm]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-7 w-7 text-amber-500" />
            Fondo de Mantenimiento
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión del fondo de mantenimiento para estaciones colectivas (crowdfunding).
            El 5% del share de EVGreen se reserva automáticamente en cada liquidación.
          </p>
        </div>
      </div>

      {/* Station selector or detail view */}
      {selectedStationId ? (
        <StationFundDetail
          stationId={selectedStationId}
          stationName={collectiveStations.find((s: any) => s.id === selectedStationId)?.name || ""}
          onBack={() => setSelectedStationId(null)}
          showWithdrawDialog={showWithdrawDialog}
          setShowWithdrawDialog={setShowWithdrawDialog}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="stations" className="gap-2">
              <Building2 className="h-4 w-4" />
              Estaciones
            </TabsTrigger>
            <TabsTrigger value="consolidated" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Reporte Consolidado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stations" className="mt-4">
            <StationsList
              stations={filteredStations}
              isLoading={collectiveStationsQuery.isLoading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onSelectStation={(id: number) => setSelectedStationId(id)}
            />
          </TabsContent>

          <TabsContent value="consolidated" className="mt-4">
            <ConsolidatedReport />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================================
// STATIONS LIST (Overview of all collective stations with fund balances)
// ============================================================================

function StationsList({
  stations,
  isLoading,
  searchTerm,
  setSearchTerm,
  onSelectStation,
}: {
  stations: any[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onSelectStation: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar estación por nombre, ciudad..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Station cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {searchTerm ? "No se encontraron estaciones con ese criterio" : "No hay estaciones colectivas registradas"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stations.map((station: any) => (
            <StationFundCard
              key={station.id}
              station={station}
              onSelect={() => onSelectStation(station.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STATION FUND CARD (Individual card in the grid)
// ============================================================================

function StationFundCard({ station, onSelect }: { station: any; onSelect: () => void }) {
  // Fetch fund summary for this station
  const summaryQuery = financialTrpc.maintenanceFundSummary.useQuery({ stationId: station.id });
  const summary = summaryQuery.data;

  const balance = summary?.currentBalance || 0;
  const totalDeposits = summary?.totalDeposits || 0;
  const totalWithdrawals = summary?.totalWithdrawals || 0;

  // Health indicator: green if balance > 30% of deposits, yellow if 10-30%, red if < 10%
  const healthRatio = totalDeposits > 0 ? (balance / totalDeposits) : 1;
  const healthColor = healthRatio > 0.3 ? "text-emerald-500" : healthRatio > 0.1 ? "text-amber-500" : "text-red-500";
  const healthBg = healthRatio > 0.3 ? "bg-emerald-500/10" : healthRatio > 0.1 ? "bg-amber-500/10" : "bg-red-500/10";
  const healthLabel = healthRatio > 0.3 ? "Saludable" : healthRatio > 0.1 ? "Moderado" : "Bajo";

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: healthRatio > 0.3 ? "#10b981" : healthRatio > 0.1 ? "#f59e0b" : "#ef4444" }}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{station.name}</CardTitle>
            <CardDescription className="text-xs truncate">{station.city} — {station.address}</CardDescription>
          </div>
          <Badge variant={station.isOnline ? "default" : "secondary"} className="ml-2 shrink-0 text-xs">
            {station.isOnline ? "Online" : "Offline"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {summaryQuery.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Balance */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Balance actual</span>
              <span className="text-lg font-bold">{formatCOP(balance)}</span>
            </div>

            {/* Deposits vs Withdrawals */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-muted-foreground">Depósitos:</span>
                <span className="font-medium">{formatCOP(totalDeposits)}</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-muted-foreground">Retiros:</span>
                <span className="font-medium">{formatCOP(totalWithdrawals)}</span>
              </div>
            </div>

            {/* Health indicator */}
            <div className="flex items-center justify-between pt-1">
              <Badge variant="outline" className={`${healthBg} ${healthColor} border-0 text-xs`}>
                <ShieldCheck className="h-3 w-3 mr-1" />
                {healthLabel}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CONSOLIDATED REPORT (Multi-station overview)
// ============================================================================

function ConsolidatedReport() {
  const consolidatedQuery = financialTrpc.consolidatedMaintenanceFundSummary.useQuery();
  const data = consolidatedQuery.data;
  const stations = data?.stations || [];
  const totals = data?.totals;

  const exportMutation = financialTrpc.exportConsolidatedMaintenanceFund.useMutation({
    onSuccess: (data: any) => {
      window.open(data.url, "_blank");
      toast.success(`Reporte consolidado ${data.format === "excel" ? "Excel" : "PDF"} generado`);
    },
    onError: (e: any) => toast.error(`Error al exportar: ${e.message}`),
  });

  if (consolidatedQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No hay datos de fondos de mantenimiento aún</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate({ format: "pdf" })}
        >
          {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          PDF Consolidado
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate({ format: "excel" })}
        >
          {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          Excel Consolidado
        </Button>
      </div>

      {/* Totals summary */}
      {totals && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <PiggyBank className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance Total</p>
                  <p className="text-xl font-bold">{formatCOP(totals.totalBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Depósitos Totales</p>
                  <p className="text-xl font-bold">{formatCOP(totals.totalDeposits)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Retiros Totales</p>
                  <p className="text-xl font-bold">{formatCOP(totals.totalWithdrawals)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${totals.stationsWithLowBalance > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                  <AlertTriangle className={`h-5 w-5 ${totals.stationsWithLowBalance > 0 ? "text-red-500" : "text-emerald-500"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Alertas Activas</p>
                  <p className="text-xl font-bold">{totals.stationsWithLowBalance}</p>
                  <p className="text-xs text-muted-foreground">de {data?.stationCount} estaciones</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stations table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <LayoutGrid className="h-5 w-5" />
            Detalle por Estación
          </CardTitle>
          <CardDescription>
            Resumen de fondos de mantenimiento de todas las estaciones colectivas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Estación</th>
                  <th className="pb-2 font-medium">Ciudad</th>
                  <th className="pb-2 font-medium text-right">Balance</th>
                  <th className="pb-2 font-medium text-right">Depósitos</th>
                  <th className="pb-2 font-medium text-right">Retiros</th>
                  <th className="pb-2 font-medium text-right">Umbral Alerta</th>
                  <th className="pb-2 font-medium text-center">Estado</th>
                  <th className="pb-2 font-medium">Último Mov.</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s: any) => (
                  <tr key={s.stationId} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 font-medium">{s.stationName}</td>
                    <td className="py-2.5 text-muted-foreground">{s.stationCity || "—"}</td>
                    <td className="py-2.5 text-right font-mono font-medium">{formatCOP(s.currentBalance)}</td>
                    <td className="py-2.5 text-right font-mono text-emerald-600">{formatCOP(s.totalDeposits)}</td>
                    <td className="py-2.5 text-right font-mono text-red-600">{formatCOP(s.totalWithdrawals)}</td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">{formatCOP(s.alertThreshold)}</td>
                    <td className="py-2.5 text-center">
                      {s.isLowBalance ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-0 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Bajo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{formatDate(s.lastMovement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {stations.map((s: any) => (
              <div key={s.stationId} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.stationName}</p>
                    <p className="text-xs text-muted-foreground">{s.stationCity}</p>
                  </div>
                  {s.isLowBalance ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-0 text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Bajo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      OK
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Balance</p>
                    <p className="font-mono font-medium">{formatCOP(s.currentBalance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Depósitos</p>
                    <p className="font-mono text-emerald-600">{formatCOP(s.totalDeposits)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Retiros</p>
                    <p className="font-mono text-red-600">{formatCOP(s.totalWithdrawals)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// STATION FUND DETAIL (Detailed view for a selected station)
// ============================================================================

function StationFundDetail({
  stationId,
  stationName,
  onBack,
  showWithdrawDialog,
  setShowWithdrawDialog,
}: {
  stationId: number;
  stationName: string;
  onBack: () => void;
  showWithdrawDialog: boolean;
  setShowWithdrawDialog: (v: boolean) => void;
}) {
  const [detailTab, setDetailTab] = useState("overview");

  const summaryQuery = financialTrpc.maintenanceFundSummary.useQuery({ stationId });
  const historyQuery = financialTrpc.maintenanceFundHistory.useQuery({ stationId, limit: 100 });
  const summary = summaryQuery.data;
  const history = historyQuery.data || [];
  const utils = trpc.useUtils();
  const financialUtils = (utils as any).financial;

  const withdrawMutation = financialTrpc.maintenanceFundWithdraw.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Retiro registrado. Nuevo balance: ${formatCOP(data.newBalance)}`);
      financialUtils.maintenanceFundSummary.invalidate();
      financialUtils.maintenanceFundHistory.invalidate();
      setShowWithdrawDialog(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportMutation = financialTrpc.exportMaintenanceFund.useMutation({
    onSuccess: (data: any) => {
      window.open(data.url, "_blank");
      toast.success(`Reporte ${data.format === "excel" ? "Excel" : "PDF"} generado exitosamente`);
    },
    onError: (e: any) => toast.error(`Error al exportar: ${e.message}`),
  });

  const balance = summary?.currentBalance || 0;
  const totalDeposits = summary?.totalDeposits || 0;
  const totalWithdrawals = summary?.totalWithdrawals || 0;
  const depositCount = summary?.depositCount || 0;
  const withdrawalCount = summary?.withdrawalCount || 0;

  return (
    <div className="space-y-6">
      {/* Back button & header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Volver
          </Button>
          <div>
            <h2 className="text-xl font-bold">{stationName}</h2>
            <p className="text-sm text-muted-foreground">Fondo de mantenimiento — Estación #{stationId}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate({ stationId, format: "pdf" })}
          >
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate({ stationId, format: "excel" })}
          >
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </Button>
          <Button onClick={() => setShowWithdrawDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Registrar Cobro
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summaryQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <PiggyBank className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance Actual</p>
                  <p className="text-xl font-bold">{formatCOP(balance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Acumulado</p>
                  <p className="text-xl font-bold">{formatCOP(totalDeposits)}</p>
                  <p className="text-xs text-muted-foreground">{depositCount} depósitos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Gastado</p>
                  <p className="text-xl font-bold">{formatCOP(totalWithdrawals)}</p>
                  <p className="text-xs text-muted-foreground">{withdrawalCount} mantenimientos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Wallet className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uso del Fondo</p>
                  <p className="text-xl font-bold">
                    {totalDeposits > 0 ? `${((totalWithdrawals / totalDeposits) * 100).toFixed(1)}%` : "0%"}
                  </p>
                  <p className="text-xs text-muted-foreground">del total acumulado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fund usage progress bar */}
      {summary && totalDeposits > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uso del fondo</span>
              <span className="text-sm text-muted-foreground">
                {formatCOP(totalWithdrawals)} de {formatCOP(totalDeposits)} usados
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((totalWithdrawals / totalDeposits) * 100, 100)}%`,
                  background: (totalWithdrawals / totalDeposits) < 0.5
                    ? "linear-gradient(90deg, #10b981, #34d399)"
                    : (totalWithdrawals / totalDeposits) < 0.8
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #ef4444, #f87171)"
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>Gastado: {((totalWithdrawals / totalDeposits) * 100).toFixed(1)}%</span>
              <span>Disponible: {formatCOP(balance)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for detail sections */}
      <Tabs value={detailTab} onValueChange={setDetailTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Tendencias
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <FundHistory history={history} isLoading={historyQuery.isLoading} />
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <FundTrendChart stationId={stationId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <AlertThresholdConfig stationId={stationId} />
        </TabsContent>
      </Tabs>

      {/* Withdraw Dialog */}
      <WithdrawDialog
        open={showWithdrawDialog}
        onClose={() => setShowWithdrawDialog(false)}
        stationId={stationId}
        currentBalance={balance}
        onSubmit={(data) => withdrawMutation.mutate(data)}
        isLoading={withdrawMutation.isPending}
      />
    </div>
  );
}

// ============================================================================
// FUND HISTORY (Extracted from StationFundDetail)
// ============================================================================

function FundHistory({ history, isLoading }: { history: any[]; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Historial de Movimientos
        </CardTitle>
        <CardDescription>
          Depósitos automáticos de liquidaciones y cobros de mantenimiento
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">No hay movimientos registrados aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Los depósitos se generan automáticamente al aprobar liquidaciones
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Descripción</th>
                    <th className="pb-2 font-medium">Detalle</th>
                    <th className="pb-2 font-medium text-right">Monto</th>
                    <th className="pb-2 font-medium text-right">Balance</th>
                    <th className="pb-2 font-medium">Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record: any) => (
                    <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 text-xs">{formatDateTime(record.createdAt)}</td>
                      <td className="py-2.5">
                        {record.type === "deposit" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">
                            <ArrowUpCircle className="h-3 w-3 mr-1" />
                            Depósito
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-0 text-xs">
                            <ArrowDownCircle className="h-3 w-3 mr-1" />
                            Retiro
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 max-w-[200px] truncate text-xs">{record.description}</td>
                      <td className="py-2.5 text-xs">
                        {record.type === "withdrawal" && (
                          <div className="space-y-0.5">
                            {record.maintenanceType && (
                              <Badge variant="secondary" className="text-xs">
                                {record.maintenanceType === "preventivo" ? "Preventivo" : "Correctivo"}
                              </Badge>
                            )}
                            {record.technicianName && (
                              <p className="text-muted-foreground">Técnico: {record.technicianName}</p>
                            )}
                            {record.invoiceNumber && (
                              <p className="text-muted-foreground">Factura: {record.invoiceNumber}</p>
                            )}
                          </div>
                        )}
                        {record.type === "deposit" && record.settlementId && (
                          <span className="text-muted-foreground">Liquidación #{record.settlementId}</span>
                        )}
                      </td>
                      <td className={`py-2.5 text-right font-mono font-medium ${record.type === "deposit" ? "text-emerald-600" : "text-red-600"}`}>
                        {record.type === "deposit" ? "+" : "-"}{formatCOP(record.amount)}
                      </td>
                      <td className="py-2.5 text-right font-mono">{formatCOP(record.balanceAfter)}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{record.creatorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {history.map((record: any) => (
                <div key={record.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    {record.type === "deposit" ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">
                        <ArrowUpCircle className="h-3 w-3 mr-1" />
                        Depósito
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-0 text-xs">
                        <ArrowDownCircle className="h-3 w-3 mr-1" />
                        Retiro
                      </Badge>
                    )}
                    <span className={`font-mono font-bold ${record.type === "deposit" ? "text-emerald-600" : "text-red-600"}`}>
                      {record.type === "deposit" ? "+" : "-"}{formatCOP(record.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{record.description}</p>
                  {record.type === "withdrawal" && record.maintenanceType && (
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {record.maintenanceType === "preventivo" ? "Preventivo" : "Correctivo"}
                      </Badge>
                      {record.technicianName && (
                        <span className="text-xs text-muted-foreground">Técnico: {record.technicianName}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateTime(record.createdAt)}</span>
                    <span>Balance: {formatCOP(record.balanceAfter)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FUND TREND CHART (Monthly deposits vs withdrawals)
// ============================================================================

function FundTrendChart({ stationId }: { stationId: number }) {
  const [months] = useState(12);
  const trendQuery = financialTrpc.maintenanceFundMonthlyTrend.useQuery({ stationId, months });
  const trend = trendQuery.data?.trend || [];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || trend.length === 0) return;

    // Dynamically import Chart.js
    const loadChart = async () => {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);

      // Destroy previous chart instance
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = canvasRef.current!.getContext("2d");
      if (!ctx) return;

      const labels = trend.map((t: any) => formatMonthLabel(t.month));
      const deposits = trend.map((t: any) => t.deposits);
      const withdrawals = trend.map((t: any) => t.withdrawals);
      const netValues = trend.map((t: any) => t.net);

      // Calculate cumulative balance
      let cumBalance = 0;
      const cumulativeBalance = trend.map((t: any) => {
        cumBalance += t.net;
        return cumBalance;
      });

      chartInstanceRef.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Depósitos",
              data: deposits,
              backgroundColor: "rgba(16, 185, 129, 0.7)",
              borderColor: "rgb(16, 185, 129)",
              borderWidth: 1,
              borderRadius: 4,
              order: 2,
            },
            {
              label: "Retiros",
              data: withdrawals,
              backgroundColor: "rgba(239, 68, 68, 0.7)",
              borderColor: "rgb(239, 68, 68)",
              borderWidth: 1,
              borderRadius: 4,
              order: 2,
            },
            {
              label: "Balance Acumulado",
              data: cumulativeBalance,
              type: "line",
              borderColor: "rgb(59, 130, 246)",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: "rgb(59, 130, 246)",
              fill: true,
              tension: 0.3,
              yAxisID: "y1",
              order: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              position: "top",
              labels: {
                usePointStyle: true,
                padding: 16,
              },
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const value = context.parsed.y;
                  return `${context.dataset.label}: ${formatCOP(value)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
            },
            y: {
              position: "left",
              title: {
                display: true,
                text: "Monto (COP)",
              },
              ticks: {
                callback: (value: any) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                  return `$${value}`;
                },
              },
            },
            y1: {
              position: "right",
              title: {
                display: true,
                text: "Balance Acumulado",
              },
              grid: { drawOnChartArea: false },
              ticks: {
                callback: (value: any) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                  return `$${value}`;
                },
              },
            },
          },
        },
      });
    };

    loadChart();

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [trend]);

  if (trendQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trend.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">No hay datos de tendencia disponibles</p>
          <p className="text-xs text-muted-foreground mt-1">
            Los datos aparecerán cuando se registren movimientos en el fondo
          </p>
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const totalMonthlyDeposits = trend.reduce((s: number, t: any) => s + t.deposits, 0);
  const totalMonthlyWithdrawals = trend.reduce((s: number, t: any) => s + t.withdrawals, 0);
  const avgMonthlyDeposit = totalMonthlyDeposits / trend.length;
  const avgMonthlyWithdrawal = totalMonthlyWithdrawals / trend.length;

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Promedio Mensual Depósitos</p>
                <p className="text-lg font-bold">{formatCOP(avgMonthlyDeposit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Promedio Mensual Retiros</p>
                <p className="text-lg font-bold">{formatCOP(avgMonthlyWithdrawal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Flujo Neto Mensual</p>
                <p className={`text-lg font-bold ${(avgMonthlyDeposit - avgMonthlyWithdrawal) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCOP(avgMonthlyDeposit - avgMonthlyWithdrawal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Tendencia Mensual — Últimos {months} meses
          </CardTitle>
          <CardDescription>
            Depósitos (liquidaciones) vs retiros (mantenimientos) con balance acumulado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: "350px" }}>
            <canvas ref={canvasRef} />
          </div>
        </CardContent>
      </Card>

      {/* Monthly breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desglose Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Mes</th>
                  <th className="pb-2 font-medium text-right">Depósitos</th>
                  <th className="pb-2 font-medium text-right">Retiros</th>
                  <th className="pb-2 font-medium text-right">Neto</th>
                  <th className="pb-2 font-medium text-center"># Dep.</th>
                  <th className="pb-2 font-medium text-center"># Ret.</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((t: any) => (
                  <tr key={t.month} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 font-medium">{formatMonthLabel(t.month)}</td>
                    <td className="py-2 text-right font-mono text-emerald-600">{formatCOP(t.deposits)}</td>
                    <td className="py-2 text-right font-mono text-red-600">{formatCOP(t.withdrawals)}</td>
                    <td className={`py-2 text-right font-mono font-medium ${t.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {t.net >= 0 ? "+" : ""}{formatCOP(t.net)}
                    </td>
                    <td className="py-2 text-center text-muted-foreground">{t.depositCount}</td>
                    <td className="py-2 text-center text-muted-foreground">{t.withdrawalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ALERT THRESHOLD CONFIG (Configurable per-station threshold in COP)
// ============================================================================

function AlertThresholdConfig({ stationId }: { stationId: number }) {
  const [threshold, setThreshold] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Get current station data to show current threshold
  const stationQuery = financialTrpc.getCollectiveStations.useQuery();
  const station = (stationQuery.data || []).find((s: any) => s.id === stationId);
  const currentThreshold = station?.maintenanceFundAlertThreshold
    ? Number(station.maintenanceFundAlertThreshold)
    : 500000;

  useEffect(() => {
    if (station && !threshold) {
      setThreshold(String(currentThreshold));
    }
  }, [station, currentThreshold]);

  const updateMutation = financialTrpc.updateAlertThreshold.useMutation({
    onSuccess: () => {
      toast.success("Umbral de alerta actualizado exitosamente");
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (e: any) => toast.error(`Error: ${e.message}`),
  });

  const numThreshold = Number(threshold) || 0;
  const hasChanged = numThreshold !== currentThreshold;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-amber-500" />
          Configuración de Alertas
        </CardTitle>
        <CardDescription>
          Configura el umbral de alerta en pesos colombianos (COP). Cuando el balance del fondo
          baje de este monto después de un retiro, se enviará una alerta automática a los
          administradores e inversionistas de la estación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Current threshold display */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Umbral actual</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <DollarSign className="h-5 w-5 text-amber-500" />
              <span className="text-xl font-bold">{formatCOP(currentThreshold)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Se envía alerta cuando el balance baje de este monto
            </p>
          </div>

          {/* New threshold input */}
          <div className="space-y-2">
            <Label htmlFor="threshold">Nuevo umbral (COP)</Label>
            <Input
              id="threshold"
              type="number"
              placeholder="Ej: 500000"
              value={threshold}
              onChange={(e) => {
                setThreshold(e.target.value);
                setIsSaved(false);
              }}
              min={0}
              max={100000000}
            />
            {numThreshold > 0 && (
              <p className="text-xs text-muted-foreground">
                Equivale a: {formatCOP(numThreshold)}
              </p>
            )}
          </div>
        </div>

        {/* Quick presets */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Valores sugeridos</Label>
          <div className="flex flex-wrap gap-2">
            {[200000, 500000, 1000000, 2000000, 5000000].map((val) => (
              <Button
                key={val}
                variant="outline"
                size="sm"
                className={`text-xs ${numThreshold === val ? "border-amber-500 bg-amber-500/10" : ""}`}
                onClick={() => {
                  setThreshold(String(val));
                  setIsSaved(false);
                }}
              >
                {formatCOP(val)}
              </Button>
            ))}
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Funcionamiento del umbral</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc pl-4">
                <li>El fondo crece progresivamente con cada liquidación (ventas de energía)</li>
                <li>Después de cada retiro (cobro de mantenimiento), se verifica el balance</li>
                <li>Si el balance queda por debajo del umbral, se envía notificación push, in-app y email</li>
                <li>Los destinatarios son: todos los administradores y los inversionistas de la estación</li>
                <li>Un valor de $0 desactiva las alertas automáticas</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            onClick={() => updateMutation.mutate({ stationId, thresholdCOP: numThreshold })}
            disabled={!hasChanged || updateMutation.isPending || numThreshold < 0}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : isSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Guardado
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar Umbral
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// WITHDRAW DIALOG (Form to register a maintenance charge)
// ============================================================================

function WithdrawDialog({
  open,
  onClose,
  stationId,
  currentBalance,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  stationId: number;
  currentBalance: number;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [maintenanceType, setMaintenanceType] = useState<string>("");
  const [maintenanceDetail, setMaintenanceDetail] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const numAmount = Number(amount) || 0;
  const isValid = numAmount > 0 && numAmount <= currentBalance && description.length >= 5 && maintenanceType;
  const exceedsBalance = numAmount > currentBalance;

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      stationId,
      amount: numAmount,
      description,
      maintenanceType,
      maintenanceDetail: maintenanceDetail || undefined,
      technicianName: technicianName || undefined,
      invoiceNumber: invoiceNumber || undefined,
    });
  };

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setAmount("");
      setDescription("");
      setMaintenanceType("");
      setMaintenanceDetail("");
      setTechnicianName("");
      setInvoiceNumber("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            Registrar Cobro de Mantenimiento
          </DialogTitle>
          <DialogDescription>
            Registra un gasto de mantenimiento contra el fondo de la estación.
            Balance disponible: <strong className="text-foreground">{formatCOP(currentBalance)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Monto (COP) *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Ej: 150000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={currentBalance}
            />
            {exceedsBalance && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                El monto excede el balance disponible ({formatCOP(currentBalance)})
              </p>
            )}
            {numAmount > 0 && !exceedsBalance && (
              <p className="text-xs text-muted-foreground">
                Balance después del retiro: {formatCOP(currentBalance - numAmount)}
              </p>
            )}
          </div>

          {/* Maintenance Type */}
          <div className="space-y-2">
            <Label>Tipo de Mantenimiento *</Label>
            <Select value={maintenanceType} onValueChange={setMaintenanceType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <span>{t.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción del trabajo *</Label>
            <Textarea
              id="description"
              placeholder="Ej: Reemplazo de conector CCS2 dañado por vandalismo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            {description.length > 0 && description.length < 5 && (
              <p className="text-xs text-red-500">Mínimo 5 caracteres</p>
            )}
          </div>

          <Separator />

          {/* Optional fields */}
          <p className="text-xs text-muted-foreground font-medium">Campos opcionales</p>

          {/* Maintenance Detail */}
          <div className="space-y-2">
            <Label htmlFor="detail">Detalle técnico</Label>
            <Textarea
              id="detail"
              placeholder="Descripción detallada del trabajo realizado..."
              value={maintenanceDetail}
              onChange={(e) => setMaintenanceDetail(e.target.value)}
              rows={2}
            />
          </div>

          {/* Technician Name */}
          <div className="space-y-2">
            <Label htmlFor="technician">Nombre del técnico</Label>
            <Input
              id="technician"
              placeholder="Ej: Carlos Rodríguez"
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
            />
          </div>

          {/* Invoice Number */}
          <div className="space-y-2">
            <Label htmlFor="invoice">Número de factura/recibo</Label>
            <Input
              id="invoice"
              placeholder="Ej: FAC-2026-0042"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading} className="gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Registrar Cobro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
