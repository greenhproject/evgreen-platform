import { useState } from "react";
import { AlertTriangle, ArrowRight, Ban, CheckSquare2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type BulkProjectStatus = "DRAFT" | "OPEN" | "IN_PROGRESS" | "FUNDED" | "COMPLETED" | "CANCELLED";

export type BulkExecutableAction =
  | { type: "PUBLISH" }
  | { type: "DELETE" }
  | { type: "CANCEL"; reason: string }
  | { type: "SET_STATUS"; status: BulkProjectStatus; reason?: string };

type PendingAction =
  | { type: "PUBLISH" }
  | { type: "DELETE" }
  | { type: "CANCEL" }
  | { type: "SET_STATUS"; status: BulkProjectStatus }
  | null;

type Props = {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  pending: boolean;
  onToggleVisible: () => void;
  onClear: () => void;
  onExecute: (action: BulkExecutableAction) => void;
};

const STATUS_OPTIONS: Array<{ value: BulkProjectStatus; label: string }> = [
  { value: "DRAFT", label: "Borrador" },
  { value: "OPEN", label: "Abierto" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "FUNDED", label: "Financiado" },
  { value: "COMPLETED", label: "Completado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export function CrowdfundingBulkActions({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  pending,
  onToggleVisible,
  onClear,
  onExecute,
}: Props) {
  const [targetStatus, setTargetStatus] = useState<BulkProjectStatus>("OPEN");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const hasSelection = selectedCount > 0;

  const isCancelAction = pendingAction?.type === "CANCEL" || (pendingAction?.type === "SET_STATUS" && pendingAction.status === "CANCELLED");
  const isDeleteAction = pendingAction?.type === "DELETE";
  const isReasonValid = !isCancelAction || cancellationReason.trim().length >= 10;

  const actionDescription = pendingAction?.type === "DELETE"
    ? "Se eliminarán definitivamente solo los proyectos en borrador o cancelados que no tengan participaciones, recaudo ni estación física. Los proyectos abiertos deben cancelarse primero."
    : isCancelAction
      ? "Los proyectos seleccionados pasarán a estado CANCELADO, dejando de estar abiertos al público y registrando la justificación y usuario responsable en la auditoría. Solo se cancelarán los proyectos sin dinero recaudado ni inversionistas."
      : pendingAction?.type === "PUBLISH"
        ? "Se publicarán únicamente borradores con meta, inversión mínima, potencia y número de cargadores completos."
        : `Se intentará aplicar el nuevo estado a ${selectedCount} proyecto(s). Las transiciones incompatibles o con actividad financiera se omitirán.`;

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "CANCEL") {
      onExecute({ type: "CANCEL", reason: cancellationReason.trim() });
    } else if (pendingAction.type === "SET_STATUS") {
      onExecute({
        type: "SET_STATUS",
        status: pendingAction.status,
        reason: pendingAction.status === "CANCELLED" ? cancellationReason.trim() : undefined,
      });
    } else {
      onExecute(pendingAction);
    }
    setPendingAction(null);
    setCancellationReason("");
  };

  return (
    <>
      <div className="sticky bottom-3 z-20 mb-3 rounded-xl border border-emerald-500/25 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onToggleVisible} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm font-medium hover:bg-muted">
              <Checkbox checked={allVisibleSelected} aria-label="Seleccionar todos los proyectos visibles" />
              <span>{allVisibleSelected ? "Quitar visibles" : `Seleccionar visibles (${visibleCount})`}</span>
            </button>
            {hasSelection && (
              <Button type="button" variant="ghost" size="sm" onClick={onClear} className="min-h-11 gap-1">
                <X className="h-4 w-4" /> Limpiar
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500/10 px-3 text-sm text-emerald-500">
              <CheckSquare2 className="h-4 w-4" />
              <strong>{selectedCount}</strong> seleccionado(s)
            </div>
            <Button type="button" variant="outline" disabled={!hasSelection || pending} onClick={() => setPendingAction({ type: "PUBLISH" })} className="min-h-11 gap-2">
              <ArrowRight className="h-4 w-4" /> Publicar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!hasSelection || pending}
              onClick={() => {
                setCancellationReason("");
                setPendingAction({ type: "CANCEL" });
              }}
              className="min-h-11 gap-2 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 border-amber-500/30"
            >
              <Ban className="h-4 w-4" /> Cancelar ({selectedCount})
            </Button>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
              <Select value={targetStatus} onValueChange={(value) => setTargetStatus(value as BulkProjectStatus)}>
                <SelectTrigger className="min-h-11 min-w-0 sm:w-44" aria-label="Nuevo estado masivo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                disabled={!hasSelection || pending}
                onClick={() => {
                  if (targetStatus === "CANCELLED") {
                    setCancellationReason("");
                    setPendingAction({ type: "CANCEL" });
                  } else {
                    setPendingAction({ type: "SET_STATUS", status: targetStatus });
                  }
                }}
                className="min-h-11"
              >
                Aplicar
              </Button>
            </div>
            <Button type="button" variant="destructive" disabled={!hasSelection || pending} onClick={() => setPendingAction({ type: "DELETE" })} className="min-h-11 gap-2">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => {
        if (!open) {
          setPendingAction(null);
          setCancellationReason("");
        }
      }}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isCancelAction ? <Ban className="h-5 w-5 text-amber-500" /> : isDeleteAction ? <AlertTriangle className="h-5 w-5 text-red-500" /> : null}
              Confirmar {isCancelAction ? "cancelación" : isDeleteAction ? "eliminación" : "acción"} sobre {selectedCount} proyecto(s)
            </AlertDialogTitle>
            <AlertDialogDescription>{actionDescription}</AlertDialogDescription>
          </AlertDialogHeader>

          {isCancelAction && (
            <div className="space-y-2 py-2">
              <Label htmlFor="bulk-cancel-reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Justificación administrativa de cancelación (obligatoria)
              </Label>
              <Textarea
                id="bulk-cancel-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ejemplo: Reemplazado por nueva ubicación, punto duplicado en prefactibilidad o cancelación acordada con el gestor..."
                className="min-h-[90px] text-sm"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mínimo 10 caracteres requeridos.</span>
                <span className={cancellationReason.trim().length >= 10 ? "text-emerald-500 font-medium" : "text-amber-500"}>
                  {cancellationReason.trim().length} / 10
                </span>
              </div>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="min-h-11">Cerrar</AlertDialogCancel>
            <AlertDialogAction
              className={`min-h-11 ${isCancelAction ? "bg-amber-600 hover:bg-amber-700 text-white" : isDeleteAction ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
              disabled={!isReasonValid}
              onClick={handleConfirm}
            >
              {isCancelAction ? "Confirmar Cancelación" : isDeleteAction ? "Confirmar Eliminación" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
