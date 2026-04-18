import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Crown, Star, Building2, Users, Camera, Upload, Pencil,
  Award, Gem, Shield, TrendingUp, MapPin, DollarSign, Eye, EyeOff,
  Percent, Zap, Trash2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const BADGE_OPTIONS = [
  { value: "emerald", label: "Esmeralda", icon: Gem, color: "bg-emerald-500 text-white" },
  { value: "gold", label: "Oro", icon: Award, color: "bg-yellow-500 text-white" },
  { value: "platinum", label: "Platino", icon: Shield, color: "bg-slate-400 text-white" },
  { value: "diamond", label: "Diamante", icon: Star, color: "bg-cyan-400 text-white" },
];

const TYPE_OPTIONS = [
  { value: "individual", label: "Dueño Individual", desc: "Propietario de estación completa", icon: Building2, color: "text-blue-500" },
  { value: "collective", label: "Participación Colectiva", desc: "Participación en estación colectiva", icon: Users, color: "text-purple-500" },
  { value: "founder", label: "Fundador", desc: "Inversionista fundador del proyecto", icon: Crown, color: "text-amber-500" },
];

export default function InvestorManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvestor, setSelectedInvestor] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [investorToDelete, setInvestorToDelete] = useState<any>(null);
  const [deleteUserAccount, setDeleteUserAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: investors, isLoading, refetch } = trpc.investorManagement.list.useQuery();
  const updateProfile = trpc.investorManagement.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil de inversionista actualizado");
      refetch();
      setShowEditModal(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadPhoto = trpc.investorManagement.uploadPhoto.useMutation({
    onSuccess: (data) => {
      toast.success("Foto subida correctamente");
      setSelectedInvestor((prev: any) => prev ? { ...prev, investorPhotoUrl: data.photoUrl } : null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteInvestor = trpc.investorManagement.deleteInvestor.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
      setShowDeleteModal(false);
      setInvestorToDelete(null);
      setDeleteConfirmText("");
      setDeleteUserAccount(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // Form state - ahora con investorTypes como array (checkboxes múltiples)
  const [editForm, setEditForm] = useState({
    investorTypes: [] as string[],
    isFounder: false,
    founderTitle: "",
    founderOrder: 0,
    investorQuote: "",
    investorBio: "",
    investorBadge: "" as string,
    investorShowInWall: true,
  });

  const openEditModal = (investor: any) => {
    setSelectedInvestor(investor);
    // Normalizar investorTypes del backend
    let types: string[] = [];
    if (investor.investorTypes && Array.isArray(investor.investorTypes) && investor.investorTypes.length > 0) {
      types = [...investor.investorTypes];
    } else if (investor.investorType) {
      types = [investor.investorType];
    }
    if (investor.isFounder && !types.includes("founder")) types.push("founder");
    
    setEditForm({
      investorTypes: types,
      isFounder: types.includes("founder") || investor.isFounder || false,
      founderTitle: investor.founderTitle || "",
      founderOrder: investor.founderOrder || 0,
      investorQuote: investor.investorQuote || "",
      investorBio: investor.investorBio || "",
      investorBadge: investor.investorBadge || "",
      investorShowInWall: investor.investorShowInWall !== false,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (investor: any) => {
    setInvestorToDelete(investor);
    setDeleteConfirmText("");
    setDeleteUserAccount(false);
    setShowDeleteModal(true);
  };

  const handleDelete = () => {
    if (!investorToDelete || deleteConfirmText !== "ELIMINAR") return;
    deleteInvestor.mutate({
      userId: investorToDelete.id,
      deleteUserAccount,
    });
  };

  const toggleType = (type: string) => {
    setEditForm((f) => {
      const newTypes = f.investorTypes.includes(type)
        ? f.investorTypes.filter((t) => t !== type)
        : [...f.investorTypes, type];
      return {
        ...f,
        investorTypes: newTypes,
        isFounder: newTypes.includes("founder"),
      };
    });
  };

  const handleSave = () => {
    if (!selectedInvestor) return;
    updateProfile.mutate({
      userId: selectedInvestor.id,
      investorTypes: editForm.investorTypes as any,
      isFounder: editForm.investorTypes.includes("founder"),
      founderTitle: editForm.founderTitle || null,
      founderOrder: editForm.founderOrder || null,
      investorQuote: editForm.investorQuote || null,
      investorBio: editForm.investorBio || null,
      investorBadge: editForm.investorBadge as any || null,
      investorShowInWall: editForm.investorShowInWall,
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedInvestor) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadPhoto.mutate({
          userId: selectedInvestor.id,
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type,
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(amount);

  const getBadgeInfo = (badge: string | null) =>
    BADGE_OPTIONS.find((b) => b.value === badge) || null;

  // Obtener labels de tipos múltiples
  const getTypeLabels = (investor: any) => {
    const types: string[] = investor.investorTypes && Array.isArray(investor.investorTypes) && investor.investorTypes.length > 0
      ? investor.investorTypes
      : investor.investorType ? [investor.investorType] : [];
    if (investor.isFounder && !types.includes("founder")) types.push("founder");
    return types;
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "individual": return "bg-blue-100 text-blue-700 border-blue-200";
      case "collective": return "bg-purple-100 text-purple-700 border-purple-200";
      case "founder": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeLabel = (type: string) => {
    return TYPE_OPTIONS.find((t) => t.value === type)?.label || type;
  };

  const filtered = investors?.filter((inv: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.name?.toLowerCase().includes(q) ||
      inv.email?.toLowerCase().includes(q) ||
      inv.companyName?.toLowerCase().includes(q)
    );
  });

  // Stats - ahora basados en investorTypes (array)
  const totalInvestors = investors?.length || 0;
  const founders = investors?.filter((i: any) => {
    const types = getTypeLabels(i);
    return types.includes("founder");
  })?.length || 0;
  const individualOwners = investors?.filter((i: any) => {
    const types = getTypeLabels(i);
    return types.includes("individual");
  })?.length || 0;
  const collectiveOwners = investors?.filter((i: any) => {
    const types = getTypeLabels(i);
    return types.includes("collective");
  })?.length || 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Inversionistas</h1>
        <p className="text-muted-foreground">Administra perfiles, tipos (no excluyentes), insignias y el muro de fundadores</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{totalInvestors}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fundadores</p>
              <p className="text-xl font-bold">{founders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Individuales</p>
              <p className="text-xl font-bold">{individualOwners}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Colectivos</p>
              <p className="text-xl font-bold">{collectiveOwners}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar inversionista..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inversionista</TableHead>
                <TableHead>Tipos</TableHead>
                <TableHead>Insignia</TableHead>
                <TableHead>Estaciones / Participaciones</TableHead>
                <TableHead>Invertido</TableHead>
                <TableHead>Muro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando inversionistas...
                  </TableCell>
                </TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron inversionistas
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((inv: any) => {
                  const badgeInfo = getBadgeInfo(inv.investorBadge);
                  const types = getTypeLabels(inv);
                  const isProtected = inv.email === "Admin@greenhproject.com" || inv.email === "greenhproject@gmail.com";
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10 border-2 border-emerald-500/20">
                              <AvatarImage src={inv.investorPhotoUrl || inv.avatarUrl} />
                              <AvatarFallback className="bg-emerald-500/10 text-emerald-600 text-sm font-bold">
                                {inv.name?.charAt(0)?.toUpperCase() || "I"}
                              </AvatarFallback>
                            </Avatar>
                            {types.includes("founder") && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                <Crown className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{inv.name || "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">{inv.email}</p>
                            {inv.companyName && (
                              <p className="text-xs text-muted-foreground">{inv.companyName}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {types.length > 0 ? types.map((type) => (
                            <Badge key={type} variant="outline" className={`text-xs ${getTypeBadgeColor(type)}`}>
                              {getTypeLabel(type)}
                            </Badge>
                          )) : (
                            <span className="text-xs text-muted-foreground">Sin asignar</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {badgeInfo ? (
                          <Badge className={`${badgeInfo.color} text-xs`}>
                            <badgeInfo.icon className="w-3 h-3 mr-1" />
                            {badgeInfo.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {(inv.ownedStations?.length || 0) > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                              <Building2 className="w-3 h-3 text-blue-500" />
                              <span>{inv.ownedStations.length} estación(es) propia(s)</span>
                            </div>
                          )}
                          {(inv.participations?.length || 0) > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                              <Users className="w-3 h-3 text-purple-500" />
                              <span>{inv.participations.length} participación(es)</span>
                            </div>
                          )}
                          {(inv.ownedStations?.length || 0) === 0 && (inv.participations?.length || 0) === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {formatCurrency(inv.totalInvested || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {inv.investorShowInWall !== false ? (
                          <Eye className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEditModal(inv)}>
                            <Pencil className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          {!isProtected && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
                              onClick={() => openDeleteModal(inv)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteModal(false);
          setInvestorToDelete(null);
          setDeleteConfirmText("");
          setDeleteUserAccount(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Inversionista
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán los datos del inversionista.
            </DialogDescription>
          </DialogHeader>

          {investorToDelete && (
            <div className="space-y-4 py-2">
              {/* Investor info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={investorToDelete.investorPhotoUrl || investorToDelete.avatarUrl} />
                  <AvatarFallback className="bg-red-500/10 text-red-600 text-sm font-bold">
                    {investorToDelete.name?.charAt(0)?.toUpperCase() || "I"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{investorToDelete.name || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">{investorToDelete.email}</p>
                </div>
              </div>

              {/* Warning about data */}
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2">
                <p className="text-sm font-medium text-red-400">Se eliminarán los siguientes datos:</p>
                <ul className="text-xs text-red-300 space-y-1 ml-4 list-disc">
                  {(investorToDelete.participations?.length || 0) > 0 && (
                    <li>{investorToDelete.participations.length} participación(es) de crowdfunding ({formatCurrency(investorToDelete.totalInvested || 0)} invertidos)</li>
                  )}
                  <li>Liquidaciones (payouts) pendientes y pagadas</li>
                  <li>Perfil de inversionista (tipo, insignia, foto, biografía)</li>
                  <li>Datos de onboarding</li>
                  {investorToDelete.isFounder && (
                    <li>Perfil de fundador y visibilidad en el muro</li>
                  )}
                </ul>
              </div>

              {/* Option: delete user account too */}
              <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
                <Checkbox
                  id="deleteAccount"
                  checked={deleteUserAccount}
                  onCheckedChange={(v) => setDeleteUserAccount(v === true)}
                  className="mt-0.5 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                />
                <div>
                  <Label htmlFor="deleteAccount" className="text-sm font-medium cursor-pointer">
                    También eliminar la cuenta de usuario
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Si no se marca, el usuario se convertirá en usuario normal (rol "user") y podrá seguir usando la plataforma sin privilegios de inversionista.
                  </p>
                </div>
              </div>

              {/* Confirmation input */}
              <div className="space-y-2">
                <Label className="text-sm">
                  Escribe <span className="font-mono font-bold text-red-400">ELIMINAR</span> para confirmar:
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmText !== "ELIMINAR" || deleteInvestor.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteInvestor.isPending ? (
                "Eliminando..."
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  {deleteUserAccount ? "Eliminar Inversionista y Cuenta" : "Eliminar Inversionista"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-14 w-14 border-2 border-emerald-500/30">
                  <AvatarImage src={selectedInvestor?.investorPhotoUrl || selectedInvestor?.avatarUrl} />
                  <AvatarFallback className="bg-emerald-500/10 text-emerald-600 text-lg font-bold">
                    {selectedInvestor?.name?.charAt(0)?.toUpperCase() || "I"}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              <div>
                <span>{selectedInvestor?.name || "Inversionista"}</span>
                <p className="text-sm font-normal text-muted-foreground">{selectedInvestor?.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Tipos de inversionista - CHECKBOXES MÚLTIPLES (no excluyentes) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipos de Inversionista (no excluyentes)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Un inversionista puede tener múltiples tipos simultáneamente
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TYPE_OPTIONS.map((opt) => {
                  const isChecked = editForm.investorTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleType(opt.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        isChecked
                          ? "border-emerald-500 bg-emerald-500/5"
                          : "border-border hover:border-emerald-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleType(opt.value)}
                          className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <opt.icon className={`w-4 h-4 ${opt.color}`} />
                        <p className="font-medium text-sm">{opt.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-8">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fundador - solo si está seleccionado el tipo fundador */}
            {editForm.investorTypes.includes("founder") && (
              <Card className="p-4 bg-amber-500/5 border-amber-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <Label className="text-sm font-semibold">Configuración de Fundador</Label>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Título de Fundador</Label>
                    <Input
                      placeholder="Ej: Co-Fundador, Fundador Visionario..."
                      value={editForm.founderTitle}
                      onChange={(e) => setEditForm((f) => ({ ...f, founderTitle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Orden en el Muro</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editForm.founderOrder}
                      onChange={(e) => setEditForm((f) => ({ ...f, founderOrder: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Insignia */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Insignia</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BADGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditForm((f) => ({ ...f, investorBadge: f.investorBadge === opt.value ? "" : opt.value }))}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      editForm.investorBadge === opt.value
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-border hover:border-emerald-500/30"
                    }`}
                  >
                    <opt.icon className={`w-6 h-6 mx-auto mb-1 ${
                      opt.value === "emerald" ? "text-emerald-500" :
                      opt.value === "gold" ? "text-yellow-500" :
                      opt.value === "platinum" ? "text-slate-400" :
                      "text-cyan-400"
                    }`} />
                    <p className="text-xs font-medium">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Frase y Bio */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Frase del Inversionista</Label>
                <Textarea
                  placeholder="Una frase inspiradora o motivacional..."
                  value={editForm.investorQuote}
                  onChange={(e) => setEditForm((f) => ({ ...f, investorQuote: e.target.value }))}
                  maxLength={500}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">{editForm.investorQuote.length}/500</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Biografía Corta</Label>
                <Textarea
                  placeholder="Breve descripción del inversionista..."
                  value={editForm.investorBio}
                  onChange={(e) => setEditForm((f) => ({ ...f, investorBio: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            {/* Visibilidad en muro */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
              <div>
                <p className="text-sm font-medium">Visible en Muro de Fundadores</p>
                <p className="text-xs text-muted-foreground">Mostrar en la sección pública del muro</p>
              </div>
              <Switch
                checked={editForm.investorShowInWall}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, investorShowInWall: v }))}
              />
            </div>

            {/* Participaciones en proyectos colectivos (crowdfunding) */}
            {selectedInvestor?.participations?.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  Participaciones Colectivas (Crowdfunding)
                </Label>
                <div className="space-y-2">
                  {selectedInvestor.participations.map((p: any) => (
                    <div key={p.id} className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{p.project?.name || "Proyecto"}</p>
                        <Badge variant="outline" className={`text-xs ${
                          p.paymentStatus === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {p.paymentStatus === "COMPLETED" ? "Pagado" : "Pendiente"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Inversión</p>
                          <p className="font-bold text-sm">{formatCurrency(Number(p.amount))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">% Participación</p>
                          <p className="font-bold text-sm flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            {Number(p.participationPercent).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Meta del Proyecto</p>
                          <p className="font-bold text-sm">{formatCurrency(Number(p.project?.targetAmount || 0))}</p>
                        </div>
                      </div>
                      {p.project?.city && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {p.project.city}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estaciones propias */}
            {selectedInvestor?.ownedStations?.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  Estaciones Propias (Individual)
                </Label>
                <div className="space-y-2">
                  {selectedInvestor.ownedStations.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.city} - {s.address}</p>
                        </div>
                      </div>
                      <Badge className={s.isOnline ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {s.isOnline ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {updateProfile.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
