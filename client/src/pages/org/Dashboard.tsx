/**
 * Org Dashboard - Panel principal del portal de organización SaaS
 * Muestra resumen de la organización, estaciones y tickets activos
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building,
  MapPin,
  Ticket,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";

export default function OrgDashboard() {
  const [, setLocation] = useLocation();

  const { data: org, isLoading: orgLoading } = (trpc.organizations as any).getMyOrg.useQuery();
  const { data: stations, isLoading: stationsLoading } = (trpc.organizations as any).getMyStations.useQuery();
  const { data: tickets } = (trpc.organizations as any).getMyTickets.useQuery();

  const onlineStations = stations?.filter((s: any) => s.isOnline) || [];
  const offlineStations = stations?.filter((s: any) => !s.isOnline) || [];
  const openTickets = tickets?.filter((t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS") || [];

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando organización...</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Building className="h-16 w-16 text-muted-foreground opacity-30" />
        <div className="text-center">
          <p className="text-lg font-medium">No perteneces a ninguna organización</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contacta al administrador de EVGreen para ser asignado a una organización.
          </p>
        </div>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    starter: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    professional: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    trial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    suspended: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building className="h-7 w-7 text-green-400" />
          {org.name}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className={planColors[org.plan] || ""}>
            Plan {org.plan}
          </Badge>
          <Badge variant="outline" className={statusColors[org.status] || ""}>
            {org.status === "active" ? "Activo" :
             org.status === "trial" ? "Trial" :
             org.status === "suspended" ? "Suspendido" : "Cancelado"}
          </Badge>
          {org.myRole && (
            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
              {org.myRole === "admin" ? "Administrador" : "Visualizador"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{org.slug}.evgreen.lat</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MapPin className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stations?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Estaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onlineStations.length}</p>
                <p className="text-xs text-muted-foreground">En Línea</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{offlineStations.length}</p>
                <p className="text-xs text-muted-foreground">Fuera de Línea</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Ticket className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openTickets.length}</p>
                <p className="text-xs text-muted-foreground">Tickets Abiertos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stations Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-400" />
                Mis Estaciones
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-400 h-7 text-xs"
                onClick={() => setLocation("/org/stations")}
              >
                Ver todas
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stationsLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : stations?.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay estaciones asignadas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stations?.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.city || s.address || "Sin ubicación"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {s.isOnline ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className={`text-xs ${s.isOnline ? "text-green-400" : "text-red-400"}`}>
                        {s.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                ))}
                {stations?.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{stations.length - 5} más
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-orange-400" />
                Tickets Recientes
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-400 h-7 text-xs"
                onClick={() => setLocation("/org/support")}
              >
                Ver todos
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!tickets || tickets.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay tickets de soporte</p>
                <Button
                  size="sm"
                  className="mt-3 bg-green-600 hover:bg-green-700"
                  onClick={() => setLocation("/org/support")}
                >
                  Crear ticket
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets?.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="flex items-start justify-between py-1.5 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        t.status === "OPEN" ? "bg-blue-500/20 text-blue-400 text-xs" :
                        t.status === "IN_PROGRESS" ? "bg-yellow-500/20 text-yellow-400 text-xs" :
                        t.status === "RESOLVED" ? "bg-green-500/20 text-green-400 text-xs" :
                        "bg-gray-500/20 text-gray-400 text-xs"
                      }
                    >
                      {t.status === "OPEN" ? "Abierto" :
                       t.status === "IN_PROGRESS" ? "En Progreso" :
                       t.status === "RESOLVED" ? "Resuelto" : "Cerrado"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Org Info */}
      {(org.contactName || org.contactEmail || org.nit) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Información de la Organización</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {org.contactName && (
                <div>
                  <p className="text-muted-foreground">Contacto</p>
                  <p className="font-medium">{org.contactName}</p>
                </div>
              )}
              {org.contactEmail && (
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{org.contactEmail}</p>
                </div>
              )}
              {org.nit && (
                <div>
                  <p className="text-muted-foreground">NIT</p>
                  <p className="font-medium">{org.nit}</p>
                </div>
              )}
              {org.maxChargers && (
                <div>
                  <p className="text-muted-foreground">Máx. Cargadores</p>
                  <p className="font-medium">{org.maxChargers}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Red EVGreen</p>
                <p className={`font-medium ${org.networkMember ? "text-green-400" : "text-gray-400"}`}>
                  {org.networkMember ? "Miembro activo" : "Red propia"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Soporte</p>
                <p className={`font-medium ${org.supportIncluded ? "text-green-400" : "text-gray-400"}`}>
                  {org.supportIncluded ? "Incluido (20%)" : "Autogestión"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
