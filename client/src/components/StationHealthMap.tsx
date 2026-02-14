/**
 * Mapa de Salud de Estaciones
 * 
 * Muestra las estaciones en un mapa con marcadores de colores
 * según su estado de salud:
 * - Verde: Online/Healthy
 * - Amarillo: Warning
 * - Rojo: Critical/Offline
 */

import { MapView } from "@/components/Map";
import { useRef, useState, useCallback } from "react";
import { Wifi, WifiOff, MapPin, Filter, Maximize2 } from "lucide-react";

interface StationHealth {
  stationId: number;
  stationName: string;
  ocppIdentity: string | null;
  isOnline: boolean;
  healthStatus: "healthy" | "warning" | "critical" | "offline";
  issue?: string;
  latitude: number | null;
  longitude: number | null;
  address?: string;
  city?: string;
}

interface StationHealthMapProps {
  stations: StationHealth[];
  className?: string;
}

// Colores para los marcadores según estado
const HEALTH_COLORS: Record<string, { bg: string; border: string; dot: string; glow: string }> = {
  healthy: { bg: "#10b981", border: "#059669", dot: "#34d399", glow: "rgba(16, 185, 129, 0.4)" },
  warning: { bg: "#f59e0b", border: "#d97706", dot: "#fbbf24", glow: "rgba(245, 158, 11, 0.4)" },
  critical: { bg: "#ef4444", border: "#dc2626", dot: "#f87171", glow: "rgba(239, 68, 68, 0.5)" },
  offline: { bg: "#6b7280", border: "#4b5563", dot: "#9ca3af", glow: "rgba(107, 114, 128, 0.3)" },
};

const HEALTH_LABELS: Record<string, string> = {
  healthy: "En línea",
  warning: "Advertencia",
  critical: "Crítico",
  offline: "Offline",
};

function createMarkerContent(station: StationHealth): HTMLElement {
  const colors = HEALTH_COLORS[station.healthStatus] || HEALTH_COLORS.offline;
  
  const container = document.createElement("div");
  container.style.cssText = `
    position: relative;
    cursor: pointer;
    transition: transform 0.2s ease;
  `;
  
  // Glow effect for critical stations
  if (station.healthStatus === "critical") {
    const glow = document.createElement("div");
    glow.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: ${colors.glow};
      animation: pulse-glow 2s ease-in-out infinite;
    `;
    container.appendChild(glow);
  }

  // Main marker pin
  const pin = document.createElement("div");
  pin.style.cssText = `
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50% 50% 50% 0;
    background: ${colors.bg};
    border: 3px solid ${colors.border};
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 1;
  `;

  // Inner icon
  const inner = document.createElement("div");
  inner.style.cssText = `
    transform: rotate(45deg);
    color: white;
    font-size: 14px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  inner.innerHTML = station.isOnline 
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/></svg>`;
  
  pin.appendChild(inner);
  container.appendChild(pin);

  // Add CSS animation for critical glow
  if (station.healthStatus === "critical") {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.3); }
      }
    `;
    container.appendChild(style);
  }

  container.addEventListener("mouseenter", () => {
    container.style.transform = "scale(1.15)";
  });
  container.addEventListener("mouseleave", () => {
    container.style.transform = "scale(1)";
  });

  return container;
}

function createInfoWindowContent(station: StationHealth): string {
  const colors = HEALTH_COLORS[station.healthStatus] || HEALTH_COLORS.offline;
  const label = HEALTH_LABELS[station.healthStatus] || "Desconocido";
  
  return `
    <div style="
      min-width: 240px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 4px;
    ">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${colors.bg};
          box-shadow: 0 0 6px ${colors.glow};
          flex-shrink: 0;
        "></div>
        <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a2e;">
          ${station.stationName}
        </h3>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #555;">
        <div style="display: flex; justify-content: space-between;">
          <span>Estado:</span>
          <span style="
            color: ${colors.bg};
            font-weight: 600;
            background: ${colors.glow};
            padding: 1px 8px;
            border-radius: 10px;
          ">${label}</span>
        </div>
        ${station.ocppIdentity ? `
        <div style="display: flex; justify-content: space-between;">
          <span>OCPP ID:</span>
          <span style="font-family: monospace; font-weight: 500;">${station.ocppIdentity}</span>
        </div>` : ""}
        ${station.address ? `
        <div style="display: flex; justify-content: space-between; gap: 8px;">
          <span style="flex-shrink: 0;">Dirección:</span>
          <span style="text-align: right;">${station.address}${station.city ? `, ${station.city}` : ""}</span>
        </div>` : ""}
        ${station.issue ? `
        <div style="
          margin-top: 6px;
          padding: 6px 8px;
          background: ${station.healthStatus === "critical" ? "#fef2f2" : "#fffbeb"};
          border-radius: 6px;
          color: ${station.healthStatus === "critical" ? "#dc2626" : "#d97706"};
          font-size: 11px;
          font-weight: 500;
        ">
          ⚠️ ${station.issue}
        </div>` : ""}
      </div>
    </div>
  `;
}

export function StationHealthMap({ stations, className }: StationHealthMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter stations with valid coordinates
  const stationsWithCoords = stations.filter(s => s.latitude !== null && s.longitude !== null);
  
  const filteredStations = filter === "all" 
    ? stationsWithCoords 
    : stationsWithCoords.filter(s => s.healthStatus === filter);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();
    
    addMarkers(map, stationsWithCoords);
  }, []);

  const addMarkers = (map: google.maps.Map, stationsToShow: StationHealth[]) => {
    // Clear existing markers
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current = [];

    if (stationsToShow.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    stationsToShow.forEach((station) => {
      if (station.latitude === null || station.longitude === null) return;

      const position = { lat: station.latitude, lng: station.longitude };
      bounds.extend(position);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: station.stationName,
        content: createMarkerContent(station),
      });

      marker.addListener("click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(createInfoWindowContent(station));
          infoWindowRef.current.open({
            anchor: marker,
            map,
          });
        }
      });

      markersRef.current.push(marker);
    });

    // Fit map to show all markers
    if (stationsToShow.length === 1) {
      map.setCenter({ lat: stationsToShow[0].latitude!, lng: stationsToShow[0].longitude! });
      map.setZoom(15);
    } else if (stationsToShow.length > 1) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  };

  // Update markers when filter changes
  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    if (mapRef.current) {
      const toShow = newFilter === "all" 
        ? stationsWithCoords 
        : stationsWithCoords.filter(s => s.healthStatus === newFilter);
      addMarkers(mapRef.current, toShow);
    }
  };

  // Count by status
  const counts = {
    all: stationsWithCoords.length,
    healthy: stationsWithCoords.filter(s => s.healthStatus === "healthy").length,
    warning: stationsWithCoords.filter(s => s.healthStatus === "warning").length,
    critical: stationsWithCoords.filter(s => s.healthStatus === "critical").length,
  };

  // Colombia center as default
  const defaultCenter = stationsWithCoords.length > 0
    ? { lat: stationsWithCoords[0].latitude!, lng: stationsWithCoords[0].longitude! }
    : { lat: 4.711, lng: -74.0721 };

  if (stationsWithCoords.length === 0) {
    return (
      <div className={`bg-card border rounded-xl p-8 text-center ${className || ""}`}>
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-muted-foreground">No hay estaciones con coordenadas configuradas</p>
        <p className="text-xs text-muted-foreground mt-1">
          Agrega latitud y longitud a las estaciones para verlas en el mapa
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${className || ""}`}>
      {/* Header con filtros */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-500" />
          Mapa de Estaciones
        </h2>
        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => handleFilterChange("all")}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                filter === "all" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas ({counts.all})
            </button>
            <button
              onClick={() => handleFilterChange("healthy")}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                filter === "healthy" ? "bg-background shadow-sm font-medium text-green-500" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {counts.healthy}
            </button>
            <button
              onClick={() => handleFilterChange("warning")}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                filter === "warning" ? "bg-background shadow-sm font-medium text-yellow-500" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              {counts.warning}
            </button>
            <button
              onClick={() => handleFilterChange("critical")}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                filter === "critical" ? "bg-background shadow-sm font-medium text-red-500" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {counts.critical}
            </button>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground p-1"
            title={isExpanded ? "Reducir mapa" : "Expandir mapa"}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Map */}
      <MapView
        className={isExpanded ? "h-[600px]" : "h-[400px]"}
        initialCenter={defaultCenter}
        initialZoom={stationsWithCoords.length === 1 ? 15 : 10}
        onMapReady={handleMapReady}
      />

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 p-3 border-t bg-muted/30">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500/30" />
          <span className="text-muted-foreground">En línea</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/30" />
          <span className="text-muted-foreground">Advertencia</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/30 animate-pulse" />
          <span className="text-muted-foreground">Crítico</span>
        </div>
      </div>
    </div>
  );
}
