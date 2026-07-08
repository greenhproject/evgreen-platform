/**
 * AdminFeedback - Panel de administración de feedback de sesiones de carga
 * 
 * Muestra todas las calificaciones de usuarios con filtros por rating,
 * paginación, y resumen estadístico.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Star, ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, ThumbsUp } from "lucide-react";

const RATING_LABELS: Record<number, { emoji: string; label: string; color: string }> = {
  1: { emoji: "😞", label: "Muy mala", color: "text-red-400 bg-red-900/30 border-red-700/50" },
  2: { emoji: "😕", label: "Mala", color: "text-orange-400 bg-orange-900/30 border-orange-700/50" },
  3: { emoji: "😐", label: "Regular", color: "text-yellow-400 bg-yellow-900/30 border-yellow-700/50" },
  4: { emoji: "😊", label: "Buena", color: "text-emerald-400 bg-emerald-900/30 border-emerald-700/50" },
  5: { emoji: "🤩", label: "Excelente", color: "text-green-400 bg-green-900/30 border-green-700/50" },
};

function RatingBadge({ rating }: { rating: number }) {
  const r = RATING_LABELS[rating] ?? RATING_LABELS[3];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${r.color}`}>
      <span>{r.emoji}</span>
      <span>{r.label}</span>
    </span>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-700"}`}
        />
      ))}
    </div>
  );
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function AdminFeedback() {
  const [page, setPage] = useState(1);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [maxRating, setMaxRating] = useState<number | undefined>(undefined);

  const { data, isLoading } = trpc.feedback.adminList.useQuery({
    page,
    limit: 20,
    minRating,
    maxRating,
  });

  const { data: summary } = trpc.feedback.adminSummary.useQuery();

  // Calcular estadísticas globales
  const totalFeedbacks = summary?.reduce((acc, s) => acc + s.total, 0) ?? 0;
  const avgAll = summary && summary.length > 0
    ? (summary.reduce((acc, s) => acc + parseFloat(s.avgRating) * s.total, 0) / totalFeedbacks).toFixed(1)
    : null;
  const negativePct = summary
    ? Math.round(
        (summary.reduce((acc, s) => acc + s.distribution[1] + s.distribution[2], 0) / Math.max(totalFeedbacks, 1)) * 100
      )
    : 0;
  const positivePct = summary
    ? Math.round(
        (summary.reduce((acc, s) => acc + s.distribution[4] + s.distribution[5], 0) / Math.max(totalFeedbacks, 1)) * 100
      )
    : 0;

  const handleFilterChange = (type: "min" | "max", value: string) => {
    const num = value === "all" ? undefined : parseInt(value);
    if (type === "min") setMinRating(num);
    else setMaxRating(num);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
            Feedback de Sesiones
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Calificaciones de usuarios al terminar cada sesión de carga
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gray-900/50 border-gray-700/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-900/40 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Calificación promedio</p>
              <p className="text-2xl font-bold text-white">{avgAll ?? "—"}<span className="text-sm text-gray-500">/5</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-700/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-900/40 flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Experiencias positivas</p>
              <p className="text-2xl font-bold text-white">{positivePct}<span className="text-sm text-gray-500">%</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-700/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Experiencias negativas</p>
              <p className="text-2xl font-bold text-white">{negativePct}<span className="text-sm text-gray-500">%</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm text-gray-400">Filtrar por calificación:</span>
        <Select onValueChange={(v) => handleFilterChange("min", v)} defaultValue="all">
          <SelectTrigger className="w-40 bg-gray-900/50 border-gray-700/50 text-white">
            <SelectValue placeholder="Desde" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {[1, 2, 3, 4, 5].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {RATING_LABELS[r].emoji} {RATING_LABELS[r].label} ({r}★)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-gray-500 text-sm">hasta</span>
        <Select onValueChange={(v) => handleFilterChange("max", v)} defaultValue="all">
          <SelectTrigger className="w-40 bg-gray-900/50 border-gray-700/50 text-white">
            <SelectValue placeholder="Hasta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {[1, 2, 3, 4, 5].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {RATING_LABELS[r].emoji} {RATING_LABELS[r].label} ({r}★)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(minRating || maxRating) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={() => { setMinRating(undefined); setMaxRating(undefined); setPage(1); }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="bg-gray-900/50 border-gray-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center justify-between">
            <span>Calificaciones recientes</span>
            {data && (
              <span className="text-sm font-normal text-gray-400">{data.total} total</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : !data?.items.length ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No hay feedback con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {data.items.map((item) => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-shrink-0">
                    <RatingBadge rating={item.rating} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <StarRow rating={item.rating} />
                      <span className="text-xs text-gray-500">
                        Sesión #{item.transactionId}
                        {item.stationId && ` · Estación #${item.stationId}`}
                      </span>
                    </div>
                    {item.comment ? (
                      <p className="text-sm text-gray-300 mt-1 italic">"{item.comment}"</p>
                    ) : (
                      <p className="text-xs text-gray-600 mt-1">Sin comentario</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      <span>{item.userName ?? `Usuario #${item.userId}`}</span>
                      {item.userEmail && <span>{item.userEmail}</span>}
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Página {data.page} de {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-gray-700/50 text-gray-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="border-gray-700/50 text-gray-300"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
