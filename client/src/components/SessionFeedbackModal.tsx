/**
 * SessionFeedbackModal - Modal de calificación post-carga
 * 
 * Se muestra automáticamente al terminar una sesión de carga.
 * Permite calificar con emojis (1-5) y dejar un comentario opcional.
 * Persiste en BD y notifica al admin si la calificación es baja (1-2).
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X, Send, Star } from "lucide-react";

interface SessionFeedbackModalProps {
  transactionId: number;
  stationId?: number;
  stationName?: string;
  onClose: () => void;
}

const RATINGS = [
  { value: 1, emoji: "😞", label: "Muy mala" },
  { value: 2, emoji: "😕", label: "Mala" },
  { value: 3, emoji: "😐", label: "Regular" },
  { value: 4, emoji: "😊", label: "Buena" },
  { value: 5, emoji: "🤩", label: "Excelente" },
];

export default function SessionFeedbackModal({
  transactionId,
  stationId,
  stationName,
  onClose,
}: SessionFeedbackModalProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        // Ya enviado antes, cerrar silenciosamente
        onClose();
        return;
      }
      toast.error("No se pudo enviar tu calificación. Inténtalo de nuevo.");
    },
  });

  const handleSubmit = () => {
    if (!selectedRating) {
      toast.error("Por favor selecciona una calificación.");
      return;
    }
    submitFeedback.mutate({
      transactionId,
      rating: selectedRating,
      comment: comment.trim() || undefined,
      stationId,
    });
  };

  // Pantalla de agradecimiento tras enviar
  if (submitted) {
    const chosen = RATINGS.find((r) => r.value === selectedRating);
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[#0f1a12] border border-emerald-800/40 rounded-t-3xl p-8 text-center animate-in slide-in-from-bottom-4 duration-300">
          <div className="text-6xl mb-4">{chosen?.emoji ?? "⭐"}</div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Gracias por tu opinión!</h2>
          <p className="text-emerald-400 text-sm mb-6">
            Tu feedback nos ayuda a mejorar la red de carga EVGreen.
          </p>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold"
            onClick={onClose}
          >
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f1a12] border border-emerald-800/40 rounded-t-3xl p-6 animate-in slide-in-from-bottom-4 duration-300">
        {/* Handle bar */}
        <div className="w-10 h-1 bg-emerald-800/60 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-lg font-bold text-white">¿Cómo fue tu experiencia?</h2>
            {stationName && (
              <p className="text-xs text-emerald-500 mt-0.5">{stationName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          Califica tu sesión de carga · Sesión #{transactionId}
        </p>

        {/* Emoji ratings */}
        <div className="flex justify-between gap-2 mb-6">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelectedRating(r.value)}
              className={`flex flex-col items-center gap-1.5 flex-1 py-3 rounded-2xl border transition-all duration-200 ${
                selectedRating === r.value
                  ? "border-emerald-500 bg-emerald-900/40 scale-105 shadow-lg shadow-emerald-900/30"
                  : "border-gray-700/50 bg-gray-900/30 hover:border-gray-600"
              }`}
            >
              <span className="text-3xl leading-none">{r.emoji}</span>
              <span
                className={`text-[10px] font-medium ${
                  selectedRating === r.value ? "text-emerald-400" : "text-gray-500"
                }`}
              >
                {r.label}
              </span>
            </button>
          ))}
        </div>

        {/* Star indicator */}
        {selectedRating && (
          <div className="flex justify-center gap-1 mb-5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${
                  s <= selectedRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-700"
                }`}
              />
            ))}
          </div>
        )}

        {/* Comment */}
        <div className="mb-5">
          <Textarea
            placeholder="¿Deseas dejar un comentario? (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 300))}
            className="bg-gray-900/50 border-gray-700/50 text-white placeholder:text-gray-600 resize-none text-sm min-h-[80px]"
            rows={3}
          />
          <p className="text-right text-xs text-gray-600 mt-1">{comment.length}/300</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            onClick={onClose}
          >
            Quizás después
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-semibold"
            onClick={handleSubmit}
            disabled={!selectedRating || submitFeedback.isPending}
          >
            {submitFeedback.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Enviar
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
