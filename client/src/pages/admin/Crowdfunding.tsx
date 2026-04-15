/**
 * Panel de Administración de Crowdfunding
 * Gestión de proyectos de inversión colectiva y participaciones
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Building2,
  Users,
  DollarSign,
  MapPin,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sun,
  TrendingUp,
  Eye,
  Bell,
  UserPlus,
  Building,
  CreditCard,
  Phone,
  Mail,
  Briefcase,
  Search,
  Link2,
  X
} from "lucide-react";
import { toast } from "sonner";

// Estados de proyecto
const PROJECT_STATUSES = [
  { value: "DRAFT", label: "Borrador", color: "bg-gray-500" },
  { value: "OPEN", label: "Abierto", color: "bg-blue-500" },
  { value: "IN_PROGRESS", label: "En Progreso", color: "bg-amber-500" },
  { value: "FUNDED", label: "Financiado", color: "bg-green-500" },
  { value: "CLOSED", label: "Cerrado", color: "bg-red-500" },
];

// Estados de pago
const PAYMENT_STATUSES = [
  { value: "PENDING", label: "Pendiente", color: "bg-yellow-500" },
  { value: "COMPLETED", label: "Completado", color: "bg-green-500" },
  { value: "CANCELLED", label: "Cancelado", color: "bg-red-500" },
  { value: "FAILED", label: "Fallido", color: "bg-red-500" },
  { value: "REFUNDED", label: "Reembolsado", color: "bg-purple-500" },
];

interface Project {
  id: number;
  name: string;
  description: string | null;
  city: string;
  zone: string;
  address: string | null;
  targetAmount: number;
  raisedAmount: number;
  minimumInvestment: number;
  investorCount?: number;
  totalPowerKw: number | null;
  chargerCount: number | null;
  chargerPowerKw: number | null;
  hasSolarPanels: boolean;
  estimatedRoiPercent: number | string | null;
  estimatedPaybackMonths: number | string | null;
  status: string;
  targetDate: Date | null;
  priority: number;
  stationId: number | null;
  createdAt: Date;
}

interface Participation {
  id: number;
  projectId: number;
  investorId: number;
  amount: number;
  participationPercent: number;
  paymentStatus: string;
  paymentDate: Date | null;
  paymentReference?: string;
  createdAt: Date;
  investor?: {
    id: number;
    name: string;
    email: string;
  };
}

export default function AdminCrowdfunding() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showParticipationsDialog, setShowParticipationsDialog] = useState(false);
  const [showRegisterInvestorDialog, setShowRegisterInvestorDialog] = useState(false);
  
  // Edit participation state
  const [editingParticipation, setEditingParticipation] = useState<Participation | null>(null);
  const [showEditParticipationDialog, setShowEditParticipationDialog] = useState(false);
  const [editPartData, setEditPartData] = useState({
    amount: 0,
    paymentStatus: "PENDING",
    paymentReference: "",
  });
  
  // User search for linking
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedLinkedUser, setSelectedLinkedUser] = useState<any>(null);
  const [showUserSearchInEdit, setShowUserSearchInEdit] = useState(false);

  const [investorFormData, setInvestorFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    taxId: "",
    bankAccount: "",
    bankName: "",
    amount: 50000000,
    paymentReference: "",
    paymentConfirmed: false,
  });
  
  // User search for register form
  const [registerUserSearch, setRegisterUserSearch] = useState("");
  const [selectedRegisterUser, setSelectedRegisterUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    city: "",
    zone: "",
    address: "",
    targetAmount: 1000000000,
    raisedAmount: 0,
    minimumInvestment: 50000000,
    totalPowerKw: 480,
    chargerCount: 4,
    chargerPowerKw: 120,
    hasSolarPanels: true,
    estimatedRoiPercent: 85,
    estimatedPaybackMonths: 14,
    status: "DRAFT",
    targetDate: "",
    priority: 1,
    // Modelo financiero
    evgreenSharePercent: "30.00",
    investorSharePercent: "70.00",
    hostSharePercent: "10.00",
    energyPurchaseCostPerKwh: "800.00",
    hostName: "",
    latitude: "",
    longitude: "",
  });

  const { data: projects, isLoading, refetch } = trpc.crowdfunding.getAllProjects.useQuery();
  const { data: participations, refetch: refetchParticipations } = trpc.crowdfunding.getParticipations.useQuery(
    { projectId: selectedProject?.id || 0 },
    { enabled: !!selectedProject }
  );
  
  // User search query
  const { data: searchedUsers } = trpc.crowdfunding.searchUsers.useQuery(
    { query: userSearchQuery },
    { enabled: userSearchQuery.length >= 2 }
  );
  
  const { data: registerSearchedUsers } = trpc.crowdfunding.searchUsers.useQuery(
    { query: registerUserSearch },
    { enabled: registerUserSearch.length >= 2 }
  );
  
  const createMutation = trpc.crowdfunding.createProject.useMutation({
    onSuccess: () => {
      toast.success("Proyecto creado exitosamente");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear proyecto");
    },
  });

  const updateMutation = trpc.crowdfunding.updateProject.useMutation({
    onSuccess: () => {
      toast.success("Proyecto actualizado");
      setEditingProject(null);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar");
    },
  });

  const confirmPaymentMutation = trpc.crowdfunding.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success("Pago confirmado exitosamente");
      refetchParticipations();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al confirmar pago");
    },
  });

  const registerInvestorMutation = trpc.crowdfunding.registerInvestor.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Inversionista registrado exitosamente");
      setShowRegisterInvestorDialog(false);
      resetInvestorForm();
      refetchParticipations();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar inversionista");
    },
  });

  const editParticipationMutation = trpc.crowdfunding.editParticipation.useMutation({
    onSuccess: () => {
      toast.success("Participación actualizada");
      setShowEditParticipationDialog(false);
      setEditingParticipation(null);
      setSelectedLinkedUser(null);
      refetchParticipations();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar participación");
    },
  });

  const deleteParticipationMutation = trpc.crowdfunding.deleteParticipation.useMutation({
    onSuccess: () => {
      toast.success("Participación eliminada");
      refetchParticipations();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar participación");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      city: "",
      zone: "",
      address: "",
      targetAmount: 1000000000,
      raisedAmount: 0,
      minimumInvestment: 50000000,
      totalPowerKw: 480,
      chargerCount: 4,
      chargerPowerKw: 120,
      hasSolarPanels: true,
      estimatedRoiPercent: 85,
      estimatedPaybackMonths: 14,
      status: "DRAFT",
      targetDate: "",
      priority: 1,
      evgreenSharePercent: "30.00",
      investorSharePercent: "70.00",
      hostSharePercent: "10.00",
      energyPurchaseCostPerKwh: "800.00",
      hostName: "",
      latitude: "",
      longitude: "",
    });
  };

  const resetInvestorForm = () => {
    setInvestorFormData({
      name: "",
      email: "",
      phone: "",
      companyName: "",
      taxId: "",
      bankAccount: "",
      bankName: "",
      amount: selectedProject?.minimumInvestment ? Number(selectedProject.minimumInvestment) : 50000000,
      paymentReference: "",
      paymentConfirmed: false,
    });
    setRegisterUserSearch("");
    setSelectedRegisterUser(null);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || "",
      city: project.city,
      zone: project.zone,
      address: project.address || "",
      targetAmount: Number(project.targetAmount),
      raisedAmount: Number(project.raisedAmount) || 0,
      minimumInvestment: Number(project.minimumInvestment),
      totalPowerKw: project.totalPowerKw || 480,
      chargerCount: project.chargerCount || 4,
      chargerPowerKw: project.chargerPowerKw || 120,
      hasSolarPanels: project.hasSolarPanels,
      estimatedRoiPercent: Number(project.estimatedRoiPercent) || 85,
      estimatedPaybackMonths: Number(project.estimatedPaybackMonths) || 14,
      status: project.status,
      targetDate: project.targetDate ? new Date(project.targetDate).toISOString().split('T')[0] : "",
      priority: project.priority,
      evgreenSharePercent: (project as any).evgreenSharePercent || "30.00",
      investorSharePercent: (project as any).investorSharePercent || "70.00",
      hostSharePercent: (project as any).hostSharePercent || "10.00",
      energyPurchaseCostPerKwh: (project as any).energyPurchaseCostPerKwh || "800.00",
      hostName: (project as any).hostName || "",
      latitude: (project as any).latitude || "",
      longitude: (project as any).longitude || "",
    });
  };

  const handleSubmit = () => {
    // Validar que EVGreen + Inversionista sumen 100% (el aliado es % separado sobre margen bruto)
    const evInvSum = parseFloat(formData.evgreenSharePercent || '0') + parseFloat(formData.investorSharePercent || '0');
    if (Math.abs(evInvSum - 100) > 0.1) {
      toast.error(`EVGreen + Inversionista deben sumar 100%. Actual: ${evInvSum.toFixed(2)}%. El % Aliado Comercial se aplica por separado sobre el margen bruto.`);
      return;
    }
    const hostPctVal = parseFloat(formData.hostSharePercent || '0');
    if (hostPctVal < 0 || hostPctVal > 50) {
      toast.error(`El % del Aliado Comercial debe estar entre 0% y 50%. Actual: ${hostPctVal.toFixed(2)}%`);
      return;
    }

    const { raisedAmount, ...rest } = formData;
    const data = {
      ...rest,
      targetDate: formData.targetDate ? new Date(formData.targetDate) : undefined,
      hostName: formData.hostName || undefined,
      latitude: formData.latitude || undefined,
      longitude: formData.longitude || undefined,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleViewParticipations = (project: Project) => {
    setSelectedProject(project);
    setShowParticipationsDialog(true);
  };

  const handleConfirmPayment = (participationId: number) => {
    if (confirm("¿Confirmar el pago de esta participación?")) {
      confirmPaymentMutation.mutate({ participationId });
    }
  };

  const handleEditParticipation = (participation: Participation) => {
    setEditingParticipation(participation);
    setEditPartData({
      amount: Number(participation.amount),
      paymentStatus: participation.paymentStatus,
      paymentReference: participation.paymentReference || "",
    });
    setSelectedLinkedUser(participation.investor ? {
      id: participation.investor.id,
      name: participation.investor.name,
      email: participation.investor.email,
    } : null);
    setShowUserSearchInEdit(false);
    setUserSearchQuery("");
    setShowEditParticipationDialog(true);
  };

  const handleDeleteParticipation = (participationId: number) => {
    if (confirm("¿Estás seguro de eliminar esta participación? Esta acción no se puede deshacer.")) {
      deleteParticipationMutation.mutate({ participationId });
    }
  };

  const handleSaveEditParticipation = () => {
    if (!editingParticipation) return;
    const mutationData: any = {
      participationId: editingParticipation.id,
    };
    if (editPartData.amount !== Number(editingParticipation.amount)) {
      mutationData.amount = editPartData.amount;
    }
    if (editPartData.paymentStatus !== editingParticipation.paymentStatus) {
      mutationData.paymentStatus = editPartData.paymentStatus;
    }
    if (editPartData.paymentReference !== (editingParticipation.paymentReference || "")) {
      mutationData.paymentReference = editPartData.paymentReference;
    }
    if (selectedLinkedUser && selectedLinkedUser.id !== editingParticipation.investorId) {
      mutationData.investorId = selectedLinkedUser.id;
    }
    editParticipationMutation.mutate(mutationData);
  };

  // When user selects a registered user in the register form, auto-fill fields
  const handleSelectRegisterUser = (user: any) => {
    setSelectedRegisterUser(user);
    setInvestorFormData({
      ...investorFormData,
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      companyName: user.companyName || "",
      taxId: user.taxId || "",
      bankAccount: user.bankAccount || "",
      bankName: user.bankName || "",
    });
    setRegisterUserSearch("");
  };

  const formatCOP = (valor: number) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  const formatCOPShort = (valor: number) => {
    if (valor >= 1000000000) {
      return `$${(valor / 1000000000).toFixed(1)}MM`;
    }
    if (valor >= 1000000) {
      return `$${(valor / 1000000).toFixed(0)}M`;
    }
    return formatCOP(valor);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = PROJECT_STATUSES.find(s => s.value === status);
    return (
      <Badge className={`${statusConfig?.color || 'bg-gray-500'} text-white`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig = PAYMENT_STATUSES.find(s => s.value === status);
    return (
      <Badge className={`${statusConfig?.color || 'bg-gray-500'} text-white`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // Calcular estadísticas
  const stats = {
    totalProjects: projects?.length || 0,
    activeProjects: projects?.filter(p => p.status === 'OPEN' || p.status === 'IN_PROGRESS').length || 0,
    totalRaised: projects?.reduce((sum, p) => sum + Number(p.raisedAmount), 0) || 0,
    totalInvestors: projects?.reduce((sum, p) => sum + (p.investorCount || 0), 0) || 0,
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            Gestión de Crowdfunding
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra proyectos de inversión colectiva y participaciones
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-muted-foreground">Proyectos</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{stats.totalProjects}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-muted-foreground">Activos</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{stats.activeProjects}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-500" />
            <p className="text-xs text-muted-foreground">Recaudado</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{formatCOPShort(stats.totalRaised)}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-500" />
            <p className="text-xs text-muted-foreground">Inversionistas</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{stats.totalInvestors}</p>
        </Card>
      </div>

      {/* Lista de proyectos - Vista móvil: tarjetas, Desktop: tabla */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando proyectos...</div>
      ) : !projects || projects.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay proyectos creados</p>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            Crear primer proyecto
          </Button>
        </Card>
      ) : (
        <>
          {/* Vista móvil - tarjetas */}
          <div className="sm:hidden space-y-3">
            {projects.map((project: any) => (
              <Card key={project.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{project.city}</h3>
                    <p className="text-xs text-muted-foreground">{project.zone}</p>
                  </div>
                  {getStatusBadge(project.status)}
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Recaudado</span>
                    <span className="font-medium">{formatCOPShort(Number(project.raisedAmount))} / {formatCOPShort(Number(project.targetAmount))}</span>
                  </div>
                  <Progress value={(Number(project.raisedAmount) / Number(project.targetAmount)) * 100} className="h-2" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {project.investorCount || 0}
                    </span>
                    <span className="text-muted-foreground">
                      {project.targetDate ? new Date(project.targetDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => handleViewParticipations(project)}>
                    <Eye className="w-3 h-3 mr-1" /> Ver
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { handleEdit(project); setShowCreateDialog(true); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Vista desktop - tabla */}
          <div className="hidden sm:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Recaudado</TableHead>
                    <TableHead>Inversionistas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Objetivo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project: any) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{project.city}</p>
                          <p className="text-sm text-muted-foreground">{project.zone}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCOPShort(Number(project.targetAmount))}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-green-600">{formatCOPShort(Number(project.raisedAmount))}</p>
                          <Progress value={(Number(project.raisedAmount) / Number(project.targetAmount)) * 100} className="h-1.5 w-20" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {project.investorCount || 0}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        {project.targetDate 
                          ? new Date(project.targetDate).toLocaleDateString('es-CO')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleViewParticipations(project)}>
                            <Eye className="w-4 h-4 mr-1" /> Ver
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { handleEdit(project); setShowCreateDialog(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}

      {/* Dialog para crear/editar proyecto */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setEditingProject(null); resetForm(); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Editar Proyecto" : "Nuevo Proyecto de Inversión"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="technical">Técnico</TabsTrigger>
              <TabsTrigger value="financial">Inversión</TabsTrigger>
              <TabsTrigger value="model">Modelo</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre del Proyecto</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Electrolinera Norte" />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Bogotá" />
                </div>
                <div>
                  <Label>Zona</Label>
                  <Input value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} placeholder="Zona Norte" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Dirección</Label>
                  <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Cra 7 #123-45" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Descripción</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción del proyecto..." rows={3} />
                </div>
                <div>
                  <Label>Fecha Objetivo</Label>
                  <Input type="date" value={formData.targetDate} onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })} />
                </div>
                <div>
                  <Label>Prioridad</Label>
                  <Input type="number" min={1} max={10} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="technical" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Potencia Total (kW)</Label>
                  <Input type="number" value={formData.totalPowerKw} onChange={(e) => setFormData({ ...formData, totalPowerKw: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Cantidad de Cargadores</Label>
                  <Input type="number" value={formData.chargerCount} onChange={(e) => setFormData({ ...formData, chargerCount: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Potencia por Cargador (kW)</Label>
                  <Input type="number" value={formData.chargerPowerKw} onChange={(e) => setFormData({ ...formData, chargerPowerKw: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={formData.hasSolarPanels} onCheckedChange={(v) => setFormData({ ...formData, hasSolarPanels: v })} />
                  <Label className="flex items-center gap-2"><Sun className="w-4 h-4 text-yellow-500" /> Paneles Solares</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Meta de Inversión (COP)</Label>
                  <Input type="number" value={formData.targetAmount} onChange={(e) => setFormData({ ...formData, targetAmount: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground mt-1">{formatCOP(formData.targetAmount)}</p>
                </div>
                <div>
                  <Label>Inversión Mínima (COP)</Label>
                  <Input type="number" value={formData.minimumInvestment} onChange={(e) => setFormData({ ...formData, minimumInvestment: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground mt-1">{formatCOP(formData.minimumInvestment)}</p>
                </div>
                <div>
                  <Label>ROI Estimado (%)</Label>
                  <Input type="number" value={formData.estimatedRoiPercent} onChange={(e) => setFormData({ ...formData, estimatedRoiPercent: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Payback Estimado (meses)</Label>
                  <Input type="number" value={formData.estimatedPaybackMonths} onChange={(e) => setFormData({ ...formData, estimatedPaybackMonths: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="model" className="space-y-4 mt-4">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 mb-4">
                <h4 className="text-sm font-semibold text-emerald-400 mb-1">Modelo Financiero de la Estación</h4>
                <p className="text-xs text-muted-foreground">Modelo: Ingresos - Costo energía = Margen bruto → Aliado Comercial (% del margen) → Neto → EVGreen + Inversionista (suman 100% entre ellos).</p>
              </div>

              {/* EVGreen + Inversionista = 100% del neto */}
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 mb-2">
                <p className="text-xs font-semibold text-blue-400">Reparto del Neto (EVGreen + Inversionista = 100%)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-emerald-400">% EVGreen</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.evgreenSharePercent}
                    onChange={(e) => {
                      const val = e.target.value;
                      const remaining = 100 - parseFloat(val || '0');
                      setFormData({
                        ...formData,
                        evgreenSharePercent: val,
                        investorSharePercent: Math.max(0, remaining).toFixed(2),
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Comisión plataforma (del neto después del aliado)</p>
                </div>
                <div>
                  <Label className="text-blue-400">% Inversionistas</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.investorSharePercent}
                    onChange={(e) => {
                      const val = e.target.value;
                      const remaining = 100 - parseFloat(val || '0');
                      setFormData({
                        ...formData,
                        investorSharePercent: val,
                        evgreenSharePercent: Math.max(0, remaining).toFixed(2),
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Retorno a inversionistas (del neto después del aliado)</p>
                </div>
              </div>

              {/* Aliado Comercial - % separado */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-2 mt-4">
                <p className="text-xs font-semibold text-amber-400">% Aliado Comercial (sobre Margen Bruto)</p>
                <p className="text-[10px] text-muted-foreground">Se descuenta primero del margen bruto. El restante se reparte entre EVGreen e Inversionista.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-amber-400">% Aliado Comercial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="50"
                    value={formData.hostSharePercent}
                    onChange={(e) => setFormData({ ...formData, hostSharePercent: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Dueño del espacio (0-50%)</p>
                </div>
              </div>

              {/* Validación */}
              {(() => {
                const evInvSum = parseFloat(formData.evgreenSharePercent || '0') + parseFloat(formData.investorSharePercent || '0');
                const hostPct = parseFloat(formData.hostSharePercent || '0');
                const isEvInvValid = Math.abs(evInvSum - 100) < 0.1;
                const isHostValid = hostPct >= 0 && hostPct <= 50;
                const isValid = isEvInvValid && isHostValid;
                return (
                  <div className={`space-y-1 text-sm px-3 py-2 rounded-md ${isValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    <div className="flex items-center gap-2">
                      {isEvInvValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      EVGreen + Inversionista: {evInvSum.toFixed(2)}% {isEvInvValid ? '— Suma 100%' : '— Deben sumar 100%'}
                    </div>
                    <div className="flex items-center gap-2">
                      {isHostValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      Aliado Comercial: {hostPct.toFixed(2)}% {isHostValid ? '— Válido (0-50%)' : '— Máximo 50%'}
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Costo Energía (COP/kWh)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.energyPurchaseCostPerKwh}
                    onChange={(e) => setFormData({ ...formData, energyPurchaseCostPerKwh: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Costo de compra de energía al operador de red</p>
                </div>
                <div>
                  <Label>Nombre Aliado Comercial</Label>
                  <Input
                    value={formData.hostName}
                    onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
                    placeholder="Nombre del dueño del espacio"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Opcional: dueño del sitio donde se instala</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Latitud</Label>
                  <Input
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="4.6097"
                  />
                </div>
                <div>
                  <Label>Longitud</Label>
                  <Input
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="-74.0817"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingProject(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingProject ? "Guardar Cambios" : "Crear Proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver participaciones */}
      <Dialog open={showParticipationsDialog} onOpenChange={setShowParticipationsDialog}>
        <DialogContent className="sm:!max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="w-5 h-5" />
              <span className="truncate">Participaciones - {selectedProject?.city} ({selectedProject?.zone})</span>
            </DialogTitle>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-4">
              {/* Botón de registro */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    resetInvestorForm();
                    setShowRegisterInvestorDialog(true);
                  }}
                  className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  Registrar Inversionista
                </Button>
              </div>

              {/* Resumen del proyecto */}
              <Card className="p-3 sm:p-4 bg-muted/50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex justify-between sm:block">
                    <p className="text-muted-foreground">Meta</p>
                    <p className="font-bold text-right sm:text-left">{formatCOP(Number(selectedProject.targetAmount))}</p>
                  </div>
                  <div className="flex justify-between sm:block">
                    <p className="text-muted-foreground">Recaudado</p>
                    <p className="font-bold text-green-600 text-right sm:text-left">{formatCOP(Number(selectedProject.raisedAmount))}</p>
                  </div>
                  <div className="flex justify-between sm:block">
                    <p className="text-muted-foreground">Progreso</p>
                    <p className="font-bold text-right sm:text-left">
                      {((Number(selectedProject.raisedAmount) / Number(selectedProject.targetAmount)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </Card>

              {/* Lista de participaciones */}
              {!participations || participations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay participaciones registradas
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Vista móvil - tarjetas */}
                  <div className="sm:hidden space-y-3">
                    {participations.map((participation: any) => (
                      <Card key={participation.id} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{participation.investor?.name || 'Sin nombre'}</p>
                            <p className="text-xs text-muted-foreground truncate">{participation.investor?.email || ''}</p>
                          </div>
                          {getPaymentStatusBadge(participation.paymentStatus)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <p className="text-muted-foreground text-xs">Monto</p>
                            <p className="font-bold">{formatCOP(Number(participation.amount))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Participación</p>
                            <Badge variant="outline">{Number(participation.participationPercent).toFixed(1)}%</Badge>
                          </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {new Date(participation.createdAt).toLocaleDateString('es-CO')}
                          </p>
                          <div className="flex gap-1">
                            {participation.paymentStatus === 'PENDING' && (
                              <Button
                                size="sm"
                                onClick={() => handleConfirmPayment(participation.id)}
                                className="gap-1 text-xs h-7 px-2"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Confirmar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditParticipation(participation)}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteParticipation(participation.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:border-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Vista desktop - tabla */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Inversionista</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Participación</TableHead>
                          <TableHead>Estado Pago</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participations.map((participation: any) => (
                          <TableRow key={participation.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{participation.investor?.name || 'Sin nombre'}</p>
                                <p className="text-sm text-muted-foreground">{participation.investor?.email || ''}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCOP(Number(participation.amount))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {Number(participation.participationPercent).toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getPaymentStatusBadge(participation.paymentStatus)}
                            </TableCell>
                            <TableCell>
                              {new Date(participation.createdAt).toLocaleDateString('es-CO')}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                {participation.paymentStatus === 'PENDING' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleConfirmPayment(participation.id)}
                                    className="gap-1"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmar
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditParticipation(participation)}
                                  title="Editar participación"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteParticipation(participation.id)}
                                  className="text-red-500 hover:text-red-600 hover:border-red-300"
                                  title="Eliminar participación"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para editar participación */}
      <Dialog open={showEditParticipationDialog} onOpenChange={(open) => {
        if (!open) {
          setShowEditParticipationDialog(false);
          setEditingParticipation(null);
          setSelectedLinkedUser(null);
          setShowUserSearchInEdit(false);
          setUserSearchQuery("");
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Editar Participación
            </DialogTitle>
          </DialogHeader>

          {editingParticipation && (
            <div className="space-y-4">
              {/* Inversionista vinculado */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Inversionista Vinculado</Label>
                {selectedLinkedUser && !showUserSearchInEdit ? (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedLinkedUser.name || 'Sin nombre'}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedLinkedUser.email}</p>
                      {selectedLinkedUser.role && (
                        <Badge variant="outline" className="mt-1 text-xs">{selectedLinkedUser.role}</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowUserSearchInEdit(true)}
                      className="gap-1 ml-2 shrink-0"
                    >
                      <Link2 className="w-3 h-3" />
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        placeholder="Buscar por nombre o correo..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                      {showUserSearchInEdit && selectedLinkedUser && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => { setShowUserSearchInEdit(false); setUserSearchQuery(""); }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    {searchedUsers && searchedUsers.length > 0 && userSearchQuery.length >= 2 && (
                      <div className="border rounded-lg max-h-40 overflow-y-auto">
                        {searchedUsers.map((user: any) => (
                          <button
                            key={user.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                            onClick={() => {
                              setSelectedLinkedUser(user);
                              setShowUserSearchInEdit(false);
                              setUserSearchQuery("");
                            }}
                          >
                            <p className="text-sm font-medium truncate">{user.name || 'Sin nombre'}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email} - <Badge variant="outline" className="text-[10px] py-0">{user.role}</Badge></p>
                          </button>
                        ))}
                      </div>
                    )}
                    {userSearchQuery.length >= 2 && searchedUsers && searchedUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No se encontraron usuarios</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Al vincular un usuario registrado, se le asignará automáticamente el rol de inversionista.
                </p>
              </div>

              {/* Monto */}
              <div>
                <Label className="text-sm">Monto de Inversión (COP)</Label>
                <Input
                  type="number"
                  value={editPartData.amount}
                  onChange={(e) => setEditPartData({ ...editPartData, amount: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCOP(editPartData.amount)}
                  {selectedProject && ` (${((editPartData.amount / Number(selectedProject.targetAmount)) * 100).toFixed(2)}%)`}
                </p>
              </div>

              {/* Estado de pago */}
              <div>
                <Label className="text-sm">Estado de Pago</Label>
                <Select value={editPartData.paymentStatus} onValueChange={(v) => setEditPartData({ ...editPartData, paymentStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Referencia de pago */}
              <div>
                <Label className="text-sm">Referencia de Pago</Label>
                <Input
                  value={editPartData.paymentReference}
                  onChange={(e) => setEditPartData({ ...editPartData, paymentReference: e.target.value })}
                  placeholder="Ref. transferencia"
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditParticipationDialog(false);
                    setEditingParticipation(null);
                    setSelectedLinkedUser(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEditParticipation}
                  disabled={editParticipationMutation.isPending}
                  className="gap-2 w-full sm:w-auto"
                >
                  {editParticipationMutation.isPending ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Registro de Inversionista */}
      <Dialog open={showRegisterInvestorDialog} onOpenChange={setShowRegisterInvestorDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-600" />
              Registrar Nuevo Inversionista
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedProject) return;
              registerInvestorMutation.mutate({
                projectId: selectedProject.id,
                ...investorFormData,
              });
            }}
            className="space-y-6"
          >
            {/* Buscar usuario existente */}
            <div className="space-y-3 p-3 sm:p-4 bg-muted/30 rounded-lg border border-dashed">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Search className="w-4 h-4" />
                Vincular con usuario registrado (opcional)
              </h3>
              <p className="text-xs text-muted-foreground">
                Busca un usuario ya registrado en la plataforma para vincular su cuenta. Se le asignará el rol de inversionista automáticamente.
              </p>
              {selectedRegisterUser ? (
                <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-green-700 dark:text-green-400 truncate">{selectedRegisterUser.name || 'Sin nombre'}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedRegisterUser.email} - Rol: {selectedRegisterUser.role}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedRegisterUser(null);
                      setRegisterUserSearch("");
                    }}
                    className="shrink-0 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      placeholder="Buscar por nombre o correo..."
                      value={registerUserSearch}
                      onChange={(e) => setRegisterUserSearch(e.target.value)}
                    />
                  </div>
                  {registerSearchedUsers && registerSearchedUsers.length > 0 && registerUserSearch.length >= 2 && (
                    <div className="border rounded-lg max-h-32 overflow-y-auto">
                      {registerSearchedUsers.map((user: any) => (
                        <button
                          type="button"
                          key={user.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                          onClick={() => handleSelectRegisterUser(user)}
                        >
                          <p className="text-sm font-medium truncate">{user.name || 'Sin nombre'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email} - {user.role}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Datos Personales */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                Datos Personales
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm">Nombre Completo *</Label>
                  <Input
                    required
                    value={investorFormData.name}
                    onChange={(e) => setInvestorFormData({ ...investorFormData, name: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <Label className="text-sm">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      required
                      type="email"
                      className="pl-10"
                      value={investorFormData.email}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, email: e.target.value })}
                      placeholder="juan@ejemplo.com"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      value={investorFormData.phone}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, phone: e.target.value })}
                      placeholder="+57 300 123 4567"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Empresa</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      value={investorFormData.companyName}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, companyName: e.target.value })}
                      placeholder="Empresa S.A.S."
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">NIT / Cédula</Label>
                  <Input
                    value={investorFormData.taxId}
                    onChange={(e) => setInvestorFormData({ ...investorFormData, taxId: e.target.value })}
                    placeholder="900.123.456-7"
                  />
                </div>
              </div>
            </div>

            {/* Datos Bancarios */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="w-4 h-4" />
                Datos Bancarios (para pagos de rendimientos)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm">Banco</Label>
                  <Select
                    value={investorFormData.bankName}
                    onValueChange={(value) => setInvestorFormData({ ...investorFormData, bankName: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar banco" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                      <SelectItem value="Davivienda">Davivienda</SelectItem>
                      <SelectItem value="BBVA">BBVA</SelectItem>
                      <SelectItem value="Banco de Bogotá">Banco de Bogotá</SelectItem>
                      <SelectItem value="Banco de Occidente">Banco de Occidente</SelectItem>
                      <SelectItem value="Banco Popular">Banco Popular</SelectItem>
                      <SelectItem value="Banco AV Villas">Banco AV Villas</SelectItem>
                      <SelectItem value="Banco Caja Social">Banco Caja Social</SelectItem>
                      <SelectItem value="Scotiabank Colpatria">Scotiabank Colpatria</SelectItem>
                      <SelectItem value="Nequi">Nequi</SelectItem>
                      <SelectItem value="Daviplata">Daviplata</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Número de Cuenta</Label>
                  <Input
                    value={investorFormData.bankAccount}
                    onChange={(e) => setInvestorFormData({ ...investorFormData, bankAccount: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Datos de Inversión */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                Datos de la Inversión
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm">Monto de Inversión (COP) *</Label>
                  <Input
                    required
                    type="number"
                    min={selectedProject?.minimumInvestment ? Number(selectedProject.minimumInvestment) : 50000000}
                    value={investorFormData.amount}
                    onChange={(e) => setInvestorFormData({ ...investorFormData, amount: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCOP(investorFormData.amount)} 
                    {selectedProject && ` (${((investorFormData.amount / Number(selectedProject.targetAmount)) * 100).toFixed(2)}%)`}
                  </p>
                </div>
                <div>
                  <Label className="text-sm">Referencia de Pago</Label>
                  <Input
                    value={investorFormData.paymentReference}
                    onChange={(e) => setInvestorFormData({ ...investorFormData, paymentReference: e.target.value })}
                    placeholder="Ref. transferencia"
                  />
                </div>
              </div>
              <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                <Switch
                  checked={investorFormData.paymentConfirmed}
                  onCheckedChange={(checked) => setInvestorFormData({ ...investorFormData, paymentConfirmed: checked })}
                />
                <div>
                  <Label className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Pago confirmado
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Marcar si ya fue verificado
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRegisterInvestorDialog(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={registerInvestorMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                {registerInvestorMutation.isPending ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Registrar Inversionista
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
