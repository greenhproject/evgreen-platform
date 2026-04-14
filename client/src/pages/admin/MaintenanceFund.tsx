/**
 * Fondo de Mantenimiento - Panel Administrativo
 * Gestión del fondo de mantenimiento para estaciones colectivas (crowdfunding)
 * Muestra: balance acumulado, historial de movimientos, formulario de retiro
 * @author Green House Project
 */
import { useState, useMemo } from "react";
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
import { toast } from "sonner";
import {
  Wrench, DollarSign, TrendingUp, TrendingDown, Plus,
  ArrowUpCircle, ArrowDownCircle, Building2, Wallet,
  FileText, CheckCircle2, AlertTriangle, Search,
  Loader2, History, PiggyBank, ShieldCheck, ChevronRight
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminMaintenanceFund() {
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
        <StationsList
          stations={filteredStations}
          isLoading={collectiveStationsQuery.isLoading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onSelectStation={(id: number) => setSelectedStationId(id)}
        />
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
        <Button onClick={() => setShowWithdrawDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar Cobro de Mantenimiento
        </Button>
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

      {/* History */}
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
          {historyQuery.isLoading ? (
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
