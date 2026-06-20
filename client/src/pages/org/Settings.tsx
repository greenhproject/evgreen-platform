/**
 * Org Settings - Configuración del portal de organización SaaS
 * Tabs: Información, Branding (logo + colores), Dominio personalizado
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building, Settings, Mail, Phone, Hash, Globe,
  Palette, Copy, CheckCircle2, AlertCircle, Info,
  ExternalLink, Zap,
} from "lucide-react";

export default function OrgSettings() {
  const utils = trpc.useUtils();
  const { data: org, isLoading } = (trpc.organizations as any).getMyOrg.useQuery();

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [primaryColor, setPrimaryColor] = useState<string>("#22c55e");
  const [secondaryColor, setSecondaryColor] = useState<string>("#1e40af");
  const [appName, setAppName] = useState<string>("");
  const [customDomain, setCustomDomain] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  if (org && !initialized) {
    setLogoUrl(org.logoUrl || "");
    setPrimaryColor(org.primaryColor || "#22c55e");
    setSecondaryColor(org.secondaryColor || "#1e40af");
    setAppName(org.appName || "");
    setCustomDomain(org.customDomain || "");
    setInitialized(true);
  }

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
        <TabsList className="grid w-full grid-cols-3 bg-muted/30">
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Información</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="domain" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Dominio</span>
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
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Logo de la organización</Label>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl border border-border/50 bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Zap className="w-8 h-8 text-muted-foreground opacity-30" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="https://tu-empresa.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      disabled={!isAdmin}
                      className="bg-muted/30 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      URL pública de tu logo (PNG, SVG o WebP). Tamaño mínimo recomendado: 200×200px.
                    </p>
                  </div>
                </div>
              </div>

              {/* Nombre de la app */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nombre de la aplicación</Label>
                <Input
                  placeholder={org.name}
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-muted/30 border-border/50"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre que aparece en el encabezado del portal. Vacío = nombre de la organización.
                </p>
              </div>

              {/* Colores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color primario</Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg border border-border/50 shrink-0 cursor-pointer"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => isAdmin && document.getElementById("primaryPicker")?.click()}
                    />
                    <input
                      id="primaryPicker"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      disabled={!isAdmin}
                      className="sr-only"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="#22c55e"
                      className="bg-muted/30 border-border/50 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Botones, íconos activos y acentos.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color secundario</Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg border border-border/50 shrink-0 cursor-pointer"
                      style={{ backgroundColor: secondaryColor }}
                      onClick={() => isAdmin && document.getElementById("secondaryPicker")?.click()}
                    />
                    <input
                      id="secondaryPicker"
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      disabled={!isAdmin}
                      className="sr-only"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="#1e40af"
                      className="bg-muted/30 border-border/50 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Fondo del sidebar y encabezado.</p>
                </div>
              </div>

              {/* Vista previa */}
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="p-3 flex items-center gap-3" style={{ backgroundColor: secondaryColor }}>
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <Zap className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-white font-bold text-sm">{appName || org.name}</span>
                </div>
                <div className="p-4 bg-muted/20 flex items-center gap-3">
                  <div
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Botón de ejemplo
                  </div>
                  <span className="text-xs text-muted-foreground">← Vista previa del branding</span>
                </div>
              </div>

              {isAdmin && (
                <Button
                  className="w-full text-white"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() =>
                    updateBranding.mutate({
                      logoUrl: logoUrl || null,
                      primaryColor,
                      secondaryColor,
                      appName: appName || undefined,
                    })
                  }
                  disabled={updateBranding.isPending}
                >
                  {updateBranding.isPending ? "Guardando..." : "Guardar cambios de branding"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: DOMINIO ─── */}
        <TabsContent value="domain" className="mt-6 space-y-4">
          {!isAdmin && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Solo el administrador puede configurar el dominio.
            </div>
          )}

          {/* Subdominio gratuito */}
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Subdominio incluido (gratis)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <p className="font-mono font-bold text-green-400">{subdomainHost}</p>
                  <p className="text-xs text-muted-foreground mt-1">URL de tu portal</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(`https://${subdomainHost}`, "URL")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Para activar <span className="font-mono text-green-400">{subdomainHost}</span>, agrega este registro DNS:
                </p>
                <div className="rounded-lg border border-border/50 overflow-hidden text-xs">
                  <div className="grid grid-cols-4 font-medium text-muted-foreground bg-muted/50 px-3 py-2">
                    <span>Tipo</span><span>Nombre</span><span>Valor</span><span>TTL</span>
                  </div>
                  <div className="grid grid-cols-4 px-3 py-3 items-center border-t border-border/30">
                    <span className="font-mono bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded w-fit">CNAME</span>
                    <span className="font-mono text-amber-400">{org.slug}</span>
                    <span className="font-mono text-green-400">evgreen.lat</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono">3600</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                        onClick={() => copy(`CNAME  ${org.slug}  evgreen.lat  3600`, "Registro DNS")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Los cambios DNS pueden tardar 24–48 horas en propagarse.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dominio personalizado */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-400" />
                Dominio personalizado
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Pro / Enterprise</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Usa tu propio dominio (ej: <span className="font-mono text-green-400">portal.tuempresa.com</span>) para que tus usuarios accedan con tu marca.
              </p>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tu dominio personalizado</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="portal.tuempresa.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value.toLowerCase().trim())}
                    disabled={!isAdmin}
                    className="bg-muted/30 border-border/50 font-mono"
                  />
                  {isAdmin && (
                    <Button
                      onClick={() => updateDomain.mutate({ customDomain: customDomain || null })}
                      disabled={updateDomain.isPending}
                      className="shrink-0"
                    >
                      {updateDomain.isPending ? "Guardando..." : "Guardar"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sin <code>https://</code>. Ejemplo: <code>portal.miempresa.com</code>
                </p>
              </div>

              {customDomain && (
                <div className="space-y-4 pt-2 border-t border-border/30">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-400" />
                    Pasos para activar <span className="font-mono text-green-400">{customDomain}</span>
                  </p>

                  {/* Paso 1 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                      Agrega este registro en tu proveedor DNS
                    </div>
                    <div className="rounded-lg border border-border/50 overflow-hidden text-xs ml-8">
                      <div className="grid grid-cols-4 font-medium text-muted-foreground bg-muted/50 px-3 py-2">
                        <span>Tipo</span><span>Nombre (Host)</span><span>Valor (Points to)</span><span>TTL</span>
                      </div>
                      <div className="grid grid-cols-4 px-3 py-3 items-center border-t border-border/30">
                        <span className="font-mono bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded w-fit">CNAME</span>
                        <span className="font-mono text-amber-400">{customDomainHost}</span>
                        <span className="font-mono text-green-400">evgreen.lat</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono">3600</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => copy(`CNAME  ${customDomainHost}  evgreen.lat  3600`, "Registro DNS")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">
                      Si tu proveedor no acepta CNAME en el dominio raíz (@), usa un registro A apuntando a <code className="text-green-400">104.18.26.246</code>.
                    </p>
                  </div>

                  {/* Paso 2 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                      Notifica a EVGreen para activar el SSL
                    </div>
                    <div className="ml-8 p-3 rounded-lg bg-muted/30 border border-border/50 text-sm space-y-2">
                      <p className="text-muted-foreground text-xs">
                        Envía un correo a <a href="mailto:soporte@evgreen.lat" className="text-green-400 underline">soporte@evgreen.lat</a> con:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                        <li>Dominio: <span className="font-mono text-green-400">{customDomain}</span></li>
                        <li>Organización: <span className="font-mono text-amber-400">{org.name}</span></li>
                        <li>Slug: <span className="font-mono text-amber-400">{org.slug}</span></li>
                      </ul>
                      <Button variant="outline" size="sm" className="mt-2"
                        onClick={() =>
                          copy(
                            `Hola EVGreen,\n\nSolicito activar el dominio personalizado:\n- Dominio: ${customDomain}\n- Organización: ${org.name}\n- Slug: ${org.slug}\n\nGracias.`,
                            "Mensaje de solicitud"
                          )
                        }>
                        <Copy className="h-3 w-3 mr-2" />
                        Copiar mensaje de solicitud
                      </Button>
                    </div>
                  </div>

                  {/* Paso 3 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                      Espera la confirmación (24–48h)
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">
                      Una vez activado, tu portal estará en <span className="font-mono text-green-400">https://{customDomain}</span> con SSL incluido.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Button variant="outline" size="sm"
                      onClick={() => window.open(`https://dnschecker.org/#CNAME/${customDomain}`, "_blank")}>
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Verificar propagación DNS
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => window.open(`https://www.whatsmydns.net/#CNAME/${customDomain}`, "_blank")}>
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Ver estado global
                    </Button>
                  </div>
                </div>
              )}

              {/* Proveedores comunes */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Guías rápidas por proveedor DNS:</p>
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
      </Tabs>
    </div>
  );
}
