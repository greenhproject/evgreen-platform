import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Unlink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CrowdfundingOrphanedStationLinks({ onRepaired }: { onRepaired?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { data, isLoading, refetch } = trpc.crowdfunding.listOrphanedStationLinks.useQuery(undefined, {
    staleTime: 30_000,
  });
  const repairMutation = trpc.crowdfunding.repairOrphanedStationLinks.useMutation({
    onSuccess: (result) => {
      if (result.affected.length > 0) {
        toast.success(`${result.affected.length} vínculo(s) huérfano(s) reparado(s).`);
      }
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} vínculo(s) permanecen bloqueado(s) por seguridad.`);
      }
      setOpen(false);
      setReason("");
      void refetch();
      onRepaired?.();
    },
    onError: (error) => toast.error(error.message || "No fue posible reparar los vínculos."),
  });

  if (isLoading || !data || data.length === 0) return null;

  const repairable = data.filter((item) => item.canRepair);
  const blocked = data.length - repairable.length;
  const reasonIsValid = reason.trim().length >= 10;

  const handleRepair = () => {
    if (!reasonIsValid || repairable.length === 0) return;
    if (!window.confirm(`Se desvincularán ${repairable.length} proyecto(s) sin recaudo ni participaciones. ¿Continuar?`)) return;
    repairMutation.mutate({
      projectIds: repairable.map((item) => item.id),
      reason: reason.trim(),
    });
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-400">
              <Unlink className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Vínculos de estaciones para revisar</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Hay {data.length} proyecto(s) que conservan un ID de estación física que ya no existe.
              </p>
            </div>
          </div>
          <Button variant="outline" className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => setOpen(true)}>
            <ShieldCheck className="h-4 w-4" />
            Ver diagnóstico
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> {repairable.length} reparable(s) sin actividad financiera</span>
          {blocked > 0 && <span className="flex items-center gap-1.5 text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {blocked} bloqueado(s) para revisión</span>}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setReason(""); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              Diagnóstico de vínculos huérfanos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-muted-foreground">
              Solo se reparan automáticamente proyectos sin recaudo y sin participaciones. Los proyectos con actividad financiera o estado terminal permanecen bloqueados.
            </div>

            <div className="max-h-[42vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>stationId</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Recaudo</TableHead>
                    <TableHead>Participaciones</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">ID proyecto: {item.id}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.stationId}</TableCell>
                      <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                      <TableCell>{formatCOP(item.raisedAmount)}</TableCell>
                      <TableCell>{item.participationCount}</TableCell>
                      <TableCell>
                        {item.canRepair ? (
                          <Badge className="gap-1 bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3" /> Reparar</Badge>
                        ) : (
                          <div className="max-w-[220px] text-xs text-red-400">{item.blockReason}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {repairable.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="orphan-repair-reason">Justificación administrativa de la reparación (obligatoria)</Label>
                <Textarea
                  id="orphan-repair-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ej.: Se eliminó la estación física durante la depuración del inventario y el proyecto no registra recaudo ni participaciones."
                  className="min-h-[86px]"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Mínimo 10 caracteres.</span>
                  <span className={reasonIsValid ? "font-medium text-emerald-400" : "text-amber-400"}>{reason.trim().length} / 10</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
            {repairable.length > 0 && (
              <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700" disabled={!reasonIsValid || repairMutation.isPending} onClick={handleRepair}>
                {repairMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Reparar {repairable.length} vínculo(s) seguro(s)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
