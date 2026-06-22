import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Shield, User } from "lucide-react";

export default function OrgUsers() {
  const { data: members, isLoading } = (trpc.organizations as any).getOrgUsers.useQuery();

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    viewer: "Visualizador",
    operator: "Operador",
  };

  const roleColor: Record<string, string> = {
    admin: "bg-green-500/20 text-green-400 border-green-500/30",
    viewer: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    operator: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-green-400" /> Gestión de Usuarios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Miembros con acceso al portal de tu organización
        </p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-400" />
            Miembros del equipo
            {members && (
              <Badge variant="outline" className="ml-auto text-xs">
                {members.length} miembro{members.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !members || members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay miembros registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {members.map((m: any) => (
                <div key={m.userId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <Avatar className="h-9 w-9 shrink-0">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="h-9 w-9 object-cover rounded-full" />
                    ) : (
                      <AvatarFallback className="bg-green-500/20 text-green-400 text-sm font-bold">
                        {(m.name || m.email || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-[10px] ${roleColor[m.role] || roleColor.viewer}`}>
                      {roleLabel[m.role] || m.role}
                    </Badge>
                    {m.isActive === false && (
                      <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/20 border-border/30">
        <CardContent className="p-4 flex items-start gap-3">
          <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Invitar nuevos miembros</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Para agregar miembros al portal, contacta al equipo de EVGreen o usa la opción de invitación
              en Configuración → Usuarios. Los nuevos miembros recibirán un correo de bienvenida.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
