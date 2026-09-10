import { useState } from "react";
import { ArrowRight, CheckSquare2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type PendingAction =
  | { type: "PUBLISH" }
  | { type: "DELETE" }
  | { type: "SET_STATUS"; status: BulkProjectStatus }
  | null;

type Props = {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  pending: boolean;
  onToggleVisible: () => void;
  onClear: () => void;
  onExecute: (action: Exclude<PendingAction, null>) => void;
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
  const hasSelection = selectedCount > 0;

  const actionDescription = pendingAction?.type === "DELETE"
    ? "Se eliminarán únicamente borradores o cancelados sin participaciones, recaudo ni estación física. Los demás se omitirán y se informará el motivo."
    : pendingAction?.type === "PUBLISH"
      ? "Se publicarán únicamente borradores con meta, inversión mínima, potencia y número de cargadores completos."
      : `Se intentará aplicar el nuevo estado a ${selectedCount} proyecto(s). Las transiciones incompatibles o con actividad financiera se omitirán.`;

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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
              <Select value={targetStatus} onValueChange={(value) => setTargetStatus(value as BulkProjectStatus)}>
                <SelectTrigger className="min-h-11 min-w-0 sm:w-44" aria-label="Nuevo estado masivo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!hasSelection || pending} onClick={() => setPendingAction({ type: "SET_STATUS", status: targetStatus })} className="min-h-11">
                Aplicar
              </Button>
            </div>
            <Button type="button" variant="destructive" disabled={!hasSelection || pending} onClick={() => setPendingAction({ type: "DELETE" })} className="min-h-11 gap-2">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción sobre {selectedCount} proyecto(s)</AlertDialogTitle>
            <AlertDialogDescription>{actionDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              onClick={() => {
                if (pendingAction) onExecute(pendingAction);
                setPendingAction(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
