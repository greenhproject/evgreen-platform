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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function TechnicianTickets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tickets, isLoading } = trpc.maintenance.myTickets.useQuery();

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      CRITICAL: "bg-red-100 text-red-700",
      HIGH: "bg-orange-100 text-orange-700",
      MEDIUM: "bg-yellow-100 text-yellow-700",
      LOW: "bg-gray-100 text-gray-700",
    };
    return <Badge className={styles[priority] || "bg-gray-100"}>{priority}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: any; label: string }> = {
      OPEN: { bg: "bg-red-100 text-red-700", icon: AlertTriangle, label: "Abierto" },
      IN_PROGRESS: { bg: "bg-blue-100 text-blue-700", icon: Clock, label: "En progreso" },
      RESOLVED: { bg: "bg-green-100 text-green-700", icon: CheckCircle, label: "Resuelto" },
      CLOSED: { bg: "bg-gray-100 text-gray-700", icon: CheckCircle, label: "Cerrado" },
    };
    const style = styles[status] || styles.OPEN;
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets de Mantenimiento</h1>
          <p className="text-muted-foreground">
            Gestiona los tickets asignados
          </p>
        </div>
        <Button onClick={() => toast.info("Crear ticket próximamente")}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo ticket
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título o estación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="OPEN">Abiertos</SelectItem>
              <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
              <SelectItem value="RESOLVED">Resueltos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Estación</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Cargando tickets...
                </TableCell>
              </TableRow>
            ) : tickets?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay tickets asignados
                </TableCell>
              </TableRow>
            ) : (
              tickets?.map((ticket: any) => (
                <TableRow key={ticket.id}>
                  <TableCell>#{ticket.id}</TableCell>
                  <TableCell className="font-medium">{ticket.title}</TableCell>
                  <TableCell>ID: {ticket.stationId}</TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell>
                    {new Date(ticket.createdAt).toLocaleDateString("es-CO")}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      Ver detalles
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
