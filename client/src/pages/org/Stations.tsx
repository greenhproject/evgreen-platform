/**
 * Org Stations - Vista de estaciones de la organización SaaS
 * Mapa con mini-tarjetas InfoWindow + modal de configuración para admins
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
} from "lucide-react";
import { useState, useRef } from "react";
import { MapView } from "@/components/Map";
import { toast } from "sonner";

export default function OrgStations() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [configStation, setConfigStation] = useState<any>(null);

  const { data: org } = (trpc.organizations as any).getMyOrg.useQuery();
  const { data: stations, isLoading, refetch } = (trpc.organizations as any).getMyStations.useQuery();

  const isAdmin = org?.myRole === "admin";

  const filtered = stations?.filter((s: any) =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const onlineCount = stations?.filter((s: any) => s.isOnline).length || 0;
  const offlineCount = stations?.filter((s: any) => !s.isOnline).length || 0;

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
  onConfigureStation,
}: {
  stations: any[];
  isAdmin: boolean;
  onConfigureStation: (s: any) => void;
}) {
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const handleMapReady = (map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
    infoWindowRef.current = new google.maps.InfoWindow();

    stations.forEach((station) => {
      const lat = parseFloat(station.latitude);
      const lng = parseFloat(station.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      hasValidCoords = true;
      const position = { lat, lng };
      bounds.extend(position);

      const isOnline = station.isOnline;
      const statusColor = isOnline ? "#22c55e" : "#ef4444";
      const statusLabel = isOnline ? "En línea" : "Offline";

      // Custom SVG marker with lightning bolt
      const svgMarker = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
              </filter>
            </defs>
            <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z"
              fill="${statusColor}" filter="url(#shadow)"/>
            <circle cx="18" cy="18" r="11" fill="white" fill-opacity="0.2"/>
            <path d="M20 8l-7 11h6l-3 9 8-13h-6l2-7z" fill="white"/>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      };

      const marker = new google.maps.Marker({
        position,
        map,
        title: station.name,
        icon: svgMarker,
      });

      marker.addListener("click", () => {
        map.panTo(position);

        const configBtn = isAdmin
          ? `<button
              id="configure-btn-${station.id}"
              style="
                display:flex; align-items:center; gap:6px;
                background:#16a34a; color:white;
                border:none; border-radius:8px;
                padding:7px 14px; font-size:13px; font-weight:600;
                cursor:pointer; width:100%; justify-content:center;
                margin-top:10px;
              "
            >
              ⚙️ Configurar estación
            </button>`
          : "";

        const content = `
          <div style="
            font-family: system-ui, -apple-system, sans-serif;
            min-width: 220px; max-width: 260px;
            padding: 4px 2px;
          ">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <div style="
                width:10px; height:10px; border-radius:50%;
                background:${statusColor}; flex-shrink:0;
                box-shadow: 0 0 6px ${statusColor};
              "></div>
              <span style="font-size:15px; font-weight:700; color:#111;">${station.name}</span>
            </div>

            <div style="
              display:inline-flex; align-items:center; gap:4px;
              background:${isOnline ? "#dcfce7" : "#fee2e2"};
              color:${isOnline ? "#16a34a" : "#dc2626"};
              border-radius:20px; padding:2px 10px; font-size:12px; font-weight:600;
              margin-bottom:10px;
            ">
              ${statusLabel}
            </div>

            ${station.address ? `
              <div style="display:flex; gap:6px; align-items:flex-start; margin-bottom:6px;">
                <span style="color:#6b7280; font-size:12px;">📍</span>
                <span style="font-size:12px; color:#374151; line-height:1.4;">${station.address}</span>
              </div>
            ` : ""}

            ${station.city ? `
              <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
                <span style="color:#6b7280; font-size:12px;">🏙️</span>
                <span style="font-size:12px; color:#374151;">${station.city}</span>
              </div>
            ` : ""}

            ${station.maxPowerKw ? `
              <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
                <span style="color:#6b7280; font-size:12px;">⚡</span>
                <span style="font-size:12px; color:#374151; font-weight:600;">${station.maxPowerKw} kW máx.</span>
              </div>
            ` : ""}

            ${station.ocppIdentity ? `
              <div style="
                background:#f3f4f6; border-radius:6px;
                padding:4px 8px; font-size:11px; color:#6b7280;
                font-family:monospace; margin-bottom:6px;
              ">
                OCPP: ${station.ocppIdentity}
              </div>
            ` : ""}

            ${configBtn}
          </div>
        `;

        infoWindowRef.current!.setContent(content);
        infoWindowRef.current!.open(map, marker);

        // Attach click handler after DOM renders
        if (isAdmin) {
          setTimeout(() => {
            const btn = document.getElementById(`configure-btn-${station.id}`);
            if (btn) {
              btn.addEventListener("click", () => {
                infoWindowRef.current!.close();
                onConfigureStation(station);
              });
            }
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

// ─── Station Config Modal ─────────────────────────────────────────────────────

function StationConfigModal({
  station,
  open,
  onClose,
  onSaved,
}: {
  station: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
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

  // Populate tariff fields when loaded
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-green-400" />
            Configurar: {station.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Station info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <div className={`w-2 h-2 rounded-full ${station.isOnline ? "bg-green-400" : "bg-red-400"}`} />
            <span>{station.isOnline ? "En línea" : "Offline"}</span>
            {station.address && <span>· {station.address}</span>}
          </div>

          {/* General */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Información General
            </h3>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la estación</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Estación Centro Comercial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción visible para los usuarios"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono de contacto</Label>
              <Input
                id="phone"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="+57 300 000 0000"
              />
            </div>
          </div>

          {/* Status toggles */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Estado
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  form.isActive
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                <Power className="h-4 w-4" />
                {form.isActive ? "Activa" : "Inactiva"}
              </button>
              <button
                onClick={() => setForm({ ...form, isPublic: !form.isPublic })}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  form.isPublic
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {form.isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {form.isPublic ? "Pública" : "Privada"}
              </button>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Tarifa de Carga
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pkwh" className="text-xs">Precio por kWh (COP)</Label>
                <Input
                  id="pkwh"
                  type="number"
                  value={form.pricePerKwh}
                  onChange={(e) => setForm({ ...form, pricePerKwh: e.target.value })}
                  placeholder="1800"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pmin" className="text-xs">Precio por minuto (COP)</Label>
                <Input
                  id="pmin"
                  type="number"
                  value={form.pricePerMinute}
                  onChange={(e) => setForm({ ...form, pricePerMinute: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="psession" className="text-xs">Cargo por sesión (COP)</Label>
                <Input
                  id="psession"
                  type="number"
                  value={form.pricePerSession}
                  onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Overstay */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Penalización por Ocupación Post-Carga
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="overstay" className="text-xs">Tarifa por minuto (COP)</Label>
                <Input
                  id="overstay"
                  type="number"
                  value={form.overstayPenaltyPerMinute}
                  onChange={(e) => setForm({ ...form, overstayPenaltyPerMinute: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grace" className="text-xs">Minutos de gracia</Label>
                <Input
                  id="grace"
                  type="number"
                  value={form.overstayGracePeriodMinutes}
                  onChange={(e) => setForm({ ...form, overstayGracePeriodMinutes: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Después del período de gracia, se cobra la tarifa de ocupación al usuario.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancelar
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleSave}
            disabled={updateMutation.isPending || !form.name}
          >
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Station Card ─────────────────────────────────────────────────────────────

function StationCard({
  station,
  isAdmin,
  onConfigure,
}: {
  station: any;
  isAdmin: boolean;
  onConfigure: () => void;
}) {
  const isOnline = station.isOnline;

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
            isOnline
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}>
            {isOnline ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
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
