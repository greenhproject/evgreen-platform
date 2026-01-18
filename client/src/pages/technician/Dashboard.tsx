import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, AlertTriangle, CheckCircle, Clock, MapPin } from "lucide-react";

export default function TechnicianDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Técnico</h1>
        <p className="text-muted-foreground">
          Gestiona el mantenimiento de las estaciones
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Tickets pendientes</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">En progreso</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Resueltos hoy</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Estaciones asignadas</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tickets urgentes */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Tickets urgentes
        </h3>
        <div className="text-center py-8 text-muted-foreground">
          No hay tickets urgentes
        </div>
      </Card>

      {/* Estaciones con problemas */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          Estaciones que requieren atención
        </h3>
        <div className="text-center py-8 text-muted-foreground">
          Todas las estaciones funcionan correctamente
        </div>
      </Card>
    </div>
  );
}
