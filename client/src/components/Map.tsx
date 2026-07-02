/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - "map-attached" → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - "standalone" → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - "data-only" → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

// Use Google Maps API Key directly (set via VITE_GOOGLE_MAPS_API_KEY env var)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

let _mapScriptPromise: Promise<void> | null = null;

function loadMapScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (_mapScriptPromise) return _mapScriptPromise;
  _mapScriptPromise = new Promise<void>((resolve) => {
    // Check again in case it loaded between calls
    if (window.google?.maps) { resolve(); return; }
    // Check if script tag already exists
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      // If it already loaded
      if (window.google?.maps) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      _mapScriptPromise = null;
      resolve();
    };
    document.head.appendChild(script);
  });
  return _mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  mapTypeId?: string;
  onMapReady?: (map: google.maps.Map) => void;
}

// Estilos de modo nocturno para Google Maps
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a2a3e" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#5a5a6a" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#16213e" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a2540" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6a7a8a" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#0d3320" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3a8a5a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#253050" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a2540" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7a8a9a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a4060" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a3050" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#8a9aaa" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1a2540" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#6a7a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1628" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a5a7a" }] },
];

// Detectar si el tema oscuro está activo
function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function MapView({
  className,
  initialCenter = { lat: 4.7110, lng: -74.0721 },
  initialZoom = 12,
  mapTypeId = "roadmap",
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    await loadMapScript();
    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }
    if (!window.google?.maps) {
      console.error("Google Maps failed to load - check API key");
      return;
    }
    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeId: mapTypeId as google.maps.MapTypeId,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_LEFT,
        mapTypeIds: ["roadmap", "satellite", "hybrid"],
      },
      fullscreenControl: false,
      zoomControl: true,
      streetViewControl: true,
      mapId: "DEMO_MAP_ID",
    });

    // Aplicar estilos oscuros después de la inicialización si el tema es oscuro
    const darkMode = isDarkTheme();
    if (darkMode) {
      map.current.setOptions({ styles: DARK_MAP_STYLES });
    }

    // Escuchar cambios de tema del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (map.current) {
        map.current.setOptions({ styles: e.matches ? DARK_MAP_STYLES : [] });
      }
    };
    mediaQuery.addEventListener('change', handleThemeChange);

    if (onMapReady) {
      onMapReady(map.current);
    }

    // Trigger resize after a short delay to handle cases where the container
    // is inside a tab/conditional render and has zero size at mount time
    setTimeout(() => {
      if (map.current) {
        google.maps.event.trigger(map.current, 'resize');
      }
    }, 100);
    setTimeout(() => {
      if (map.current) {
        google.maps.event.trigger(map.current, 'resize');
      }
    }, 500);
  });

  useEffect(() => {
    init();
  }, [init]);

  // ResizeObserver: trigger map resize whenever the container changes size
  // This handles sidebar collapse/expand and tab switching on large screens
  useEffect(() => {
    if (!mapContainer.current) return;
    const observer = new ResizeObserver(() => {
      if (map.current) {
        google.maps.event.trigger(map.current, 'resize');
      }
    });
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
