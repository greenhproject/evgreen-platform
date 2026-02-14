import { trpc } from "@/lib/trpc";
import { 
  Users, User, MapPin, Mail, Shield, Wrench, 
  CheckCircle, Clock, AlertTriangle
} from "lucide-react";

export default function EngineerTechnicians() {
  const { data: technicians, isLoading } = trpc.maintenance.listTechnicians.useQuery();
  const { data: stats } = trpc.maintenance.operationsStats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Mapear stats por técnico
  const techStats = new Map<number, any>();
  stats?.byTechnician?.forEach((t: any) => techStats.set(t.id, t));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-500" />
          Equipo Técnico
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona y supervisa el rendimiento del equipo de técnicos.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Total equipo</p>
          <p className="text-2xl font-bold mt-1">{technicians?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Ingenieros</p>
          <p className="text-2xl font-bold mt-1 text-blue-500">
            {technicians?.filter((t: any) => t.role === "engineer").length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Técnicos</p>
          <p className="text-2xl font-bold mt-1 text-amber-500">
            {technicians?.filter((t: any) => t.role === "technician").length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Activos</p>
          <p className="text-2xl font-bold mt-1 text-green-500">
            {technicians?.filter((t: any) => t.isActive !== false).length || 0}
          </p>
        </div>
      </div>

      {/* Lista de técnicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(!technicians || technicians.length === 0) ? (
          <div className="col-span-2 bg-card border rounded-xl p-8 text-center text-muted-foreground">
            No hay técnicos registrados en el sistema
          </div>
        ) : (
          technicians.map((tech: any) => {
            const tStats = techStats.get(tech.id);
            const isEngineer = tech.role === "engineer";
            return (
              <div key={tech.id} className="bg-card border rounded-xl p-5 hover:border-blue-500/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isEngineer ? "bg-blue-500/10" : "bg-amber-500/10"
                  }`}>
                    {isEngineer ? (
                      <Shield className="h-6 w-6 text-blue-500" />
                    ) : (
                      <Wrench className="h-6 w-6 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {isEngineer ? "Ing. " : ""}{tech.name}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isEngineer 
                          ? "bg-blue-500/10 text-blue-500" 
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {isEngineer ? "Ingeniero" : "Técnico"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Mail className="h-3 w-3" /> {tech.email}
                    </p>
                    {tech.assignedRegion && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {tech.assignedRegion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats del técnico */}
                {tStats ? (
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tickets asignados</span>
                      <span className="font-semibold">{tStats.count}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-green-500">
                        <CheckCircle className="h-3 w-3" /> {tStats.completed}
                      </span>
                      <span className="flex items-center gap-1 text-yellow-500">
                        <Clock className="h-3 w-3" /> {tStats.pending}
                      </span>
                    </div>
                    {tStats.count > 0 && (
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${(tStats.completed / tStats.count) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                    Sin tickets asignados
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
