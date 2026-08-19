import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ManualFormalizationAuditProps = {
  reason: string;
  evidence: string;
  formalizedAt: string | Date;
};

export function formatManualFormalizationDate(value: string | Date) {
  return new Date(value).toLocaleString("es-CO");
}

/** Resumen reutilizable que diferencia la aprobación interna de una firma externa. */
export function ManualFormalizationAudit({
  reason,
  evidence,
  formalizedAt,
}: ManualFormalizationAuditProps) {
  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
      <p className="font-medium text-amber-100">Formalización interna manual</p>
      <p className="mt-1 text-xs text-amber-100/85">
        Publicación excepcional registrada el {formatManualFormalizationDate(formalizedAt)}. La firma externa del cliente no fue sustituida.
      </p>
      <p className="mt-1 text-xs text-amber-100/85">Motivo: {reason}</p>
      <p className="mt-1 text-xs text-amber-100/85">Evidencia: {evidence}</p>
    </div>
  );
}

type ManualFormalizationFieldsProps = {
  reason: string;
  evidence: string;
  onReasonChange: (value: string) => void;
  onEvidenceChange: (value: string) => void;
};

export function ManualFormalizationFields({
  reason,
  evidence,
  onReasonChange,
  onEvidenceChange,
}: ManualFormalizationFieldsProps) {
  return (
    <div className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3">
      <p className="text-sm font-medium text-amber-100">Formalización interna excepcional</p>
      <p className="mt-1 text-xs text-amber-100/85">Esta acción no suplanta la firma del cliente. Registra que el negocio fue aprobado internamente y deja trazabilidad del responsable y motivo.</p>
      <Label className="mt-3 mb-1.5 block text-sm text-amber-100">Motivo de aprobación interna *</Label>
      <Textarea
        value={reason}
        onChange={event => onReasonChange(event.target.value)}
        placeholder="Ej.: Acuerdo comercial confirmado por canal interno; se autoriza avanzar con la publicación."
        className="min-h-24 border-amber-400/30 bg-slate-950/40 text-white placeholder:text-slate-500"
      />
      <Label className="mt-3 mb-1.5 block text-sm text-amber-100">Evidencia o referencia de aprobación *</Label>
      <Textarea
        value={evidence}
        onChange={event => onEvidenceChange(event.target.value)}
        placeholder="Ej.: Acta Comité Comercial 18-08-2026, correo de aprobación o enlace al soporte interno."
        className="min-h-20 border-amber-400/30 bg-slate-950/40 text-white placeholder:text-slate-500"
      />
    </div>
  );
}
