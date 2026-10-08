import { useMemo, useState } from "react";
import { Copy, Loader2, Plus, QrCode, Save, Settings2, Unplug } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StationQRCode } from "@/components/StationQRCode";
import { toast } from "sonner";

type StationSummary = {
  id: number;
  name: string;
  ocppIdentity?: string | null;
  evses?: Array<{
    id: number;
    connectorId?: number | null;
    evseIdLocal?: number | null;
    connectorLabel?: string | null;
    connectorType?: string | null;
    powerKw?: string | number | null;
  }>;
};

type DraftCharger = {
  chargerCode: string;
  displayName: string;
  ocppIdentity: string;
  maxConcurrentSessions: string;
  manufacturer: string;
  model: string;
  powerKw: string;
};

const emptyDraft = (station: StationSummary): DraftCharger => ({
  chargerCode: "",
  displayName: "",
  // Puede conservarse el identificador de estación en instalaciones OCPP 1.6
  // que exponen sus salidas bajo una misma identidad; el equipo técnico puede
  // cambiarlo si cada gabinete registra su propia identidad.
  ocppIdentity: station.ocppIdentity || "",
  maxConcurrentSessions: "1",
  manufacturer: "",
  model: "",
  powerKw: "",
});

export function ChargerHierarchyManager({ station }: { station: StationSummary }) {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<DraftCharger>(() => emptyDraft(station));
  const [assignmentByConnector, setAssignmentByConnector] = useState<Record<number, { chargerId: string; label: string }>>({});
  const [editingByCharger, setEditingByCharger] = useState<Record<number, { code: string; name: string; capacity: string }>>({});
  const [connectorQrPreview, setConnectorQrPreview] = useState<{ token: string; label: string } | null>(null);

  const hierarchyQuery = trpc.chargers.listByStation.useQuery(
    { stationId: station.id },
    { refetchOnWindowFocus: true },
  );

  const refresh = async () => {
    await Promise.all([
      utils.chargers.listByStation.invalidate({ stationId: station.id }),
      utils.stations.listAll.invalidate(),
      utils.stations.getEvses.invalidate({ stationId: station.id }),
    ]);
  };

  const createCharger = trpc.chargers.create.useMutation({
    onSuccess: async () => {
      toast.success("Cargador físico creado. Ahora asigna sus salidas.");
      setDraft(emptyDraft(station));
      setShowCreate(false);
      await refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo crear el cargador."),
  });

  const updateCharger = trpc.chargers.update.useMutation({
    onSuccess: async () => {
      toast.success("Configuración del cargador actualizada.");
      await refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo actualizar el cargador."),
  });

  const assignConnector = trpc.chargers.assignConnector.useMutation({
    onSuccess: async () => {
      toast.success("Pistola asignada al cargador físico.");
      await refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo asignar la pistola."),
  });

  const regenerateQr = trpc.chargers.regenerateConnectorQr.useMutation({
    onSuccess: async ({ qrToken, evseId }) => {
      const code = encodeURIComponent(String(station.ocppIdentity || station.id));
      const url = `${window.location.origin}/c/${code}?connector=${encodeURIComponent(qrToken)}`;
      const connector = groups.flatMap((group: any) => group.connectors ?? []).find((entry: any) => entry.id === evseId);
      setConnectorQrPreview({ token: qrToken, label: connector?.label || "Conector" });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("QR específico generado: el enlace fue copiado para impresión.");
      } catch {
        toast.success("QR específico generado. Cópialo desde la consola administrativa.");
        console.info("[EVGreen] Connector QR URL", url);
      }
      await refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo generar el QR."),
  });

  const groups = hierarchyQuery.data ?? [];
  const physicalChargers = useMemo(() => groups.filter((group: any) => !group.isLegacyUnassigned), [groups]);
  const legacyGroup = useMemo(() => groups.find((group: any) => group.isLegacyUnassigned), [groups]);
  const legacyConnectors = legacyGroup?.connectors ?? [];

  const editorFor = (charger: any) => editingByCharger[charger.id] ?? {
    code: charger.chargerCode || "",
    name: charger.displayName || charger.label || "",
    capacity: String(charger.concurrentCapacity || 1),
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="flex items-center gap-2 font-semibold">
            <Settings2 className="h-4 w-4 text-primary" />
            Jerarquía física y QR por pistola
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Estación → gabinete físico → salida. La capacidad concurrente determina cuántos vehículos pueden cargar al mismo tiempo en cada equipo.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setShowCreate((visible) => !visible)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo cargador
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="charger-code">Código físico</Label>
              <Input id="charger-code" value={draft.chargerCode} onChange={(event) => setDraft({ ...draft, chargerCode: event.target.value })} placeholder="Ej. ING-DC-01" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charger-name">Nombre visible</Label>
              <Input id="charger-name" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} placeholder="Cargador 01" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charger-ocpp">Identidad OCPP</Label>
              <Input id="charger-ocpp" value={draft.ocppIdentity} onChange={(event) => setDraft({ ...draft, ocppIdentity: event.target.value })} placeholder="Identidad configurada en el equipo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charger-capacity">Sesiones simultáneas</Label>
              <Input id="charger-capacity" type="number" min="1" max="8" value={draft.maxConcurrentSessions} onChange={(event) => setDraft({ ...draft, maxConcurrentSessions: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charger-manufacturer">Fabricante (opcional)</Label>
              <Input id="charger-manufacturer" value={draft.manufacturer} onChange={(event) => setDraft({ ...draft, manufacturer: event.target.value })} placeholder="Liboltek" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charger-model">Modelo / potencia (opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input id="charger-model" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="Modelo" />
                <Input type="number" min="0" value={draft.powerKw} onChange={(event) => setDraft({ ...draft, powerKw: event.target.value })} placeholder="kW" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={createCharger.isPending}
              onClick={() => createCharger.mutate({
                stationId: station.id,
                chargerCode: draft.chargerCode.trim(),
                displayName: draft.displayName.trim(),
                ocppIdentity: draft.ocppIdentity.trim(),
                maxConcurrentSessions: Math.max(1, Number(draft.maxConcurrentSessions) || 1),
                manufacturer: draft.manufacturer.trim() || undefined,
                model: draft.model.trim() || undefined,
                powerKw: draft.powerKw || undefined,
              })}
            >
              {createCharger.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar cargador
            </Button>
          </div>
        </Card>
      )}

      {hierarchyQuery.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando jerarquía física…</div>
      ) : physicalChargers.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">Aún no hay gabinetes físicos configurados. Crea uno y asigna las pistolas existentes sin afectar reservas ni transacciones.</Card>
      ) : (
        <div className="space-y-3">
          {physicalChargers.map((charger: any) => {
            const editor = editorFor(charger);
            return (
              <Card key={charger.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{charger.label}</p>
                    <p className="text-xs text-muted-foreground">{charger.connectors?.length || 0} salida{charger.connectors?.length === 1 ? "" : "s"} · {charger.availableSlots} cupo{charger.availableSlots === 1 ? "" : "s"} operativo{charger.availableSlots === 1 ? "" : "s"}</p>
                  </div>
                  <Badge variant={charger.supportsIndependentSessions ? "default" : "secondary"}>
                    {charger.concurrentCapacity} sesión{charger.concurrentCapacity === 1 ? "" : "es"} simultánea{charger.concurrentCapacity === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
                  <Input aria-label="Código de cargador" value={editor.code} onChange={(event) => setEditingByCharger({ ...editingByCharger, [charger.id]: { ...editor, code: event.target.value } })} placeholder="Código" />
                  <Input aria-label="Nombre de cargador" value={editor.name} onChange={(event) => setEditingByCharger({ ...editingByCharger, [charger.id]: { ...editor, name: event.target.value } })} placeholder="Nombre visible" />
                  <Input aria-label="Sesiones simultáneas" type="number" min="1" max="8" value={editor.capacity} onChange={(event) => setEditingByCharger({ ...editingByCharger, [charger.id]: { ...editor, capacity: event.target.value } })} />
                  <Button size="sm" variant="outline" disabled={updateCharger.isPending} onClick={() => updateCharger.mutate({ id: charger.id, data: { chargerCode: editor.code.trim(), displayName: editor.name.trim(), maxConcurrentSessions: Math.max(1, Number(editor.capacity) || 1) } })}>
                    <Save className="h-4 w-4 mr-1" /> Guardar
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(charger.connectors ?? []).map((connector: any) => (
                    <div key={connector.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{connector.label}</p>
                        <p className="text-xs text-muted-foreground">{connector.connectorType?.replace("_", " ")} · {connector.powerKw} kW</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={regenerateQr.isPending}
                        onClick={() => {
                          if (confirm(`¿Generar un nuevo QR para ${connector.label}? El QR anterior quedará revocado.`)) {
                            regenerateQr.mutate({ evseId: connector.id });
                          }
                        }}
                      >
                        {regenerateQr.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
                        QR
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {legacyConnectors.length > 0 && (
        <Card className="p-4 space-y-3 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <Unplug className="h-4 w-4 mt-0.5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">Conectores pendientes de organizar</p>
              <p className="text-xs text-muted-foreground">Asignarlos no cambia su identidad OCPP ni registros históricos; sólo establece la jerarquía física y la capacidad del gabinete.</p>
            </div>
          </div>
          <div className="space-y-2">
            {legacyConnectors.map((connector: any) => {
              const assignment = assignmentByConnector[connector.id] ?? { chargerId: "", label: connector.label || `Pistola ${connector.connectorId}` };
              return (
                <div key={connector.id} className="grid grid-cols-1 gap-2 rounded-lg border border-amber-500/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={assignment.label} onChange={(event) => setAssignmentByConnector({ ...assignmentByConnector, [connector.id]: { ...assignment, label: event.target.value } })} aria-label="Etiqueta de pistola" />
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={assignment.chargerId} onChange={(event) => setAssignmentByConnector({ ...assignmentByConnector, [connector.id]: { ...assignment, chargerId: event.target.value } })} aria-label="Cargador físico">
                    <option value="">Selecciona cargador…</option>
                    {physicalChargers.map((charger: any) => <option key={charger.id} value={charger.id}>{charger.label}</option>)}
                  </select>
                  <Button size="sm" disabled={!assignment.chargerId || !assignment.label.trim() || assignConnector.isPending} onClick={() => assignConnector.mutate({ chargerId: Number(assignment.chargerId), evseId: connector.id, connectorLabel: assignment.label.trim() })}>
                    Asignar
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {connectorQrPreview && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Etiqueta lista: {connectorQrPreview.label}</p>
              <p className="text-xs text-muted-foreground">Descarga o imprime este QR específico antes de instalarlo en la pistola.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConnectorQrPreview(null)}>Cerrar</Button>
          </div>
          <StationQRCode
            stationCode={String(station.ocppIdentity || station.id)}
            stationName={station.name}
            connectorToken={connectorQrPreview.token}
            connectorLabel={connectorQrPreview.label}
          />
        </Card>
      )}

      <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Copy className="h-3 w-3" /> El botón QR crea un token opaco, revoca el anterior y copia el enlace listo para generar/imprimir la etiqueta.</p>
    </section>
  );
}
