/**
 * Org Settings - Configuración del portal de organización SaaS
 * Tabs: Información, Mi Plan (Billing), Branding, Dominio
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRef } from "react";
import {
  Building, Settings, Mail, Phone, Hash, Globe,
  Palette, Copy, CheckCircle2, AlertCircle, Info,
  ExternalLink, Zap, CreditCard, Calendar, TrendingUp,
  ArrowUpCircle, Clock, Upload, ImageIcon, X as XIcon,
  Headphones, MessageCircle, ToggleLeft, Code,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function OrgSettings() {
  const utils = trpc.useUtils();
  const { data: org, isLoading } = (trpc.organizations as any).getMyOrg.useQuery();
  const { data: billing } = (trpc.organizations as any).getMyBilling.useQuery();

  const requestPlanChange = (trpc.organizations as any).requestPlanChange.useMutation({
    onSuccess: (data: any) => toast.success(data.message),
    onError: (err: any) => toast.error(err.message),
  });

  const [planChangeForm, setPlanChangeForm] = useState({ newPlan: "", notes: "" });
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [primaryColor, setPrimaryColor] = useState<string>("#22c55e");
  const [secondaryColor, setSecondaryColor] = useState<string>("#1e40af");
  const [appName, setAppName] = useState<string>("");
  const [customDomain, setCustomDomain] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  if (org && !initialized) {
    setLogoUrl(org.logoUrl || "");
    setLogoPreview(org.logoUrl || "");
    setPrimaryColor(org.primaryColor || "#22c55e");
    setSecondaryColor(org.secondaryColor || "#1e40af");
    setAppName(org.appName || "");
    setCustomDomain(org.customDomain || "");
    setInitialized(true);
  }

  const uploadOrgLogo = (trpc.organizations as any).uploadOrgLogo.useMutation({
    onSuccess: (data: any) => {
      setLogoUrl(data.logoUrl);
      setLogoPreview(data.logoUrl);
      setLogoFile(null);
      toast.success("Logo subido correctamente");
      (utils.organizations as any).getMyOrg.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileSelect = (file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato no válido. Usa PNG, JPG, WEBP o SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. Máximo 2MB.");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = () => {
    if (!logoFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadOrgLogo.mutate({ fileBase64: base64, mimeType: logoFile.type as any, fileName: logoFile.name });
    };
    reader.readAsDataURL(logoFile);
  };

  const updateBranding = (trpc.organizations as any).updateMyBranding.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message);
      (utils.organizations as any).getMyOrg.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateDomain = (trpc.organizations as any).updateMyDomain.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message);
      (utils.organizations as any).getMyOrg.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isAdmin = org?.myRole === "admin";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Building className="h-16 w-16 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">No perteneces a ninguna organización</p>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    starter: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    professional: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    trial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    suspended: "bg-red-500/20 text-red-400 border-red-500/30",
    cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  const subdomainHost = `${org.slug}.evgreen.lat`;
  const customDomainHost = customDomain && customDomain.split(".").length > 2
    ? customDomain.split(".").slice(0, -2).join(".")
    : "@";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-green-400" />
          Configuración
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Personaliza tu organización en la plataforma EVGreen
        </p>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted/30">
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Información</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Mi Plan</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="domain" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Dominio</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            <span className="hidden sm:inline">Soporte</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB: INFORMACIÓN ─── */}
        <TabsContent value="info" className="mt-6 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-green-400" />
                Información de la Organización
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold">{org.name}</p>
                  <p className="text-sm text-muted-foreground font-mono mt-0.5">{subdomainHost}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge className={planColors[org.plan] || planColors.starter}>{org.plan}</Badge>
                  <Badge className={statusColors[org.status] || statusColors.trial}>{org.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/30">
                {org.contactName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Contacto:</span>
                    <span className="font-medium truncate">{org.contactName}</span>
                  </div>
                )}
                {org.contactEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium truncate">{org.contactEmail}</span>
                  </div>
                )}
                {org.contactPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Teléfono:</span>
                    <span className="font-medium">{org.contactPhone}</span>
                  </div>
                )}
                {org.nit && (
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">NIT:</span>
                    <span className="font-medium">{org.nit}</span>
                  </div>
                )}
              </div>

              {org.trialEndsAt && org.status === "trial" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                  <Info className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="text-blue-300">
                    Trial activo hasta:{" "}
                    <strong>
                      {new Date(org.trialEndsAt).toLocaleDateString("es-CO", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/30">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{org.maxChargers}</div>
                  <div className="text-xs text-muted-foreground mt-1">Cargadores máx.</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold">{org.supportIncluded ? "✓" : "✗"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Soporte incl.</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold">{org.networkMember ? "✓" : "✗"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Red EVGreen</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-muted-foreground capitalize">{org.plan}</div>
                  <div className="text-xs text-muted-foreground mt-1">Plan actual</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: MI PLAN / BILLING ─── */}
        <TabsContent value="billing" className="mt-6 space-y-4">

          {/* Plan actual + estado */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-green-400" />
                Plan Actual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold capitalize">{billing?.org?.plan || org?.plan}</p>
                  <p className="text-sm text-muted-foreground capitalize">{billing?.org?.status || org?.status}</p>
                </div>
                <div className="text-right space-y-1">
                  {billing?.org?.nextBillingDate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Próximo cobro: <strong className="text-foreground">{new Date(billing.org.nextBillingDate).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</strong></span>
                    </div>
                  )}
                  {billing?.org?.trialEndsAt && billing?.org?.status === "trial" && (
                    <div className="flex items-center gap-1 text-sm text-blue-400">
                      <Clock className="h-4 w-4" />
                      <span>Trial hasta: <strong>{new Date(billing.org.trialEndsAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comisión por transacción */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/30">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">% Comisión EVGreen</p>
                  <p className="text-xl font-bold text-green-400">{billing?.currentPeriodFees?.feePercent || billing?.planDefaults?.transactionFeePercent || "5"}%</p>
                  <p className="text-xs text-muted-foreground mt-1">por transacción</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Cargadores máx.</p>
                  <p className="text-xl font-bold">{billing?.org?.maxChargers || org?.maxChargers}</p>
                  <p className="text-xs text-muted-foreground mt-1">incluidos en el plan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acumulado período actual */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                Acumulado Período Actual (últimos 30 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{billing?.currentPeriodFees?.sessionCount || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sesiones</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">${(billing?.currentPeriodFees?.totalVolumeCOP || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground mt-1">Volumen COP</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-400">${(billing?.currentPeriodFees?.feeAccruedCOP || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground mt-1">Comisión EVGreen COP</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historial de facturación */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-400" />
                Historial de Facturación
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!billing?.billingHistory || billing.billingHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay registros de facturación aún.</p>
              ) : (
                <div className="space-y-2">
                  {billing.billingHistory.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.description || r.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold">{r.amount} {r.currency}</span>
                        <Badge
                          variant="outline"
                          className={
                            r.status === "paid" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                            r.status === "overdue" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                            "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                          }
                        >
                          {r.status === "paid" ? "Pagado" : r.status === "overdue" ? "Vencido" : "Pendiente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Solicitar cambio de plan */}
          {isAdmin && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-green-400" />
                  Solicitar Cambio de Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selecciona el plan al que deseas migrar. El equipo de EVGreen procesará tu solicitud y te contactará para coordinar el cambio.
                </p>
                <div className="space-y-2">
                  <Label className="text-xs">Plan deseado</Label>
                  <Select value={planChangeForm.newPlan} onValueChange={(v) => setPlanChangeForm({ ...planChangeForm, newPlan: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter — Setup $500 USD · Renovación $125 USD/año</SelectItem>
                      <SelectItem value="professional">Professional — Setup $1,200 USD · Renovación $300 USD/año</SelectItem>
                      <SelectItem value="enterprise">Enterprise — Cotización personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Nota adicional (opcional)</Label>
                  <Textarea
                    placeholder="Cuéntanos tus necesidades o preguntas..."
                    value={planChangeForm.notes}
                    onChange={(e) => setPlanChangeForm({ ...planChangeForm, notes: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={!planChangeForm.newPlan || requestPlanChange.isPending}
                  onClick={() => {
                    if (!planChangeForm.newPlan) return;
                    requestPlanChange.mutate({ newPlan: planChangeForm.newPlan as any, notes: planChangeForm.notes || undefined });
                    setPlanChangeForm({ newPlan: "", notes: "" });
                  }}
                >
                  {requestPlanChange.isPending ? "Enviando..." : "Enviar solicitud de cambio"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── TAB: BRANDING ─── */}
        <TabsContent value="branding" className="mt-6 space-y-4">
          {!isAdmin && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Solo el administrador puede modificar el branding.
            </div>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-green-400" />
                Identidad Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo upload */}
              <div className="space-y-2">
                <Label className="text-xs">Logo de la Organización</Label>
                <p className="text-xs text-muted-foreground">
                  Recomendado: <strong>PNG o SVG</strong> con fondo transparente · <strong>400×400px</strong> mínimo · Máx. <strong>2MB</strong>
                </p>

                {/* Drag & drop zone */}
                {isAdmin && (
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer ${
                      isDragging ? "border-green-400 bg-green-500/10" : "border-border/50 hover:border-green-500/50 hover:bg-muted/20"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileSelect(file);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    />
                    {logoPreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={logoPreview} alt="Logo preview" className="h-20 w-auto max-w-[180px] object-contain rounded-lg" />
                        <p className="text-xs text-muted-foreground">{logoFile ? logoFile.name : "Logo actual"}</p>
                        {logoFile && (
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              disabled={uploadOrgLogo.isPending}
                              onClick={(e) => { e.stopPropagation(); handleUploadLogo(); }}>
                              {uploadOrgLogo.isPending ? "Subiendo..." : "Subir logo"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); setLogoFile(null); setLogoPreview(logoUrl); }}>
                              <XIcon className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Arrastra tu logo aquí</p>
                        <p className="text-xs text-muted-foreground">o haz clic para seleccionar</p>
                        <p className="text-xs text-muted-foreground/70">PNG · JPG · WEBP · SVG · Máx. 2MB</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback: URL manual */}
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    O ingresa una URL de imagen directamente
                  </summary>
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="https://tu-empresa.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => { setLogoUrl(e.target.value); setLogoPreview(e.target.value); }}
                      disabled={!isAdmin}
                      className="text-sm"
                    />
                  </div>
                </details>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Nombre de la App (en la plataforma)</Label>
                <Input
                  placeholder={org.name}
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Color Primario</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      disabled={!isAdmin} className="h-9 w-12 rounded border border-border/50 bg-transparent cursor-pointer" />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      disabled={!isAdmin} className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Color Secundario</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                      disabled={!isAdmin} className="h-9 w-12 rounded border border-border/50 bg-transparent cursor-pointer" />
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                      disabled={!isAdmin} className="font-mono text-sm" />
                  </div>
                </div>
              </div>

              {/* Vista previa */}
              <div className="p-4 rounded-lg border border-border/50 space-y-2">
                <p className="text-xs text-muted-foreground">Vista previa</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-bold" style={{ color: primaryColor }}>{appName || org.name}</span>
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-16 rounded" style={{ backgroundColor: primaryColor }} />
                  <div className="h-6 w-16 rounded" style={{ backgroundColor: secondaryColor }} />
                </div>
              </div>

              {isAdmin && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={updateBranding.isPending}
                  onClick={() => updateBranding.mutate({ logoUrl: logoUrl || undefined, primaryColor, secondaryColor, appName: appName || undefined })}
                >
                  {updateBranding.isPending ? "Guardando..." : "Guardar Branding"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: DOMINIO ─── */}
        <TabsContent value="domain" className="mt-6 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-400" />
                Subdominio Gratuito
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Tu plataforma está disponible en:</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Globe className="h-4 w-4 text-green-400 shrink-0" />
                <span className="font-mono text-sm font-medium">{subdomainHost}</span>
                <div className="flex gap-1 ml-auto">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copy(subdomainHost, "Subdominio")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                    <a href={`https://${subdomainHost}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-400" />
                Dominio Personalizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAdmin && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Solo el administrador puede configurar el dominio.
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Tu dominio personalizado</Label>
                <Input
                  placeholder="app.tuempresa.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>

              {customDomain && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                  <p className="text-xs font-medium text-muted-foreground">Configura este registro DNS en tu proveedor:</p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground px-2">
                      <span>Tipo</span><span>Host</span><span>Valor</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30 font-mono text-xs">
                      <span className="text-green-400">CNAME</span>
                      <span className="truncate">{customDomainHost}</span>
                      <div className="flex items-center gap-1">
                        <span className="truncate">{subdomainHost}</span>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 shrink-0" onClick={() => copy(subdomainHost, "Valor CNAME")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isAdmin && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={updateDomain.isPending || !customDomain}
                  onClick={() => updateDomain.mutate({ customDomain })}
                >
                  {updateDomain.isPending ? "Guardando..." : "Guardar Dominio"}
                </Button>
              )}

              <div className="pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-2">Guías de configuración DNS:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Cloudflare", url: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/" },
                    { name: "GoDaddy", url: "https://co.godaddy.com/help/add-a-cname-record-19236" },
                    { name: "Namecheap", url: "https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/" },
                    { name: "Google Domains", url: "https://support.google.com/domains/answer/9211383" },
                    { name: "GlobalDomainGroup", url: "https://globaldomaingroup.com" },
                  ].map((p) => (
                    <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-green-500/50 transition-colors">
                      {p.name} →
                    </a>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: SOPORTE ─── */}
        <SupportTab org={org} />
      </Tabs>
    </div>
  );
}

function SupportTab({ org }: { org: any }) {
  const utils = trpc.useUtils();
  const [supportPhone, setSupportPhone] = useState(org?.supportPhone || "");
  const [supportEmail, setSupportEmail] = useState(org?.supportEmail || "evgreen@greenhproject.com");
  const [chatEmbedCode, setChatEmbedCode] = useState(org?.chatEmbedCode || "");
  const [supportMode, setSupportMode] = useState<"org_only" | "evgreen_included">(org?.supportMode || "org_only");
  const [isSaving, setIsSaving] = useState(false);

  const updateSupport = (trpc.organizations as any).updateSupportConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración de soporte guardada");
      utils.organizations.getMyOrg.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    updateSupport.mutate({ supportPhone, supportEmail, chatEmbedCode, supportMode });
  };

  const evgreenIncluded = org?.supportIncluded === true;

  return (
    <TabsContent value="support" className="mt-6 space-y-4">
      {/* Mode selector */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Headphones className="h-4 w-4 text-green-400" />
            Modo de Soporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <button
              onClick={() => setSupportMode("org_only")}
              className={`p-4 rounded-xl border text-left transition-colors ${
                supportMode === "org_only"
                  ? "bg-green-500/10 border-green-500/40"
                  : "bg-muted/20 border-border/30 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <ToggleLeft className="h-5 w-5 text-blue-400" />
                <span className="font-semibold text-sm">Solo Organización</span>
                {supportMode === "org_only" && (
                  <Badge className="ml-auto bg-green-600 text-white text-[10px]">Activo</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Tú atiendes a tus usuarios directamente. Los tickets y mensajes solo llegan a tu equipo.
                Ideal si tienes contratado el plan con solo comisión por transacción.
              </p>
            </button>
            <button
              onClick={() => setSupportMode("evgreen_included")}
              className={`p-4 rounded-xl border text-left transition-colors ${
                supportMode === "evgreen_included"
                  ? "bg-green-500/10 border-green-500/40"
                  : evgreenIncluded ? "bg-muted/20 border-border/30 hover:bg-muted/40" : "opacity-50 cursor-not-allowed bg-muted/10 border-border/20"
              }`}
              disabled={!evgreenIncluded}
            >
              <div className="flex items-center gap-2 mb-2">
                <Headphones className="h-5 w-5 text-green-400" />
                <span className="font-semibold text-sm">EVGreen Incluido</span>
                {!evgreenIncluded && (
                  <Badge variant="outline" className="ml-auto text-[10px] border-amber-500/50 text-amber-400">Requiere plan con soporte</Badge>
                )}
                {supportMode === "evgreen_included" && evgreenIncluded && (
                  <Badge className="ml-auto bg-green-600 text-white text-[10px]">Activo</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Los tickets llegan a tu equipo Y al equipo de EVGreen. Soporte compartido con SLA garantizado.
                Disponible con plan Professional o Enterprise con soporte incluido.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Contact info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-400" />
            Datos de Contacto para tus Usuarios
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Esta información aparecerá en el portal de soporte que ven tus usuarios finales.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Teléfono / WhatsApp de soporte
              </Label>
              <Input
                className="mt-1 h-9"
                placeholder="+57 300 000 0000"
                value={supportPhone}
                onChange={e => setSupportPhone(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email de soporte
              </Label>
              <Input
                className="mt-1 h-9"
                type="email"
                placeholder="soporte@tuempresa.com"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Chat embed */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Code className="h-3 w-3" /> Código de chat en vivo (opcional)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">
              Pega el código de embed de Tawk.to, Intercom, Crisp u otro servicio de chat.
            </p>
            <textarea
              className="w-full h-24 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder={`<!-- Ejemplo Tawk.to -->\n<script type="text/javascript">\nvar Tawk_API=Tawk_API||{};\n...</script>`}
              value={chatEmbedCode}
              onChange={e => setChatEmbedCode(e.target.value)}
            />
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700 h-9"
            onClick={handleSave}
            disabled={updateSupport.isPending}
          >
            {updateSupport.isPending ? "Guardando..." : "Guardar configuración de soporte"}
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-muted/20 border-border/30">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">¿Cómo funciona el soporte para tus usuarios?</p>
            <ul className="text-xs text-muted-foreground mt-1 space-y-1">
              <li>• Tus usuarios ven el teléfono y email configurados en la pantalla de soporte</li>
              <li>• Si tienes chat embed, aparece el widget flotante en todo el portal</li>
              <li>• Los tickets creados en el portal llegan a tu equipo (y a EVGreen si está activado)</li>
              <li>• Con modo EVGreen incluido, nuestro equipo responde con SLA de 4h hábiles</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
