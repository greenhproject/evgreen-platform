import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, MapPin, Zap, Settings, Eye, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function InvestorStations() {
  const { data: stations, isLoading } = trpc.stations.listOwned.useQuery();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (isOnline: boolean, isActive: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inactiva</Badge>;
    return isOnline ? (
      <Badge className="bg-green-100 text-green-700">En línea</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700">Fuera de línea</Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Estaciones</h1>
        <p className="text-muted-foreground">
          Gestiona y monitorea tus estaciones de carga
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stations?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Estaciones</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stations?.filter((s) => s.isOnline).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">En línea</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(0)}</div>
              <div className="text-sm text-muted-foreground">Ingresos del mes</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0 kWh</div>
              <div className="text-sm text-muted-foreground">Energía vendida</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar estación..." className="pl-10" />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estación</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Conectores</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ingresos del mes</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Cargando estaciones...
                </TableCell>
              </TableRow>
            ) : stations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No tienes estaciones registradas
                </TableCell>
              </TableRow>
            ) : (
              stations?.map((station) => (
                <TableRow key={station.id}>
                  <TableCell>
                    <div className="font-medium">{station.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {station.ocppIdentity || station.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {station.city}
                    </div>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{getStatusBadge(station.isOnline, station.isActive)}</TableCell>
                  <TableCell>{formatCurrency(0)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
