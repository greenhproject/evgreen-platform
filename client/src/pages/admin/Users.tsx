import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, UserPlus, Users, Shield, Wrench, Briefcase } from "lucide-react";
import { toast } from "sonner";

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery(
    roleFilter !== "all" ? { role: roleFilter as any } : undefined
  );

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Rol actualizado correctamente");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getRoleBadge = (role: string) => {
    const styles: Record<string, { bg: string; icon: any; label: string }> = {
      admin: { bg: "bg-red-100 text-red-700", icon: Shield, label: "Admin" },
      staff: { bg: "bg-purple-100 text-purple-700", icon: Shield, label: "Staff" },
      technician: { bg: "bg-blue-100 text-blue-700", icon: Wrench, label: "Técnico" },
      investor: { bg: "bg-green-100 text-green-700", icon: Briefcase, label: "Inversionista" },
      user: { bg: "bg-gray-100 text-gray-700", icon: Users, label: "Usuario" },
    };
    const style = styles[role] || styles.user;
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  const filteredUsers = users?.filter((user) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !user.name?.toLowerCase().includes(query) &&
        !user.email?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground">
            Gestiona los usuarios de la plataforma
          </p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Invitar usuario
        </Button>
      </div>

      {/* Estadísticas por rol */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { role: "admin", icon: Shield, color: "red" },
          { role: "staff", icon: Shield, color: "purple" },
          { role: "technician", icon: Wrench, color: "blue" },
          { role: "investor", icon: Briefcase, color: "green" },
          { role: "user", icon: Users, color: "gray" },
        ].map(({ role, icon: Icon, color }) => (
          <Card key={role} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {users?.filter((u) => u.role === role).length || 0}
                </div>
                <div className="text-sm text-muted-foreground capitalize">{role}s</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="technician">Técnico</SelectItem>
              <SelectItem value="investor">Inversionista</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tabla de usuarios */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Cargando usuarios...
                </TableCell>
              </TableRow>
            ) : filteredUsers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={(user as any).avatarUrl || undefined} />
                        <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name || "Sin nombre"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <Badge variant={(user as any).isActive !== false ? "default" : "secondary"}>
                      {(user as any).isActive !== false ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString("es-CO")}
                  </TableCell>
                  <TableCell>
                    {new Date(user.lastSignedIn).toLocaleDateString("es-CO")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info("Ver perfil próximamente")}>
                          Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Editar próximamente")}>
                          Editar
                        </DropdownMenuItem>
                        {user.email !== "greenhproject@gmail.com" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "investor" })}
                            >
                              Hacer inversionista
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "technician" })}
                            >
                              Hacer técnico
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
