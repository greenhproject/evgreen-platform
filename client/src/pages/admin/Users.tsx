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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, MoreVertical, UserPlus, Users, Shield, Wrench, Briefcase, Eye, Copy, Hash, Pencil, Trash2, Tag, Wallet, Plus, Minus, RotateCcw, Loader2, Download, FileSpreadsheet, FileText, ChevronDown, ChevronUp, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [showWalletAdjust, setShowWalletAdjust] = useState(false);
  const [walletAdjustType, setWalletAdjustType] = useState<"credit" | "debit" | "refund">("credit");
  const [walletAdjustAmount, setWalletAdjustAmount] = useState("");
  const [walletAdjustReason, setWalletAdjustReason] = useState("");
  const [showWalletHistory, setShowWalletHistory] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "user" as "staff" | "technician" | "investor" | "user" | "admin",
    isActive: true,
    companyName: "",
    taxId: "",
    bankAccount: "",
    bankName: "",
    technicianLicense: "",
    assignedRegion: "",
  });

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setShowWalletAdjust(false);
    setWalletAdjustAmount("");
    setWalletAdjustReason("");
    setShowWalletHistory(false);
    setShowUserModal(true);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "user",
      isActive: user.isActive !== false,
      companyName: user.companyName || "",
      taxId: user.taxId || "",
      bankAccount: user.bankAccount || "",
      bankName: user.bankName || "",
      technicianLicense: user.technicianLicense || "",
      assignedRegion: user.assignedRegion || "",
    });
    setShowEditModal(true);
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
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

  const updateFullMutation = trpc.users.updateFull.useMutation({
    onSuccess: () => {
      toast.success("Usuario actualizado correctamente");
      setShowEditModal(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuario eliminado correctamente");
      setShowDeleteDialog(false);
      setUserToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Query de billetera del usuario seleccionado
  const walletQuery = trpc.users.getUserWallet.useQuery(
    { userId: selectedUser?.id || 0 },
    { enabled: !!selectedUser && showUserModal }
  );

  // Query de transacciones de billetera
  const walletTxQuery = trpc.users.getUserWalletTransactions.useQuery(
    { userId: selectedUser?.id || 0, limit: 100 },
    { enabled: !!selectedUser && showUserModal && showWalletHistory }
  );

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      RECHARGE: "Recarga",
      CHARGE_PAYMENT: "Pago de carga",
      CHARGE: "Cargo por carga",
      RESERVATION: "Reserva",
      PENALTY: "Penalidad",
      REFUND: "Reembolso",
      SUBSCRIPTION: "Suscripción",
      ADMIN_CREDIT: "Crédito (Admin)",
      ADMIN_DEBIT: "Débito (Admin)",
      ADMIN_REFUND: "Reembolso (Admin)",
      EARNING: "Ganancia",
      STRIPE_PAYMENT: "Pago Stripe",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    if (type.includes("CREDIT") || type === "RECHARGE" || type === "REFUND" || type === "ADMIN_REFUND" || type === "EARNING" || type === "STRIPE_PAYMENT") return "text-green-600";
    if (type.includes("DEBIT") || type === "CHARGE" || type === "CHARGE_PAYMENT" || type === "PENALTY" || type === "SUBSCRIPTION") return "text-red-600";
    return "text-muted-foreground";
  };

  const handleExportPdf = async () => {
    if (!selectedUser || !walletTxQuery.data) return;
    setExportingPdf(true);
    try {
      const transactions = walletTxQuery.data;
      // Generar HTML para PDF
      const htmlContent = `
        <html><head><style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #16a34a; font-size: 22px; }
          h2 { color: #555; font-size: 16px; margin-top: 5px; }
          .info { margin: 15px 0; padding: 10px; background: #f0fdf4; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th { background: #16a34a; color: white; padding: 8px; text-align: left; }
          td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .positive { color: #16a34a; font-weight: bold; }
          .negative { color: #dc2626; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
        </style></head><body>
          <h1>⚡ EVGreen - Movimientos de Billetera</h1>
          <h2>${selectedUser.name || selectedUser.email}</h2>
          <div class="info">
            <strong>Saldo actual:</strong> $${(walletQuery.data?.balance || 0).toLocaleString("es-CO")} COP<br/>
            <strong>Total movimientos:</strong> ${transactions.length}<br/>
            <strong>Fecha de reporte:</strong> ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Saldo Antes</th><th>Saldo Después</th><th>Motivo</th></tr></thead>
            <tbody>
              ${transactions.map((tx: any) => `
                <tr>
                  <td>${new Date(tx.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>${getTypeLabel(tx.type)}</td>
                  <td class="${tx.amount >= 0 ? 'positive' : 'negative'}">$${tx.amount.toLocaleString("es-CO")} COP</td>
                  <td>$${tx.balanceBefore.toLocaleString("es-CO")}</td>
                  <td>$${tx.balanceAfter.toLocaleString("es-CO")}</td>
                  <td>${tx.description || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">Generado por EVGreen Platform - www.evgreen.lat</div>
        </body></html>
      `;
      // Crear blob y descargar
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      toast.success("PDF generado. Use Ctrl+P o Cmd+P para guardar como PDF.");
    } catch (e) {
      toast.error("Error al generar PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedUser || !walletTxQuery.data) return;
    setExportingExcel(true);
    try {
      const transactions = walletTxQuery.data;
      // Generar CSV (compatible con Excel)
      const headers = "Fecha,Tipo,Monto (COP),Saldo Antes,Saldo Después,Estado,Motivo";
      const rows = transactions.map((tx: any) => {
        const date = new Date(tx.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const desc = (tx.description || "-").replace(/,/g, ";").replace(/\n/g, " ");
        return `${date},${getTypeLabel(tx.type)},${tx.amount},${tx.balanceBefore},${tx.balanceAfter},${tx.status},"${desc}"`;
      });
      const csvContent = "\uFEFF" + headers + "\n" + rows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos_billetera_${selectedUser.name || selectedUser.id}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Archivo Excel (CSV) descargado");
    } catch (e) {
      toast.error("Error al exportar");
    } finally {
      setExportingExcel(false);
    }
  };

  const adjustWalletMutation = trpc.users.adjustWalletBalance.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Saldo ajustado. Anterior: $${data.previousBalance.toLocaleString()} → Nuevo: $${data.newBalance.toLocaleString()} COP`
      );
      setShowWalletAdjust(false);
      setWalletAdjustAmount("");
      setWalletAdjustReason("");
      walletQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleWalletAdjust = () => {
    if (!selectedUser) return;
    const amount = parseFloat(walletAdjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Ingrese un monto válido mayor a 0");
      return;
    }
    if (!walletAdjustReason.trim() || walletAdjustReason.trim().length < 3) {
      toast.error("Debe indicar un motivo (mínimo 3 caracteres)");
      return;
    }
    adjustWalletMutation.mutate({
      userId: selectedUser.id,
      amount,
      reason: walletAdjustReason.trim(),
      type: walletAdjustType,
    });
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    updateFullMutation.mutate({
      userId: selectedUser.id,
      data: editForm,
    });
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    deleteMutation.mutate({ userId: userToDelete.id });
  };

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
        !user.email?.toLowerCase().includes(query) &&
        !(user as any).idTag?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  const isMasterAccount = (email: string | null) => email === "greenhproject@gmail.com";

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o TAGID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-48">
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
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>TAGID</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead className="w-16">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Cargando usuarios...
                </TableCell>
              </TableRow>
            ) : filteredUsers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                  <TableCell className="max-w-[200px] truncate">{user.email}</TableCell>
                  <TableCell>
                    {(user as any).idTag ? (
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                          {(user as any).idTag}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard((user as any).idTag)}
                          title="Copiar TAGID"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
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
                    {user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString("es-CO") : "Nunca"}
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
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar usuario
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(user.id.toString())}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar ID
                        </DropdownMenuItem>
                        {(user as any).idTag && (
                          <DropdownMenuItem onClick={() => copyToClipboard((user as any).idTag)}>
                            <Tag className="w-4 h-4 mr-2" />
                            Copiar TAGID
                          </DropdownMenuItem>
                        )}
                        {!isMasterAccount(user.email) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "investor" })}
                              disabled={user.role === "investor"}
                            >
                              <Briefcase className="w-4 h-4 mr-2" />
                              Hacer inversionista
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "technician" })}
                              disabled={user.role === "technician"}
                            >
                              <Wrench className="w-4 h-4 mr-2" />
                              Hacer técnico
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(user)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar usuario
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

              {/* TAGID del Usuario */}
              {selectedUser.idTag && (
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <Label className="text-xs text-muted-foreground">TAGID (para identificación OCPP)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Tag className="w-4 h-4 text-green-600" />
                    <code className="text-xl font-bold font-mono text-green-600">
                      {selectedUser.idTag}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedUser.idTag)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Este código identifica al usuario en el sistema OCPP de cargadores
                  </p>
                </div>
              )}

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
                    {selectedUser.lastSignedIn ? new Date(selectedUser.lastSignedIn).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }) : "Nunca"}
                  </p>
                </div>
              </div>

              {/* Información adicional para inversionistas */}
              {selectedUser.role === "investor" && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <Label className="text-green-700 dark:text-green-400">Información de Inversionista</Label>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Empresa:</strong> {selectedUser.companyName || "No especificada"}</p>
                    <p><strong>NIT/RUT:</strong> {selectedUser.taxId || "No especificado"}</p>
                    <p><strong>Banco:</strong> {selectedUser.bankName || "No especificado"}</p>
                    <p><strong>Cuenta:</strong> {selectedUser.bankAccount || "No especificada"}</p>
                  </div>
                </div>
              )}

              {/* Billetera del Usuario */}
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> Saldo en Billetera
                    </Label>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                      {walletQuery.isLoading ? (
                        <span className="text-sm text-muted-foreground">Cargando...</span>
                      ) : (
                        `$ ${(walletQuery.data?.balance || 0).toLocaleString("es-CO")} COP`
                      )}
                    </p>
                  </div>
                </div>
                
                {/* Botones de ajuste */}
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-600/30 hover:bg-green-600/10"
                    onClick={() => {
                      setWalletAdjustType("credit");
                      setShowWalletAdjust(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-600/30 hover:bg-red-600/10"
                    onClick={() => {
                      setWalletAdjustType("debit");
                      setShowWalletAdjust(true);
                    }}
                  >
                    <Minus className="w-3 h-3 mr-1" />
                    Descontar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-600/30 hover:bg-blue-600/10"
                    onClick={() => {
                      setWalletAdjustType("refund");
                      setShowWalletAdjust(true);
                    }}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reembolso
                  </Button>
                </div>

                {/* Formulario de ajuste */}
                {showWalletAdjust && (
                  <div className="mt-3 p-3 bg-background rounded-lg border space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        walletAdjustType === "credit" ? "bg-green-100 text-green-700" :
                        walletAdjustType === "refund" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }>
                        {walletAdjustType === "credit" ? "Agregar crédito" :
                         walletAdjustType === "refund" ? "Reembolso" : "Descontar"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs">Monto (COP)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ej: 50000"
                        value={walletAdjustAmount}
                        onChange={(e) => setWalletAdjustAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Motivo / Razón</Label>
                      <Input
                        placeholder="Ej: Reembolso por fallo en cobro de carga #1234"
                        value={walletAdjustReason}
                        onChange={(e) => setWalletAdjustReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleWalletAdjust}
                        disabled={adjustWalletMutation.isPending}
                        className={
                          walletAdjustType === "credit" ? "bg-green-600 hover:bg-green-700" :
                          walletAdjustType === "refund" ? "bg-blue-600 hover:bg-blue-700" :
                          "bg-red-600 hover:bg-red-700"
                        }
                      >
                        {adjustWalletMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        Confirmar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowWalletAdjust(false);
                          setWalletAdjustAmount("");
                          setWalletAdjustReason("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Historial de Movimientos */}
              <div className="border rounded-lg">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => setShowWalletHistory(!showWalletHistory)}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <History className="w-4 h-4" />
                    Historial de Movimientos
                  </span>
                  {showWalletHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showWalletHistory && (
                  <div className="border-t">
                    {/* Botones de exportación */}
                    <div className="flex gap-2 p-3 border-b bg-muted/30">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportPdf}
                        disabled={exportingPdf || !walletTxQuery.data?.length}
                      >
                        {exportingPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileText className="w-3 h-3 mr-1" />}
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportExcel}
                        disabled={exportingExcel || !walletTxQuery.data?.length}
                      >
                        {exportingExcel ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileSpreadsheet className="w-3 h-3 mr-1" />}
                        Excel
                      </Button>
                    </div>
                    
                    {/* Tabla de transacciones */}
                    <div className="max-h-64 overflow-y-auto">
                      {walletTxQuery.isLoading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Cargando movimientos...</div>
                      ) : !walletTxQuery.data?.length ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Sin movimientos registrados</div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted">
                            <tr>
                              <th className="text-left p-2">Fecha</th>
                              <th className="text-left p-2">Tipo</th>
                              <th className="text-right p-2">Monto</th>
                              <th className="text-right p-2">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {walletTxQuery.data.map((tx: any) => (
                              <tr key={tx.id} className="border-t hover:bg-muted/30" title={tx.description || ""}>
                                <td className="p-2 whitespace-nowrap">
                                  {new Date(tx.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                </td>
                                <td className="p-2">
                                  <span className="truncate block max-w-[120px]">{getTypeLabel(tx.type)}</span>
                                  {tx.description && (
                                    <span className="text-[10px] text-muted-foreground truncate block max-w-[120px]">{tx.description}</span>
                                  )}
                                </td>
                                <td className={`p-2 text-right font-medium whitespace-nowrap ${getTypeColor(tx.type)}`}>
                                  {tx.amount >= 0 ? "+" : ""}${tx.amount.toLocaleString("es-CO")}
                                </td>
                                <td className="p-2 text-right whitespace-nowrap">
                                  ${tx.balanceAfter.toLocaleString("es-CO")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowUserModal(false);
                    handleEditUser(selectedUser);
                  }}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Editar
                </Button>
                {!isMasterAccount(selectedUser.email) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-600"
                    onClick={() => {
                      setShowUserModal(false);
                      handleDeleteClick(selectedUser);
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edición de Usuario */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Editar Usuario
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del usuario. Los cambios se guardarán inmediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+57 300 123 4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="usuario@ejemplo.com"
                disabled={isMasterAccount(selectedUser?.email)}
              />
              {isMasterAccount(selectedUser?.email) && (
                <p className="text-xs text-muted-foreground">El email de la cuenta maestra no se puede modificar</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rol</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value: any) => setEditForm({ ...editForm, role: value })}
                  disabled={isMasterAccount(selectedUser?.email)}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="investor">Inversionista</SelectItem>
                    <SelectItem value="technician">Técnico</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Estado</Label>
                <Select
                  value={editForm.isActive ? "active" : "inactive"}
                  onValueChange={(value) => setEditForm({ ...editForm, isActive: value === "active" })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos adicionales para inversionistas */}
            {editForm.role === "investor" && (
              <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <Label className="text-green-700 dark:text-green-400 font-medium">Información de Inversionista</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-company">Empresa</Label>
                    <Input
                      id="edit-company"
                      value={editForm.companyName}
                      onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-tax">NIT/RUT</Label>
                    <Input
                      id="edit-tax"
                      value={editForm.taxId}
                      onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                      placeholder="123456789-0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-bank">Banco</Label>
                    <Input
                      id="edit-bank"
                      value={editForm.bankName}
                      onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                      placeholder="Nombre del banco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-account">Cuenta Bancaria</Label>
                    <Input
                      id="edit-account"
                      value={editForm.bankAccount}
                      onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })}
                      placeholder="Número de cuenta"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Campos adicionales para técnicos */}
            {editForm.role === "technician" && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label className="text-blue-700 dark:text-blue-400 font-medium">Información de Técnico</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-license">Licencia</Label>
                    <Input
                      id="edit-license"
                      value={editForm.technicianLicense}
                      onChange={(e) => setEditForm({ ...editForm, technicianLicense: e.target.value })}
                      placeholder="Número de licencia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-region">Región Asignada</Label>
                    <Input
                      id="edit-region"
                      value={editForm.assignedRegion}
                      onChange={(e) => setEditForm({ ...editForm, assignedRegion: e.target.value })}
                      placeholder="Bogotá, Medellín, etc."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateFullMutation.isPending}>
              {updateFullMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el usuario{" "}
              <strong>{userToDelete?.name || userToDelete?.email}</strong> y todos sus datos asociados
              (billetera, notificaciones, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
