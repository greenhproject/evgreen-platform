import { useState } from "react";
import { BatteryCharging, Gauge, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OperationalSocSession = {
  transactionId: number;
  soc: number | null;
  socSource: "charger" | "manual" | "power_detection" | "none" | string;
  currentKwh: number | string;
  currentPower?: number | null;
  manualSoc?: number | null;
  manualBatteryCapacityKwh?: number | null;
  energySinceCalibrationKwh?: number | null;
  manualSocCalibratedAt?: Date | string | null;
  manualSocAvailable?: boolean;
  manualSocUnavailableReason?: string | null;
  canCalibrateSoc?: boolean;
  calibrationPermissionReason?: string | null;
};

const SOC_SOURCE_LABEL: Record<string, string> = {
  charger: "OCPP real",
  manual: "Estimación AC",
  power_detection: "Carga completa detectada",
  none: "Sin lectura",
};

function parseNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function OperationalSocPanel({
  session,
  stationName,
  connectorLabel,
  onUpdated,
  compact = false,
  dark = false,
}: {
  session: OperationalSocSession;
  stationName: string;
  connectorLabel: string;
  onUpdated?: () => void | Promise<unknown>;
  compact?: boolean;
  dark?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [socValue, setSocValue] = useState("");
  const [batteryCapacity, setBatteryCapacity] = useState("");
  const utils = trpc.useUtils();

  const recalibrate = trpc.noc.recalibrateManualSoc.useMutation({
    onSuccess: async result => {
      toast.success(`SOC recalibrado a ${result.soc}% como valor absoluto`);
      setDialogOpen(false);
      await utils.noc.getNetworkSnapshot.invalidate();
      await onUpdated?.();
    },
    onError: error => toast.error(error.message),
  });

  const currentSoc = session.soc;
  const currentKwh = parseNumber(session.currentKwh);
  const currentPower = parseNumber(session.currentPower);
  const energySinceCalibration = parseNumber(session.energySinceCalibrationKwh);
  const sourceLabel = SOC_SOURCE_LABEL[session.socSource] ?? "Fuente desconocida";
  const unavailableReason = session.manualSocUnavailableReason
    ?? session.calibrationPermissionReason
    ?? "La recalibración no está disponible para esta sesión.";

  const openCalibration = () => {
    setSocValue(String(currentSoc ?? session.manualSoc ?? ""));
    setBatteryCapacity(session.manualBatteryCapacityKwh
      ? String(session.manualBatteryCapacityKwh)
      : "");
    setDialogOpen(true);
  };

  const submitCalibration = () => {
    const soc = Number(socValue);
    const capacity = batteryCapacity.trim() ? Number(batteryCapacity) : undefined;
    if (!Number.isFinite(soc) || soc < 0 || soc > 100) {
      toast.error("Ingrese un SOC válido entre 0% y 100%.");
      return;
    }
    if (capacity !== undefined && (!Number.isFinite(capacity) || capacity < 10 || capacity > 200)) {
      toast.error("La capacidad debe estar entre 10 y 200 kWh.");
      return;
    }
    recalibrate.mutate({
      transactionId: session.transactionId,
      soc,
      batteryCapacityKwh: capacity,
    });
  };

  return (
    <>
      <div
        className={cn(
          "rounded-lg border p-2.5",
          dark ? "border-white/10 bg-black/20" : "border-border bg-muted/25",
          compact ? "mt-1.5" : "mt-3"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums",
              currentSoc === null
                ? dark ? "border-gray-600 text-gray-400" : "border-muted-foreground/30 text-muted-foreground"
                : session.socSource === "charger"
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                  : "border-green-500/50 bg-green-500/10 text-green-400"
            )}>
              {currentSoc === null ? "—" : `${Math.round(currentSoc)}%`}
            </div>
            <div className="min-w-0">
              <div className={cn("flex items-center gap-1.5 text-xs font-semibold", dark ? "text-white" : "text-foreground")}>
                <BatteryCharging className="h-3.5 w-3.5 shrink-0" />
                <span>{currentSoc === null ? "SOC pendiente" : "Estado de carga"}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("h-5 px-1.5 text-[9px]", dark && "border-white/15 text-gray-300")}>
                  {sourceLabel}
                </Badge>
                <span className={cn("text-[10px]", dark ? "text-gray-400" : "text-muted-foreground")}>
                  {currentKwh.toFixed(2)} kWh
                  {currentPower > 0 ? ` · ${currentPower.toFixed(1)} kW` : ""}
                </span>
              </div>
              {session.socSource === "manual" && energySinceCalibration > 0 && (
                <p className={cn("mt-1 text-[10px]", dark ? "text-green-300" : "text-emerald-700 dark:text-emerald-400")}>
                  +{energySinceCalibration.toFixed(2)} kWh desde la última calibración
                </p>
              )}
            </div>
          </div>

          {session.canCalibrateSoc ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn("h-8 shrink-0 px-2 text-[10px]", dark && "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20")}
              onClick={openCalibration}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Recalibrar
            </Button>
          ) : (
            <span className={cn("max-w-[120px] text-right text-[9px] leading-tight", dark ? "text-gray-500" : "text-muted-foreground")} title={unavailableReason}>
              {session.socSource === "charger" ? "Protegido por OCPP" : "Solo lectura"}
            </span>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              Recalibrar SOC actual
            </DialogTitle>
            <DialogDescription>
              {stationName} · {connectorLabel}. El porcentaje ingresado reemplaza la estimación actual y no vuelve a sumar la energía ya cargada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`soc-${session.transactionId}`}>SOC que muestra el vehículo</Label>
              <div className="relative">
                <Input
                  id={`soc-${session.transactionId}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={1}
                  value={socValue}
                  onChange={event => setSocValue(event.target.value)}
                  className="pr-10 text-lg font-semibold"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`capacity-${session.transactionId}`}>Capacidad de batería (opcional)</Label>
              <div className="relative">
                <Input
                  id={`capacity-${session.transactionId}`}
                  type="number"
                  inputMode="decimal"
                  min={10}
                  max={200}
                  step={0.1}
                  value={batteryCapacity}
                  onChange={event => setBatteryCapacity(event.target.value)}
                  placeholder="Se conserva la capacidad conocida"
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kWh</span>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>La estimación continuará únicamente con la energía entregada después de esta calibración. En DC y cuando exista SOC OCPP real, la edición permanece bloqueada.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={recalibrate.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitCalibration} disabled={recalibrate.isPending || socValue.trim() === ""}>
              {recalibrate.isPending ? "Guardando…" : "Aplicar como valor absoluto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
