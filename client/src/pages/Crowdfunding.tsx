/**
 * EVGreen - Muro de Crowdfunding
 * Mapa interactivo de puntos de inversión para cargadores EV en Colombia
 * Muestra espacios publicados con scoring IA, datos de inversión, galería de fotos y contacto
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import {
  Zap, MapPin, TrendingUp, DollarSign, Battery, Users, Star,
  X, ExternalLink, MessageCircle, ChevronRight, Building2, Car,
  Loader2, Filter, BarChart3, ArrowRight, Camera, ChevronLeft,
  Image as ImageIcon,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface SpacePhoto {
  url: string;
  type: string;
  caption: string | null;
}

interface PublishedSpace {
  id: number;
  code: string;
  spaceName: string;
  spaceType: string;
  city: string;
  department: string | null;
  address: string;
  latitude: string | null;
  longitude: string | null;
  aiScore: number | null;
  aiAnalysis: string | null;
  estimatedInvestmentCop: number | null;
  estimatedPowerKw: number | null;
  estimatedChargerCount: number | null;
  recommendedChargerType: string | null;
  status: string;
  crowdfundingProjectId: number | null;
  socioeconomicStratum: number | null;
  estimatedDailyVehicles: number | null;
  parkingSpots: number | null;
  thumbnailUrl: string | null;
  photos: SpacePhoto[];
  crowdfunding: {
    raisedAmount: number;
    targetAmount: number;
    status: string;
  } | null;
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  parking: "Parqueadero",
  mall: "Centro comercial",
  gas_station: "Estación de servicio",
  hotel: "Hotel",
  restaurant: "Restaurante",
  office_building: "Oficinas",
  residential: "Residencial",
  supermarket: "Supermercado",
  hospital: "Hospital",
  university: "Universidad",
  airport: "Aeropuerto",
  highway_rest: "Parador",
  other: "Otro",
};

const PHOTO_TYPE_LABELS: Record<string, string> = {
  general: "Vista general",
  electrical_panel: "Tablero eléctrico",
  transformer: "Transformador",
  parking_area: "Área de parqueo",
  access_road: "Vía de acceso",
  surroundings: "Alrededores",
  other: "Otra",
};

function formatCOP(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString("es-CO")}`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30";
  if (score >= 60) return "bg-yellow-500/20 border-yellow-500/30";
  if (score >= 40) return "bg-orange-500/20 border-orange-500/30";
  return "bg-red-500/20 border-red-500/30";
}

function getFundingPercent(space: PublishedSpace): number {
  if (!space.crowdfunding) return 0;
  return Math.min(100, Math.round((space.crowdfunding.raisedAmount / space.crowdfunding.targetAmount) * 100));
}

// ============================================================================
// PHOTO GALLERY COMPONENT
// ============================================================================

function PhotoGallery({ photos }: { photos: SpacePhoto[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      {/* Thumbnail Grid */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
          <Camera className="w-4 h-4" />
          Fotos del espacio ({photos.length})
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setLightboxIdx(i)}
              className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer border border-[#1f2937] hover:border-emerald-500/40 transition-colors"
            >
              <img
                src={photo.url}
                alt={photo.caption || PHOTO_TYPE_LABELS[photo.type] || "Foto del espacio"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Photo type badge */}
              <div className="absolute bottom-1 left-1 right-1">
                <span className="text-[10px] bg-black/60 text-gray-300 px-1.5 py-0.5 rounded-md backdrop-blur-sm truncate block text-center">
                  {PHOTO_TYPE_LABELS[photo.type] || photo.type}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="relative w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Navigation arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIdx((lightboxIdx - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setLightboxIdx((lightboxIdx + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Image */}
            <img
              src={photos[lightboxIdx].url}
              alt={photos[lightboxIdx].caption || "Foto del espacio"}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />

            {/* Caption */}
            <div className="text-center mt-4">
              <span className="text-sm text-emerald-400 font-medium">
                {PHOTO_TYPE_LABELS[photos[lightboxIdx].type] || photos[lightboxIdx].type}
              </span>
              {photos[lightboxIdx].caption && (
                <p className="text-sm text-gray-400 mt-1">{photos[lightboxIdx].caption}</p>
              )}
              <p className="text-xs text-gray-600 mt-1">
                {lightboxIdx + 1} / {photos.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Crowdfunding() {
  const { data: spaces, isLoading } = trpc.spaces.listPublished.useQuery();
  const [selectedSpace, setSelectedSpace] = useState<PublishedSpace | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const filteredSpaces = useMemo(() => {
    if (!spaces) return [];
    if (filter === "all") return spaces as PublishedSpace[];
    return (spaces as PublishedSpace[]).filter(s => s.spaceType === filter);
  }, [spaces, filter]);

  // ========================================================================
  // MAP SETUP
  // ========================================================================
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Add markers when spaces load
  useEffect(() => {
    if (!mapRef.current || !filteredSpaces?.length) return;

    // Clear existing markers
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;

    filteredSpaces.forEach(space => {
      if (!space.latitude || !space.longitude) return;
      const lat = parseFloat(space.latitude);
      const lng = parseFloat(space.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const position = { lat, lng };
      bounds.extend(position);
      hasValidCoords = true;

      const fundingPct = getFundingPercent(space);
      const score = space.aiScore || 0;

      // Create custom marker element
      const markerEl = document.createElement("div");
      markerEl.className = "cursor-pointer";
      markerEl.innerHTML = `
        <div style="
          background: ${fundingPct >= 100 ? '#059669' : fundingPct >= 50 ? '#d97706' : '#10b981'};
          color: white;
          padding: 6px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          border: 2px solid ${fundingPct >= 100 ? '#047857' : fundingPct >= 50 ? '#b45309' : '#059669'};
        ">
          <span style="font-size:14px;">⚡</span>
          <span>${space.estimatedPowerKw || '?'}kW</span>
          ${score ? `<span style="opacity:0.8;font-size:10px;margin-left:2px;">${score}pts</span>` : ''}
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid ${fundingPct >= 100 ? '#059669' : fundingPct >= 50 ? '#d97706' : '#10b981'};
          margin: 0 auto;
        "></div>
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position,
        content: markerEl,
        title: space.spaceName,
      });

      marker.addListener("click", () => {
        setSelectedSpace(space);
      });

      markersRef.current.push(marker);
    });

    if (hasValidCoords) {
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [filteredSpaces]);

  // ========================================================================
  // WHATSAPP CONTACT
  // ========================================================================
  const contactAdvisor = (space: PublishedSpace) => {
    const message = encodeURIComponent(
      `Hola, estoy interesado en el punto de inversión "${space.spaceName}" en ${space.city} (Código: ${space.code}). Me gustaría recibir más información sobre las condiciones de inversión.`
    );
    window.open(`https://wa.me/573124567890?text=${message}`, "_blank");
  };

  // ========================================================================
  // PARSE AI ANALYSIS
  // ========================================================================
  const parseAIAnalysis = (analysis: string | null): any => {
    if (!analysis) return null;
    try {
      return JSON.parse(analysis);
    } catch {
      return null;
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-[#1f2937] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">EVGreen</span>
          </a>
          <div className="flex items-center gap-3">
            <a
              href="/postula-tu-espacio"
              className="text-sm text-emerald-400 hover:text-emerald-300 hidden sm:block"
            >
              Postula tu espacio
            </a>
            <Button
              onClick={() => contactAdvisor(selectedSpace || { spaceName: "la red EVGreen", city: "Colombia", code: "GENERAL" } as any)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Contactar asesor
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-emerald-600/10 to-transparent">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Invierte en la
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300"> movilidad eléctrica</span>
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto mb-6">
              Explora puntos de carga EV verificados y evaluados por IA en toda Colombia. 
              Cada punto ha sido aprobado técnicamente y cuenta con carta de intención firmada.
            </p>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">{spaces?.length || 0}</strong> puntos disponibles
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">
                    {(spaces as PublishedSpace[] | undefined)?.reduce((sum, s) => sum + (s.estimatedPowerKw || 0), 0) || 0}
                  </strong> kW totales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">
                    {new Set((spaces as PublishedSpace[] | undefined)?.map(s => s.city) || []).size}
                  </strong> ciudades
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: Map */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2">
              <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
              {["all", "parking", "mall", "gas_station", "hotel", "restaurant", "office_building"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    filter === f
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-[#111827] text-gray-400 border border-[#1f2937] hover:border-gray-600"
                  }`}
                >
                  {f === "all" ? "Todos" : SPACE_TYPE_LABELS[f] || f}
                </button>
              ))}
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-[#1f2937] h-[500px] lg:h-[600px]">
              <MapView
                onMapReady={handleMapReady}
                initialCenter={{ lat: 4.6, lng: -74.08 }}
                initialZoom={6}
              />
            </div>
          </div>

          {/* Right: List or Detail */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            ) : selectedSpace ? (
              <SpaceDetail
                space={selectedSpace}
                onClose={() => setSelectedSpace(null)}
                onContact={() => contactAdvisor(selectedSpace)}
                parseAI={parseAIAnalysis}
              />
            ) : filteredSpaces.length === 0 ? (
              <div className="text-center py-20">
                <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No hay puntos disponibles con este filtro</p>
              </div>
            ) : (
              filteredSpaces.map(space => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  onClick={() => {
                    setSelectedSpace(space);
                    if (space.latitude && space.longitude && mapRef.current) {
                      mapRef.current.panTo({
                        lat: parseFloat(space.latitude),
                        lng: parseFloat(space.longitude),
                      });
                      mapRef.current.setZoom(14);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* CTA bottom */}
        <div className="mt-8 text-center bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-emerald-600/10 rounded-2xl border border-emerald-500/20 p-8">
          <h3 className="text-xl font-bold text-white mb-2">¿Tienes un espacio ideal para un cargador?</h3>
          <p className="text-gray-400 mb-4 max-w-lg mx-auto">
            Postula tu espacio y recibe una evaluación técnica gratuita con IA. Si es viable, lo publicamos aquí para que inversionistas lo financien.
          </p>
          <a href="/postula-tu-espacio">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Building2 className="w-4 h-4 mr-2" />
              Postular mi espacio
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SPACE CARD
// ============================================================================

function SpaceCard({ space, onClick }: { space: PublishedSpace; onClick: () => void }) {
  const fundingPct = getFundingPercent(space);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#111827] border border-[#1f2937] rounded-xl p-4 hover:border-emerald-500/30 transition-all group"
    >
      {/* Thumbnail preview */}
      {space.thumbnailUrl && (
        <div className="relative w-full h-28 rounded-lg overflow-hidden mb-3">
          <img src={space.thumbnailUrl} alt={space.spaceName} className="w-full h-full object-cover" />
          {space.photos && space.photos.length > 1 && (
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Camera className="w-3 h-3" />
              {space.photos.length}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
            {space.spaceName}
          </h4>
          <p className="text-xs text-gray-500">
            {space.city}{space.department ? `, ${space.department}` : ""} · {SPACE_TYPE_LABELS[space.spaceType] || space.spaceType}
          </p>
        </div>
        {space.aiScore && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${getScoreBg(space.aiScore)}`}>
            <Star className="w-3 h-3" />
            <span className={getScoreColor(space.aiScore)}>{space.aiScore}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
        {space.estimatedPowerKw && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" />
            {space.estimatedPowerKw} kW
          </span>
        )}
        {space.estimatedChargerCount && (
          <span className="flex items-center gap-1">
            <Battery className="w-3 h-3 text-blue-400" />
            {space.estimatedChargerCount} cargadores
          </span>
        )}
        {space.estimatedInvestmentCop && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-yellow-400" />
            {formatCOP(space.estimatedInvestmentCop)}
          </span>
        )}
      </div>

      {space.crowdfunding && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Financiamiento</span>
            <span className="text-emerald-400 font-medium">{fundingPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-gradient-to-r from-emerald-500 to-green-400"
              style={{ width: `${fundingPct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ============================================================================
// SPACE DETAIL
// ============================================================================

function SpaceDetail({
  space,
  onClose,
  onContact,
  parseAI,
}: {
  space: PublishedSpace;
  onClose: () => void;
  onContact: () => void;
  parseAI: (analysis: string | null) => any;
}) {
  const aiData = parseAI(space.aiAnalysis);
  const fundingPct = getFundingPercent(space);

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="relative">
        {space.thumbnailUrl ? (
          <img src={space.thumbnailUrl} alt={space.spaceName} className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-emerald-600/30 to-green-800/30 flex items-center justify-center">
            <Zap className="w-12 h-12 text-emerald-400/50" />
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70"
        >
          <X className="w-4 h-4" />
        </button>
        {space.aiScore && (
          <div className={`absolute top-3 left-3 flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border backdrop-blur-sm ${getScoreBg(space.aiScore)}`}>
            <Star className="w-4 h-4" />
            <span className={getScoreColor(space.aiScore)}>{space.aiScore}/100</span>
          </div>
        )}
        {/* Photo count badge */}
        {space.photos && space.photos.length > 1 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
            <Camera className="w-3.5 h-3.5" />
            {space.photos.length} fotos
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Title */}
        <div>
          <h3 className="text-lg font-bold text-white">{space.spaceName}</h3>
          <p className="text-sm text-gray-400">
            {space.city}{space.department ? `, ${space.department}` : ""} · {SPACE_TYPE_LABELS[space.spaceType] || space.spaceType}
          </p>
          <p className="text-xs text-gray-500 mt-1">{space.address}</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          {space.estimatedInvestmentCop && (
            <div className="bg-[#0a0f1a] rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Inversión total</p>
              <p className="text-lg font-bold text-white">{formatCOP(space.estimatedInvestmentCop)}</p>
            </div>
          )}
          {space.estimatedPowerKw && (
            <div className="bg-[#0a0f1a] rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Potencia</p>
              <p className="text-lg font-bold text-emerald-400">{space.estimatedPowerKw} kW</p>
            </div>
          )}
          {space.estimatedChargerCount && (
            <div className="bg-[#0a0f1a] rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Cargadores</p>
              <p className="text-lg font-bold text-white">{space.estimatedChargerCount}</p>
            </div>
          )}
          {space.socioeconomicStratum && (
            <div className="bg-[#0a0f1a] rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Estrato</p>
              <p className="text-lg font-bold text-white">{space.socioeconomicStratum}</p>
            </div>
          )}
        </div>

        {/* Funding progress */}
        {space.crowdfunding && (
          <div className="bg-[#0a0f1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Progreso de financiamiento</span>
              <span className="text-sm font-bold text-emerald-400">{fundingPct}%</span>
            </div>
            <div className="w-full h-2 bg-[#1f2937] rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all"
                style={{ width: `${fundingPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{formatCOP(space.crowdfunding.raisedAmount)} recaudado</span>
              <span>Meta: {formatCOP(space.crowdfunding.targetAmount)}</span>
            </div>
          </div>
        )}

        {/* Photo Gallery */}
        <PhotoGallery photos={space.photos} />

        {/* AI Analysis */}
        {aiData && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              Análisis IA
            </h4>
            {aiData.summary && (
              <p className="text-sm text-gray-300">{aiData.summary}</p>
            )}
            {aiData.strengths && aiData.strengths.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Fortalezas</p>
                <ul className="space-y-1">
                  {aiData.strengths.slice(0, 3).map((s: string, i: number) => (
                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                      <span className="text-emerald-400 mt-0.5">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiData.investmentAppeal && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Atractivo para inversión:</span>
                <span className={`text-xs font-bold ${
                  aiData.investmentAppeal === "alto" ? "text-emerald-400" :
                  aiData.investmentAppeal === "medio" ? "text-yellow-400" : "text-red-400"
                }`}>
                  {aiData.investmentAppeal.charAt(0).toUpperCase() + aiData.investmentAppeal.slice(1)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={onContact}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Contactar asesor por WhatsApp
          </Button>
          <p className="text-xs text-gray-500 text-center">
            Un asesor te brindará toda la información sobre condiciones de inversión
          </p>
        </div>
      </div>
    </div>
  );
}
