import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, MapPin, Zap, Settings, Eye } from "lucide-react";
import { toast } from "sonner";

export default function AdminStations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: stations, isLoading, refetch } = trpc.stations.listAll.useQuery();

  const getStatusBadge = (isOnline: boolean, isActive: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inactiva</Badge>;
    return isOnline ? (
      <Badge className="bg-green-100 text-green-700">En línea</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700">Fuera de línea</Badge>
    );
  };

  const filteredStations = stations?.filter((station) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        station.name.toLowerCase().includes(query) ||
        station.address.toLowerCase().includes(query) ||
        station.city.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estaciones de Carga</h1>
          <p className="text-muted-foreground">
            Gestiona todas las estaciones de la red Green EV
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva estación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear nueva estación</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input placeholder="Nombre de la estación" />
              </div>
              <div className="space-y-2">
                <Label>Propietario (ID)</Label>
                <Input placeholder="ID del inversionista" type="number" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Dirección</Label>
                <Input placeholder="Dirección completa" />
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input placeholder="Ciudad" />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input placeholder="Departamento" />
              </div>
              <div className="space-y-2">
                <Label>Latitud</Label>
                <Input placeholder="4.7110" />
              </div>
              <div className="space-y-2">
                <Label>Longitud</Label>
                <Input placeholder="-74.0721" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Identidad OCPP</Label>
                <Input placeholder="Identificador único del cargador" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={() => toast.info("Crear estación próximamente")}>
                Crear estación
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
              <div className="text-sm text-muted-foreground">Total estaciones</div>
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
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stations?.filter((s) => !s.isOnline).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Fuera de línea</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stations?.filter((s) => !s.isActive).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Inactivas</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, dirección o ciudad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Tabla de estaciones */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estación</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Conectores</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última conexión</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Cargando estaciones...
                </TableCell>
              </TableRow>
            ) : filteredStations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay estaciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredStations?.map((station) => (
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
                  <TableCell>ID: {station.ownerId}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{getStatusBadge(station.isOnline, station.isActive)}</TableCell>
                  <TableCell>
                    {(station as any).lastHeartbeat
                      ? new Date((station as any).lastHeartbeat).toLocaleString("es-CO")
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4" />
                    </Button>
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
