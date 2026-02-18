import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  MapPin,
  Clock,
  Zap,
  Navigation,
  Phone,
  Calendar,
  ChevronRight,
  Star,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { AIInsightCard } from "@/components/AIInsightCard";

// Componente de tarifa dinámica del kWh
function DynamicPricingCard({ stationId }: { stationId: number }) {
  const { data: kwhPrice, isLoading } = trpc.transactions.getDynamicKwhPrice.useQuery(
    { stationId },
    { refetchInterval: 60000 } // Actualizar cada minuto
  );

  const getDemandColor = (level: string) => {
    switch (level) {
      case "LOW": return "text-green-400";
      case "NORMAL": return "text-blue-400";
      case "HIGH": return "text-orange-400";
      case "SURGE": return "text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getDemandBg = (level: string) => {
    switch (level) {
      case "LOW": return "bg-green-500/10 border-green-500/30";
      case "NORMAL": return "bg-blue-500/10 border-blue-500/30";
      case "HIGH": return "bg-orange-500/10 border-orange-500/30";
      case "SURGE": return "bg-red-500/10 border-red-500/30";
      default: return "bg-muted";
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-semibold mb-3">Tarifas</h3>
        <Card className="p-4 bg-card/50 backdrop-blur border-border/50 animate-pulse">
          <div className="h-32" />
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        Tarifas en tiempo real
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </h3>
      <Card className={`p-4 backdrop-blur border-2 ${kwhPrice ? getDemandBg(kwhPrice.factors.demandLevel) : 'bg-card/50 border-border/50'}`}>
        <div className="space-y-4">
          {/* Precio dinámico principal */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Precio actual por kWh</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${kwhPrice ? getDemandColor(kwhPrice.factors.demandLevel) : ''}`}>
                  ${kwhPrice?.dynamicPricePerKwh?.toLocaleString() || '---'}
                </span>
                <span className="text-muted-foreground">COP</span>
              </div>
            </div>
            {kwhPrice && (
              <div className="text-right">
                <div className={`text-sm font-medium ${getDemandColor(kwhPrice.factors.demandLevel)}`}>
                  {kwhPrice.demandVisualization?.message}
                </div>
                <div className={`text-lg font-bold ${getDemandColor(kwhPrice.factors.demandLevel)}`}>
                  {kwhPrice.demandVisualization?.savingsOrSurge}
                </div>
              </div>
            )}
          </div>

          {/* Comparación con precio base */}
          {kwhPrice && kwhPrice.multiplier !== 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Precio base:</span>
              <span className="line-through text-muted-foreground">
                ${kwhPrice.basePricePerKwh?.toLocaleString()} COP
              </span>
              <span className={getDemandColor(kwhPrice.factors.demandLevel)}>
                ({kwhPrice.multiplier > 1 ? '+' : ''}{Math.round((kwhPrice.multiplier - 1) * 100)}%)
              </span>
            </div>
          )}

          {/* Detalles de factores */}
          {kwhPrice && (
            <div className="pt-3 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tarifa de conexión</span>
                <span className="font-medium">$2,000 COP</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Penalización por ocupación</span>
                <span className="font-medium">$500 COP/min</span>
              </div>
            </div>
          )}

          {/* Indicador de validez */}
          {kwhPrice && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Info className="w-3 h-3" />
              <span>Precio válido por 15 min. Actualiza automáticamente.</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedEvse, setSelectedEvse] = useState<any>(null);
  const [reservationDate, setReservationDate] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("60");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");

  const stationId = parseInt(id || "0");

  const { data: station, isLoading } = trpc.stations.getById.useQuery({ 
    id: stationId 
  });
  
  // Obtener EVSEs de la estación
  const { data: evses } = trpc.stations.getEvses.useQuery(
    { stationId },
    { enabled: !!station }
  );

  // Obtener calificaciones reales de la estación
  const { data: reviewsData } = trpc.reviews.getByStation.useQuery(
    { stationId },
    { enabled: !!station }
  );

  const stationRating = reviewsData?.averageRating ?? null;
  const totalReviews = reviewsData?.totalReviews ?? 0;

  // Obtener tarifa dinámica
  const requestedDate = useMemo(() => {
    if (reservationDate && reservationTime) {
      return new Date(`${reservationDate}T${reservationTime}`);
    }
    return new Date();
  }, [reservationDate, reservationTime]);

  const { data: dynamicPrice, isLoading: priceLoading } = trpc.reservations.getDynamicPrice.useQuery(
    {
      stationId,
      evseId: selectedEvse?.id || 1,
      requestedDate,
      estimatedDurationMinutes: parseInt(estimatedDuration),
    },
    { enabled: !!selectedEvse && showReservationModal }
  );

  // Obtener predicción de mejores horarios
  const { data: bestTimes } = trpc.reservations.getBestTimes.useQuery(
    { stationId },
    { enabled: showReservationModal }
  );

  // Obtener ocupación de la zona
  const { data: occupancy } = trpc.reservations.getZoneOccupancy.useQuery(
    { stationId },
    { enabled: !!station }
  );

  // Mutación para crear review
  const utils = trpc.useUtils();
  const submitReview = trpc.reviews.create.useMutation({
    onSuccess: () => {
      toast.success("¡Gracias por tu calificación!");
      setShowReviewForm(false);
      setNewRating(0);
      setNewComment("");
      utils.reviews.getByStation.invalidate({ stationId });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar calificación");
    },
  });

  const handleSubmitReview = () => {
    if (newRating === 0) {
      toast.error("Selecciona una calificación");
      return;
    }
    submitReview.mutate({
      stationId,
      rating: newRating,
      comment: newComment || undefined,
    });
  };

  // Mutación para crear reserva
  const createReservation = trpc.reservations.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Reserva creada exitosamente. Tarifa: $${data.reservationFee.toLocaleString()} COP`);
      setShowReservationModal(false);
      setSelectedEvse(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleReserve = (evse: any) => {
    setSelectedEvse(evse);
    // Establecer fecha y hora por defecto (próxima hora)
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setReservationDate(now.toISOString().split("T")[0]);
    setReservationTime(now.toTimeString().slice(0, 5));
    setShowReservationModal(true);
  };

  const handleConfirmReservation = () => {
    if (!selectedEvse || !reservationDate || !reservationTime) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const startTime = new Date(`${reservationDate}T${reservationTime}`);
    const endTime = new Date(startTime.getTime() + parseInt(estimatedDuration) * 60 * 1000);

    createReservation.mutate({
      evseId: selectedEvse.id,
      stationId,
      startTime,
      endTime,
      estimatedDurationMinutes: parseInt(estimatedDuration),
    });
  };

  const getConnectorStatus = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      AVAILABLE: { bg: "bg-green-500/20", text: "text-green-400", label: "Disponible" },
      CHARGING: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      PREPARING: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      SUSPENDED_EV: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      SUSPENDED_EVSE: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      FINISHING: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      RESERVED: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Reservado" },
      FAULTED: { bg: "bg-red-500/20", text: "text-red-400", label: "Falla" },
      UNAVAILABLE: { bg: "bg-gray-500/20", text: "text-gray-400", label: "No disponible" },
    };
    return styles[status] || styles.UNAVAILABLE;
  };

  const getDemandIcon = (level: string) => {
    switch (level) {
      case "LOW": return <TrendingDown className="w-5 h-5" />;
      case "NORMAL": return <Minus className="w-5 h-5" />;
      case "HIGH": return <TrendingUp className="w-5 h-5" />;
      case "SURGE": return <AlertTriangle className="w-5 h-5" />;
      default: return <Minus className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <UserLayout title="Cargando..." showBack>
        <div className="p-4 space-y-4">
          <Card className="h-48 animate-pulse bg-muted" />
          <Card className="h-32 animate-pulse bg-muted" />
        </div>
      </UserLayout>
    );
  }

  if (!station) {
    return (
      <UserLayout title="Estación no encontrada" showBack>
        <div className="p-4 text-center py-12">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Esta estación no existe</p>
        </div>
      </UserLayout>
    );
  }

  const availableCount = evses?.filter((e: any) => e.status === "AVAILABLE").length || 0;

  return (
    <UserLayout title={station.name} showBack>
      <div className="pb-32">
        {/* Imagen/Mapa de la estación */}
        <div className="h-48 bg-gradient-to-br from-primary/20 to-secondary/20 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-16 h-16 text-primary/30" />
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
            <Badge className={availableCount > 0 ? "bg-primary" : "bg-muted"}>
              {availableCount} disponibles
            </Badge>
            {occupancy && (
              <Badge 
                variant="outline" 
                className={`
                  ${occupancy.occupancyRate < 30 ? "border-green-500 text-green-400" : ""}
                  ${occupancy.occupancyRate >= 30 && occupancy.occupancyRate < 70 ? "border-blue-500 text-blue-400" : ""}
                  ${occupancy.occupancyRate >= 70 ? "border-orange-500 text-orange-400" : ""}
                `}
              >
                {Math.round(occupancy.occupancyRate)}% ocupación
              </Badge>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Info básica */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
              <h2 className="text-xl font-bold mb-2">{station.name}</h2>
              <p className="text-muted-foreground flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4" />
                {station.address}, {station.city}
              </p>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {(() => {
                      const oh = (station as any).operatingHours;
                      if (!oh || (typeof oh === 'object' && Object.keys(oh).length === 0)) return 'Horario no configurado';
                      if (typeof oh === 'string') return oh;
                      const days = Object.values(oh) as any[];
                      const is24_7 = days.length === 7 && days.every((d: any) => d?.open === '00:00' && d?.close === '23:59');
                      if (is24_7) return '24/7';
                      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      const today = dayNames[new Date().getDay()];
                      const todayHours = (oh as any)[today];
                      if (todayHours?.closed) return 'Cerrado hoy';
                      return todayHours ? `Hoy: ${todayHours.open} - ${todayHours.close}` : 'Horario no configurado';
                    })()}
                  </span>
                </div>
                {stationRating !== null && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{stationRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({totalReviews})</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Indicador de demanda en tiempo real */}
          {occupancy && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className={`p-4 border-2 ${
                occupancy.occupancyRate < 30 ? "border-green-500/50 bg-green-500/10" :
                occupancy.occupancyRate < 70 ? "border-blue-500/50 bg-blue-500/10" :
                occupancy.occupancyRate < 90 ? "border-orange-500/50 bg-orange-500/10" :
                "border-red-500/50 bg-red-500/10"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {occupancy.occupancyRate < 30 ? (
                      <TrendingDown className="w-6 h-6 text-green-400" />
                    ) : occupancy.occupancyRate < 70 ? (
                      <Minus className="w-6 h-6 text-blue-400" />
                    ) : occupancy.occupancyRate < 90 ? (
                      <TrendingUp className="w-6 h-6 text-orange-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {occupancy.occupancyRate < 30 ? "Baja demanda" :
                         occupancy.occupancyRate < 70 ? "Demanda normal" :
                         occupancy.occupancyRate < 90 ? "Alta demanda" :
                         "Demanda muy alta"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {occupancy.availableConnectors} de {occupancy.totalConnectors} conectores libres
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      occupancy.occupancyRate < 30 ? "text-green-400" :
                      occupancy.occupancyRate < 70 ? "text-blue-400" :
                      occupancy.occupancyRate < 90 ? "text-orange-400" :
                      "text-red-400"
                    }`}>
                      {occupancy.occupancyRate < 30 ? "Ahorra 20%" :
                       occupancy.occupancyRate < 70 ? "Precio normal" :
                       occupancy.occupancyRate < 90 ? "+40% surge" :
                       "+100% surge"}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Conectores */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="font-semibold mb-3">Conectores disponibles</h3>
            <div className="space-y-3">
              {evses?.map((evse: any, index: number) => {
                const statusStyle = getConnectorStatus(evse.status);
                return (
                  <Card key={evse.id} className="p-4 bg-card/50 backdrop-blur border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${statusStyle.bg} flex items-center justify-center`}>
                          <Zap className={`w-6 h-6 ${statusStyle.text}`} />
                        </div>
                        <div>
                          <div className="font-medium">Conector {index + 1}</div>
                          <div className="text-sm text-muted-foreground">
                            {evse.connectorType?.replace("_", " ")} • {evse.powerKw} kW
                          </div>
                        </div>
                      </div>
                      <Badge className={`${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </Badge>
                    </div>
                    
                    {evse.status === "AVAILABLE" && (
                      <div className="mt-4 flex gap-2">
                        <Button
                          className="flex-1 gradient-primary text-white"
                          onClick={() => setLocation(`/start-charge?code=${station.ocppIdentity || station.id}`)}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Iniciar carga
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleReserve(evse)}
                          className="border-primary/50 hover:bg-primary/10"
                        >
                          <Calendar className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </motion.div>

          {/* Tarifas con Precio Dinámico */}
          <DynamicPricingCard stationId={stationId} />

          {/* Sugerencia de IA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <AIInsightCard 
              type="station" 
              stationId={stationId}
              onAskAI={(question) => {
                // Abrir el chat de IA con la pregunta
                const chatButton = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
                if (chatButton) chatButton.click();
              }}
            />
          </motion.div>

          {/* Información adicional */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  {station.description || "Estación de carga operada por EVGreen."}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Calificaciones y Opiniones */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4 bg-card/50 backdrop-blur border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Calificaciones y Opiniones
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowReviewForm(!showReviewForm)}
                >
                  {showReviewForm ? "Cancelar" : "Calificar"}
                </Button>
              </div>

              {/* Resumen de calificación */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{stationRating !== null ? stationRating.toFixed(1) : "--"}</div>
                  <div className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${stationRating !== null && s <= Math.round(stationRating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{totalReviews} opini{totalReviews === 1 ? "ón" : "ones"}</div>
                </div>
              </div>

              {/* Formulario de nueva calificación */}
              {showReviewForm && (
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-sm">Tu calificación</Label>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setNewRating(s)}
                          className="p-0.5"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${s <= newRating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30 hover:text-yellow-500/50"}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Comentario (opcional)</Label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Comparte tu experiencia..."
                      className="w-full mt-1 p-2 bg-background border border-border rounded-md text-sm resize-none h-20"
                      maxLength={1000}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full gradient-primary text-white"
                    onClick={handleSubmitReview}
                    disabled={submitReview.isPending || newRating === 0}
                  >
                    {submitReview.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Enviar calificación
                  </Button>
                </div>
              )}

              {/* Lista de opiniones */}
              {reviewsData?.reviews && reviewsData.reviews.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {reviewsData.reviews.slice(0, 5).map((review: any) => (
                    <div key={review.id} className="p-3 bg-muted/20 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                            {(review.userName || "U").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{review.userName || "Usuario"}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${s <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                      <div className="text-xs text-muted-foreground/60">
                        {new Date(review.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                      {review.ownerResponse && (
                        <div className="mt-2 pl-3 border-l-2 border-primary/50">
                          <span className="text-xs font-medium text-primary">Respuesta del operador:</span>
                          <p className="text-xs text-muted-foreground">{review.ownerResponse}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Aún no hay opiniones. ¡Sé el primero en calificar!
                </p>
              )}
            </Card>
          </motion.div>

          {/* Acciones rápidas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3"
          >
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <Navigation className="w-5 h-5" />
              <span className="text-xs">Cómo llegar</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
              <Phone className="w-5 h-5" />
              <span className="text-xs">Contactar</span>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Modal de Reserva con Tarifa Dinámica */}
      <Dialog open={showReservationModal} onOpenChange={setShowReservationModal}>
        <DialogContent className="w-[95vw] max-w-md mx-auto bg-background/95 backdrop-blur border-border/50 max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Reservar Cargador
            </DialogTitle>
            <DialogDescription>
              {selectedEvse && `Conector ${selectedEvse.connectorType?.replace("_", " ")} • ${selectedEvse.powerKw} kW`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selector de fecha */}
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="bg-background/50"
              />
            </div>

            {/* Selector de hora */}
            <div className="space-y-2">
              <Label>Hora de inicio</Label>
              <Input
                type="time"
                value={reservationTime}
                onChange={(e) => setReservationTime(e.target.value)}
                className="bg-background/50"
              />
            </div>

            {/* Duración estimada */}
            <div className="space-y-2">
              <Label>Duración estimada</Label>
              <Select value={estimatedDuration} onValueChange={setEstimatedDuration}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1.5 horas</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="180">3 horas</SelectItem>
                  <SelectItem value="240">4 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tarifa Dinámica */}
            <AnimatePresence mode="wait">
              {priceLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-6"
                >
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </motion.div>
              ) : dynamicPrice ? (
                <motion.div
                  key="price"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card className={`p-4 border-2 ${
                    dynamicPrice.visualization.level === "LOW" ? "border-green-500/50 bg-green-500/10" :
                    dynamicPrice.visualization.level === "NORMAL" ? "border-blue-500/50 bg-blue-500/10" :
                    dynamicPrice.visualization.level === "HIGH" ? "border-orange-500/50 bg-orange-500/10" :
                    "border-red-500/50 bg-red-500/10"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div style={{ color: dynamicPrice.visualization.color }}>
                          {getDemandIcon(dynamicPrice.visualization.level)}
                        </div>
                        <span className="font-medium text-sm sm:text-base">{dynamicPrice.visualization.message}</span>
                      </div>
                      <Badge 
                        variant="outline"
                        className="self-start sm:self-auto whitespace-nowrap"
                        style={{ 
                          borderColor: dynamicPrice.visualization.color,
                          color: dynamicPrice.visualization.color 
                        }}
                      >
                        {dynamicPrice.visualization.savingsOrSurge}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-muted-foreground text-xs">Precio base</span>
                        <span className="text-right text-xs">${dynamicPrice.basePrice.toLocaleString()} COP/kWh</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-muted-foreground text-xs">Precio dinámico</span>
                        <span className="text-right text-xs font-semibold" style={{ color: dynamicPrice.visualization.color }}>
                          ${dynamicPrice.finalPrice.toLocaleString()} COP/kWh
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-muted-foreground text-xs">Tarifa reserva</span>
                        <span className="text-right text-xs">${dynamicPrice.reservationFee.toLocaleString()} COP</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-border/50 grid grid-cols-2 gap-1 items-center">
                        <span className="font-medium text-sm">Total estimado</span>
                        <span className="text-right font-bold text-base" style={{ color: dynamicPrice.visualization.color }}>
                          ${dynamicPrice.estimatedTotal.toLocaleString()} COP
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="break-words">Penalización por no presentarse: ${dynamicPrice.noShowPenalty.toLocaleString()} COP</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Mejores horarios sugeridos */}
            {bestTimes && bestTimes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Mejores horarios para cargar</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {bestTimes
                    .filter(t => t.recommendation === "BEST")
                    .slice(0, 4)
                    .map((slot, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-green-500/50 text-green-400 hover:bg-green-500/10"
                        onClick={() => {
                          const d = new Date(slot.time);
                          setReservationDate(d.toISOString().split("T")[0]);
                          setReservationTime(d.toTimeString().slice(0, 5));
                        }}
                      >
                        {new Date(slot.time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="flex-1 order-2 sm:order-1"
              onClick={() => setShowReservationModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 gradient-primary text-white order-1 sm:order-2"
              onClick={handleConfirmReservation}
              disabled={createReservation.isPending || !dynamicPrice}
            >
              {createReservation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}
