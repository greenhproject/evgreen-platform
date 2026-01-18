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
import { Search, MapPin, Zap, Settings } from "lucide-react";
import { toast } from "sonner";

export default function TechnicianStations() {
  const getStatusBadge = (isOnline: boolean) => {
    return isOnline ? (
      <Badge className="bg-green-100 text-green-700">En línea</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700">Fuera de línea</Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Estaciones Asignadas</h1>
        <p className="text-muted-foreground">
          Estaciones bajo tu responsabilidad de mantenimiento
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
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Asignadas</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
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
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Con fallas</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Mantenimiento</div>
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
              <TableHead>Última revisión</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No hay estaciones asignadas
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
