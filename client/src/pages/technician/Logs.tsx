import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Activity, AlertTriangle, Info, CheckCircle } from "lucide-react";

export default function TechnicianLogs() {
  const getLogIcon = (type: string) => {
    const icons: Record<string, any> = {
      ERROR: AlertTriangle,
      WARNING: AlertTriangle,
      INFO: Info,
      SUCCESS: CheckCircle,
    };
    return icons[type] || Info;
  };

  const getLogStyle = (type: string) => {
    const styles: Record<string, string> = {
      ERROR: "text-red-600 bg-red-50",
      WARNING: "text-orange-600 bg-orange-50",
      INFO: "text-blue-600 bg-blue-50",
      SUCCESS: "text-green-600 bg-green-50",
    };
    return styles[type] || "text-gray-600 bg-gray-50";
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Logs del Sistema</h1>
        <p className="text-muted-foreground">
          Monitorea los eventos y diagnósticos de las estaciones
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar en logs..." className="pl-10" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ERROR">Errores</SelectItem>
              <SelectItem value="WARNING">Advertencias</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las estaciones</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Logs */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4" />
          <h3 className="font-semibold">Eventos recientes</h3>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          No hay logs disponibles
        </div>
      </Card>
    </div>
  );
}
