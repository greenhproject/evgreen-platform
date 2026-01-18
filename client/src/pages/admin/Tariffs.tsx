import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function AdminTariffs() {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarifas</h1>
          <p className="text-muted-foreground">
            Gestiona las tarifas de las estaciones de carga
          </p>
        </div>
        <Button onClick={() => toast.info("Crear tarifa próximamente")}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva tarifa
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(1200)}</div>
              <div className="text-sm text-muted-foreground">Precio promedio/kWh</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(5000)}</div>
              <div className="text-sm text-muted-foreground">Fee de reserva promedio</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(500)}</div>
              <div className="text-sm text-muted-foreground">Penalización/min promedio</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por estación..." className="pl-10" />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estación</TableHead>
              <TableHead>Nombre tarifa</TableHead>
              <TableHead>Precio/kWh</TableHead>
              <TableHead>Fee reserva</TableHead>
              <TableHead>Penalización</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No hay tarifas configuradas
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
