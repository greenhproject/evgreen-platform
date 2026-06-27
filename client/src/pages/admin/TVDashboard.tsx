import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";

// ============================================================================
// EVGreen NOC - Network Operations Center Dashboard
// Diseñado para pantallas grandes / TV. Ruta: /admin/tv
// ============================================================================

type StationStatus = "charging" | "available" | "offline" | "faulted" | "inactive";

const STATUS_COLORS: Record<StationStatus, string> = {
  charging: "#22c55e",
  available: "#3b82f6",
  offline: "#ef4444",
  faulted: "#f97316",
  inactive: "#6b7280",
};

const STATUS_LABELS: Record<StationStatus, string> = {
  charging: "Cargando",
  available: "Disponible",
  offline: "Sin conexión",
  faulted: "Falla",
  inactive: "Inactiva",
};

const STATUS_BG: Record<StationStatus, string> = {
  charging: "bg-green-500/20 border-green-500/40",
  available: "bg-blue-500/20 border-blue-500/40",
  offline: "bg-red-500/20 border-red-500/40",
  faulted: "bg-orange-500/20 border-orange-500/40",
  inactive: "bg-gray-500/20 border-gray-500/40",
};

function formatCOP(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatKwh(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} MWh`;
  return `${value.toFixed(1)} kWh`;
}

function formatElapsed(startTime: Date | string) {
  const start = new Date(startTime);
  const diffMs = Date.now() - start.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right">
      <div className="text-2xl font-mono font-bold text-white tabular-nums">
        {time.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="text-xs text-gray-400">
        {time.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-3 w-3">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: color }} />
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-5 py-3 rounded-xl border"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}12` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function StationCard({ station }: { station: any }) {
  const status = station.overallStatus as StationStatus;
  const color = STATUS_COLORS[status];

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 ${STATUS_BG[status]}`}
      style={{ minWidth: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{station.name}</div>
          <div className="text-xs text-gray-400 truncate">{station.city}{station.department ? `, ${station.department}` : ""}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "charging" && <PulsingDot color={color} />}
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}25`, color }}>
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      {/* Connectors row */}
      <div className="flex gap-1 flex-wrap">
        {station.evses.map((evse: any) => {
          const evseColor = evse.isCharging ? "#22c55e" : evse.status === "AVAILABLE" ? "#3b82f6" : evse.status === "FAULTED" ? "#f97316" : "#6b7280";
          return (
            <div
              key={evse.id}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
              style={{ borderColor: `${evseColor}50`, backgroundColor: `${evseColor}15`, color: evseColor }}
            >
              <span>⚡</span>
              <span>{evse.connectorType}</span>
              {evse.isCharging && evse.currentTx && (
                <span className="font-mono">{parseFloat(evse.currentTx.kwhConsumed || "0").toFixed(1)} kWh</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{station.chargingCount}/{station.totalEvses} activos</span>
        {station.totalPowerKw > 0 && (
          <span className="text-green-400 font-mono font-medium">{station.totalPowerKw} kW</span>
        )}
        {station.lastHeartbeat && (
          <span className="text-gray-500">♥ {formatElapsed(station.lastHeartbeat)}</span>
        )}
      </div>
    </div>
  );
}

function ActivityTicker({ items }: { items: any[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const width = ref.current.scrollWidth / 2;
    let frame: number;
    let pos = 0;
    const animate = () => {
      pos += 0.4;
      if (pos >= width) pos = 0;
      setOffset(pos);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [items.length]);

  const tickerItems = [...items, ...items]; // duplicate for seamless loop

  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div
        ref={ref}
        className="inline-flex gap-8"
        style={{ transform: `translateX(-${offset}px)` }}
      >
        {tickerItems.map((item, i) => {
          const isActive = item.status === "IN_PROGRESS";
          const isCompleted = item.status === "COMPLETED";
          return (
            <span key={i} className="inline-flex items-center gap-2 text-sm">
              <span className={isActive ? "text-green-400" : isCompleted ? "text-blue-400" : "text-gray-400"}>
                {isActive ? "⚡" : isCompleted ? "✓" : "·"}
              </span>
              <span className="text-white font-medium">{item.userName}</span>
              <span className="text-gray-400">en</span>
              <span className="text-green-300">{item.stationName}</span>
              {isCompleted && (
                <>
                  <span className="text-gray-500">·</span>
                  <span className="text-yellow-400 font-mono">{formatCOP(item.totalCost)}</span>
                  <span className="text-gray-500">·</span>
                  <span className="text-blue-300 font-mono">{item.kwhConsumed.toFixed(1)} kWh</span>
                </>
              )}
              {isActive && (
                <span className="text-green-400 font-mono animate-pulse">
                  {formatElapsed(item.startTime)} activo
                </span>
              )}
              <span className="text-gray-700 mx-2">|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function HourlyChart({ data }: { data: Array<{ hour: number; revenue: number; kwh: number; sessions: number }> }) {
  if (!data.length) return <div className="text-gray-600 text-xs text-center py-4">Sin datos hoy</div>;

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex items-end gap-0.5 h-16">
      {hours.map(h => {
        const d = data.find(x => x.hour === h);
        const height = d ? Math.max(4, (d.revenue / maxRevenue) * 100) : 0;
        return (
          <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={d ? `${h}:00 - $${d.revenue.toLocaleString()} COP` : ""}>
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${height}%`,
                minHeight: d ? "4px" : "0",
                backgroundColor: d ? "#22c55e" : "transparent",
                opacity: d ? 0.8 : 0,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function TVDashboard() {
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data, isLoading, refetch } = trpc.noc.getNetworkSnapshot.useQuery(undefined, {
    refetchInterval: 15_000, // auto-refresh cada 15s
    staleTime: 10_000,
  });

  // Auto-refresh counter
  const [nextRefresh, setNextRefresh] = useState(15);
  useEffect(() => {
    const t = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) { refetch(); return 15; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [refetch]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Update map markers when data changes
  useEffect(() => {
    if (!mapInstance || !data) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    data.stations.forEach(station => {
      if (!station.latitude || !station.longitude) return;
      const lat = parseFloat(station.latitude as string);
      const lng = parseFloat(station.longitude as string);
      if (isNaN(lat) || isNaN(lng)) return;

      const status = station.overallStatus as StationStatus;
      const color = STATUS_COLORS[status];

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstance,
        title: station.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: station.overallStatus === "charging" ? 12 : 9,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="background:#1a1a2e;color:#fff;padding:10px;border-radius:8px;min-width:180px;font-family:sans-serif;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${station.name}</div>
            <div style="font-size:12px;color:#9ca3af;margin-bottom:6px;">${station.city}${station.department ? `, ${station.department}` : ""}</div>
            <div style="display:flex;gap:8px;font-size:12px;">
              <span style="color:${color};font-weight:600;">${STATUS_LABELS[status]}</span>
              <span style="color:#6b7280;">·</span>
              <span>${station.chargingCount}/${station.totalEvses} activos</span>
            </div>
            ${station.totalPowerKw > 0 ? `<div style="font-size:12px;color:#22c55e;margin-top:4px;">⚡ ${station.totalPowerKw} kW entregando</div>` : ""}
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(mapInstance, marker);
      });

      markersRef.current.push(marker);
    });
  }, [mapInstance, data]);

  const kpis = data?.kpis;
  const stations = data?.stations || [];

  // Group stations by status for summary
  const byStatus = {
    charging: stations.filter(s => s.overallStatus === "charging"),
    available: stations.filter(s => s.overallStatus === "available"),
    offline: stations.filter(s => s.overallStatus === "offline"),
    faulted: stations.filter(s => s.overallStatus === "faulted"),
    inactive: stations.filter(s => s.overallStatus === "inactive"),
  };

  return (
    <div
      className="flex flex-col bg-[#050d1a] text-white"
      style={{ minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#080f1f]">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 text-lg">⚡</span>
          </div>
          <div>
            <div className="font-bold text-white text-lg leading-tight">EVGreen NOC</div>
            <div className="text-xs text-gray-500">Network Operations Center</div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2">
          <PulsingDot color="#22c55e" />
          <span className="text-xs text-green-400 font-medium">SISTEMA EN VIVO</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-xs text-gray-500">Actualiza en {nextRefresh}s</span>
        </div>

        {/* Clock + fullscreen */}
        <div className="flex items-center gap-4">
          <LiveClock />
          <button
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white transition-colors text-lg"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? "⊡" : "⛶"}
          </button>
        </div>
      </header>

      {/* ── KPI BAR ── */}
      <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-white/10 bg-[#06101e]">
        {/* Network status */}
        <div className="flex gap-2">
          <KpiCard
            label="En línea"
            value={String(kpis?.onlineStations ?? "—")}
            sub={`de ${kpis?.totalStations ?? "—"} estaciones`}
            color="#22c55e"
            icon="🟢"
          />
          <KpiCard
            label="Cargando"
            value={String(kpis?.chargingStations ?? "—")}
            sub={`${kpis?.activeSessionsCount ?? 0} sesiones activas`}
            color="#3b82f6"
            icon="⚡"
          />
        </div>
        {/* Power */}
        <div className="flex gap-2">
          <KpiCard
            label="Potencia total"
            value={`${kpis?.totalPowerDelivering ?? 0} kW`}
            sub="entregando ahora"
            color="#a78bfa"
            icon="🔋"
          />
          <KpiCard
            label="Alertas"
            value={String((kpis?.offlineStations ?? 0) + (kpis?.faultedStations ?? 0))}
            sub={`${kpis?.offlineStations ?? 0} offline · ${kpis?.faultedStations ?? 0} fallas`}
            color={((kpis?.offlineStations ?? 0) + (kpis?.faultedStations ?? 0)) > 0 ? "#ef4444" : "#6b7280"}
            icon="⚠️"
          />
        </div>
        {/* Today */}
        <div className="flex gap-2">
          <KpiCard
            label="Facturado hoy"
            value={formatCOP(kpis?.today.revenue ?? 0)}
            sub={`${kpis?.today.sessions ?? 0} sesiones`}
            color="#f59e0b"
            icon="💰"
          />
          <KpiCard
            label="kWh hoy"
            value={formatKwh(kpis?.today.kwh ?? 0)}
            sub="energía entregada"
            color="#06b6d4"
            icon="⚡"
          />
        </div>
        {/* Month */}
        <div className="flex gap-2">
          <KpiCard
            label="Mes actual"
            value={formatCOP(kpis?.month.revenue ?? 0)}
            sub={`${kpis?.month.sessions ?? 0} sesiones`}
            color="#10b981"
            icon="📅"
          />
          <KpiCard
            label="kWh del mes"
            value={formatKwh(kpis?.month.kwh ?? 0)}
            sub={`${kpis?.week.sessions ?? 0} sesiones esta semana`}
            color="#8b5cf6"
            icon="📊"
          />
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* LEFT: Map */}
        <div className="flex-1 relative" style={{ minWidth: 0 }}>
          <MapView
            onMapReady={(map) => {
              setMapInstance(map);
              setMapReady(true);
              map.setCenter({ lat: 4.5709, lng: -74.2973 });
              map.setZoom(6);
              map.setOptions({
                styles: [
                  { elementType: "geometry", stylers: [{ color: "#0d1b2a" }] },
                  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
                  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
                  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
                  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
                  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a57" }] },
                  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
                  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
                  { featureType: "poi", stylers: [{ visibility: "off" }] },
                ],
                disableDefaultUI: true,
                zoomControl: true,
              });
            }}
          />
          {/* Map legend */}
          <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Estado de red</div>
            {(Object.entries(STATUS_LABELS) as [StationStatus, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2 text-xs mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                <span className="text-gray-300">{label}</span>
                <span className="text-gray-500 ml-auto font-mono">{byStatus[key].length}</span>
              </div>
            ))}
          </div>
          {/* Top stations overlay */}
          {data?.topStations && data.topStations.length > 0 && (
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-xl p-3 border border-white/10 min-w-48">
              <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">🏆 Top estaciones (mes)</div>
              {data.topStations.map((s, i) => (
                <div key={s.stationId} className="flex items-center gap-2 text-xs mb-1.5">
                  <span className="text-gray-500 font-mono w-4">{i + 1}.</span>
                  <span className="text-white truncate flex-1">{s.name}</span>
                  <span className="text-yellow-400 font-mono">{formatCOP(s.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Station cards */}
        <div
          className="border-l border-white/10 bg-[#06101e] overflow-y-auto"
          style={{ width: "380px", minWidth: "380px" }}
        >
          {/* Section header */}
          <div className="sticky top-0 bg-[#06101e] border-b border-white/10 px-4 py-2 z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Estaciones ({stations.length})
              </span>
              <div className="flex gap-2 text-xs">
                <span className="text-green-400">{byStatus.charging.length} ⚡</span>
                <span className="text-blue-400">{byStatus.available.length} ✓</span>
                <span className="text-red-400">{byStatus.offline.length} ✗</span>
              </div>
            </div>
          </div>

          {/* Hourly chart */}
          {data?.hourlyData && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Ingresos por hora (hoy)</div>
              <HourlyChart data={data.hourlyData} />
            </div>
          )}

          {/* Station cards */}
          <div className="p-3 flex flex-col gap-2">
            {isLoading && (
              <div className="text-center text-gray-500 py-8 text-sm">Cargando red...</div>
            )}
            {/* Charging first */}
            {byStatus.charging.map(s => <StationCard key={s.id} station={s} />)}
            {/* Available */}
            {byStatus.available.map(s => <StationCard key={s.id} station={s} />)}
            {/* Faulted */}
            {byStatus.faulted.map(s => <StationCard key={s.id} station={s} />)}
            {/* Offline */}
            {byStatus.offline.map(s => <StationCard key={s.id} station={s} />)}
            {/* Inactive */}
            {byStatus.inactive.map(s => <StationCard key={s.id} station={s} />)}
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div className="border-t border-white/10 bg-[#080f1f] px-4 py-2 flex items-center gap-4">
        <div className="shrink-0 flex items-center gap-2">
          <PulsingDot color="#22c55e" />
          <span className="text-xs text-green-400 font-medium uppercase tracking-wider">Actividad</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <ActivityTicker items={data.recentActivity} />
          ) : (
            <span className="text-xs text-gray-600">Sin actividad reciente</span>
          )}
        </div>
      </div>
    </div>
  );
}
