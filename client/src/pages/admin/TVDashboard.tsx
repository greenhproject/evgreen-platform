/**
 * EVGreen NOC - Network Operations Center Dashboard
 * Panel de control de red para TV/pantalla grande y móvil.
 * Ruta: /admin/tv (sin AdminLayout - fullscreen)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";

// ─── tipos ────────────────────────────────────────────────────────────────────
type StationStatus = "charging" | "available" | "offline" | "faulted" | "inactive";

const STATUS_COLOR: Record<StationStatus, string> = {
  charging: "#22c55e",
  available: "#3b82f6",
  offline:   "#ef4444",
  faulted:   "#f97316",
  inactive:  "#6b7280",
};
const STATUS_LABEL: Record<StationStatus, string> = {
  charging: "Cargando",
  available: "Disponible",
  offline:   "Sin conexión",
  faulted:   "Falla",
  inactive:  "Inactiva",
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtKwh(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} MWh` : `${v.toFixed(1)} kWh`;
}
function fmtElapsed(start: Date | string) {
  const ms = Date.now() - new Date(start).getTime();
  const m  = Math.floor(ms / 60000);
  const h  = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

// ─── sub-components ───────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="text-right leading-tight">
      <div className="text-xl font-mono font-bold text-white tabular-nums">
        {t.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="text-[10px] text-gray-400 capitalize">
        {t.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
      </div>
    </div>
  );
}

function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {pulse && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />}
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border" style={{ borderColor: `${color}35`, backgroundColor: `${color}10` }}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium truncate">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono tabular-nums leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 truncate">{sub}</div>}
    </div>
  );
}

function StationCard({ s }: { s: any }) {
  const status = s.overallStatus as StationStatus;
  const color  = STATUS_COLOR[status];
  return (
    <div className="rounded-lg border p-2.5 flex flex-col gap-1.5" style={{ borderColor: `${color}35`, backgroundColor: `${color}0d` }}>
      {/* header */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="font-semibold text-white text-xs truncate">{s.name}</div>
          <div className="text-[10px] text-gray-500 truncate">{s.city}{s.department ? `, ${s.department}` : ""}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {status === "charging" && <Dot color={color} pulse />}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>
      {/* connectors */}
      <div className="flex gap-1 flex-wrap">
        {s.evses.map((e: any) => {
          const ec = e.isCharging ? "#22c55e" : e.status === "AVAILABLE" ? "#3b82f6" : e.status === "FAULTED" ? "#f97316" : "#6b7280";
          return (
            <span key={e.id} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: `${ec}40`, backgroundColor: `${ec}15`, color: ec }}>
              ⚡ {e.connectorType}{e.isCharging && e.currentTx ? ` · ${parseFloat(e.currentTx.kwhConsumed || "0").toFixed(1)} kWh` : ""}
            </span>
          );
        })}
      </div>
      {/* stats */}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>{s.chargingCount}/{s.totalEvses} activos</span>
        {s.totalPowerKw > 0 && <span className="text-green-400 font-mono">{s.totalPowerKw} kW</span>}
        {s.lastHeartbeat && <span>♥ {fmtElapsed(s.lastHeartbeat)}</span>}
      </div>
    </div>
  );
}

function HourlyBars({ data }: { data: Array<{ hour: number; revenue: number }> }) {
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div className="flex items-end gap-px h-10">
      {Array.from({ length: 24 }, (_, h) => {
        const d = data.find(x => x.hour === h);
        const pct = d ? Math.max(6, (d.revenue / max) * 100) : 0;
        return (
          <div key={h} className="flex-1 flex flex-col justify-end" title={d ? `${h}:00 · ${fmtCOP(d.revenue)}` : `${h}:00`}>
            <div className="w-full rounded-sm" style={{ height: `${pct}%`, backgroundColor: d ? "#22c55e" : "transparent", opacity: 0.75 }} />
          </div>
        );
      })}
    </div>
  );
}

function Ticker({ items }: { items: any[] }) {
  const ref  = useRef<HTMLDivElement>(null);
  const pos  = useRef(0);
  const raf  = useRef<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || items.length === 0) return;
    const animate = () => {
      pos.current += 0.5;
      const half = el.scrollWidth / 2;
      if (pos.current >= half) pos.current = 0;
      el.style.transform = `translateX(-${pos.current}px)`;
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [items.length]);

  const all = [...items, ...items];
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div ref={ref} className="inline-flex gap-6">
        {all.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs">
            <span className={item.status === "IN_PROGRESS" ? "text-green-400" : item.status === "COMPLETED" ? "text-blue-400" : "text-gray-500"}>
              {item.status === "IN_PROGRESS" ? "⚡" : item.status === "COMPLETED" ? "✓" : "·"}
            </span>
            <span className="text-white font-medium">{item.userName}</span>
            <span className="text-gray-500">en</span>
            <span className="text-green-300">{item.stationName}</span>
            {item.status === "COMPLETED" && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-yellow-400 font-mono">{fmtCOP(item.totalCost)}</span>
                <span className="text-gray-600">·</span>
                <span className="text-blue-300 font-mono">{item.kwhConsumed.toFixed(1)} kWh</span>
              </>
            )}
            {item.status === "IN_PROGRESS" && (
              <span className="text-green-400 font-mono">{fmtElapsed(item.startTime)}</span>
            )}
            <span className="text-gray-700 mx-3">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function TVDashboard() {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [countdown, setCountdown] = useState(15);
  const [isFS, setIsFS] = useState(false);

  const { data, isLoading, refetch } = trpc.noc.getNetworkSnapshot.useQuery(undefined, {
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // countdown timer
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { refetch(); return 15; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [refetch]);

  // map markers
  useEffect(() => {
    if (!mapRef.current || !data?.stations) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    data.stations.forEach(station => {
      if (!station.latitude || !station.longitude) return;
      const lat = parseFloat(String(station.latitude));
      const lng = parseFloat(String(station.longitude));
      if (isNaN(lat) || isNaN(lng)) return;
      const color = STATUS_COLOR[station.overallStatus as StationStatus];
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: mapRef.current!,
        title: station.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: station.overallStatus === "charging" ? 11 : 8,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      const iw = new google.maps.InfoWindow({
        content: `<div style="background:#111827;color:#fff;padding:8px 10px;border-radius:8px;font-family:sans-serif;min-width:160px;">
          <div style="font-weight:700;font-size:13px;">${station.name}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${station.city || ""}${station.department ? `, ${station.department}` : ""}</div>
          <div style="margin-top:6px;font-size:12px;color:${color};font-weight:600;">${STATUS_LABEL[station.overallStatus as StationStatus]}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">${station.chargingCount}/${station.totalEvses} conectores activos</div>
          ${station.totalPowerKw > 0 ? `<div style="font-size:11px;color:#22c55e;margin-top:2px;">⚡ ${station.totalPowerKw} kW</div>` : ""}
        </div>`,
      });
      marker.addListener("click", () => iw.open(mapRef.current!, marker));
      markersRef.current.push(marker);
    });
  }, [data?.stations]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setCenter({ lat: 4.5709, lng: -74.2973 });
    map.setZoom(6);
    map.setOptions({
      disableDefaultUI: true,
      zoomControl: true,
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
    });
  }, []);

  const toggleFS = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFS(true); }
    else { document.exitFullscreen(); setIsFS(false); }
  };

  const kpis = data?.kpis;
  const stations = data?.stations || [];
  const byStatus = {
    charging:  stations.filter(s => s.overallStatus === "charging"),
    available: stations.filter(s => s.overallStatus === "available"),
    faulted:   stations.filter(s => s.overallStatus === "faulted"),
    offline:   stations.filter(s => s.overallStatus === "offline"),
    inactive:  stations.filter(s => s.overallStatus === "inactive"),
  };
  const sorted = [...byStatus.charging, ...byStatus.available, ...byStatus.faulted, ...byStatus.offline, ...byStatus.inactive];

  return (
    <div className="flex flex-col bg-[#050d1a] text-white" style={{ height: "100dvh", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#080f1f] gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-green-500/20 flex items-center justify-center text-green-400 text-base">⚡</div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">EVGreen NOC</div>
            <div className="text-[10px] text-gray-500">Network Operations Center</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dot color="#22c55e" pulse />
          <span className="text-[11px] text-green-400 font-medium">EN VIVO</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-[11px] text-gray-500">↻ {countdown}s</span>
        </div>
        <div className="flex items-center gap-3">
          <LiveClock />
          <button onClick={toggleFS} className="text-gray-400 hover:text-white text-base" title="Pantalla completa">
            {isFS ? "⊡" : "⛶"}
          </button>
        </div>
      </header>

      {/* ── KPI BAR ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 px-3 py-2 border-b border-white/10 bg-[#06101e]">
        <KpiCard label="En línea"      value={String(kpis?.onlineStations ?? "—")}        sub={`de ${kpis?.totalStations ?? "—"}`}            color="#22c55e" icon="🟢" />
        <KpiCard label="Cargando"      value={String(kpis?.chargingStations ?? "—")}       sub={`${kpis?.activeSessionsCount ?? 0} sesiones`}  color="#3b82f6" icon="⚡" />
        <KpiCard label="Potencia"      value={`${kpis?.totalPowerDelivering ?? 0} kW`}     sub="ahora mismo"                                   color="#a78bfa" icon="🔋" />
        <KpiCard label="Alertas"       value={String((kpis?.offlineStations ?? 0) + (kpis?.faultedStations ?? 0))} sub={`${kpis?.offlineStations ?? 0} off · ${kpis?.faultedStations ?? 0} falla`} color={((kpis?.offlineStations ?? 0) + (kpis?.faultedStations ?? 0)) > 0 ? "#ef4444" : "#6b7280"} icon="⚠️" />
        <KpiCard label="Hoy $"         value={fmtCOP(kpis?.today.revenue ?? 0)}            sub={`${kpis?.today.sessions ?? 0} sesiones`}       color="#f59e0b" icon="💰" />
        <KpiCard label="Hoy kWh"       value={fmtKwh(kpis?.today.kwh ?? 0)}                sub="energía entregada"                             color="#06b6d4" icon="⚡" />
        <KpiCard label="Mes $"         value={fmtCOP(kpis?.month.revenue ?? 0)}            sub={`${kpis?.month.sessions ?? 0} sesiones`}       color="#10b981" icon="📅" />
        <KpiCard label="Mes kWh"       value={fmtKwh(kpis?.month.kwh ?? 0)}               sub={`${kpis?.week.sessions ?? 0} esta semana`}     color="#8b5cf6" icon="📊" />
      </div>

      {/* ── MAIN: mapa + panel ── */}
      {/* Mobile: stacked. Desktop: side-by-side */}
      <div className="flex flex-col lg:flex-row" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>

        {/* MAP — fills remaining height, never overflows */}
        <div className="relative" style={{ flex: "1 1 0", minHeight: "300px", overflow: "hidden" }}>
          <div className="w-full h-full relative">
            <MapView
              className="w-full h-full"
              onMapReady={handleMapReady}
            />
            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-sm rounded-lg p-2 border border-white/10 text-xs">
              <div className="text-gray-400 mb-1.5 text-[10px] uppercase tracking-wide font-medium">Estado</div>
              {(Object.entries(STATUS_LABEL) as [StationStatus, string][]).map(([k, l]) => (
                <div key={k} className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[k] }} />
                  <span className="text-gray-300">{l}</span>
                  <span className="text-gray-500 ml-auto pl-2 font-mono">{byStatus[k]?.length ?? 0}</span>
                </div>
              ))}
            </div>
            {/* Top stations */}
            {data?.topStations && data.topStations.length > 0 && (
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-sm rounded-lg p-2 border border-white/10 text-xs min-w-[160px]">
                <div className="text-gray-400 mb-1.5 text-[10px] uppercase tracking-wide font-medium">🏆 Top mes</div>
                {data.topStations.map((s, i) => (
                  <div key={s.stationId} className="flex items-center gap-1.5 mb-1">
                    <span className="text-gray-500 font-mono w-3">{i + 1}.</span>
                    <span className="text-white truncate flex-1 max-w-[100px]">{s.name}</span>
                    <span className="text-yellow-400 font-mono">{fmtCOP(s.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* STATION PANEL */}
        <div className="border-t lg:border-t-0 lg:border-l border-white/10 bg-[#06101e] overflow-y-auto lg:w-[360px] lg:shrink-0" style={{ maxHeight: "100%" }}>
          {/* sticky header */}
          <div className="sticky top-0 z-10 bg-[#06101e] border-b border-white/10 px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Estaciones ({stations.length})</span>
            <div className="flex gap-2 text-[10px]">
              <span className="text-green-400">{byStatus.charging.length} ⚡</span>
              <span className="text-blue-400">{byStatus.available.length} ✓</span>
              <span className="text-red-400">{byStatus.offline.length} ✗</span>
              {byStatus.faulted.length > 0 && <span className="text-orange-400">{byStatus.faulted.length} !</span>}
            </div>
          </div>

          {/* hourly chart */}
          {data?.hourlyData && data.hourlyData.length > 0 && (
            <div className="px-3 py-2 border-b border-white/10">
              <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Ingresos por hora (hoy)</div>
              <HourlyBars data={data.hourlyData} />
            </div>
          )}

          {/* cards */}
          <div className="p-2 flex flex-col gap-1.5">
            {isLoading && <div className="text-center text-gray-500 py-8 text-xs">Cargando red...</div>}
            {!isLoading && sorted.length === 0 && (
              <div className="text-center text-gray-600 py-8 text-xs">Sin estaciones registradas</div>
            )}
            {sorted.map(s => <StationCard key={s.id} s={s} />)}
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div className="border-t border-white/10 bg-[#080f1f] px-3 py-1.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <Dot color="#22c55e" pulse />
          <span className="text-[10px] text-green-400 font-medium uppercase tracking-wide">Actividad</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {data?.recentActivity && data.recentActivity.length > 0
            ? <Ticker items={data.recentActivity} />
            : <span className="text-[11px] text-gray-600">Sin actividad reciente</span>
          }
        </div>
      </div>
    </div>
  );
}
