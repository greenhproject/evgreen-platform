import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, TrendingUp, DollarSign, Clock, CheckCircle2 } from "lucide-react";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function OccupancyLiquidations() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);

  const { data: summary, refetch: refetchSummary } = trpc.occupancyLiquidations.adminSummary.useQuery({ year, month });
  const { data: stationDetail } = trpc.occupancyLiquidations.adminByStation.useQuery(
    { stationId: selectedStation!, year, month },
    { enabled: !!selectedStation }
  );
  const { data: stations } = trpc.stations.listAll.useQuery();

  const markPaidMutation = trpc.occupancyLiquidations.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Liquidaciones marcadas como pagadas");
      refetchSummary();
    },
    onError: () => toast.error("Error al marcar como pagado"),
  });

  const totalUserCharge = summary?.reduce((acc, r) => acc + Number(r.totalUserCharge), 0) ?? 0;
  const totalAllyTransfer = summary?.reduce((acc, r) => acc + Number(r.totalAllyTransfer), 0) ?? 0;
  const totalEvgreenMargin = summary?.reduce((acc, r) => acc + Number(r.totalEvgreenMargin), 0) ?? 0;
  const totalMinutes = summary?.reduce((acc, r) => acc + Number(r.totalMinutes), 0) ?? 0;

  const getStationName = (stationId: number) => {
    const st = (stations ?? []).find((s: any) => s.id === stationId);
    return st?.name ?? `Estación #${stationId}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liquidaciones de Ocupación</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Desglose de cobros de tarifa de ocupación post-carga y transferencias a aliados
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Métricas globales del período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" /> Cobrado a usuarios
            </div>
            <div className="text-2xl font-bold text-green-500">
              ${totalUserCharge.toLocaleString("es-CO")}
            </div>
            <div className="text-xs text-muted-foreground">COP total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Building2 className="w-4 h-4" /> Transferido a aliados
            </div>
            <div className="text-2xl font-bold text-blue-500">
              ${totalAllyTransfer.toLocaleString("es-CO")}
            </div>
            <div className="text-xs text-muted-foreground">COP total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Margen EVGreen
            </div>
            <div className="text-2xl font-bold text-emerald-500">
              ${totalEvgreenMargin.toLocaleString("es-CO")}
            </div>
            <div className="text-xs text-muted-foreground">COP total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="w-4 h-4" /> Minutos cobrados
            </div>
            <div className="text-2xl font-bold">
              {Math.round(totalMinutes).toLocaleString("es-CO")}
            </div>
            <div className="text-xs text-muted-foreground">min totales</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla resumen por aliado/estación */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen por Estación — {MONTHS[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {!summary || summary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay liquidaciones de ocupación en este período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estación</TableHead>
                  <TableHead>Aliado ID</TableHead>
                  <TableHead className="text-right">Minutos</TableHead>
                  <TableHead className="text-right">Cobrado usuario</TableHead>
                  <TableHead className="text-right">Transferido aliado</TableHead>
                  <TableHead className="text-right">Margen EVGreen</TableHead>
                  <TableHead className="text-right">Sesiones</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((row, i) => (
                  <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStation(row.stationId)}>
                    <TableCell className="font-medium">{getStationName(row.stationId)}</TableCell>
                    <TableCell>
                      {row.hostUserId ? (
                        <Badge variant="outline">Host #{row.hostUserId}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin aliado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{Math.round(Number(row.totalMinutes)).toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right text-green-600">${Number(row.totalUserCharge).toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right text-blue-600">${Number(row.totalAllyTransfer).toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right text-emerald-600">${Number(row.totalEvgreenMargin).toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right">{Number(row.sessionCount)}</TableCell>
                    <TableCell>
                      {row.hostUserId && Number(row.totalAllyTransfer) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            markPaidMutation.mutate({ hostUserId: row.hostUserId!, year, month });
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Marcar pagado
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detalle de registros por estación */}
      {selectedStation && stationDetail && stationDetail.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalle — {getStationName(selectedStation)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Transacción</TableHead>
                  <TableHead className="text-right">Minutos</TableHead>
                  <TableHead className="text-right">Tarifa usuario</TableHead>
                  <TableHead className="text-right">Tarifa aliado</TableHead>
                  <TableHead className="text-right">Cobrado usuario</TableHead>
                  <TableHead className="text-right">Transferido aliado</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stationDetail.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="text-xs">{new Date(rec.createdAt).toLocaleString("es-CO")}</TableCell>
                    <TableCell>#{rec.transactionId}</TableCell>
                    <TableCell className="text-right">{Number(rec.minutesCharged).toFixed(1)}</TableCell>
                    <TableCell className="text-right">${rec.occupancyRatePerMinute}/min</TableCell>
                    <TableCell className="text-right">${rec.parkingRatePerMinute}/min</TableCell>
                    <TableCell className="text-right text-green-600">${rec.userCharge.toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right text-blue-600">${rec.allyTransfer.toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right text-emerald-600">${rec.evgreenMargin.toLocaleString("es-CO")}</TableCell>
                    <TableCell>
                      {rec.allyPaidAt ? (
                        <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Pagado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Pendiente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
