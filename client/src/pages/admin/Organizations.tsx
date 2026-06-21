/**
 * Admin Organizations Page - Gestión de tenants SaaS
 * Panel para crear, editar y administrar organizaciones licenciadas
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building,
  Plus,
  Search,
  DollarSign,
  Users,
  Zap,
  Settings,
  TrendingUp,
  MapPin,
  Ticket,
  UserPlus,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function Organizations() {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  // Queries
  const { data: orgs, isLoading, refetch } = (trpc.organizations as any).list.useQuery({
    search: search || undefined,
    plan: (filterPlan as any) || undefined,
    status: (filterStatus as any) || undefined,
  });
  const { data: stats } = (trpc.organizations as any).getStats.useQuery();
  const { data: pricingDefaults } = (trpc.organizations as any).getPricingDefaults.useQuery();

  // Mutations
  const createOrg = (trpc.organizations as any).create.useMutation({
    onSuccess: () => {
      toast.success("Organización creada exitosamente");
      setShowCreateDialog(false);
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "Error al crear organización"),
  });

  const updatePricing = (trpc.organizations as any).updatePricingDefault.useMutation({
    onSuccess: () => {
      toast.success("Pricing actualizado");
    },
  });

  const statusColors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    trial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    suspended: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const planColors: Record<string, string> = {
    starter: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    professional: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building className="h-7 w-7 text-green-400" />
            Organizaciones SaaS
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona los clientes licenciados de la plataforma EVGreen
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPricingDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Pricing Global
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Org
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Building className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.active || 0}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.trial || 0}</p>
                <p className="text-xs text-muted-foreground">En Trial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats?.totalRevenue || "0"}</p>
                <p className="text-xs text-muted-foreground">Revenue Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspendido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Organizations Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="p-4 text-sm font-medium text-muted-foreground">Organización</th>
                  <th className="p-4 text-sm font-medium text-muted-foreground">Plan</th>
                  <th className="p-4 text-sm font-medium text-muted-foreground">Estado</th>
                  <th className="p-4 text-sm font-medium text-muted-foreground">Red</th>
                  <th className="p-4 text-sm font-medium text-muted-foreground">Soporte</th>
                  <th className="p-4 text-sm font-medium text-muted-foreground">Contacto</th>
                  <th className="p-4 text-sm font-medium text-muted-foreground">Creado</th>
                  <th className="p-4 text-sm font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Cargando organizaciones...
                    </td>
                  </tr>
                ) : orgs?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <Building className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No hay organizaciones registradas</p>
                      <p className="text-sm mt-1">Crea la primera organización para comenzar</p>
                    </td>
                  </tr>
                ) : (
                  orgs?.map((org: any) => (
                    <tr key={org.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">{org.slug}.evgreen.lat</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={planColors[org.plan] || ""}>
                          {org.plan}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={statusColors[org.status] || ""}>
                          {org.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={org.networkMember ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}>
                          {org.networkMember ? "EVGreen Network" : "Red Propia"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm ${org.supportIncluded ? "text-green-400" : "text-gray-400"}`}>
                          {org.supportIncluded ? "✓ Incluido" : "Autogestión"}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm">{org.contactName || "-"}</p>
                        <p className="text-xs text-muted-foreground">{org.contactEmail || ""}</p>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedOrg(org)}
                          className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Gestionar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Organization Dialog */}
      <CreateOrgDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={(data) => createOrg.mutate(data)}
        isLoading={createOrg.isPending}
      />

      {/* Pricing Defaults Dialog */}
      <PricingDialog
        open={showPricingDialog}
        onClose={() => setShowPricingDialog(false)}
        defaults={pricingDefaults || []}
        onUpdate={(plan, data) => updatePricing.mutate({ plan, ...data })}
      />

      {/* Org Detail Management Dialog */}
      {selectedOrg && (
        <OrgDetailDialog
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

// ==========================================
// Org Detail Dialog (Tabs: Estaciones, Usuarios, Tickets)
// ==========================================
function OrgDetailDialog({ org, onClose, onRefresh }: {
  org: any;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();

  // Queries
  const { data: orgStations, refetch: refetchStations } = (trpc.organizations as any).listOrgStations.useQuery({ organizationId: org.id });
  const { data: unassignedStations } = (trpc.organizations as any).listUnassignedStations.useQuery();
  const { data: orgUsers, refetch: refetchUsers } = (trpc.organizations as any).listOrgUsers.useQuery({ organizationId: org.id });
  const { data: orgTickets, refetch: refetchTickets } = (trpc.organizations as any).listOrgTickets.useQuery({ organizationId: org.id });

  // Mutations
  const assignStation = (trpc.organizations as any).assignStation.useMutation({
    onSuccess: () => {
      toast.success("Estación asignada");
      refetchStations();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unassignStation = (trpc.organizations as any).assignStation.useMutation({
    onSuccess: () => {
      toast.success("Estación desvinculada");
      refetchStations();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addOrgUser = (trpc.organizations as any).addOrgUser.useMutation({
    onSuccess: () => {
      toast.success("Usuario agregado");
      refetchUsers();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeOrgUser = (trpc.organizations as any).removeOrgUser.useMutation({
    onSuccess: () => {
      toast.success("Usuario removido");
      refetchUsers();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateTicketStatus = (trpc.organizations as any).updateTicketStatus.useMutation({
    onSuccess: () => {
      toast.success("Ticket actualizado");
      refetchTickets();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [addUserForm, setAddUserForm] = useState({ userId: "", role: "admin" as "admin" | "viewer" });
  const [selectedStationId, setSelectedStationId] = useState<string>("");

  // Billing
  const { data: billingHistory, refetch: refetchBilling } = (trpc.organizations as any).getBillingHistory.useQuery({ organizationId: org.id });
  const { data: feeAccrued } = (trpc.organizations as any).getTransactionFeeAccrued.useQuery({ organizationId: org.id, periodDays: 30 });
  const changePlanAdmin = (trpc.organizations as any).changePlanAdmin.useMutation({
    onSuccess: () => { toast.success("Plan actualizado"); refetchBilling(); onRefresh(); },
    onError: (err: any) => toast.error(err.message),
  });
  const markBillingPaid = (trpc.organizations as any).markBillingPaid.useMutation({
    onSuccess: () => { toast.success("Pago registrado"); refetchBilling(); },
    onError: (err: any) => toast.error(err.message),
  });
  const createBillingRecord = (trpc.organizations as any).createBillingRecord.useMutation({
    onSuccess: () => { toast.success("Registro creado"); refetchBilling(); },
    onError: (err: any) => toast.error(err.message),
  });
  const [planForm, setPlanForm] = useState({
    plan: org.plan || "starter",
    status: org.status || "trial",
    transactionFeePercent: org.transactionFeePercent || "",
    nextBillingDate: org.nextBillingDate ? new Date(org.nextBillingDate).toISOString().split("T")[0] : "",
    trialEndsAt: org.trialEndsAt ? new Date(org.trialEndsAt).toISOString().split("T")[0] : "",
    recordSetupPayment: false, setupAmount: "",
    recordRenewalPayment: false, renewalAmount: "",
  });
  const [newBillingForm, setNewBillingForm] = useState({
    type: "setup" as "setup" | "annual_renewal" | "transaction_fee" | "support_fee" | "minimum_fee",
    description: "", amount: "", currency: "USD",
  });

  const ticketStatusColors: Record<string, string> = {
    OPEN: "bg-blue-500/20 text-blue-400",
    IN_PROGRESS: "bg-yellow-500/20 text-yellow-400",
    RESOLVED: "bg-green-500/20 text-green-400",
    CLOSED: "bg-gray-500/20 text-gray-400",
  };

  const ticketPriorityColors: Record<string, string> = {
    LOW: "text-gray-400",
    MEDIUM: "text-blue-400",
    HIGH: "text-orange-400",
    CRITICAL: "text-red-400",
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-green-400" />
            {org.name}
            <Badge variant="outline" className="ml-2 text-xs">
              {org.plan}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="billing">
          <TabsList className="w-full">
            <TabsTrigger value="billing" className="flex-1">
              <CreditCard className="h-4 w-4 mr-1" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="stations" className="flex-1">
              <MapPin className="h-4 w-4 mr-1" />
              Estaciones
            </TabsTrigger>
            <TabsTrigger value="users" className="flex-1">
              <Users className="h-4 w-4 mr-1" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex-1">
              <Ticket className="h-4 w-4 mr-1" />
              Tickets
            </TabsTrigger>
          </TabsList>

          {/* ---- TAB: BILLING ---- */}
          <TabsContent value="billing" className="space-y-4 mt-4">
            {/* Acumulado comisiones */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
                <p className="text-xs text-muted-foreground">Sesiones (30d)</p>
                <p className="text-xl font-bold text-green-400">{feeAccrued?.sessionCount || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
                <p className="text-xs text-muted-foreground">Volumen COP (30d)</p>
                <p className="text-lg font-bold">${(feeAccrued?.totalVolumeCOP || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-xs text-muted-foreground">Comisión EVGreen ({feeAccrued?.feePercent || 5}%)</p>
                <p className="text-lg font-bold text-green-400">${(feeAccrued?.feeAccruedCOP || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</p>
              </div>
            </div>

            {/* Cambiar plan */}
            <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/10">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-green-400" /> Cambiar Plan y Estado
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Plan</label>
                  <Select value={planForm.plan} onValueChange={(v) => setPlanForm({ ...planForm, plan: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Estado</label>
                  <Select value={planForm.status} onValueChange={(v) => setPlanForm({ ...planForm, status: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="suspended">Suspendido</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">% Comisión (override org)</label>
                  <Input className="h-8 text-sm" placeholder="Ej: 4.5" value={planForm.transactionFeePercent}
                    onChange={(e) => setPlanForm({ ...planForm, transactionFeePercent: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Próximo cobro</label>
                  <Input type="date" className="h-8 text-sm" value={planForm.nextBillingDate}
                    onChange={(e) => setPlanForm({ ...planForm, nextBillingDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Trial termina el</label>
                  <Input type="date" className="h-8 text-sm" value={planForm.trialEndsAt}
                    onChange={(e) => setPlanForm({ ...planForm, trialEndsAt: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={planForm.recordSetupPayment}
                  onCheckedChange={(v) => setPlanForm({ ...planForm, recordSetupPayment: v })} />
                <span className="text-xs">Registrar pago Setup</span>
                {planForm.recordSetupPayment && (
                  <Input className="h-7 text-xs w-28" placeholder="Monto USD" value={planForm.setupAmount}
                    onChange={(e) => setPlanForm({ ...planForm, setupAmount: e.target.value })} />
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={planForm.recordRenewalPayment}
                  onCheckedChange={(v) => setPlanForm({ ...planForm, recordRenewalPayment: v })} />
                <span className="text-xs">Registrar Renovación Anual</span>
                {planForm.recordRenewalPayment && (
                  <Input className="h-7 text-xs w-28" placeholder="Monto USD" value={planForm.renewalAmount}
                    onChange={(e) => setPlanForm({ ...planForm, renewalAmount: e.target.value })} />
                )}
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full" disabled={changePlanAdmin.isPending}
                onClick={() => {
                  const payload: any = { organizationId: org.id, plan: planForm.plan as any, status: planForm.status as any };
                  if (planForm.transactionFeePercent) payload.transactionFeePercent = planForm.transactionFeePercent;
                  if (planForm.nextBillingDate) payload.nextBillingDate = new Date(planForm.nextBillingDate);
                  if (planForm.trialEndsAt) payload.trialEndsAt = new Date(planForm.trialEndsAt);
                  if (planForm.recordSetupPayment && planForm.setupAmount) { payload.recordSetupPayment = true; payload.setupAmount = planForm.setupAmount; }
                  if (planForm.recordRenewalPayment && planForm.renewalAmount) { payload.recordRenewalPayment = true; payload.renewalAmount = planForm.renewalAmount; }
                  changePlanAdmin.mutate(payload);
                }}>
                {changePlanAdmin.isPending ? "Guardando..." : "Guardar cambios de plan"}
              </Button>
            </div>

            {/* Historial de billing */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" /> Historial de Facturación
              </h3>
              {!billingHistory || billingHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin registros</p>
              ) : (
                <div className="space-y-2">
                  {billingHistory.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.description || r.type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("es-CO")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold">{r.amount} {r.currency}</span>
                        <Badge variant="outline" className={r.status === "paid" ? "bg-green-500/10 text-green-400" : r.status === "overdue" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}>
                          {r.status === "paid" ? "Pagado" : r.status === "overdue" ? "Vencido" : "Pendiente"}
                        </Badge>
                        {r.status !== "paid" && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-green-400"
                            onClick={() => markBillingPaid.mutate({ id: r.id })}>
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Agregar registro manual */}
              <div className="pt-2 border-t border-border/30 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Agregar registro manual</p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newBillingForm.type} onValueChange={(v: any) => setNewBillingForm({ ...newBillingForm, type: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="setup">Setup</SelectItem>
                      <SelectItem value="annual_renewal">Renovación Anual</SelectItem>
                      <SelectItem value="transaction_fee">Comisión Transacciones</SelectItem>
                      <SelectItem value="support_fee">Soporte</SelectItem>
                      <SelectItem value="minimum_fee">Mínimo Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="h-7 text-xs" placeholder="Monto (USD)" value={newBillingForm.amount}
                    onChange={(e) => setNewBillingForm({ ...newBillingForm, amount: e.target.value })} />
                </div>
                <Input className="h-7 text-xs" placeholder="Descripción (opcional)" value={newBillingForm.description}
                  onChange={(e) => setNewBillingForm({ ...newBillingForm, description: e.target.value })} />
                <Button size="sm" variant="outline" className="w-full h-7 text-xs"
                  disabled={!newBillingForm.amount || createBillingRecord.isPending}
                  onClick={() => {
                    createBillingRecord.mutate({ organizationId: org.id, type: newBillingForm.type,
                      description: newBillingForm.description || undefined, amount: newBillingForm.amount, currency: newBillingForm.currency });
                    setNewBillingForm({ type: "setup", description: "", amount: "", currency: "USD" });
                  }}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar registro
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ---- TAB: ESTACIONES ---- */}
          <TabsContent value="stations" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar estación sin asignar..." />
                </SelectTrigger>
                <SelectContent>
                  {unassignedStations?.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — {s.city || s.address || "Sin ubicación"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 shrink-0"
                disabled={!selectedStationId || assignStation.isPending}
                onClick={() => {
                  if (!selectedStationId) return;
                  assignStation.mutate({ stationId: parseInt(selectedStationId), organizationId: org.id });
                  setSelectedStationId("");
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Asignar
              </Button>
            </div>

            {orgStations?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay estaciones asignadas a esta organización</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orgStations?.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.city || s.address || "Sin ubicación"}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => unassignStation.mutate({ stationId: s.id, organizationId: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- TAB: USUARIOS ---- */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="ID de usuario (número)"
                value={addUserForm.userId}
                onChange={(e) => setAddUserForm({ ...addUserForm, userId: e.target.value })}
                className="flex-1"
                type="number"
              />
              <Select value={addUserForm.role} onValueChange={(v: any) => setAddUserForm({ ...addUserForm, role: v })}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 shrink-0"
                disabled={!addUserForm.userId || addOrgUser.isPending}
                onClick={() => {
                  if (!addUserForm.userId) return;
                  addOrgUser.mutate({
                    organizationId: org.id,
                    userId: parseInt(addUserForm.userId),
                    role: addUserForm.role,
                  });
                  setAddUserForm({ userId: "", role: "admin" });
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresa el ID numérico del usuario. El usuario debe existir en la plataforma.
            </p>

            {orgUsers?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay usuarios asignados a esta organización</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orgUsers?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div>
                      <p className="font-medium text-sm">{u.userName || `Usuario #${u.userId}`}</p>
                      <p className="text-xs text-muted-foreground">{u.userEmail || ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={u.role === "admin" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}>
                        {u.role}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => removeOrgUser.mutate({ id: u.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- TAB: TICKETS ---- */}
          <TabsContent value="tickets" className="space-y-4 mt-4">
            {orgTickets?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay tickets de soporte para esta organización</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orgTickets?.map((t: any) => (
                  <div key={t.id} className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.userName || "Usuario desconocido"} · {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={ticketStatusColors[t.status] || ""}>
                          {t.status}
                        </Badge>
                        <span className={`text-xs font-medium ${ticketPriorityColors[t.priority] || ""}`}>
                          {t.priority}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    <div className="flex gap-1 flex-wrap">
                      {t.status !== "IN_PROGRESS" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 text-yellow-400 border-yellow-500/30"
                          onClick={() => updateTicketStatus.mutate({ ticketId: t.id, status: "IN_PROGRESS" })}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          En Progreso
                        </Button>
                      )}
                      {t.status !== "RESOLVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 text-green-400 border-green-500/30"
                          onClick={() => updateTicketStatus.mutate({ ticketId: t.id, status: "RESOLVED" })}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolver
                        </Button>
                      )}
                      {t.status !== "CLOSED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 text-gray-400 border-gray-500/30"
                          onClick={() => updateTicketStatus.mutate({ ticketId: t.id, status: "CLOSED" })}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cerrar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Create Organization Dialog
// ==========================================
function CreateOrgDialog({ open, onClose, onSubmit, isLoading }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    plan: "starter" as const,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    nit: "",
    networkMember: true,
    supportIncluded: false,
    maxChargers: 10,
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Organización</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>Slug (subdominio)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                placeholder="mi-empresa"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">{form.slug || "slug"}.evgreen.lat</p>
            </div>
          </div>

          <div>
            <Label>Plan</Label>
            <Select value={form.plan} onValueChange={(v: any) => setForm({ ...form, plan: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter ($500/cargador)</SelectItem>
                <SelectItem value="professional">Professional ($750/cargador)</SelectItem>
                <SelectItem value="enterprise">Enterprise ($1,200/cargador)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre de Contacto</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div>
              <Label>Email de Contacto</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Teléfono</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            <div>
              <Label>NIT</Label>
              <Input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Máximo de Cargadores</Label>
            <Input type="number" min={1} value={form.maxChargers} onChange={(e) => setForm({ ...form, maxChargers: parseInt(e.target.value) || 10 })} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-sm">EVGreen Network</p>
              <p className="text-xs text-muted-foreground">Pertenecer a la red compartida de usuarios</p>
            </div>
            <Switch checked={form.networkMember} onCheckedChange={(v) => setForm({ ...form, networkMember: v })} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-sm">Soporte Incluido (20%)</p>
              <p className="text-xs text-muted-foreground">Preventivo + atención L1/L2 por EVGreen</p>
            </div>
            <Switch checked={form.supportIncluded} onCheckedChange={(v) => setForm({ ...form, supportIncluded: v })} />
          </div>

          <div>
            <Label>Notas internas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
            {isLoading ? "Creando..." : "Crear Organización"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Pricing Defaults Dialog
// ==========================================
function PricingDialog({ open, onClose, defaults, onUpdate }: {
  open: boolean;
  onClose: () => void;
  defaults: any[];
  onUpdate: (plan: string, data: any) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Pricing Global (Configuración por Plan)
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Estos valores se aplican como default a nuevas organizaciones. Puedes hacer override individual por organización.
        </p>
        <div className="space-y-4">
          {defaults.map((d: any) => (
            <Card key={d.id} className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg capitalize flex items-center gap-2">
                  <Badge variant="outline" className={
                    d.plan === "enterprise" ? "bg-amber-500/20 text-amber-400" :
                    d.plan === "professional" ? "bg-purple-500/20 text-purple-400" :
                    "bg-gray-500/20 text-gray-300"
                  }>
                    {d.plan}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Setup/cargador</p>
                    <p className="font-bold text-green-400">${d.setupFeePerCharger} USD</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Renovación/año</p>
                    <p className="font-bold">${d.annualFeePerCharger} USD</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Transaction Fee</p>
                    <p className="font-bold">{d.transactionFeePercent}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Soporte (incluye fee)</p>
                    <p className="font-bold">{d.supportFeePercent}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Descuento Red</p>
                    <p className="font-bold">-{d.networkDiscount}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fee Mínimo/mes</p>
                    <p className="font-bold">${d.minMonthlyFeePerCharger} USD</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Máx. Cargadores</p>
                    <p className="font-bold">{d.maxChargers === 9999 ? "Ilimitado" : d.maxChargers}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">SLA Uptime</p>
                    <p className="font-bold">{d.uptimeSla}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Para editar estos valores, contacta al equipo de desarrollo o usa la API directamente.
        </p>
      </DialogContent>
    </Dialog>
  );
}
