/**
 * Org Stations - Vista de estaciones del portal SaaS
 * Modal de configuración con: Config, Horario, Tarifas + IA, QR, OCPP, Financiero
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Search, CheckCircle, AlertCircle, Zap, WifiOff, Map, List,
  Settings, DollarSign, Power, Eye, EyeOff, QrCode, Activity, Wifi,
  Sparkles, TrendingUp, Clock, Calendar, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { MapView } from "@/components/Map";
import { toast } from "sonner";
import { StationQRCode } from "@/components/StationQRCode";

const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map(d => [d.key, { open: "06:00", close: "22:00", enabled: true }])
);

export default function OrgStations() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [configStation, setConfigStation] = useState<any>(null);

  const { data: org } = (trpc.organizations as any).getMyOrg.useQuery();
  const { data: stations, isLoading, refetch } = (trpc.organizations as any).getMyStations.useQuery();

  const { data: ocppConnections } = trpc.ocpp.getActiveConnections.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const isAdmin = org?.myRole === "admin";

  const getOCPPInfo = (station: any) => {
    if (!ocppConnections) return null;
    const ocppId = station.ocppIdentity || station.id?.toString();
    return (ocppConnections as any[]).find(
      (conn: any) => conn.ocppIdentity === ocppId || conn.stationId === station.id
    );
  };

  const filtered = stations?.filter((s: any) =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const onlineCount = stations?.filter((s: any) => s.isOnline || getOCPPInfo(s)).length || 0;
  const offlineCount = (stations?.length || 0) - onlineCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-7 w-7 text-green-400" />
            Mis Estaciones
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona y configura las estaciones de carga de tu organización
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button onClick={() => setView("map")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Map className="h-3.5 w-3.5" /> Mapa
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">{onlineCount} en línea</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-red-400">{offlineCount} fuera de línea</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border/50">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{stations?.length || 0} total</span>
        </div>
      </div>

      {view === "list" && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, ciudad o dirección..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      )}

      {view === "map" && (
        <Card className="border-border/50 overflow-hidden">
          <div className="h-[520px] relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Cargando mapa...</div>
            ) : !stations || stations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <MapPin className="h-12 w-12 opacity-30" />
                <p>No hay estaciones para mostrar en el mapa</p>
              </div>
            ) : (
              <OrgStationsMap stations={stations} isAdmin={isAdmin} ocppConnections={ocppConnections || []} onConfigureStation={setConfigStation} />
            )}
          </div>
        </Card>
      )}

      {view === "list" && (
        <>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando estaciones...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{search ? "No se encontraron estaciones" : "No hay estaciones asignadas a tu organización"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s: any) => (
                <StationCard key={s.id} station={s} isAdmin={isAdmin} ocppInfo={getOCPPInfo(s)} onConfigure={() => setConfigStation(s)} />
              ))}
            </div>
          )}
        </>
      )}

      {configStation && (
        <StationConfigModal
          station={configStation}
          open={!!configStation}
          ocppInfo={getOCPPInfo(configStation)}
          onClose={() => setConfigStation(null)}
          onSaved={() => { refetch(); setConfigStation(null); }}
        />
      )}
    </div>
  );
}

// ─── Map Component ────────────────────────────────────────────────────────────
function OrgStationsMap({ stations, isAdmin, ocppConnections, onConfigureStation }: any) {
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const getOCPPInfo = (station: any) => {
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.find((conn: any) => conn.ocppIdentity === ocppId || conn.stationId === station.id);
  };

  const handleMapReady = (map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (infoWindowRef.current) infoWindowRef.current.close();
    infoWindowRef.current = new google.maps.InfoWindow();

    stations.forEach((station: any) => {
      const lat = parseFloat(station.latitude);
      const lng = parseFloat(station.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      hasValidCoords = true;
      const position = { lat, lng };
      bounds.extend(position);
      const connInfo = getOCPPInfo(station);
      const isOnline = !!connInfo || station.isOnline;
      const statusColor = isOnline ? "#22c55e" : "#ef4444";

      const svgMarker = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${statusColor}"/><circle cx="18" cy="18" r="11" fill="white" fill-opacity="0.2"/><path d="M20 8l-7 11h6l-3 9 8-13h-6l2-7z" fill="white"/></svg>`)}`,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      };

      const marker = new google.maps.Marker({ position, map, title: station.name, icon: svgMarker });
      marker.addListener("click", () => {
        map.panTo(position);
        const configBtn = isAdmin ? `<button id="configure-btn-${station.id}" style="display:flex;align-items:center;gap:6px;background:#16a34a;color:white;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;margin-top:10px;">⚙️ Configurar estación</button>` : "";
        const content = `<div style="font-family:system-ui;min-width:220px;padding:4px 2px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><div style="width:10px;height:10px;border-radius:50%;background:${statusColor};flex-shrink:0;"></div><span style="font-size:15px;font-weight:700;">${station.name}</span></div>${station.address ? `<div style="font-size:12px;color:#374151;margin-bottom:6px;">📍 ${station.address}</div>` : ""}${station.maxPowerKw ? `<div style="font-size:12px;color:#374151;margin-bottom:6px;">⚡ ${station.maxPowerKw} kW</div>` : ""}${configBtn}</div>`;
        infoWindowRef.current!.setContent(content);
        infoWindowRef.current!.open(map, marker);
        if (isAdmin) {
          setTimeout(() => {
            const btn = document.getElementById(`configure-btn-${station.id}`);
            if (btn) btn.addEventListener("click", () => { infoWindowRef.current!.close(); onConfigureStation(station); });
          }, 100);
        }
      });
      markersRef.current.push(marker);
    });

    if (hasValidCoords) { map.fitBounds(bounds); if (stations.length === 1) map.setZoom(15); }
    else { map.setCenter({ lat: 4.711, lng: -74.0721 }); map.setZoom(6); }
  };

  return <MapView onMapReady={handleMapReady} className="w-full h-full" initialCenter={{ lat: 4.711, lng: -74.0721 }} initialZoom={6} />;
}

// ─── Station Config Modal ─────────────────────────────────────────────────────
function StationConfigModal({ station, open, ocppInfo, onClose, onSaved }: any) {
  const [activeTab, setActiveTab] = useState("config");

  const { data: tariff } = (trpc.organizations as any).getMyStationTariff.useQuery(
    { stationId: station.id },
    { enabled: open }
  );

  const updateMutation = (trpc.organizations as any).updateMyStation.useMutation({
    onSuccess: () => { toast.success("Estación actualizada correctamente"); onSaved(); },
    onError: (err: any) => { toast.error(err.message || "Error al actualizar"); },
  });

  const [form, setForm] = useState({
    name: station.name || "",
    description: station.description || "",
    contactPhone: station.contactPhone || "",
    isActive: station.isActive ?? true,
    isPublic: station.isPublic ?? true,
    // Tarifa
    pricePerKwh: "",
    pricePerMinute: "",
    pricePerSession: "",
    overstayPenaltyPerMinute: "",
    overstayGracePeriodMinutes: "",
    reservationFee: "",
    connectionFee: "",
    // IA
    autoPricing: false,
    priceMinKwh: "",
    priceMaxKwh: "",
    // Horario
    operatingHours: station.operatingHours || DEFAULT_HOURS,
  });

  const tariffLoaded = useRef(false);
  useEffect(() => {
    if (tariff && !tariffLoaded.current) {
      tariffLoaded.current = true;
      setForm(f => ({
        ...f,
        pricePerKwh: tariff.pricePerKwh?.toString() || "",
        pricePerMinute: tariff.pricePerMinute?.toString() || "",
        pricePerSession: tariff.pricePerSession?.toString() || "",
        overstayPenaltyPerMinute: tariff.overstayPenaltyPerMinute?.toString() || "",
        overstayGracePeriodMinutes: tariff.overstayGracePeriodMinutes?.toString() || "",
        reservationFee: tariff.reservationFee?.toString() || "",
        connectionFee: tariff.connectionFee?.toString() || "",
        autoPricing: !!tariff.autoPricing,
        priceMinKwh: tariff.priceMinKwh?.toString() || "1000",
        priceMaxKwh: tariff.priceMaxKwh?.toString() || "3000",
      }));
    }
  }, [tariff]);

  const handleSave = () => {
    const payload: any = {
      stationId: station.id,
      name: form.name,
      description: form.description || null,
      contactPhone: form.contactPhone || null,
      isActive: form.isActive,
      isPublic: form.isPublic,
      operatingHours: form.operatingHours,
      autoPricing: form.autoPricing,
    };
    if (form.pricePerKwh) payload.pricePerKwh = parseFloat(form.pricePerKwh);
    if (form.pricePerMinute) payload.pricePerMinute = parseFloat(form.pricePerMinute);
    if (form.pricePerSession) payload.pricePerSession = parseFloat(form.pricePerSession);
    if (form.overstayPenaltyPerMinute) payload.overstayPenaltyPerMinute = parseFloat(form.overstayPenaltyPerMinute);
    if (form.overstayGracePeriodMinutes) payload.overstayGracePeriodMinutes = parseInt(form.overstayGracePeriodMinutes);
    if (form.reservationFee) payload.reservationFee = parseFloat(form.reservationFee);
    if (form.connectionFee) payload.connectionFee = parseFloat(form.connectionFee);
    if (form.priceMinKwh) payload.priceMinKwh = parseFloat(form.priceMinKwh);
    if (form.priceMaxKwh) payload.priceMaxKwh = parseFloat(form.priceMaxKwh);
    updateMutation.mutate(payload);
  };

  const isOCPPConnected = !!ocppInfo;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-green-400" />
            {station.name}
          </DialogTitle>
        </DialogHeader>

        {/* Status bar */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${isOCPPConnected ? "bg-green-400" : "bg-red-400"}`} />
          <span>{isOCPPConnected ? "OCPP Conectado" : "Sin conexión OCPP"}</span>
          {station.address && <span className="ml-auto truncate text-xs">· {station.address}</span>}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="config" className="text-xs px-1"><Settings className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="tariff" className="text-xs px-1"><DollarSign className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs px-1"><Calendar className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="qr" className="text-xs px-1"><QrCode className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="ocpp" className="text-xs px-1"><Activity className="h-3.5 w-3.5" /></TabsTrigger>
          </TabsList>

          {/* ── Tab Config General ── */}
          <TabsContent value="config" className="space-y-4 pt-3">
            <SectionTitle>Información General</SectionTitle>
            <Field label="Nombre de la estación">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Estación Centro Comercial" />
            </Field>
            <Field label="Descripción (visible para usuarios)">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción de la estación" />
            </Field>
            <Field label="Teléfono de contacto">
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+57 300 000 0000" />
            </Field>

            <SectionTitle>Estado de la Estación</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <ToggleButton active={form.isActive} onClick={() => setForm({ ...form, isActive: !form.isActive })} icon={<Power className="h-4 w-4" />} label={form.isActive ? "Activa" : "Inactiva"} color="green" />
              <ToggleButton active={form.isPublic} onClick={() => setForm({ ...form, isPublic: !form.isPublic })} icon={form.isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} label={form.isPublic ? "Pública" : "Privada"} color="blue" />
            </div>

            {/* Modelo financiero (solo lectura) */}
            <SectionTitle>Modelo Financiero</SectionTitle>
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Info className="h-3.5 w-3.5" />
                <span>Distribución de ingresos configurada por EVGreen</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tu organización</span>
                  <span className="font-semibold text-green-400">{station.investorSharePercent ?? 70}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EVGreen</span>
                  <span className="font-semibold">{station.evgreenSharePercent ?? 30}%</span>
                </div>
                {parseFloat(station.hostSharePercent || "0") > 0 && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Aliado Comercial</span>
                    <span className="font-semibold">{station.hostSharePercent}%</span>
                  </div>
                )}
              </div>
            </div>

            <SaveButton onClick={handleSave} loading={updateMutation.isPending} onCancel={onClose} />
          </TabsContent>

          {/* ── Tab Tarifas + IA ── */}
          <TabsContent value="tariff" className="space-y-4 pt-3">
            {/* Toggle IA */}
            <div className={`rounded-xl border p-4 transition-all ${form.autoPricing ? "bg-purple-500/10 border-purple-500/30" : "bg-muted/30 border-border/30"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.autoPricing ? "bg-purple-500/20" : "bg-muted"}`}>
                    <Sparkles className={`h-5 w-5 ${form.autoPricing ? "text-purple-400" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Precio Automático IA</p>
                    <p className="text-xs text-muted-foreground">La IA ajusta el precio según demanda y horario</p>
                  </div>
                </div>
                <Switch
                  checked={form.autoPricing}
                  onCheckedChange={(v) => setForm({ ...form, autoPricing: v })}
                />
              </div>
              {form.autoPricing && (
                <div className="mt-3 rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-xs text-purple-300 space-y-1">
                  <p className="font-semibold">✦ El precio se ajustará automáticamente entre:</p>
                  <p className="text-lg font-bold text-purple-200">
                    ${parseFloat(form.priceMinKwh || "1000").toLocaleString("es-CO")} – ${parseFloat(form.priceMaxKwh || "3000").toLocaleString("es-CO")} COP/kWh
                  </p>
                  <p className="text-muted-foreground">basado en: ocupación de conectores (40%), horario pico/valle (30%), día de la semana (15%), demanda histórica (15%)</p>
                </div>
              )}
            </div>

            {/* Rango de precios IA */}
            {form.autoPricing && (
              <div className="space-y-3">
                <SectionTitle>Rango de Precios IA</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Precio mínimo (COP/kWh)">
                    <Input type="number" value={form.priceMinKwh} onChange={(e) => setForm({ ...form, priceMinKwh: e.target.value })} placeholder="1000" />
                  </Field>
                  <Field label="Precio máximo (COP/kWh)">
                    <Input type="number" value={form.priceMaxKwh} onChange={(e) => setForm({ ...form, priceMaxKwh: e.target.value })} placeholder="3000" />
                  </Field>
                </div>
              </div>
            )}

            {/* Precios base */}
            <SectionTitle>Precios Base</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio por kWh (COP)">
                <Input type="number" value={form.pricePerKwh} onChange={(e) => setForm({ ...form, pricePerKwh: e.target.value })} placeholder="1800" disabled={form.autoPricing} />
              </Field>
              <Field label="Precio por minuto (COP)">
                <Input type="number" value={form.pricePerMinute} onChange={(e) => setForm({ ...form, pricePerMinute: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Cargo por sesión (COP)">
                <Input type="number" value={form.pricePerSession} onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Tarifa de conexión (COP)">
                <Input type="number" value={form.connectionFee} onChange={(e) => setForm({ ...form, connectionFee: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Tarifa de reserva (COP)">
                <Input type="number" value={form.reservationFee} onChange={(e) => setForm({ ...form, reservationFee: e.target.value })} placeholder="5000" />
              </Field>
            </div>

            {/* Penalización post-carga */}
            <SectionTitle>Penalización Post-Carga</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="COP por minuto de ocupación">
                <Input type="number" value={form.overstayPenaltyPerMinute} onChange={(e) => setForm({ ...form, overstayPenaltyPerMinute: e.target.value })} placeholder="500" />
              </Field>
              <Field label="Minutos de gracia">
                <Input type="number" value={form.overstayGracePeriodMinutes} onChange={(e) => setForm({ ...form, overstayGracePeriodMinutes: e.target.value })} placeholder="10" />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Después del período de gracia, se cobra la tarifa de ocupación al usuario.</p>

            <SaveButton onClick={handleSave} loading={updateMutation.isPending} onCancel={onClose} />
          </TabsContent>

          {/* ── Tab Horario ── */}
          <TabsContent value="schedule" className="space-y-3 pt-3">
            <SectionTitle>Horario de Operación</SectionTitle>
            <p className="text-xs text-muted-foreground">Define cuándo está disponible la estación para los usuarios.</p>

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => {
                const allEnabled = DAYS.every(d => form.operatingHours?.[d.key]?.enabled);
                const newHours = { ...form.operatingHours };
                DAYS.forEach(d => { newHours[d.key] = { ...newHours[d.key], enabled: !allEnabled }; });
                setForm({ ...form, operatingHours: newHours });
              }}
            >
              {DAYS.every(d => form.operatingHours?.[d.key]?.enabled) ? "Desactivar todos" : "Activar todos (24/7)"}
            </Button>

            <div className="space-y-2">
              {DAYS.map(({ key, label }) => {
                const dayHours = form.operatingHours?.[key] || { open: "06:00", close: "22:00", enabled: true };
                return (
                  <div key={key} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${dayHours.enabled ? "bg-muted/20 border-border/30" : "bg-muted/10 border-border/20 opacity-60"}`}>
                    <Switch
                      checked={dayHours.enabled}
                      onCheckedChange={(v) => {
                        const newHours = { ...form.operatingHours, [key]: { ...dayHours, enabled: v } };
                        setForm({ ...form, operatingHours: newHours });
                      }}
                    />
                    <span className="text-sm font-medium w-20 shrink-0">{label}</span>
                    {dayHours.enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={dayHours.open}
                          onChange={(e) => {
                            const newHours = { ...form.operatingHours, [key]: { ...dayHours, open: e.target.value } };
                            setForm({ ...form, operatingHours: newHours });
                          }}
                          className="h-7 text-xs w-24"
                        />
                        <span className="text-xs text-muted-foreground">a</span>
                        <Input
                          type="time"
                          value={dayHours.close}
                          onChange={(e) => {
                            const newHours = { ...form.operatingHours, [key]: { ...dayHours, close: e.target.value } };
                            setForm({ ...form, operatingHours: newHours });
                          }}
                          className="h-7 text-xs w-24"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground flex-1">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>

            <SaveButton onClick={handleSave} loading={updateMutation.isPending} onCancel={onClose} />
          </TabsContent>

          {/* ── Tab QR ── */}
          <TabsContent value="qr" className="pt-2">
            <StationQRCode
              stationCode={station.ocppIdentity || `ST-${station.id}`}
              stationName={station.name}
              stationAddress={station.address}
            />
          </TabsContent>

          {/* ── Tab OCPP ── */}
          <TabsContent value="ocpp" className="space-y-4 pt-3">
            {isOCPPConnected ? (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-green-400" />
                  <span className="font-semibold text-green-400">Cargador Conectado</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Versión OCPP</p><p className="font-medium">{ocppInfo.ocppVersion || "1.6"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Conectado desde</p><p className="font-medium text-xs">{ocppInfo.connectedAt ? new Date(ocppInfo.connectedAt).toLocaleString("es-CO") : "N/A"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Último heartbeat</p><p className="font-medium text-xs">{ocppInfo.lastHeartbeat ? new Date(ocppInfo.lastHeartbeat).toLocaleString("es-CO") : "N/A"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Identidad OCPP</p><p className="font-medium font-mono text-xs">{ocppInfo.ocppIdentity}</p></div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-red-400">Cargador Desconectado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">El cargador no está conectado al servidor OCPP en este momento.</p>
                </div>
              </div>
            )}

            {isOCPPConnected && ocppInfo.connectorStatuses && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado de conectores</p>
                {Object.entries(ocppInfo.connectorStatuses).map(([connId, status]: [string, any]) => (
                  <div key={connId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <span className="text-sm">Conector #{connId}</span>
                    <Badge className={status === "Available" ? "bg-green-500/20 text-green-400 border-green-500/30" : status === "Charging" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>{status}</Badge>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">Para logs completos de OCPP, accede al Monitor OCPP en el panel de administración.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">{children}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleButton({ active, onClick, icon, label, color }: any) {
  const colors: Record<string, string> = {
    green: active ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-muted border-border text-muted-foreground",
    blue: active ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-muted border-border text-muted-foreground",
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${colors[color]}`}>
      {icon}{label}
    </button>
  );
}

function SaveButton({ onClick, loading, onCancel }: any) {
  return (
    <div className="flex gap-2 pt-2">
      <Button variant="outline" onClick={onCancel} disabled={loading} className="flex-1">Cancelar</Button>
      <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onClick} disabled={loading}>
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}

// ─── Station Card ─────────────────────────────────────────────────────────────
function StationCard({ station, isAdmin, ocppInfo, onConfigure }: any) {
  const isOnline = !!ocppInfo || station.isOnline;
  return (
    <Card className={`border-border/50 transition-all ${isOnline ? "hover:border-green-500/30" : "opacity-80"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{station.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{station.city || station.address || "Sin ubicación"}</span>
            </p>
          </div>
          <div className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded-full text-xs font-medium ${isOnline ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {isOnline ? <CheckCircle className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {station.address && <div className="col-span-2"><p className="text-muted-foreground">Dirección</p><p className="font-medium truncate">{station.address}</p></div>}
          {station.ocppIdentity && <div><p className="text-muted-foreground">OCPP ID</p><p className="font-medium font-mono truncate">{station.ocppIdentity}</p></div>}
          {station.maxPowerKw && <div><p className="text-muted-foreground">Potencia Máx.</p><p className="font-medium">{station.maxPowerKw} kW</p></div>}
        </div>
        {ocppInfo && <div className="mt-3 flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 rounded-lg px-2.5 py-1.5"><Wifi className="h-3 w-3 shrink-0" /><span>OCPP {ocppInfo.ocppVersion || "1.6"} conectado</span></div>}
        {!isOnline && <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5"><WifiOff className="h-3 w-3 shrink-0" /><span>Estación desconectada del servidor OCPP</span></div>}
        {isAdmin && (
          <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-xs gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={onConfigure}>
            <Settings className="h-3.5 w-3.5" /> Configurar estación
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
