/**
 * EVGreen - Formulario Público de Postulación de Espacios
 * Permite a cualquier persona postular su espacio para instalar cargadores EV
 * Multi-paso con mapa interactivo y upload de fotos
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapView } from "@/components/Map";
import {
  Zap, MapPin, Building2, Camera, CheckCircle2, ArrowRight, ArrowLeft,
  Upload, X, Loader2, Phone, Mail, User, FileText, Clock, Wifi, Car,
  TrendingUp, Info, ChevronDown,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface PhotoFile {
  file: File;
  preview: string;
  photoType: string;
  caption: string;
}

interface FormData {
  // Step 1: Datos del postulante
  submitterName: string;
  submitterEmail: string;
  submitterPhone: string;
  submitterCompany: string;
  submitterDocument: string;
  // Step 2: Datos del espacio
  spaceName: string;
  spaceType: string;
  spaceTypeOther: string;
  address: string;
  city: string;
  department: string;
  latitude: string;
  longitude: string;
  // Step 3: Características técnicas
  availableAreaM2: string;
  parkingSpots: string;
  transformerCapacityKva: string;
  hasElectricalPanel: boolean;
  electricalDistance: string;
  hasInternet: boolean;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  is24Hours: boolean;
  // Step 4: Tráfico y contexto
  estimatedDailyVehicles: string;
  estimatedEvPercent: string;
  nearbyAttractions: string;
  socioeconomicStratum: string;
  // Step 5: Notas
  additionalNotes: string;
}

const INITIAL_FORM: FormData = {
  submitterName: "",
  submitterEmail: "",
  submitterPhone: "",
  submitterCompany: "",
  submitterDocument: "",
  spaceName: "",
  spaceType: "",
  spaceTypeOther: "",
  address: "",
  city: "",
  department: "",
  latitude: "",
  longitude: "",
  availableAreaM2: "",
  parkingSpots: "",
  transformerCapacityKva: "",
  hasElectricalPanel: false,
  electricalDistance: "",
  hasInternet: false,
  operatingHoursStart: "06:00",
  operatingHoursEnd: "22:00",
  is24Hours: false,
  estimatedDailyVehicles: "",
  estimatedEvPercent: "",
  nearbyAttractions: "",
  socioeconomicStratum: "",
  additionalNotes: "",
};

const SPACE_TYPES = [
  { value: "parking", label: "Parqueadero público", icon: "🅿️" },
  { value: "mall", label: "Centro comercial", icon: "🏬" },
  { value: "gas_station", label: "Estación de servicio", icon: "⛽" },
  { value: "hotel", label: "Hotel / hospedaje", icon: "🏨" },
  { value: "restaurant", label: "Restaurante", icon: "🍽️" },
  { value: "office_building", label: "Edificio de oficinas", icon: "🏢" },
  { value: "residential", label: "Conjunto residencial", icon: "🏘️" },
  { value: "supermarket", label: "Supermercado", icon: "🛒" },
  { value: "hospital", label: "Hospital / clínica", icon: "🏥" },
  { value: "university", label: "Universidad", icon: "🎓" },
  { value: "airport", label: "Aeropuerto", icon: "✈️" },
  { value: "highway_rest", label: "Parador en carretera", icon: "🛣️" },
  { value: "other", label: "Otro", icon: "📍" },
];

const PHOTO_TYPES = [
  { value: "general", label: "Vista general del espacio" },
  { value: "electrical_panel", label: "Tablero eléctrico" },
  { value: "transformer", label: "Transformador" },
  { value: "parking_area", label: "Área de parqueo" },
  { value: "access_road", label: "Vía de acceso" },
  { value: "surroundings", label: "Alrededores" },
  { value: "other", label: "Otra" },
];

const DEPARTMENTS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá",
  "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba",
  "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena",
  "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda",
  "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca",
  "Vaupés", "Vichada", "Bogotá D.C.",
];

const STEPS = [
  { id: 1, title: "Tus datos", icon: User, desc: "Información de contacto" },
  { id: 2, title: "El espacio", icon: MapPin, desc: "Ubicación y tipo" },
  { id: 3, title: "Técnico", icon: Zap, desc: "Especificaciones" },
  { id: 4, title: "Contexto", icon: TrendingUp, desc: "Tráfico y entorno" },
  { id: 5, title: "Fotos", icon: Camera, desc: "Evidencia visual" },
  { id: 6, title: "Enviar", icon: CheckCircle2, desc: "Confirmar datos" },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SpaceSubmission() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptsDataTreatment, setAcceptsDataTreatment] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const submitMutation = trpc.spaces.submit.useMutation();

  const updateForm = (field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // ========================================================================
  // MAP HANDLER
  // ========================================================================
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // Agregar click listener para seleccionar ubicación
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat().toFixed(8);
      const lng = e.latLng.lng().toFixed(8);

      setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));

      // Mover o crear marcador
      if (markerRef.current) {
        markerRef.current.position = e.latLng;
      } else {
        markerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: e.latLng,
          title: "Ubicación del espacio",
        });
      }

      // Reverse geocode para obtener dirección
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: e.latLng }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const addr = results[0].formatted_address;
          setForm(prev => ({ ...prev, address: addr }));
        }
      });
    });
  }, []);

  // ========================================================================
  // PHOTO HANDLERS
  // ========================================================================
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: PhotoFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} excede el límite de 10MB`);
        continue;
      }
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} no es una imagen válida`);
        continue;
      }
      newPhotos.push({
        file,
        preview: URL.createObjectURL(file),
        photoType: "general",
        caption: "",
      });
    }

    setPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const updatePhotoType = (index: number, type: string) => {
    setPhotos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], photoType: type };
      return updated;
    });
  };

  const updatePhotoCaption = (index: number, caption: string) => {
    setPhotos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], caption };
      return updated;
    });
  };

  // ========================================================================
  // SUBMIT
  // ========================================================================
  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Convertir fotos a base64
      const photosBase64 = await Promise.all(
        photos.map(async (photo) => {
          const buffer = await photo.file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          return {
            base64,
            fileName: photo.file.name,
            contentType: photo.file.type,
            photoType: photo.photoType as any,
            caption: photo.caption || undefined,
          };
        })
      );

      const result = await submitMutation.mutateAsync({
        ...form,
        spaceType: form.spaceType as any,
        parkingSpots: form.parkingSpots ? parseInt(form.parkingSpots) : undefined,
        electricalDistance: form.electricalDistance ? parseInt(form.electricalDistance) : undefined,
        estimatedDailyVehicles: form.estimatedDailyVehicles ? parseInt(form.estimatedDailyVehicles) : undefined,
        estimatedEvPercent: form.estimatedEvPercent ? parseInt(form.estimatedEvPercent) : undefined,
        socioeconomicStratum: form.socioeconomicStratum ? parseInt(form.socioeconomicStratum) : undefined,
        photos: photosBase64,
      });

      setSubmittedCode(result.code);
      toast.success("Postulación enviada exitosamente");
    } catch (err: any) {
      toast.error(err.message || "Error al enviar la postulación");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // VALIDATION
  // ========================================================================
  const validateStep = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        if (!form.submitterName.trim()) { toast.error("El nombre es requerido"); return false; }
        if (!form.submitterEmail.trim() || !form.submitterEmail.includes("@")) { toast.error("Email válido requerido"); return false; }
        if (!form.submitterPhone.trim() || form.submitterPhone.length < 7) { toast.error("Teléfono válido requerido"); return false; }
        return true;
      case 2:
        if (!form.spaceName.trim()) { toast.error("El nombre del espacio es requerido"); return false; }
        if (!form.spaceType) { toast.error("Seleccione el tipo de espacio"); return false; }
        if (!form.address.trim()) { toast.error("La dirección es requerida"); return false; }
        if (!form.city.trim()) { toast.error("La ciudad es requerida"); return false; }
        return true;
      case 3:
      case 4:
      case 5:
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 6));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ========================================================================
  // SUCCESS VIEW
  // ========================================================================
  if (submittedCode) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full bg-emerald-500/10 animate-ping" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Postulación Enviada
          </h1>
          <p className="text-gray-400 mb-8">
            Hemos recibido tu postulación. Nuestro equipo técnico la evaluará y te contactaremos pronto.
          </p>

          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 mb-8">
            <p className="text-sm text-gray-400 mb-2">Tu código de seguimiento</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">
              {submittedCode}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Guarda este código para consultar el estado de tu postulación
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(submittedCode);
                toast.success("Código copiado al portapapeles");
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Copiar código
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="w-full border-[#374151] text-gray-300 hover:bg-[#1f2937]"
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-[#1f2937] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">EVGreen</span>
          </a>
          <span className="text-sm text-gray-400 hidden sm:block">Postula tu espacio</span>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/10 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-6 relative">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">Red de carga EV en Colombia</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Genera ingresos pasivos con tu
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300"> espacio disponible</span>
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto text-base">
              Instala un cargador de vehículos eléctricos sin inversión y recibe el <strong className="text-emerald-300">10% del margen bruto</strong> de cada carga realizada en tu punto. Nosotros ponemos el equipo, la tecnología y la operación.
            </p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
            <div className="text-center bg-[#111827]/80 border border-[#1f2937] rounded-xl p-3">
              <p className="text-xl font-bold text-emerald-400">$0</p>
              <p className="text-xs text-gray-400">Inversión</p>
            </div>
            <div className="text-center bg-[#111827]/80 border border-[#1f2937] rounded-xl p-3">
              <p className="text-xl font-bold text-emerald-400">10%</p>
              <p className="text-xs text-gray-400">Margen bruto</p>
            </div>
            <div className="text-center bg-[#111827]/80 border border-[#1f2937] rounded-xl p-3">
              <p className="text-xl font-bold text-emerald-400">+207%</p>
              <p className="text-xs text-gray-400">Crec. EV 2024</p>
            </div>
          </div>
        </div>
      </div>

      {/* Value Proposition Section */}
      <div className="max-w-5xl mx-auto px-4 mb-8">
        <div className="bg-gradient-to-br from-[#111827] to-[#0d1525] border border-[#1f2937] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            ¿Qué recibes?
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">10% del margen bruto</p>
                <p className="text-xs text-gray-400">Por cada kWh vendido en tu punto (~$145 COP/kWh de margen)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Car className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Tráfico premium</p>
                <p className="text-xs text-gray-400">Conductores EV permanecen 30+ min mientras cargan</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Valorización del espacio</p>
                <p className="text-xs text-gray-400">Tu propiedad se posiciona como punto EV-friendly</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Cero mantenimiento</p>
                <p className="text-xs text-gray-400">EVGreen opera, mantiene y monitorea 24/7</p>
              </div>
            </div>
          </div>

          {/* Income Projection */}
          <div className="bg-[#0a0f1a] border border-[#374151] rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Proyección de ingresos (escenario realista)
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500 mb-1">Conservador</p>
                <p className="text-lg font-bold text-white">$87K</p>
                <p className="text-xs text-gray-400">COP/mes</p>
                <p className="text-[10px] text-gray-500">~4 cargas/día</p>
              </div>
              <div className="border-x border-[#374151]">
                <p className="text-xs text-gray-500 mb-1">Moderado</p>
                <p className="text-lg font-bold text-emerald-400">$174K</p>
                <p className="text-xs text-gray-400">COP/mes</p>
                <p className="text-[10px] text-gray-500">~8 cargas/día</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Optimista</p>
                <p className="text-lg font-bold text-white">$348K</p>
                <p className="text-xs text-gray-400">COP/mes</p>
                <p className="text-[10px] text-gray-500">~16 cargas/día</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
              * Basado en carga promedio de 15 kWh por sesión, margen bruto de ~$145 COP/kWh, participación del 10%. Cálculo: cargas/día × 15 kWh × $145 × 10% × 30 días.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[11px] text-amber-200/70 leading-relaxed">
              <strong className="text-amber-300">Importante:</strong> Los ingresos proyectados son estimaciones basadas en promedios del mercado y no constituyen una promesa de ingresos fijos. Los ingresos reales dependen de la ubicación, tráfico vehicular, demanda de carga EV y facturación efectiva del punto. EVGreen no garantiza un monto mínimo de ingresos.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-5xl mx-auto px-4 mb-8">
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">¿Cómo funciona?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-emerald-400">1</span>
              </div>
              <p className="text-sm font-medium text-white">Postulas</p>
              <p className="text-xs text-gray-400">Llenas este formulario con los datos de tu espacio</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-emerald-400">2</span>
              </div>
              <p className="text-sm font-medium text-white">Evaluamos</p>
              <p className="text-xs text-gray-400">Nuestro equipo técnico visita y evalúa la viabilidad</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-emerald-400">3</span>
              </div>
              <p className="text-sm font-medium text-white">Instalamos</p>
              <p className="text-xs text-gray-400">Instalamos el cargador sin costo para ti</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-emerald-400">4</span>
              </div>
              <p className="text-sm font-medium text-white">Generas</p>
              <p className="text-xs text-gray-400">Recibes el 10% del margen por cada carga</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-5xl mx-auto px-4 mb-8">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            return (
              <div key={s.id} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => {
                    if (isCompleted) setStep(s.id);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                    isActive
                      ? "bg-emerald-500/20 border border-emerald-500/30"
                      : isCompleted
                      ? "bg-emerald-500/5 border border-emerald-500/10 cursor-pointer hover:bg-emerald-500/10"
                      : "bg-[#111827]/50 border border-[#1f2937]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive
                      ? "bg-emerald-500 text-white"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-[#1f2937] text-gray-500"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className={`text-xs font-medium ${isActive ? "text-emerald-300" : isCompleted ? "text-emerald-400/70" : "text-gray-500"}`}>
                      Paso {s.id}
                    </p>
                    <p className={`text-sm ${isActive ? "text-white" : isCompleted ? "text-gray-300" : "text-gray-500"}`}>
                      {s.title}
                    </p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-4 sm:w-8 h-px mx-1 ${step > s.id ? "bg-emerald-500/40" : "bg-[#1f2937]"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-3xl mx-auto px-4 pb-24">
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 sm:p-8">
          {/* Step 1: Datos del postulante */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Tus datos de contacto</h2>
                <p className="text-sm text-gray-400">Necesitamos saber quién postula el espacio para contactarte.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-gray-300 mb-1.5 block">Nombre completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      value={form.submitterName}
                      onChange={e => updateForm("submitterName", e.target.value)}
                      placeholder="Ej: Juan Carlos Pérez"
                      className="pl-10 bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      type="email"
                      value={form.submitterEmail}
                      onChange={e => updateForm("submitterEmail", e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="pl-10 bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Teléfono *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      value={form.submitterPhone}
                      onChange={e => updateForm("submitterPhone", e.target.value)}
                      placeholder="300 123 4567"
                      className="pl-10 bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Empresa (opcional)</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      value={form.submitterCompany}
                      onChange={e => updateForm("submitterCompany", e.target.value)}
                      placeholder="Nombre de la empresa"
                      className="pl-10 bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">CC / NIT (opcional)</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      value={form.submitterDocument}
                      onChange={e => updateForm("submitterDocument", e.target.value)}
                      placeholder="1.234.567.890"
                      className="pl-10 bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Datos del espacio */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Información del espacio</h2>
                <p className="text-sm text-gray-400">Cuéntanos sobre el lugar donde quieres instalar el cargador.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-gray-300 mb-1.5 block">Nombre del lugar *</Label>
                  <Input
                    value={form.spaceName}
                    onChange={e => updateForm("spaceName", e.target.value)}
                    placeholder="Ej: Centro Comercial Andino, Parqueadero Central..."
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-gray-300 mb-1.5 block">Tipo de espacio *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SPACE_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => updateForm("spaceType", t.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                          form.spaceType === t.value
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : "bg-[#0a0f1a] border-[#374151] text-gray-400 hover:border-[#4b5563]"
                        }`}
                      >
                        <span>{t.icon}</span>
                        <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.spaceType === "other" && (
                  <div className="sm:col-span-2">
                    <Label className="text-gray-300 mb-1.5 block">Especifique el tipo</Label>
                    <Input
                      value={form.spaceTypeOther}
                      onChange={e => updateForm("spaceTypeOther", e.target.value)}
                      placeholder="Describa el tipo de espacio"
                      className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <Label className="text-gray-300 mb-1.5 block">Dirección *</Label>
                  <Input
                    value={form.address}
                    onChange={e => updateForm("address", e.target.value)}
                    placeholder="Calle, carrera, número..."
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Ciudad *</Label>
                  <Input
                    value={form.city}
                    onChange={e => updateForm("city", e.target.value)}
                    placeholder="Ej: Bogotá"
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Departamento</Label>
                  <Select value={form.department} onValueChange={v => updateForm("department", v)}>
                    <SelectTrigger className="bg-[#0a0f1a] border-[#374151] text-white">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2937] border-[#374151]">
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d} value={d} className="text-white">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mapa */}
              <div>
                <Label className="text-gray-300 mb-1.5 block">
                  Ubicación en el mapa
                  <span className="text-gray-500 text-xs ml-2">(Haz clic para marcar la ubicación)</span>
                </Label>
                <div className="rounded-xl overflow-hidden border border-[#374151]">
                  <MapView
                    className="h-[300px]"
                    initialCenter={{ lat: 4.7110, lng: -74.0721 }}
                    initialZoom={6}
                    onMapReady={handleMapReady}
                  />
                </div>
                {form.latitude && form.longitude && (
                  <p className="text-xs text-emerald-400 mt-2">
                    Coordenadas: {form.latitude}, {form.longitude}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Características técnicas */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Especificaciones técnicas</h2>
                <p className="text-sm text-gray-400">Estos datos nos ayudan a evaluar la viabilidad técnica. Completa lo que puedas.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 mb-1.5 block">Área disponible (m²)</Label>
                  <Input
                    type="number"
                    value={form.availableAreaM2}
                    onChange={e => updateForm("availableAreaM2", e.target.value)}
                    placeholder="Ej: 50"
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Puestos de parqueo disponibles</Label>
                  <Input
                    type="number"
                    value={form.parkingSpots}
                    onChange={e => updateForm("parkingSpots", e.target.value)}
                    placeholder="Ej: 4"
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Capacidad del transformador (kVA)</Label>
                  <Input
                    type="number"
                    value={form.transformerCapacityKva}
                    onChange={e => updateForm("transformerCapacityKva", e.target.value)}
                    placeholder="Ej: 150"
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Si no lo sabe, déjelo en blanco</p>
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Distancia tablero eléctrico (metros)</Label>
                  <Input
                    type="number"
                    value={form.electricalDistance}
                    onChange={e => updateForm("electricalDistance", e.target.value)}
                    placeholder="Ej: 20"
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                  />
                </div>

                <div className="flex items-center justify-between bg-[#0a0f1a] border border-[#374151] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm text-white">Tablero eléctrico accesible</p>
                      <p className="text-xs text-gray-500">¿Tiene tablero eléctrico cerca?</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.hasElectricalPanel}
                    onCheckedChange={v => updateForm("hasElectricalPanel", v)}
                  />
                </div>

                <div className="flex items-center justify-between bg-[#0a0f1a] border border-[#374151] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm text-white">Conexión a internet</p>
                      <p className="text-xs text-gray-500">WiFi o red cableada</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.hasInternet}
                    onCheckedChange={v => updateForm("hasInternet", v)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between bg-[#0a0f1a] border border-[#374151] rounded-xl px-4 py-3 mb-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-sm text-white">Operación 24 horas</p>
                        <p className="text-xs text-gray-500">¿El espacio está abierto todo el día?</p>
                      </div>
                    </div>
                    <Switch
                      checked={form.is24Hours}
                      onCheckedChange={v => updateForm("is24Hours", v)}
                    />
                  </div>

                  {!form.is24Hours && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 mb-1.5 block">Hora apertura</Label>
                        <Input
                          type="time"
                          value={form.operatingHoursStart}
                          onChange={e => updateForm("operatingHoursStart", e.target.value)}
                          className="bg-[#0a0f1a] border-[#374151] text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 mb-1.5 block">Hora cierre</Label>
                        <Input
                          type="time"
                          value={form.operatingHoursEnd}
                          onChange={e => updateForm("operatingHoursEnd", e.target.value)}
                          className="bg-[#0a0f1a] border-[#374151] text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Tráfico y contexto */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Tráfico y contexto</h2>
                <p className="text-sm text-gray-400">Esta información nos ayuda a estimar el potencial del punto de carga.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 mb-1.5 block">Vehículos diarios estimados</Label>
                  <div className="relative">
                    <Car className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      type="number"
                      value={form.estimatedDailyVehicles}
                      onChange={e => updateForm("estimatedDailyVehicles", e.target.value)}
                      placeholder="Ej: 500"
                      className="pl-10 bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">% vehículos eléctricos estimado</Label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={form.estimatedEvPercent}
                      onChange={e => updateForm("estimatedEvPercent", e.target.value)}
                      placeholder="Ej: 5"
                      className="pl-10 bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 mb-1.5 block">Estrato socioeconómico</Label>
                  <Select value={form.socioeconomicStratum} onValueChange={v => updateForm("socioeconomicStratum", v)}>
                    <SelectTrigger className="bg-[#0a0f1a] border-[#374151] text-white">
                      <SelectValue placeholder="Seleccione estrato..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2937] border-[#374151]">
                      {[1, 2, 3, 4, 5, 6].map(s => (
                        <SelectItem key={s} value={s.toString()} className="text-white">Estrato {s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-gray-300 mb-1.5 block">Puntos de interés cercanos</Label>
                  <Textarea
                    value={form.nearbyAttractions}
                    onChange={e => updateForm("nearbyAttractions", e.target.value)}
                    placeholder="Ej: Centro comercial a 200m, universidad a 500m, zona empresarial..."
                    rows={3}
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600 resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-gray-300 mb-1.5 block">Notas adicionales</Label>
                  <Textarea
                    value={form.additionalNotes}
                    onChange={e => updateForm("additionalNotes", e.target.value)}
                    placeholder="Cualquier información adicional que considere relevante..."
                    rows={3}
                    className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Fotos */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Fotos del espacio</h2>
                <p className="text-sm text-gray-400">
                  Sube fotos del espacio para que nuestro equipo pueda evaluarlo visualmente. 
                  Incluye vistas del área de parqueo, tablero eléctrico, transformador y alrededores.
                </p>
              </div>

              {/* Upload area */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#374151] rounded-2xl p-8 cursor-pointer hover:border-emerald-500/40 transition-colors">
                <Upload className="w-10 h-10 text-gray-500 mb-3" />
                <p className="text-sm text-gray-300 mb-1">Arrastra fotos aquí o haz clic para seleccionar</p>
                <p className="text-xs text-gray-500">JPG, PNG, WebP. Máximo 10MB por foto</p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              {/* Photo grid */}
              {photos.length > 0 && (
                <div className="space-y-4">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="flex gap-4 bg-[#0a0f1a] border border-[#374151] rounded-xl p-3">
                      <div className="relative w-24 h-24 flex-shrink-0">
                        <img
                          src={photo.preview}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Select value={photo.photoType} onValueChange={v => updatePhotoType(idx, v)}>
                          <SelectTrigger className="bg-[#111827] border-[#374151] text-white h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1f2937] border-[#374151]">
                            {PHOTO_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value} className="text-white text-sm">{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={photo.caption}
                          onChange={e => updatePhotoCaption(idx, e.target.value)}
                          placeholder="Descripción breve (opcional)"
                          className="bg-[#111827] border-[#374151] text-white placeholder:text-gray-600 h-9 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-[#0a0f1a] border border-[#374151] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-400">
                    <p className="font-medium text-gray-300 mb-1">Fotos recomendadas:</p>
                    <ul className="space-y-1">
                      <li>Vista general del espacio y área de parqueo</li>
                      <li>Tablero eléctrico (si es accesible)</li>
                      <li>Transformador eléctrico</li>
                      <li>Vía de acceso al espacio</li>
                      <li>Alrededores y contexto del lugar</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Confirmación */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Confirmar y enviar</h2>
                <p className="text-sm text-gray-400">Revisa los datos antes de enviar tu postulación.</p>
              </div>

              {/* Summary */}
              <div className="space-y-4">
                <SummarySection title="Datos de contacto">
                  <SummaryRow label="Nombre" value={form.submitterName} />
                  <SummaryRow label="Email" value={form.submitterEmail} />
                  <SummaryRow label="Teléfono" value={form.submitterPhone} />
                  {form.submitterCompany && <SummaryRow label="Empresa" value={form.submitterCompany} />}
                  {form.submitterDocument && <SummaryRow label="CC/NIT" value={form.submitterDocument} />}
                </SummarySection>

                <SummarySection title="Espacio">
                  <SummaryRow label="Nombre" value={form.spaceName} />
                  <SummaryRow label="Tipo" value={SPACE_TYPES.find(t => t.value === form.spaceType)?.label || form.spaceType} />
                  <SummaryRow label="Dirección" value={form.address} />
                  <SummaryRow label="Ciudad" value={form.city} />
                  {form.department && <SummaryRow label="Departamento" value={form.department} />}
                  {form.latitude && <SummaryRow label="Coordenadas" value={`${form.latitude}, ${form.longitude}`} />}
                </SummarySection>

                <SummarySection title="Especificaciones técnicas">
                  {form.availableAreaM2 && <SummaryRow label="Área" value={`${form.availableAreaM2} m²`} />}
                  {form.parkingSpots && <SummaryRow label="Parqueos" value={form.parkingSpots} />}
                  {form.transformerCapacityKva && <SummaryRow label="Transformador" value={`${form.transformerCapacityKva} kVA`} />}
                  <SummaryRow label="Tablero eléctrico" value={form.hasElectricalPanel ? "Sí" : "No"} />
                  <SummaryRow label="Internet" value={form.hasInternet ? "Sí" : "No"} />
                  <SummaryRow label="Horario" value={form.is24Hours ? "24 horas" : `${form.operatingHoursStart} - ${form.operatingHoursEnd}`} />
                </SummarySection>

                {(form.estimatedDailyVehicles || form.socioeconomicStratum) && (
                  <SummarySection title="Contexto">
                    {form.estimatedDailyVehicles && <SummaryRow label="Vehículos/día" value={form.estimatedDailyVehicles} />}
                    {form.estimatedEvPercent && <SummaryRow label="% EV estimado" value={`${form.estimatedEvPercent}%`} />}
                    {form.socioeconomicStratum && <SummaryRow label="Estrato" value={form.socioeconomicStratum} />}
                  </SummarySection>
                )}

                {photos.length > 0 && (
                  <SummarySection title={`Fotos (${photos.length})`}>
                    <div className="flex gap-2 flex-wrap">
                      {photos.map((p, i) => (
                        <img key={i} src={p.preview} alt={`Foto ${i + 1}`} className="w-16 h-16 object-cover rounded-lg" />
                      ))}
                    </div>
                  </SummarySection>
                )}
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-sm text-emerald-300">
                  Al enviar esta postulación, nuestro equipo técnico evaluará tu espacio. 
                  Te contactaremos por email con el resultado de la evaluación. 
                  El proceso puede tomar entre 3 y 7 días hábiles.
                </p>
              </div>

              {/* Data Treatment Consent */}
              <div className="bg-[#0a0f1a] border border-[#374151] rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptsDataTreatment}
                    onChange={e => setAcceptsDataTreatment(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-[#374151] bg-[#111827] text-emerald-500 focus:ring-emerald-500 flex-shrink-0"
                  />
                  <span className="text-xs text-gray-400 leading-relaxed">
                    Autorizo a EVGreen S.A.S. el tratamiento de mis datos personales conforme a la Ley 1581 de 2012 y su Decreto Reglamentario 1377 de 2013. Mis datos serán utilizados para evaluar la viabilidad del espacio postulado, contactarme con información sobre el programa, y enviar comunicaciones comerciales relacionadas. Puedo ejercer mis derechos de acceso, corrección, supresión y revocatoria escribiendo a <strong className="text-gray-300">datos@evgreen.lat</strong>.
                  </span>
                </label>
              </div>

              {/* Income disclaimer */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <p className="text-[11px] text-amber-200/70 leading-relaxed">
                  <strong className="text-amber-300">Aviso legal:</strong> La participación del 10% sobre el margen bruto está sujeta a la firma de un contrato de comodato o alianza comercial. Los ingresos dependen exclusivamente de la facturación real del punto de carga y no constituyen una renta fija garantizada. EVGreen se reserva el derecho de evaluar y aprobar los espacios según criterios técnicos y comerciales.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1f2937]">
            {step > 1 ? (
              <Button
                variant="outline"
                onClick={prevStep}
                className="border-[#374151] text-gray-300 hover:bg-[#1f2937]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
            ) : (
              <div />
            )}

            {step < 6 ? (
              <Button
                onClick={nextStep}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Siguiente
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !acceptsDataTreatment}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-8 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Enviar Postulación
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0f1a] border border-[#374151] rounded-xl p-4">
      <h3 className="text-sm font-medium text-emerald-400 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
