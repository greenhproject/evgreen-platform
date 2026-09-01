import { useEffect, useState } from "react";
import { CheckCircle2, Database, ExternalLink, Eye, EyeOff, Loader2, Network, RefreshCw, Save, ShieldCheck, TestTube2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const AVAILABLE_MODULES = ["LOCATIONS", "TARIFFS", "SESSIONS", "CDRS"] as const;
type ModuleName = (typeof AVAILABLE_MODULES)[number];

export default function AdminOCPIConfig() {
  const ocpiApi = trpc.ocpiAdmin as any;
  const { data, isLoading, refetch } = ocpiApi.getConfig.useQuery();
  const { data: catalog, refetch: refetchCatalog } = ocpiApi.getCatalog.useQuery();
  const { data: syncRuns, refetch: refetchSyncRuns } = ocpiApi.listSyncRuns.useQuery();
  const { data: remoteLocations } = ocpiApi.listRemoteLocations.useQuery();
  const { data: outboxEvents, refetch: refetchOutboxEvents } = ocpiApi.listOutboxEvents.useQuery();
  const [showToken, setShowToken] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({ environment: "SANDBOX" as "SANDBOX" | "PRODUCTION", enabled: false, autoSync: false, versionsUrl: "", countryCode: "CO", partyId: "", modules: ["LOCATIONS", "TARIFFS"] as ModuleName[], token: "", inboundToken: "", mtlsCertificate: "", mtlsPrivateKey: "" });

  useEffect(() => {
    if (!data) return;
    setForm({ environment: data.environment, enabled: data.enabled, autoSync: data.autoSync, versionsUrl: data.versionsUrl, countryCode: data.countryCode, partyId: data.partyId, modules: data.modules as ModuleName[], token: "", inboundToken: "", mtlsCertificate: "", mtlsPrivateKey: "" });
  }, [data]);

  const save = ocpiApi.saveConfig.useMutation({
    onSuccess: () => { toast.success("Configuración OCPI guardada"); refetch(); setForm(current => ({ ...current, token: "", inboundToken: "", mtlsCertificate: "", mtlsPrivateKey: "" })); },
    onError: (error: any) => toast.error(error.message),
  });
  const test = ocpiApi.testConnection.useMutation({
    onSuccess: (result: any) => { result.success ? toast.success(result.message) : toast.error(result.message); refetch(); },
    onError: (error: any) => toast.error(error.message),
  });
  const previewCatalog = ocpiApi.previewCatalog.useMutation({
    onSuccess: (result: any) => { toast.success(result.message); refetchCatalog(); refetchSyncRuns(); },
    onError: (error: any) => toast.error(error.message),
  });
  const publishCatalog = ocpiApi.publishCatalog.useMutation({
    onSuccess: (result: any) => { toast.message(result.message); refetchSyncRuns(); },
    onError: (error: any) => toast.error(error.message),
  });
  const stageCatalog = ocpiApi.stageCatalog.useMutation({
    onSuccess: (result: any) => { toast.success(result.message); refetchOutboxEvents(); },
    onError: (error: any) => toast.error(error.message),
  });
  const validateOutboxDryRun = ocpiApi.validateOutboxDryRun.useMutation({
    onSuccess: (result: any) => { toast.success(result.message); refetchOutboxEvents(); },
    onError: (error: any) => toast.error(error.message),
  });

  const toggleModule = (module: ModuleName) => setForm(current => ({ ...current, modules: current.modules.includes(module) ? current.modules.filter(value => value !== module) : [...current.modules, module] }));
  const secretPlaceholder = (exists: boolean, label: string) => exists ? `${label} guardado · escríbelo solo para rotarlo` : `Ingrese ${label.toLowerCase()}`;

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2"><div className="flex items-center gap-2 text-primary"><Network className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Interoperabilidad</span></div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Centro OCPI · CargaME / SIEM</h1><p className="max-w-3xl text-sm text-muted-foreground">Configure el enlace oficial de CargaME sin editar código. Los secretos se cifran en el servidor y se muestran siempre enmascarados.</p></div>
      <Badge variant={data?.enabled ? "default" : "secondary"} className="w-fit">{data?.enabled ? "OCPI activo" : "OCPI desactivado"}</Badge>
    </section>

    <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex gap-3 pt-5"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><p className="text-sm leading-6 text-muted-foreground">CargaME/SIEM requiere alta, credenciales y certificación de UPME. Mantenga el entorno en <strong>Sandbox</strong> hasta completar la prueba de conexión y la habilitación oficial. El modo ROAMING no inicia cobros ni comandos remotos externos por sí mismo.</p></CardContent></Card>

    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <Card><CardHeader><CardTitle>Conexión e identidad OCPI</CardTitle><CardDescription>Datos emitidos por CargaME durante el onboarding técnico.</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Proveedor</Label><Input value="CargaME / SIEM (UPME)" disabled /></div><div className="space-y-2"><Label>Entorno</Label><select value={form.environment} onChange={event => setForm({ ...form, environment: event.target.value as any })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="SANDBOX">Sandbox / certificación</option><option value="PRODUCTION">Producción</option></select></div></div>
        <div className="space-y-2"><Label htmlFor="versionsUrl">Versions URL OCPI</Label><Input id="versionsUrl" value={form.versionsUrl} onChange={event => setForm({ ...form, versionsUrl: event.target.value })} placeholder="https://.../ocpi/versions" inputMode="url" /><p className="text-xs text-muted-foreground">Debe ser HTTPS pública; se bloquean localhost y redes privadas.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Country Code</Label><Input value={form.countryCode} maxLength={2} onChange={event => setForm({ ...form, countryCode: event.target.value.toUpperCase() })} placeholder="CO" /></div><div className="space-y-2"><Label>Party ID</Label><Input value={form.partyId} maxLength={3} onChange={event => setForm({ ...form, partyId: event.target.value.toUpperCase() })} placeholder="EVG" /></div></div>
        <div className="space-y-3"><Label>Módulos habilitados</Label><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{AVAILABLE_MODULES.map(module => <label key={module} className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 text-sm"><Checkbox checked={form.modules.includes(module)} onCheckedChange={() => toggleModule(module)} />{module}</label>)}</div></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Estado operativo</CardTitle><CardDescription>Activación y diagnóstico seguro.</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"><div><p className="font-medium">Activar enlace OCPI</p><p className="text-xs text-muted-foreground">Exige URL, Party ID y token.</p></div><Switch checked={form.enabled} onCheckedChange={enabled => setForm({ ...form, enabled })} /></div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"><div><p className="font-medium">Transmisión automática</p><p className="text-xs text-muted-foreground">Deshabilitada hasta completar la certificación SIEM y activar el despachador oficial. La cola local sigue disponible.</p></div><Switch checked={false} disabled aria-label="Transmisión automática no disponible hasta certificación SIEM" /></div>
        <div className="rounded-lg bg-muted/50 p-4 text-sm"><p className="font-medium">Última prueba</p><p className="mt-1 text-muted-foreground">{data?.lastTestStatus === "NEVER" ? "Aún no ejecutada" : `${data?.lastTestStatus} · ${data?.lastTestAt ? new Date(data.lastTestAt).toLocaleString() : ""}`}</p>{data?.lastTestMessage && <p className="mt-2 text-xs text-muted-foreground">{data.lastTestMessage}</p>}</div>
        <Button className="w-full" variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>{test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}Probar conexión Versions</Button>
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Credenciales y mTLS</CardTitle><CardDescription>Deje un campo vacío para conservar el secreto existente. Las llaves no vuelven a mostrarse desde el servidor.</CardDescription></CardHeader><CardContent className="grid gap-5 lg:grid-cols-2">
      <SecretInput label="Token OCPI" value={form.token} placeholder={secretPlaceholder(Boolean(data?.hasToken), "token")} visible={showToken} onVisibleChange={setShowToken} onChange={token => setForm({ ...form, token })} />
      <SecretInput label="Token entrante (Locations CargaME)" value={form.inboundToken} placeholder={secretPlaceholder(Boolean(data?.hasInboundToken), "token entrante")} visible={showToken} onVisibleChange={setShowToken} onChange={inboundToken => setForm({ ...form, inboundToken })} />
      <SecretInput label="Certificado cliente mTLS (opcional)" value={form.mtlsCertificate} placeholder={secretPlaceholder(Boolean(data?.hasMtlsCertificate), "certificado")} visible={showCert} onVisibleChange={setShowCert} onChange={mtlsCertificate => setForm({ ...form, mtlsCertificate })} multiline />
      <SecretInput label="Llave privada mTLS (opcional)" value={form.mtlsPrivateKey} placeholder={secretPlaceholder(Boolean(data?.hasMtlsPrivateKey), "llave privada")} visible={showKey} onVisibleChange={setShowKey} onChange={mtlsPrivateKey => setForm({ ...form, mtlsPrivateKey })} multiline />
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Endpoint entrante · Locations OCPI</CardTitle><CardDescription>Comparta esta URL con CargaME/UPME al habilitar el intercambio bidireccional. Requiere el token entrante configurado arriba.</CardDescription></CardHeader><CardContent><Label>PUT Location</Label><Input readOnly value="https://app.evgreen.lat/ocpi/2.2.1/locations/{country_code}/{party_id}/{location_id}" className="mt-2 font-mono text-xs" /></CardContent></Card>

    <Card><CardHeader><CardTitle>Ubicaciones recibidas</CardTitle><CardDescription>Últimas 50 Locations entregadas por socios OCPI. Se guardan como registro independiente, sin alterar las estaciones propias.</CardDescription></CardHeader><CardContent className="space-y-2">{remoteLocations?.length ? remoteLocations.map((location: any) => <div key={location.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{location.name || `Location ${location.locationId}`}</p><p className="text-xs text-muted-foreground">{location.provider} · {location.countryCode}/{location.partyId} · {location.address || location.city || "Dirección no informada"}</p></div><div className="flex items-center gap-2"><Badge variant={location.status === "ACTIVE" ? "default" : "secondary"}>{location.status}</Badge><span className="text-[11px] text-muted-foreground">{location.updatedAt ? new Date(location.updatedAt).toLocaleString() : ""}</span></div></div>) : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Aún no se han recibido Locations. El endpoint queda protegido y no acepta información sin el token entrante.</p>}</CardContent></Card>

    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Catálogo regulatorio SIEM</CardTitle><CardDescription>Solo se incluyen estaciones activas, públicas y habilitadas explícitamente para reporte SIEM por Administración. Esta previsualización no envía información a CargaME.</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4"><div><p className="font-medium">{catalog?.eligibleCount ?? 0} estación(es) elegible(s)</p><p className="text-xs text-muted-foreground">Identidad OCPI: {catalog?.identity?.countryCode || "CO"} · {catalog?.identity?.partyId || "Party ID pendiente"}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => previewCatalog.mutate()} disabled={previewCatalog.isPending}>{previewCatalog.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Generar previsualización</Button><Button variant="outline" onClick={() => stageCatalog.mutate()} disabled={stageCatalog.isPending}>{stageCatalog.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}Preparar cola</Button><Button onClick={() => publishCatalog.mutate()} disabled={publishCatalog.isPending}>{publishCatalog.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Network className="mr-2 h-4 w-4" />}Publicar · dry-run</Button></div></div>
        <div className="space-y-2">{catalog?.entries?.length ? catalog.entries.map((entry: any) => <div key={entry.stationId} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{entry.stationName}</p><p className="text-xs text-muted-foreground">{entry.city} · {entry.evseCount} EVSE(s)</p></div><Badge variant={entry.eligibility?.eligible ? "default" : "secondary"}>{entry.eligibility?.eligible ? "Elegible" : entry.eligibility?.reason}</Badge></div>) : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No hay estaciones habilitadas para reporte SIEM. Edite una estación pública y active el control de reporte regulatorio cuando su registro CárgaME esté validado.</p>}</div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Bitácora OCPI</CardTitle><CardDescription>Auditoría de catálogos generados y futuros envíos.</CardDescription></CardHeader><CardContent className="space-y-3">{syncRuns?.length ? syncRuns.slice(0, 5).map((run: any) => <div key={run.id} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{run.operation}</span><Badge variant={run.status === "SUCCESS" ? "default" : "secondary"}>{run.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{run.message}</p><p className="mt-2 text-[11px] text-muted-foreground">{run.createdAt ? new Date(run.createdAt).toLocaleString() : ""}</p></div>) : <p className="text-sm text-muted-foreground">Aún no hay ejecuciones registradas.</p>}</CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Cola de eventos SIEM</CardTitle><CardDescription>Eventos preparados para una futura transmisión certificada. La cola no ejecuta solicitudes externas por sí misma; las acciones locales solo prueban la trazabilidad de estados.</CardDescription></CardHeader><CardContent className="space-y-2">{outboxEvents?.length ? outboxEvents.map((event: any) => <div key={event.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{event.eventType} · Estación {event.stationId ?? "plataforma"}</p><p className="text-xs text-muted-foreground">Intentos: {event.attemptCount} · Actualizado: {event.updatedAt ? new Date(event.updatedAt).toLocaleString() : ""}</p>{event.lastError ? <p className="mt-1 text-xs text-destructive">{event.lastError}</p> : null}</div><div className="flex flex-wrap items-center gap-2"><Badge variant={event.status === "SENT" ? "default" : event.status === "DEAD" ? "destructive" : "secondary"}>{event.status}</Badge>{event.status === "PENDING" ? <><Button size="sm" variant="outline" onClick={() => validateOutboxDryRun.mutate({ eventId: event.id, outcome: "SENT" })} disabled={validateOutboxDryRun.isPending}>{validateOutboxDryRun.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}Validar localmente</Button><Button size="sm" variant="outline" onClick={() => validateOutboxDryRun.mutate({ eventId: event.id, outcome: "FAILED" })} disabled={validateOutboxDryRun.isPending}>Simular fallo</Button></> : null}{event.status === "FAILED" ? <Button size="sm" variant="outline" onClick={() => validateOutboxDryRun.mutate({ eventId: event.id, outcome: "DEAD" })} disabled={validateOutboxDryRun.isPending}>Cerrar fallo</Button> : null}</div></div>) : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No hay eventos pendientes. Use “Preparar cola” para registrar el catálogo SIEM sin transmitirlo.</p>}</CardContent></Card>
    <section className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"><a className="inline-flex items-center gap-2 text-sm text-primary hover:underline" href="https://www.upme.gov.co/simec/siem/" target="_blank" rel="noreferrer">Portal SIEM / CargaME <ExternalLink className="h-3.5 w-3.5" /></a><Button onClick={() => save.mutate(form)} disabled={save.isPending || form.modules.length === 0} className="w-full sm:w-auto">{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar configuración OCPI</Button></section>
  </main>;
}

function SecretInput({ label, value, placeholder, visible, onVisibleChange, onChange, multiline = false }: { label: string; value: string; placeholder: string; visible: boolean; onVisibleChange: (value: boolean) => void; onChange: (value: string) => void; multiline?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><div className="relative">{multiline ? <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={`min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ${visible ? "" : "font-mono"}`} style={{ WebkitTextSecurity: visible ? "none" : "disc" } as any} /> : <Input type={visible ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="pr-10" />}{<button type="button" aria-label={`Mostrar ${label}`} onClick={() => onVisibleChange(!visible)} className="absolute right-2 top-2.5 text-muted-foreground">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}</div></div>;
}
