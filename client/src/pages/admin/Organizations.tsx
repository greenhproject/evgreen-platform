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
  DialogTrigger,
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
import {
  Building,
  Plus,
  Search,
  DollarSign,
  Users,
  Zap,
  Settings,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export default function Organizations() {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building className="h-7 w-7 text-green-400" />
            Organizaciones SaaS
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los clientes licenciados de la plataforma EVGreen
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPricingDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Pricing Global
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Organización
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
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, slug o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[150px]">
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
          <SelectTrigger className="w-[150px]">
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
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Cargando organizaciones...
                    </td>
                  </tr>
                ) : orgs?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
    </div>
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
