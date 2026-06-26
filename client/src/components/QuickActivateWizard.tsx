/**
 * QuickActivateWizard — Wizard de activación rápida de organizaciones SaaS
 * 4 pasos: (1) Datos org, (2) Usuario, (3) Estaciones, (4) Módulos → Activar
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Rocket, Building, User, Zap, Layers, CheckCircle,
  Search, ChevronRight, ChevronLeft, Mail, Phone, Hash,
  LayoutDashboard, BarChart2, BrainCircuit, FileText,
  Users, TrendingUp, ParkingCircle, CreditCard, Webhook,
  Palette, Receipt, Settings, HeadphonesIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  MODULE_CATALOG,
  getDefaultModulesByPlan,
  canPlanAccessModule,
  CATEGORY_LABELS,
  PLAN_LABELS,
  type ModulePlan,
} from "@shared/modules-catalog";

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, BarChart2, BrainCircuit, FileText, Users, TrendingUp,
  ParkingCircle, CreditCard, Webhook, Palette, Receipt, Settings,
  HeadphonesIcon, Zap, Layers,
};

const STEPS = [
  { id: 1, label: "Organización", icon: Building },
  { id: 2, label: "Usuario", icon: User },
  { id: 3, label: "Estaciones", icon: Zap },
  { id: 4, label: "Módulos", icon: Layers },
];

const PLAN_OPTIONS: { value: ModulePlan; label: string; desc: string; color: string }[] = [
  { value: "starter", label: "Starter", desc: "Hasta 10 cargadores", color: "border-gray-500/40 bg-gray-500/10" },
  { value: "professional", label: "Professional", desc: "Hasta 50 cargadores", color: "border-purple-500/40 bg-purple-500/10" },
  { value: "enterprise", label: "Enterprise", desc: "Cargadores ilimitados", color: "border-amber-500/40 bg-amber-500/10" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickActivateWizard({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);

  // Step 1 — Org data
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [plan, setPlan] = useState<ModulePlan>("professional");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [nit, setNit] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Step 2 — User
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string; email: string } | null>(null);

  // Step 3 — Stations
  const [selectedStationIds, setSelectedStationIds] = useState<number[]>([]);

  // Step 4 — Modules
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  // Auto-generate slug from org name
  useEffect(() => {
    if (orgName) {
      setOrgSlug(
        orgName.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 30)
      );
    }
  }, [orgName]);

  // Reset modules when plan changes
  useEffect(() => {
    setEnabledModules(getDefaultModulesByPlan(plan));
  }, [plan]);

  // Queries
  const { data: userResults } = (trpc.organizations as any).searchUsers.useQuery(
    { query: userSearch },
    { enabled: userSearch.length >= 2 }
  );

  const { data: unassignedStations } = (trpc.organizations as any).listUnassignedStations.useQuery(
    undefined,
    { enabled: step === 3 }
  );

  // Mutation
  const quickActivate = (trpc.organizations as any).quickActivate.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message || "Organización activada");
      if (data.emailSent) toast.success("Email de bienvenida enviado ✓");
      onSuccess();
      handleClose();
    },
    onError: (err: any) => toast.error(err.message || "Error al activar"),
  });

  const handleClose = () => {
    setStep(1);
    setOrgName(""); setOrgSlug(""); setPlan("professional");
    setContactName(""); setContactEmail(""); setContactPhone(""); setNit("");
    setUserSearch(""); setSelectedUser(null);
    setSelectedStationIds([]);
    setEnabledModules(getDefaultModulesByPlan("professional"));
    setSendEmail(true);
    onClose();
  };

  const canNext = () => {
    if (step === 1) return orgName.length >= 2 && orgSlug.length >= 2 && contactName && contactEmail;
    if (step === 2) return true; // user is optional
    if (step === 3) return true; // stations are optional
    return true;
  };

  const handleActivate = () => {
    quickActivate.mutate({
      orgName,
      orgSlug,
      plan,
      contactName,
      contactEmail,
      contactPhone: contactPhone || undefined,
      nit: nit || undefined,
      userId: selectedUser?.id,
      stationIds: selectedStationIds.length > 0 ? selectedStationIds : undefined,
      modules: enabledModules,
      sendWelcomeEmail: sendEmail,
    });
  };

  const toggleStation = (id: number) => {
    setSelectedStationIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleModule = (key: string) => {
    const mod = MODULE_CATALOG.find(m => m.key === key);
    if (mod?.required) return; // can't toggle required modules
    setEnabledModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  };

  const groupedModules = MODULE_CATALOG.reduce((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod);
    return acc;
  }, {} as Record<string, typeof MODULE_CATALOG>);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Rocket className="h-5 w-5 text-green-400" />
            Activación Rápida de Organización
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                  isActive ? "bg-green-500/20 text-green-400 border border-green-500/40" :
                  isDone ? "bg-green-500/10 text-green-500" :
                  "text-muted-foreground"
                }`}>
                  {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Org Data ── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Datos de la organización cliente</p>

            {/* Plan selector */}
            <div className="grid grid-cols-3 gap-2">
              {PLAN_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlan(p.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    plan === p.value ? p.color + " border-opacity-100" : "border-border/40 bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <p className="font-semibold text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Nombre de la organización *</Label>
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ej: Centro Comercial Andino EV" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Slug (URL) *</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground shrink-0">evgreen.lat/org/</span>
                  <Input value={orgSlug} onChange={e => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="andino-ev" className="h-9 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Hash className="h-3 w-3" />NIT</Label>
                <Input value={nit} onChange={e => setNit(e.target.value)} placeholder="901.447.678-0" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" />Nombre contacto *</Label>
                <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nombre del gerente" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email contacto *</Label>
                <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="gerente@empresa.com" className="h-9" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Teléfono</Label>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+57 300 000 0000" className="h-9" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/30">
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
              <div>
                <p className="text-sm font-medium">Enviar email de bienvenida</p>
                <p className="text-xs text-muted-foreground">Se enviará a {contactEmail || "el email del contacto"} con credenciales y pasos de inicio</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: User ── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Asigna el usuario administrador de esta organización (opcional — puedes hacerlo después)</p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="pl-9 h-9"
              />
            </div>

            {userResults && userResults.length > 0 && !selectedUser && (
              <div className="border border-border/40 rounded-lg overflow-hidden divide-y divide-border/30">
                {userResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setUserSearch(""); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm shrink-0">
                      {u.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold shrink-0">
                  {selectedUser.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{selectedUser.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {!selectedUser && (
              <div className="text-center py-6 text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Busca un usuario existente para asignarlo como admin de la org</p>
                <p className="text-xs mt-1">Si el cliente aún no tiene cuenta, puedes asignarlo después desde la org</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Stations ── */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecciona las estaciones a asignar a esta organización (opcional)</p>

            {!unassignedStations || unassignedStations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No hay estaciones sin organización asignada</p>
                <p className="text-xs mt-1">Puedes asignar estaciones después desde la gestión de la org</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {unassignedStations.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => toggleStation(s.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      selectedStationIds.includes(s.id)
                        ? "bg-green-500/10 border-green-500/40"
                        : "border-border/40 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      selectedStationIds.includes(s.id) ? "border-green-500 bg-green-500" : "border-border"
                    }`}>
                      {selectedStationIds.includes(s.id) && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.city} · {s.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedStationIds.length > 0 && (
              <p className="text-xs text-green-400 font-medium">{selectedStationIds.length} estación{selectedStationIds.length !== 1 ? "es" : ""} seleccionada{selectedStationIds.length !== 1 ? "s" : ""}</p>
            )}
          </div>
        )}

        {/* ── STEP 4: Modules ── */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Activa o desactiva los módulos disponibles para esta organización.
              Los módulos base del plan <strong className="text-foreground">{PLAN_LABELS[plan]}</strong> están preseleccionados.
            </p>

            {(["core", "analytics", "advanced", "enterprise"] as const).map(cat => {
              const mods = groupedModules[cat];
              if (!mods) return null;
              return (
                <div key={cat} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{CATEGORY_LABELS[cat]}</p>
                  <div className="space-y-1.5">
                    {mods.map(mod => {
                      const canAccess = canPlanAccessModule(plan, mod.key);
                      const isEnabled = enabledModules.includes(mod.key);
                      const IconComp = ICON_MAP[mod.icon] || Layers;
                      return (
                        <div
                          key={mod.key}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            !canAccess ? "opacity-40 border-border/20 bg-muted/10" :
                            isEnabled ? "border-green-500/30 bg-green-500/5" :
                            "border-border/30 bg-muted/20"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isEnabled && canAccess ? "bg-green-500/20 text-green-400" : "bg-muted/40 text-muted-foreground"
                          }`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{mod.label}</p>
                              {mod.required && <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border-blue-500/30">requerido</Badge>}
                              {!canAccess && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                                  {PLAN_LABELS[mod.plan]}+
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                          </div>
                          <Switch
                            checked={isEnabled && canAccess}
                            onCheckedChange={() => canAccess && !mod.required && toggleModule(mod.key)}
                            disabled={!canAccess || mod.required}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/30">
          {step > 1 && (
            <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <Button
              size="sm"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="bg-green-600 hover:bg-green-700 gap-1"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={quickActivate.isPending}
              className="bg-green-600 hover:bg-green-700 gap-2 px-6"
            >
              <Rocket className="h-4 w-4" />
              {quickActivate.isPending ? "Activando..." : "Activar Organización"}
            </Button>
          )}
        </div>

        {/* Summary footer on step 4 */}
        {step === 4 && (
          <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1 border border-border/30">
            <p><span className="text-foreground font-medium">Org:</span> {orgName} ({PLAN_LABELS[plan]})</p>
            {selectedUser && <p><span className="text-foreground font-medium">Admin:</span> {selectedUser.name} ({selectedUser.email})</p>}
            <p><span className="text-foreground font-medium">Estaciones:</span> {selectedStationIds.length > 0 ? `${selectedStationIds.length} asignadas` : "Ninguna (asignar después)"}</p>
            <p><span className="text-foreground font-medium">Módulos:</span> {enabledModules.length} activos</p>
            <p><span className="text-foreground font-medium">Email bienvenida:</span> {sendEmail ? `Sí → ${contactEmail}` : "No"}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
