/**
 * Org Settings - Configuración del portal de organización SaaS
 * Muestra información de la organización y configuración de la cuenta
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Settings, Mail, Phone, Hash, Globe } from "lucide-react";

export default function OrgSettings() {
  const { data: org, isLoading } = (trpc.organizations as any).getMyOrg.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Building className="h-16 w-16 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">No perteneces a ninguna organización</p>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    starter: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    professional: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-green-400" />
          Configuración
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Información de tu organización en la plataforma EVGreen
        </p>
      </div>

      {/* Org Info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-4 w-4 text-green-400" />
            Información de la Organización
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold">{org.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Globe className="h-3 w-3" />
                {org.slug}.evgreen.lat
              </p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Badge variant="outline" className={planColors[org.plan] || ""}>
                Plan {org.plan}
              </Badge>
              <Badge variant="outline" className={
                org.status === "active" ? "bg-green-500/20 text-green-400" :
                org.status === "trial" ? "bg-blue-500/20 text-blue-400" :
                "bg-red-500/20 text-red-400"
              }>
                {org.status === "active" ? "Activo" :
                 org.status === "trial" ? "Trial" :
                 org.status === "suspended" ? "Suspendido" : "Cancelado"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
            {org.contactName && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Contacto</p>
                  <p className="text-sm font-medium">{org.contactName}</p>
                </div>
              </div>
            )}
            {org.contactEmail && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{org.contactEmail}</p>
                </div>
              </div>
            )}
            {org.contactPhone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-medium">{org.contactPhone}</p>
                </div>
              </div>
            )}
            {org.nit && (
              <div className="flex items-start gap-2">
                <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">NIT</p>
                  <p className="text-sm font-medium">{org.nit}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Details */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalles del Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Plan</p>
              <p className="font-semibold capitalize">{org.plan}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Máx. Cargadores</p>
              <p className="font-semibold">{org.maxChargers || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Red EVGreen</p>
              <p className={`font-semibold ${org.networkMember ? "text-green-400" : "text-gray-400"}`}>
                {org.networkMember ? "Miembro" : "Red propia"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Soporte</p>
              <p className={`font-semibold ${org.supportIncluded ? "text-green-400" : "text-gray-400"}`}>
                {org.supportIncluded ? "Incluido (20%)" : "Autogestión"}
              </p>
            </div>
            {org.trialEndsAt && org.status === "trial" && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Trial termina</p>
                <p className="font-semibold text-blue-400">
                  {new Date(org.trialEndsAt).toLocaleDateString("es-CO")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Para modificar la información de tu organización o cambiar de plan, contacta a{" "}
        <a href="mailto:soporte@evgreen.lat" className="text-green-400 hover:underline">
          soporte@evgreen.lat
        </a>
      </p>
    </div>
  );
}
