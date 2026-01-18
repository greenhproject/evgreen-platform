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
import { Search, MoreVertical, UserPlus, Users, Shield, Wrench, Briefcase, Eye, Copy, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("ID copiado al portapapeles");
  };

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
              <TableHead className="w-20">ID</TableHead>
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
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {user.id}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(user.id.toString())}
                        title="Copiar ID"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
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
                        <DropdownMenuItem onClick={() => handleViewUser(user)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(user.id.toString())}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar ID
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

      {/* Modal de Detalles de Usuario */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Detalles del Usuario
            </DialogTitle>
            <DialogDescription>
              Información completa del usuario
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              {/* ID del Usuario - Destacado */}
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <Label className="text-xs text-muted-foreground">ID del Usuario (para asignar estaciones)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Hash className="w-4 h-4 text-primary" />
                  <code className="text-2xl font-bold font-mono text-primary">
                    {selectedUser.id}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedUser.id.toString())}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use este ID en el campo "ID Propietario" al crear o editar estaciones
                </p>
              </div>

              {/* Información del usuario */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nombre</Label>
                  <p className="font-medium">{selectedUser.name || "Sin nombre"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rol</Label>
                  <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{selectedUser.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Registro</Label>
                  <p className="text-sm">
                    {new Date(selectedUser.createdAt).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Último acceso</Label>
                  <p className="text-sm">
                    {new Date(selectedUser.lastSignedIn).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Información adicional para inversionistas */}
              {selectedUser.role === "investor" && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <Label className="text-green-700 dark:text-green-400">Información de Inversionista</Label>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Empresa:</strong> {(selectedUser as any).companyName || "No especificada"}</p>
                    <p><strong>NIT/RUT:</strong> {(selectedUser as any).taxId || "No especificado"}</p>
                    <p><strong>Banco:</strong> {(selectedUser as any).bankName || "No especificado"}</p>
                    <p><strong>Cuenta:</strong> {(selectedUser as any).bankAccount || "No especificada"}</p>
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedUser.email !== "greenhproject@gmail.com" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateRoleMutation.mutate({ userId: selectedUser.id, role: "investor" });
                        setShowUserModal(false);
                      }}
                      disabled={selectedUser.role === "investor"}
                    >
                      <Briefcase className="w-3 h-3 mr-1" />
                      Hacer Inversionista
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateRoleMutation.mutate({ userId: selectedUser.id, role: "technician" });
                        setShowUserModal(false);
                      }}
                      disabled={selectedUser.role === "technician"}
                    >
                      <Wrench className="w-3 h-3 mr-1" />
                      Hacer Técnico
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
