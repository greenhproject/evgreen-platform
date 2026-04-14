/**
 * Centro Financiero - Panel Administrativo
 * 3 Tabs: Gastos Fijos | Liquidaciones/Waterfall | Métricas SLA
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
  Calculator, Plus, Pencil, Trash2, DollarSign, TrendingUp,
  FileText, CheckCircle2, AlertTriangle, XCircle, ArrowDownUp,
  Activity, Gauge, Clock, Star, Zap, Sun, Shield,
  ChevronRight, Loader2, BarChart3
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

// ============================================================================
// TYPES
// ============================================================================

type Tab = "expenses" | "settlements" | "metrics";

const EXPENSE_CATEGORIES = [
  { value: "INSURANCE", label: "Póliza de Seguro" },
  { value: "CONNECTIVITY", label: "Internet/Conectividad" },
  { value: "ENERGY", label: "Energía Eléctrica" },
  { value: "FIDUCIARY", label: "Fiducia/Administración" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "RENT", label: "Arriendo" },
  { value: "TAXES", label: "Impuestos/Tasas" },
  { value: "SECURITY", label: "Vigilancia/Seguridad" },
  { value: "PLATFORM", label: "Plataforma Tecnológica" },
  { value: "OTHER", label: "Otros" },
];

const PERIODICITIES = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

const PERIOD_TYPES = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminFinancial() {
  const [activeTab, setActiveTab] = useState<Tab>("expenses");
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  // Get all stations for the selector
  const stationsQuery = trpc.stations.listAll.useQuery();
  const stations = stationsQuery.data || [];

  const tabs = [
    { id: "expenses" as Tab, label: "Gastos Fijos", icon: DollarSign },
    { id: "settlements" as Tab, label: "Liquidaciones", icon: ArrowDownUp },
    { id: "metrics" as Tab, label: "Métricas SLA", icon: Activity },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-7 w-7 text-primary" />
            Centro Financiero
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de gastos, liquidaciones waterfall y métricas operativas SLA
          </p>
        </div>

        {/* Station Selector */}
        <div className="w-full md:w-80">
          <Select
            value={selectedStationId?.toString() || ""}
            onValueChange={(v) => setSelectedStationId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar estación..." />
            </SelectTrigger>
            <SelectContent>
              {stations.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name} — {s.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {!selectedStationId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">Selecciona una estación</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Elige una estación del selector superior para ver y gestionar sus gastos fijos, liquidaciones y métricas operativas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeTab === "expenses" && <ExpensesTab stationId={selectedStationId} />}
          {activeTab === "settlements" && <SettlementsTab stationId={selectedStationId} />}
          {activeTab === "metrics" && <MetricsTab stationId={selectedStationId} />}
        </>
      )}
    </div>
  );
}

// ============================================================================
// TAB 1: GASTOS FIJOS
// ============================================================================

function ExpensesTab({ stationId }: { stationId: number }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const expensesQuery = financialTrpc.getExpenses.useQuery({ stationId, activeOnly: false });
  const expenses = expensesQuery.data || [];
  const utils = trpc.useUtils();
  const financialUtils = (utils as any).financial;

  const createMutation = financialTrpc.createExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto fijo creado exitosamente");
      financialUtils.getExpenses.invalidate();
      setShowCreate(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = financialTrpc.updateExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto actualizado");
      financialUtils.getExpenses.invalidate();
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = financialTrpc.deleteExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto desactivado");
      financialUtils.getExpenses.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalMonthly = useMemo(() => {
    return expenses
      .filter((e: any) => e.isActive)
      .reduce((sum: number, e: any) => {
        const amount = Number(e.amountCop);
        switch (e.periodicity) {
          case "MONTHLY": return sum + amount;
          case "BIMONTHLY": return sum + amount / 2;
          case "QUARTERLY": return sum + amount / 3;
          case "SEMIANNUAL": return sum + amount / 6;
          case "ANNUAL": return sum + amount / 12;
          default: return sum + amount;
        }
      }, 0);
  }, [expenses]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gastos Activos</p>
                <p className="text-2xl font-bold">{expenses.filter((e: any) => e.isActive).length}</p>
              </div>
              <FileText className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Costo Mensual Estimado</p>
                <p className="text-2xl font-bold text-orange-500">{formatCOP(totalMonthly)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Costo Anual Estimado</p>
                <p className="text-2xl font-bold text-blue-500">{formatCOP(totalMonthly * 12)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Gastos Fijos Configurados</h2>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Agregar Gasto
        </Button>
      </div>

      {/* Expenses Table */}
      {expenses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay gastos fijos configurados para esta estación.</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Crear primer gasto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Prioridad</th>
                <th className="text-left p-3 font-medium">Nombre</th>
                <th className="text-left p-3 font-medium">Categoría</th>
                <th className="text-right p-3 font-medium">Monto</th>
                <th className="text-left p-3 font-medium">Periodicidad</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-right p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp: any) => (
                <tr key={exp.id} className={`border-t ${!exp.isActive ? "opacity-50" : ""}`}>
                  <td className="p-3">
                    <Badge variant="outline" className="font-mono">{exp.waterfallPriority}</Badge>
                  </td>
                  <td className="p-3 font-medium">{exp.name}</td>
                  <td className="p-3">
                    <Badge variant="secondary">
                      {EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label || exp.category}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono">{formatCOP(Number(exp.amountCop))}</td>
                  <td className="p-3">
                    {PERIODICITIES.find(p => p.value === exp.periodicity)?.label || exp.periodicity}
                  </td>
                  <td className="p-3">
                    {exp.isActive ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Activo</Badge>
                    ) : (
                      <Badge variant="destructive">Inactivo</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(exp.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {exp.isActive && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("¿Desactivar este gasto?")) {
                              deleteMutation.mutate({ id: exp.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <ExpenseFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMutation.mutate({ ...data, stationId })}
        isLoading={createMutation.isPending}
        title="Nuevo Gasto Fijo"
      />

      {/* Edit Dialog */}
      {editingId && (
        <ExpenseFormDialog
          open={true}
          onClose={() => setEditingId(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingId, ...data })}
          isLoading={updateMutation.isPending}
          title="Editar Gasto Fijo"
          initialData={expenses.find((e: any) => e.id === editingId)}
        />
      )}
    </div>
  );
}

// ============================================================================
// EXPENSE FORM DIALOG
// ============================================================================

function ExpenseFormDialog({
  open, onClose, onSubmit, isLoading, title, initialData
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  title: string;
  initialData?: any;
}) {
  const [form, setForm] = useState({
    name: initialData?.name || "",
    category: initialData?.category || "OTHER",
    description: initialData?.description || "",
    amountCop: initialData?.amountCop ? Number(initialData.amountCop) : 0,
    periodicity: initialData?.periodicity || "MONTHLY",
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().split("T")[0] : "",
    providerName: initialData?.providerName || "",
    contractReference: initialData?.contractReference || "",
    waterfallPriority: initialData?.waterfallPriority || 5,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Configure los detalles del gasto fijo para esta estación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nombre del Gasto</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Póliza Todo Riesgo"
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Periodicidad</Label>
              <Select value={form.periodicity} onValueChange={(v) => setForm({ ...form, periodicity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODICITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto (COP)</Label>
              <Input
                type="number"
                value={form.amountCop || ""}
                onChange={(e) => setForm({ ...form, amountCop: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Prioridad Waterfall (1-20)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.waterfallPriority}
                onChange={(e) => setForm({ ...form, waterfallPriority: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Fecha Fin (opcional)</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Proveedor</Label>
              <Input
                value={form.providerName}
                onChange={(e) => setForm({ ...form, providerName: e.target.value })}
                placeholder="Nombre del proveedor"
              />
            </div>
            <div>
              <Label>Ref. Contrato</Label>
              <Input
                value={form.contractReference}
                onChange={(e) => setForm({ ...form, contractReference: e.target.value })}
                placeholder="Número de contrato"
              />
            </div>
            <div className="col-span-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción del gasto..."
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={isLoading || !form.name || !form.amountCop}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initialData ? "Guardar Cambios" : "Crear Gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TAB 2: LIQUIDACIONES / WATERFALL
// ============================================================================

function SettlementsTab({ stationId }: { stationId: number }) {
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<number | null>(null);

  const settlementsQuery = financialTrpc.getSettlements.useQuery({ stationId, limit: 20 });
  const settlements = settlementsQuery.data || [];
  const utils = trpc.useUtils();
  const financialUtils = (utils as any).financial;

  const generateMutation = financialTrpc.generateSettlement.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Liquidación generada: ${formatCOP(data.grossRevenue)} bruto → ${formatCOP(data.investorTotalAmount)} para inversionistas`);
      financialUtils.getSettlements.invalidate();
      setShowGenerate(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = financialTrpc.approveSettlement.useMutation({
    onSuccess: () => {
      financialUtils.getSettlements.invalidate();
      toast.success("Liquidación aprobada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const distributeMutation = financialTrpc.distributeSettlement.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message);
      financialUtils.getSettlements.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Historial de Liquidaciones</h2>
        <Button onClick={() => setShowGenerate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Generar Liquidación
        </Button>
      </div>

      {/* Settlements List */}
      {settlements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ArrowDownUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay liquidaciones generadas para esta estación.</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowGenerate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Generar primera liquidación
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {settlements.map((s: any) => (
            <Card key={s.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={
                        s.status === "DISTRIBUTED" ? "default" :
                        s.status === "APPROVED" ? "secondary" : "outline"
                      }>
                        {s.status === "DRAFT" && "Borrador"}
                        {s.status === "APPROVED" && "Aprobada"}
                        {s.status === "DISTRIBUTED" && "Distribuida"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {s.periodType} — {formatDate(s.periodStart)} a {formatDate(s.periodEnd)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Ingreso Bruto</p>
                        <p className="font-semibold text-green-500">{formatCOP(Number(s.grossRevenue))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gastos Fijos</p>
                        <p className="font-semibold text-red-500">-{formatCOP(Number(s.totalFixedExpenses))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Inversionistas ({s.investorSharePercent}%)</p>
                        <p className="font-semibold text-primary">{formatCOP(Number(s.investorTotalAmount))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Plataforma ({s.platformSharePercent}%)</p>
                        <p className="font-semibold">{formatCOP(Number(s.platformTotalAmount))}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {s.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => approveMutation.mutate({ id: s.id })}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Aprobar
                      </Button>
                    )}
                    {s.status === "APPROVED" && (
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => distributeMutation.mutate({ id: s.id })}
                        disabled={distributeMutation.isPending}
                      >
                        <DollarSign className="h-4 w-4" /> Distribuir
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSettlement(s.id)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Settlement Dialog */}
      <GenerateSettlementDialog
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        stationId={stationId}
        onGenerate={(data) => generateMutation.mutate(data)}
        isLoading={generateMutation.isPending}
      />

      {/* Settlement Detail Dialog */}
      {selectedSettlement && (
        <SettlementDetailDialog
          settlementId={selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// GENERATE SETTLEMENT DIALOG
// ============================================================================

function GenerateSettlementDialog({
  open, onClose, stationId, onGenerate, isLoading
}: {
  open: boolean;
  onClose: () => void;
  stationId: number;
  onGenerate: (data: any) => void;
  isLoading: boolean;
}) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

  const [form, setForm] = useState({
    periodType: "MONTHLY",
    periodStart: firstDay.toISOString().split("T")[0],
    periodEnd: lastDay.toISOString().split("T")[0],
    investorSharePercent: 70,
    platformSharePercent: 30,
    contingencyPercent: 5,
    notes: "",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar Nueva Liquidación</DialogTitle>
          <DialogDescription>
            Calcula automáticamente ingresos, deduce gastos fijos y distribuye el remanente según la cascada de pagos (waterfall).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Tipo de Período</Label>
              <Select value={form.periodType} onValueChange={(v) => setForm({ ...form, periodType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              />
            </div>
            <div>
              <Label>Fecha Fin</Label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              />
            </div>
            <div>
              <Label>% Inversionistas</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.investorSharePercent}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setForm({ ...form, investorSharePercent: v, platformSharePercent: 100 - v });
                }}
              />
            </div>
            <div>
              <Label>% Plataforma</Label>
              <Input
                type="number"
                value={form.platformSharePercent}
                disabled
              />
            </div>
            <div className="col-span-2">
              <Label>% Reserva Contingencia</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={form.contingencyPercent}
                onChange={(e) => setForm({ ...form, contingencyPercent: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observaciones sobre esta liquidación..."
                rows={2}
              />
            </div>
          </div>

          {/* Waterfall Preview */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">CASCADA DE PAGOS (WATERFALL)</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>1. Ingreso Bruto por Venta de Energía</span>
                  <span className="text-green-500 font-mono">+$$$</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>2. (-) Gastos Fijos (por prioridad)</span>
                  <span className="font-mono">-$$$</span>
                </div>
                <div className="flex justify-between text-yellow-500">
                  <span>3. (-) Reserva Contingencia ({form.contingencyPercent}%)</span>
                  <span className="font-mono">-$$$</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold">
                  <span>4. Neto Distribuible</span>
                  <span className="font-mono">=$$$</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span className="pl-4">→ Inversionistas ({form.investorSharePercent}%)</span>
                  <span className="font-mono">$$$</span>
                </div>
                <div className="flex justify-between">
                  <span className="pl-4">→ Plataforma GHP ({form.platformSharePercent}%)</span>
                  <span className="font-mono">$$$</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onGenerate({ ...form, stationId })}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generar Liquidación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SETTLEMENT DETAIL DIALOG
// ============================================================================

function SettlementDetailDialog({
  settlementId, onClose
}: {
  settlementId: number;
  onClose: () => void;
}) {
  const detailQuery = financialTrpc.getSettlementDetail.useQuery({ id: settlementId });
  const detail = detailQuery.data;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Liquidación #{settlementId}</DialogTitle>
        </DialogHeader>

        {!detail ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Waterfall Breakdown */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4" /> Cascada de Pagos (Waterfall)
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-green-500/10 rounded">
                  <span className="font-medium">Ingreso Bruto</span>
                  <span className="font-mono font-bold text-green-500">{formatCOP(Number(detail.settlement.grossRevenue))}</span>
                </div>
                {detail.expenseLines.map((line: any, i: number) => (
                  <div key={i} className="flex justify-between p-2 bg-red-500/5 rounded text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{line.waterfallPriority}</Badge>
                      {line.name}
                    </span>
                    <span className="font-mono text-red-500">-{formatCOP(Number(line.proratedAmount))}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between p-2 bg-yellow-500/10 rounded">
                  <span className="font-medium">Reserva Contingencia</span>
                  <span className="font-mono text-yellow-600">-{formatCOP(Number(detail.settlement.contingencyReserve))}</span>
                </div>
                <Separator />
                <div className="flex justify-between p-2 bg-primary/10 rounded font-bold">
                  <span>Neto Distribuible</span>
                  <span className="font-mono text-primary">
                    {formatCOP(Number(detail.settlement.investorTotalAmount) + Number(detail.settlement.platformTotalAmount))}
                  </span>
                </div>
              </div>
            </div>

            {/* Distribution */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Distribución por Inversionista
              </h3>
              {detail.investorShares.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay inversionistas vinculados a esta estación.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Inversionista</th>
                        <th className="text-right p-2 font-medium">Participación</th>
                        <th className="text-right p-2 font-medium">Bruto</th>
                        <th className="text-right p-2 font-medium">Gastos</th>
                        <th className="text-right p-2 font-medium">Neto</th>
                        <th className="text-center p-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.investorShares.map((share: any) => (
                        <tr key={share.id} className="border-t">
                          <td className="p-2">ID: {share.investorUserId}</td>
                          <td className="p-2 text-right font-mono">{formatPercent(share.participationPercent)}</td>
                          <td className="p-2 text-right font-mono text-green-500">{formatCOP(Number(share.grossShare))}</td>
                          <td className="p-2 text-right font-mono text-red-500">-{formatCOP(Number(share.expenseShare))}</td>
                          <td className="p-2 text-right font-mono font-bold text-primary">{formatCOP(Number(share.netShare))}</td>
                          <td className="p-2 text-center">
                            <Badge variant={share.status === "CREDITED" ? "default" : "outline"}>
                              {share.status === "PENDING" ? "Pendiente" : share.status === "CREDITED" ? "Acreditado" : share.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TAB 3: MÉTRICAS SLA
// ============================================================================

function MetricsTab({ stationId }: { stationId: number }) {
  const [showRecord, setShowRecord] = useState(false);

  const metricsQuery = financialTrpc.getMetrics.useQuery({ stationId, limit: 12 });
  const latestQuery = financialTrpc.getLatestMetric.useQuery({ stationId });
  const metrics = metricsQuery.data || [];
  const latest = latestQuery.data;
  const utils = trpc.useUtils();
  const financialUtils = (utils as any).financial;

  const recordMutation = financialTrpc.recordMetrics.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Métricas registradas — SLA: ${data.slaStatus}`);
      financialUtils.getMetrics.invalidate();
      financialUtils.getLatestMetric.invalidate();
      setShowRecord(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const SLA_TARGETS = [
    { key: "availability", label: "Disponibilidad Operativa", target: "≥ 95%", icon: Gauge, value: latest ? formatPercent(latest.availabilityPercent) : "—", color: "text-green-500" },
    { key: "response", label: "Respuesta Fallas Críticas", target: "≤ 24h", icon: Clock, value: latest ? `${Number(latest.avgCriticalResponseHours).toFixed(1)}h` : "—", color: "text-blue-500" },
    { key: "platform", label: "Uptime Plataforma", target: "≥ 99%", icon: Activity, value: latest ? formatPercent(latest.platformUptimePercent) : "—", color: "text-purple-500" },
    { key: "satisfaction", label: "Satisfacción Usuario", target: "≥ 4.0/5", icon: Star, value: latest ? `${Number(latest.userSatisfactionScore).toFixed(1)}/5` : "—", color: "text-yellow-500" },
    { key: "billing", label: "Precisión Facturación", target: "≥ 99.9%", icon: Zap, value: latest ? formatPercent(latest.billingAccuracyPercent) : "—", color: "text-cyan-500" },
    { key: "solar", label: "Generación Solar", target: "≥ 85%", icon: Sun, value: latest ? formatPercent(latest.solarGenerationPercent) : "—", color: "text-orange-500" },
  ];

  return (
    <div className="space-y-4">
      {/* SLA Status Banner */}
      {latest && (
        <Card className={`border-2 ${
          latest.slaStatus === "COMPLIANT" ? "border-green-500/30 bg-green-500/5" :
          latest.slaStatus === "WARNING" ? "border-yellow-500/30 bg-yellow-500/5" :
          "border-red-500/30 bg-red-500/5"
        }`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {latest.slaStatus === "COMPLIANT" ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : latest.slaStatus === "WARNING" ? (
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <div>
                  <h3 className="font-bold text-lg">
                    Estado SLA: {
                      latest.slaStatus === "COMPLIANT" ? "Cumplimiento" :
                      latest.slaStatus === "WARNING" ? "Advertencia" : "Incumplimiento"
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {latest.slaBreachCount} indicadores fuera de meta
                    {latest.consecutiveBreachMonths > 0 && ` — ${latest.consecutiveBreachMonths} meses consecutivos`}
                  </p>
                </div>
              </div>
              {latest.penaltyApplied !== "NONE" && (
                <Badge variant="destructive" className="text-sm">
                  {latest.penaltyApplied === "IMPROVEMENT_PLAN" && "Plan de Mejora"}
                  {latest.penaltyApplied === "FEE_REDUCTION_10" && "Reducción 10% Comisión"}
                  {latest.penaltyApplied === "DEFAULT_EVENT" && "Evento de Incumplimiento"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SLA_TARGETS.map((kpi) => (
          <Card key={kpi.key}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">Meta: {kpi.target}</p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Historial de Métricas</h2>
        <Button onClick={() => setShowRecord(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Registrar Métricas
        </Button>
      </div>

      {/* Metrics History */}
      {metrics.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay métricas registradas para esta estación.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Período</th>
                <th className="text-center p-3 font-medium">Disponibilidad</th>
                <th className="text-center p-3 font-medium">Respuesta</th>
                <th className="text-center p-3 font-medium">Uptime</th>
                <th className="text-center p-3 font-medium">Satisfacción</th>
                <th className="text-center p-3 font-medium">Facturación</th>
                <th className="text-center p-3 font-medium">Solar</th>
                <th className="text-center p-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m: any) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 text-xs">{formatDate(m.periodStart)} - {formatDate(m.periodEnd)}</td>
                  <td className="p-3 text-center font-mono">{formatPercent(m.availabilityPercent)}</td>
                  <td className="p-3 text-center font-mono">{Number(m.avgCriticalResponseHours).toFixed(1)}h</td>
                  <td className="p-3 text-center font-mono">{formatPercent(m.platformUptimePercent)}</td>
                  <td className="p-3 text-center font-mono">{Number(m.userSatisfactionScore).toFixed(1)}</td>
                  <td className="p-3 text-center font-mono">{formatPercent(m.billingAccuracyPercent)}</td>
                  <td className="p-3 text-center font-mono">{formatPercent(m.solarGenerationPercent)}</td>
                  <td className="p-3 text-center">
                    <Badge variant={
                      m.slaStatus === "COMPLIANT" ? "default" :
                      m.slaStatus === "WARNING" ? "secondary" : "destructive"
                    } className="text-xs">
                      {m.slaStatus === "COMPLIANT" ? "OK" : m.slaStatus === "WARNING" ? "Alerta" : "Incump."}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Metrics Dialog */}
      <RecordMetricsDialog
        open={showRecord}
        onClose={() => setShowRecord(false)}
        stationId={stationId}
        onRecord={(data) => recordMutation.mutate(data)}
        isLoading={recordMutation.isPending}
      />
    </div>
  );
}

// ============================================================================
// RECORD METRICS DIALOG
// ============================================================================

function RecordMetricsDialog({
  open, onClose, stationId, onRecord, isLoading
}: {
  open: boolean;
  onClose: () => void;
  stationId: number;
  onRecord: (data: any) => void;
  isLoading: boolean;
}) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

  const [form, setForm] = useState({
    periodStart: firstDay.toISOString().split("T")[0],
    periodEnd: lastDay.toISOString().split("T")[0],
    availabilityPercent: 95,
    totalUptimeHours: 720,
    totalDowntimeHours: 0,
    avgCriticalResponseHours: 2,
    criticalTicketsCount: 0,
    criticalTicketsResolved: 0,
    platformUptimePercent: 99.5,
    userSatisfactionScore: 4.0,
    totalReviews: 0,
    billingAccuracyPercent: 99.9,
    totalTransactions: 0,
    disputedTransactions: 0,
    solarGenerationPercent: 85,
    solarKwhGenerated: 0,
    solarKwhExpected: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Métricas Operativas</DialogTitle>
          <DialogDescription>
            Ingrese los indicadores de desempeño del período. El sistema calculará automáticamente el estado SLA y las consecuencias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Período Inicio</Label>
              <Input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
            </div>
            <div>
              <Label>Período Fin</Label>
              <Input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm flex items-center gap-2"><Gauge className="h-4 w-4" /> Disponibilidad Operativa (Meta: ≥ 95%)</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>% Disponibilidad</Label>
              <Input type="number" step="0.1" value={form.availabilityPercent} onChange={(e) => setForm({ ...form, availabilityPercent: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Horas Activo</Label>
              <Input type="number" value={form.totalUptimeHours} onChange={(e) => setForm({ ...form, totalUptimeHours: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Horas Inactivo</Label>
              <Input type="number" value={form.totalDowntimeHours} onChange={(e) => setForm({ ...form, totalDowntimeHours: Number(e.target.value) })} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Respuesta a Fallas (Meta: ≤ 24h)</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Promedio Respuesta (h)</Label>
              <Input type="number" step="0.1" value={form.avgCriticalResponseHours} onChange={(e) => setForm({ ...form, avgCriticalResponseHours: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tickets Críticos</Label>
              <Input type="number" value={form.criticalTicketsCount} onChange={(e) => setForm({ ...form, criticalTicketsCount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tickets Resueltos</Label>
              <Input type="number" value={form.criticalTicketsResolved} onChange={(e) => setForm({ ...form, criticalTicketsResolved: Number(e.target.value) })} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Plataforma y Satisfacción</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>% Uptime Plataforma (Meta: ≥ 99%)</Label>
              <Input type="number" step="0.01" value={form.platformUptimePercent} onChange={(e) => setForm({ ...form, platformUptimePercent: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Satisfacción (Meta: ≥ 4.0/5)</Label>
              <Input type="number" step="0.1" min={0} max={5} value={form.userSatisfactionScore} onChange={(e) => setForm({ ...form, userSatisfactionScore: Number(e.target.value) })} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Facturación y Solar</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>% Precisión Facturación (Meta: ≥ 99.9%)</Label>
              <Input type="number" step="0.01" value={form.billingAccuracyPercent} onChange={(e) => setForm({ ...form, billingAccuracyPercent: Number(e.target.value) })} />
            </div>
            <div>
              <Label>% Generación Solar (Meta: ≥ 85%)</Label>
              <Input type="number" step="0.1" value={form.solarGenerationPercent} onChange={(e) => setForm({ ...form, solarGenerationPercent: Number(e.target.value) })} />
            </div>
            <div>
              <Label>kWh Generados (Solar)</Label>
              <Input type="number" value={form.solarKwhGenerated} onChange={(e) => setForm({ ...form, solarKwhGenerated: Number(e.target.value) })} />
            </div>
            <div>
              <Label>kWh Esperados (Solar)</Label>
              <Input type="number" value={form.solarKwhExpected} onChange={(e) => setForm({ ...form, solarKwhExpected: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onRecord({ ...form, stationId })} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Métricas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
