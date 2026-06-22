/**
 * Org Stations - Vista de estaciones de la organización SaaS
 * Modal con tabs: Configuración, QR, Logs OCPP, Precios Dinámicos IA
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Search,
  CheckCircle,
  AlertCircle,
  Zap,
  WifiOff,
  Map,
  List,
  Settings,
  DollarSign,
  Power,
  Eye,
  EyeOff,
  QrCode,
  Activity,
  Wifi,
  Sparkles,
  TrendingUp,
  Clock,
} from "lucide-react";
import { useState, useRef } from "react";
import { MapView } from "@/components/Map";
import { toast } from "sonner";
import { StationQRCode } from "@/components/StationQRCode";

export default function OrgStations() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [configStation, setConfigStation] = useState<any>(null);

  const { data: org } = (trpc.organizations as any).getMyOrg.useQuery();
  const { data: stations, isLoading, refetch } = (trpc.organizations as any).getMyStations.useQuery();

  // OCPP connections para estado en tiempo real
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
            Estado en tiempo real de las estaciones de carga de tu organización
          </p>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Map className="h-3.5 w-3.5" />
            Mapa
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

      {/* Search (only in list view) */}
      {view === "list" && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, ciudad o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Map View */}
      {view === "map" && (
        <Card className="border-border/50 overflow-hidden">
          <div className="h-[520px] relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Cargando mapa...
              </div>
            ) : !stations || stations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <MapPin className="h-12 w-12 opacity-30" />
                <p>No hay estaciones para mostrar en el mapa</p>
              </div>
            ) : (
              <OrgStationsMap
                stations={stations}
                isAdmin={isAdmin}
                ocppConnections={ocppConnections || []}
                onConfigureStation={setConfigStation}
              />
            )}
          </div>
        </Card>
      )}

      {/* List View */}
      {view === "list" && (
        <>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Cargando estaciones...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{search ? "No se encontraron estaciones con ese criterio" : "No hay estaciones asignadas a tu organización"}</p>
              {!search && (
                <p className="text-sm mt-1">Contacta al administrador de EVGreen para asignar estaciones.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s: any) => (
                <StationCard
                  key={s.id}
                  station={s}
                  isAdmin={isAdmin}
                  ocppInfo={getOCPPInfo(s)}
                  onConfigure={() => setConfigStation(s)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Config Modal */}
      {configStation && (
        <StationConfigModal
          station={configStation}
          open={!!configStation}
          ocppInfo={getOCPPInfo(configStation)}
          onClose={() => setConfigStation(null)}
          onSaved={() => {
            refetch();
            setConfigStation(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Map Component ────────────────────────────────────────────────────────────
function OrgStationsMap({
  stations,
  isAdmin,
  ocppConnections,
  onConfigureStation,
}: {
  stations: any[];
  isAdmin: boolean;
  ocppConnections: any[];
  onConfigureStation: (s: any) => void;
}) {
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const getOCPPInfo = (station: any) => {
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.find(
      (conn: any) => conn.ocppIdentity === ocppId || conn.stationId === station.id
    );
  };

  const handleMapReady = (map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (infoWindowRef.current) infoWindowRef.current.close();
    infoWindowRef.current = new google.maps.InfoWindow();

    stations.forEach((station) => {
      const lat = parseFloat(station.latitude);
      const lng = parseFloat(station.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      hasValidCoords = true;
      const position = { lat, lng };
      bounds.extend(position);

      const connInfo = getOCPPInfo(station);
      const isOnline = !!connInfo || station.isOnline;
      const statusColor = isOnline ? "#22c55e" : "#ef4444";
      const statusLabel = isOnline ? "En línea" : "Offline";

      const svgMarker = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
            <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
            </filter></defs>
            <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z"
              fill="${statusColor}" filter="url(#shadow)"/>
            <circle cx="18" cy="18" r="11" fill="white" fill-opacity="0.2"/>
            <path d="M20 8l-7 11h6l-3 9 8-13h-6l2-7z" fill="white"/>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      };

      const marker = new google.maps.Marker({ position, map, title: station.name, icon: svgMarker });

      marker.addListener("click", () => {
        map.panTo(position);
        const configBtn = isAdmin
          ? `<button id="configure-btn-${station.id}" style="display:flex;align-items:center;gap:6px;background:#16a34a;color:white;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;margin-top:10px;">⚙️ Configurar estación</button>`
          : "";

        const content = `
          <div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;max-width:260px;padding:4px 2px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${statusColor};flex-shrink:0;box-shadow:0 0 6px ${statusColor};"></div>
              <span style="font-size:15px;font-weight:700;color:#111;">${station.name}</span>
            </div>
            <div style="display:inline-flex;align-items:center;gap:4px;background:${isOnline ? "#dcfce7" : "#fee2e2"};color:${isOnline ? "#16a34a" : "#dc2626"};border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600;margin-bottom:10px;">${statusLabel}</div>
            ${station.address ? `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;"><span style="color:#6b7280;font-size:12px;">📍</span><span style="font-size:12px;color:#374151;line-height:1.4;">${station.address}</span></div>` : ""}
            ${station.city ? `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;"><span style="color:#6b7280;font-size:12px;">🏙️</span><span style="font-size:12px;color:#374151;">${station.city}</span></div>` : ""}
            ${station.maxPowerKw ? `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;"><span style="color:#6b7280;font-size:12px;">⚡</span><span style="font-size:12px;color:#374151;font-weight:600;">${station.maxPowerKw} kW máx.</span></div>` : ""}
            ${station.ocppIdentity ? `<div style="background:#f3f4f6;border-radius:6px;padding:4px 8px;font-size:11px;color:#6b7280;font-family:monospace;margin-bottom:6px;">OCPP: ${station.ocppIdentity}</div>` : ""}
            ${configBtn}
          </div>`;

        infoWindowRef.current!.setContent(content);
        infoWindowRef.current!.open(map, marker);

        if (isAdmin) {
          setTimeout(() => {
            const btn = document.getElementById(`configure-btn-${station.id}`);
            if (btn) btn.addEventListener("click", () => {
              infoWindowRef.current!.close();
              onConfigureStation(station);
            });
          }, 100);
        }
      });

      markersRef.current.push(marker);
    });

    if (hasValidCoords) {
      map.fitBounds(bounds);
      if (stations.length === 1) map.setZoom(15);
    } else {
      map.setCenter({ lat: 4.711, lng: -74.0721 });
      map.setZoom(6);
    }
  };

  return (
    <MapView
      onMapReady={handleMapReady}
      className="w-full h-full"
      initialCenter={{ lat: 4.711, lng: -74.0721 }}
      initialZoom={6}
    />
  );
}

// ─── Station Config Modal (con tabs) ─────────────────────────────────────────
function StationConfigModal({
  station,
  open,
  ocppInfo,
  onClose,
  onSaved,
}: {
  station: any;
  open: boolean;
  ocppInfo: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState("config");

  const { data: tariff } = (trpc.organizations as any).getMyStationTariff.useQuery(
    { stationId: station.id },
    { enabled: open }
  );

  const updateMutation = (trpc.organizations as any).updateMyStation.useMutation({
    onSuccess: () => {
      toast.success("Estación actualizada correctamente");
      onSaved();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar la estación");
    },
  });

  const [form, setForm] = useState({
    name: station.name || "",
    description: station.description || "",
    contactPhone: station.contactPhone || "",
    isActive: station.isActive ?? true,
    isPublic: station.isPublic ?? true,
    pricePerKwh: "",
    pricePerMinute: "",
    pricePerSession: "",
    overstayPenaltyPerMinute: "",
    overstayGracePeriodMinutes: "",
  });

  const [aiPricingEnabled, setAiPricingEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ price: number; reason: string } | null>(null);

  const tariffLoaded = useRef(false);
  if (tariff && !tariffLoaded.current) {
    tariffLoaded.current = true;
    setForm((f) => ({
      ...f,
      pricePerKwh: tariff.pricePerKwh?.toString() || "",
      pricePerMinute: tariff.pricePerMinute?.toString() || "",
      pricePerSession: tariff.pricePerSession?.toString() || "",
      overstayPenaltyPerMinute: tariff.overstayPenaltyPerMinute?.toString() || "",
      overstayGracePeriodMinutes: tariff.overstayGracePeriodMinutes?.toString() || "",
    }));
  }

  const handleSave = () => {
    const payload: any = {
      stationId: station.id,
      name: form.name,
      description: form.description || null,
      contactPhone: form.contactPhone || null,
      isActive: form.isActive,
      isPublic: form.isPublic,
    };
    if (form.pricePerKwh) payload.pricePerKwh = parseFloat(form.pricePerKwh);
    if (form.pricePerMinute) payload.pricePerMinute = parseFloat(form.pricePerMinute);
    if (form.pricePerSession) payload.pricePerSession = parseFloat(form.pricePerSession);
    if (form.overstayPenaltyPerMinute) payload.overstayPenaltyPerMinute = parseFloat(form.overstayPenaltyPerMinute);
    if (form.overstayGracePeriodMinutes) payload.overstayGracePeriodMinutes = parseInt(form.overstayGracePeriodMinutes);
    updateMutation.mutate(payload);
  };

  // Simulación de sugerencia IA de precio
  const generateAISuggestion = async () => {
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    const currentPrice = parseFloat(form.pricePerKwh || "1800");
    const hour = new Date().getHours();
    let suggestedPrice = currentPrice;
    let reason = "";

    if (hour >= 18 && hour <= 22) {
      suggestedPrice = Math.round(currentPrice * 1.15);
      reason = "Hora pico (18:00–22:00): alta demanda detectada. Se recomienda incrementar el precio un 15%.";
    } else if (hour >= 0 && hour <= 6) {
      suggestedPrice = Math.round(currentPrice * 0.85);
      reason = "Madrugada (00:00–06:00): baja demanda. Se recomienda reducir el precio un 15% para incentivar uso.";
    } else if (hour >= 7 && hour <= 9) {
      suggestedPrice = Math.round(currentPrice * 1.08);
      reason = "Hora punta matutina (07:00–09:00): demanda moderada-alta. Incremento del 8% recomendado.";
    } else {
      suggestedPrice = currentPrice;
      reason = "Demanda normal en este horario. Se mantiene el precio actual como óptimo.";
    }

    setAiSuggestion({ price: suggestedPrice, reason });
    setAiLoading(false);
  };

  const applyAISuggestion = () => {
    if (aiSuggestion) {
      setForm(f => ({ ...f, pricePerKwh: aiSuggestion.price.toString() }));
      toast.success(`Precio actualizado a $${aiSuggestion.price.toLocaleString("es-CO")} COP/kWh`);
    }
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
          <span>{isOCPPConnected ? "Conectado OCPP" : "Sin conexión OCPP"}</span>
          {station.address && <span className="ml-auto truncate text-xs">· {station.address}</span>}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="config" className="flex items-center gap-1 text-xs">
              <Settings className="h-3.5 w-3.5" />
              Config
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-1 text-xs">
              <QrCode className="h-3.5 w-3.5" />
              QR
            </TabsTrigger>
            <TabsTrigger value="ocpp" className="flex items-center gap-1 text-xs">
              <Activity className="h-3.5 w-3.5" />
              OCPP
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              IA
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Configuración ── */}
          <TabsContent value="config" className="space-y-5 pt-2">
            {/* General */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Información General
              </h3>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">Nombre de la estación</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Estación Centro Comercial" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs">Descripción (opcional)</Label>
                <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción visible para los usuarios" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs">Teléfono de contacto</Label>
                <Input id="phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+57 300 000 0000" />
              </div>
            </div>

            {/* Estado */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    form.isActive ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  <Power className="h-4 w-4" />
                  {form.isActive ? "Activa" : "Inactiva"}
                </button>
                <button
                  onClick={() => setForm({ ...form, isPublic: !form.isPublic })}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    form.isPublic ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {form.isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {form.isPublic ? "Pública" : "Privada"}
                </button>
              </div>
            </div>

            {/* Tarifa */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" /> Tarifa de Carga
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pkwh" className="text-xs">Precio por kWh (COP)</Label>
                  <Input id="pkwh" type="number" value={form.pricePerKwh} onChange={(e) => setForm({ ...form, pricePerKwh: e.target.value })} placeholder="1800" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pmin" className="text-xs">Precio por minuto (COP)</Label>
                  <Input id="pmin" type="number" value={form.pricePerMinute} onChange={(e) => setForm({ ...form, pricePerMinute: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="psession" className="text-xs">Cargo por sesión (COP)</Label>
                  <Input id="psession" type="number" value={form.pricePerSession} onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })} placeholder="0" />
                </div>
              </div>
            </div>

            {/* Penalización */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Penalización por Ocupación Post-Carga
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="overstay" className="text-xs">Tarifa por minuto (COP)</Label>
                  <Input id="overstay" type="number" value={form.overstayPenaltyPerMinute} onChange={(e) => setForm({ ...form, overstayPenaltyPerMinute: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grace" className="text-xs">Minutos de gracia</Label>
                  <Input id="grace" type="number" value={form.overstayGracePeriodMinutes} onChange={(e) => setForm({ ...form, overstayGracePeriodMinutes: e.target.value })} placeholder="10" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Después del período de gracia, se cobra la tarifa de ocupación al usuario.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Cancelar</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleSave}
                disabled={updateMutation.isPending || !form.name}
              >
                {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
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
          <TabsContent value="ocpp" className="space-y-4 pt-2">
            {isOCPPConnected ? (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-green-400" />
                  <span className="font-semibold text-green-400">Cargador Conectado</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Versión OCPP</p>
                    <p className="font-medium">{ocppInfo.ocppVersion || "1.6"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Conectado desde</p>
                    <p className="font-medium text-xs">
                      {ocppInfo.connectedAt ? new Date(ocppInfo.connectedAt).toLocaleString("es-CO") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Último heartbeat</p>
                    <p className="font-medium text-xs">
                      {ocppInfo.lastHeartbeat ? new Date(ocppInfo.lastHeartbeat).toLocaleString("es-CO") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Identidad OCPP</p>
                    <p className="font-medium font-mono text-xs">{ocppInfo.ocppIdentity}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-red-400">Cargador Desconectado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El cargador no está conectado al servidor OCPP en este momento.
                  </p>
                </div>
              </div>
            )}

            {/* Estado de conectores */}
            {isOCPPConnected && ocppInfo.connectorStatuses && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado de conectores</p>
                {Object.entries(ocppInfo.connectorStatuses).map(([connId, status]: [string, any]) => (
                  <div key={connId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <span className="text-sm">Conector #{connId}</span>
                    <Badge className={
                      status === "Available" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                      status === "Charging" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                      status === "Preparing" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                      "bg-red-500/20 text-red-400 border-red-500/30"
                    }>
                      {status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <p className="text-xs text-muted-foreground text-center">
                Para ver los logs completos de comunicación OCPP, accede al Monitor OCPP desde el panel de administración.
              </p>
            </div>
          </TabsContent>

          {/* ── Tab IA Precios Dinámicos ── */}
          <TabsContent value="ai" className="space-y-4 pt-2">
            <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span className="font-semibold text-purple-400">Precios Dinámicos con IA</span>
              </div>
              <p className="text-xs text-muted-foreground">
                La IA analiza la hora del día, demanda histórica y patrones de uso para sugerir el precio óptimo por kWh.
              </p>
            </div>

            {/* Precio actual */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
              <div>
                <p className="text-xs text-muted-foreground">Precio actual por kWh</p>
                <p className="text-lg font-bold text-foreground">
                  ${parseFloat(form.pricePerKwh || "0").toLocaleString("es-CO")} COP
                </p>
              </div>
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Sugerencia IA */}
            {aiSuggestion && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Sugerencia de la IA</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Precio sugerido</p>
                    <p className="text-xl font-bold text-green-400">
                      ${aiSuggestion.price.toLocaleString("es-CO")} COP/kWh
                    </p>
                  </div>
                  <Badge className={
                    aiSuggestion.price > parseFloat(form.pricePerKwh || "0")
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : aiSuggestion.price < parseFloat(form.pricePerKwh || "0")
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-muted text-muted-foreground"
                  }>
                    {aiSuggestion.price > parseFloat(form.pricePerKwh || "0") ? "↑ Subir" :
                     aiSuggestion.price < parseFloat(form.pricePerKwh || "0") ? "↓ Bajar" : "= Mantener"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{aiSuggestion.reason}</p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 h-9 text-sm"
                  onClick={applyAISuggestion}
                >
                  Aplicar precio sugerido
                </Button>
              </div>
            )}

            {/* Contexto horario */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Hora actual (local)</p>
                <p className="text-sm font-medium">{new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>

            <Button
              className="w-full h-10"
              variant="outline"
              onClick={generateAISuggestion}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Analizando con IA...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Generar sugerencia de precio
                </span>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Los cambios de precio se aplican en la pestaña "Config" y se guardan al hacer clic en "Guardar cambios".
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Station Card ─────────────────────────────────────────────────────────────
function StationCard({
  station,
  isAdmin,
  ocppInfo,
  onConfigure,
}: {
  station: any;
  isAdmin: boolean;
  ocppInfo: any;
  onConfigure: () => void;
}) {
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
          <div className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
            isOnline ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}>
            {isOnline ? <CheckCircle className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {station.address && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Dirección</p>
              <p className="font-medium truncate">{station.address}</p>
            </div>
          )}
          {station.ocppIdentity && (
            <div>
              <p className="text-muted-foreground">OCPP ID</p>
              <p className="font-medium font-mono truncate">{station.ocppIdentity}</p>
            </div>
          )}
          {station.maxPowerKw && (
            <div>
              <p className="text-muted-foreground">Potencia Máx.</p>
              <p className="font-medium">{station.maxPowerKw} kW</p>
            </div>
          )}
        </div>

        {ocppInfo && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 rounded-lg px-2.5 py-1.5">
            <Wifi className="h-3 w-3 shrink-0" />
            <span>OCPP {ocppInfo.ocppVersion || "1.6"} conectado</span>
          </div>
        )}

        {!isOnline && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5">
            <WifiOff className="h-3 w-3 shrink-0" />
            <span>Estación desconectada del servidor OCPP</span>
          </div>
        )}

        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 h-8 text-xs gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
            onClick={onConfigure}
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar estación
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
