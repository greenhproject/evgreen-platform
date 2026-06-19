import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, TrendingUp, DollarSign, Clock, Info } from "lucide-react";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function HostOccupancyLiquidations() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: summary } = trpc.occupancyLiquidations.mySummary.useQuery({ year, month });
  const { data: records } = trpc.occupancyLiquidations.myRecords.useQuery({ year, month });

  const totalUserCharge = summary?.totalUserCharge ?? 0;
  const totalAllyTransfer = summary?.totalAllyTransfer ?? 0;
  const totalMinutes = summary?.totalMinutes ?? 0;
  const sessionCount = summary?.sessionCount ?? 0;
  // pendingTransfer and paidTransfer are derived from records
  const pendingTransfer = (records ?? []).filter(r => !r.allyPaidAt).reduce((acc, r) => acc + r.allyTransfer, 0);
  const paidTransfer = (records ?? []).filter(r => !!r.allyPaidAt).reduce((acc, r) => acc + r.allyTransfer, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ocupación Parqueadero</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Liquidaciones de tarifa de ocupación post-carga en tus espacios
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

      {/* Explicación del modelo */}
      <div className="flex gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-sm text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Cuando un vehículo ocupa tu espacio después de terminar la carga, EVGreen cobra al usuario la tarifa de ocupación configurada y te transfiere la tarifa equivalente a tu tarifa de parqueadero. El diferencial lo retiene EVGreen como margen de operación.
        </span>
      </div>

      {/* Métricas del período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="w-4 h-4" /> Minutos cobrados
            </div>
            <div className="text-2xl font-bold">{Math.round(Number(totalMinutes)).toLocaleString("es-CO")}</div>
            <div className="text-xs text-muted-foreground">{sessionCount} sesiones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" /> Cobrado a usuarios
            </div>
            <div className="text-2xl font-bold text-green-500">${Number(totalUserCharge).toLocaleString("es-CO")}</div>
            <div className="text-xs text-muted-foreground">COP total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Building2 className="w-4 h-4" /> Tu transferencia
            </div>
            <div className="text-2xl font-bold text-blue-500">${Number(totalAllyTransfer).toLocaleString("es-CO")}</div>
            <div className="text-xs text-muted-foreground">COP total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Pendiente de pago
            </div>
            <div className="text-2xl font-bold text-amber-500">${Number(pendingTransfer).toLocaleString("es-CO")}</div>
            <div className="text-xs text-muted-foreground">
              Pagado: ${Number(paidTransfer).toLocaleString("es-CO")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de registros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros de Ocupación — {MONTHS[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {!records || records.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay registros de ocupación en este período</p>
              <p className="text-xs mt-1">Los registros aparecen cuando un usuario ocupa tu espacio después de terminar la carga</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estación</TableHead>
                  <TableHead className="text-right">Minutos</TableHead>
                  <TableHead className="text-right">Tu tarifa</TableHead>
                  <TableHead className="text-right">Tu transferencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="text-xs">{new Date(rec.createdAt).toLocaleString("es-CO")}</TableCell>
                    <TableCell className="font-medium">{`Estación #${rec.stationId}`}</TableCell>
                    <TableCell className="text-right">{Number(rec.minutesCharged).toFixed(1)}</TableCell>
                    <TableCell className="text-right">${rec.parkingRatePerMinute}/min</TableCell>
                    <TableCell className="text-right font-medium text-blue-600">${Number(rec.allyTransfer).toLocaleString("es-CO")}</TableCell>
                    <TableCell>
                      {rec.allyPaidAt ? (
                        <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">
                          Pagado {new Date(rec.allyPaidAt).toLocaleDateString("es-CO")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
