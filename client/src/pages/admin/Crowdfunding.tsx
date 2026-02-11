/**
 * Panel de Administración de Crowdfunding
 * Gestión de proyectos de inversión colectiva y participaciones
 */

import { useState } from "react";
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
  Briefcase
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
  });

  const { data: projects, isLoading, refetch } = trpc.crowdfunding.getAllProjects.useQuery();
  const { data: participations, refetch: refetchParticipations } = trpc.crowdfunding.getParticipations.useQuery(
    { projectId: selectedProject?.id || 0 },
    { enabled: !!selectedProject }
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
    });
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      targetDate: formData.targetDate ? new Date(formData.targetDate) : undefined,
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Gestión de Crowdfunding
          </h1>
          <p className="text-muted-foreground">
            Administra proyectos de inversión colectiva y participaciones
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Proyectos</p>
              <p className="text-2xl font-bold">{stats.totalProjects}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activos</p>
              <p className="text-2xl font-bold">{stats.activeProjects}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Recaudado</p>
              <p className="text-2xl font-bold">{formatCOPShort(stats.totalRaised)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inversionistas</p>
              <p className="text-2xl font-bold">{stats.totalInvestors}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabla de proyectos */}
      <Card>
        <CardHeader>
          <CardTitle>Proyectos de Inversión Colectiva</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando proyectos...</div>
          ) : projects?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay proyectos creados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ciudad / Zona</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Inversionistas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Objetivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects?.map((project) => {
                  const porcentaje = (Number(project.raisedAmount) / Number(project.targetAmount)) * 100;
                  return (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{project.city}</p>
                            <p className="text-sm text-muted-foreground">{project.zone}</p>
                          </div>
                          {project.hasSolarPanels && (
                            <Sun className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[150px]">
                          <div className="flex justify-between text-sm">
                            <span>{formatCOPShort(Number(project.raisedAmount))}</span>
                            <span className="text-muted-foreground">/ {formatCOPShort(Number(project.targetAmount))}</span>
                          </div>
                          <Progress value={Math.min(porcentaje, 100)} className="h-2" />
                          <p className="text-xs text-muted-foreground">{porcentaje.toFixed(1)}%</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{project.investorCount || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        {project.targetDate 
                          ? new Date(project.targetDate).toLocaleDateString('es-CO')
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewParticipations(project)}
                            className="gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(project)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear/editar proyecto */}
      <Dialog open={showCreateDialog || !!editingProject} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingProject(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Editar Proyecto" : "Nuevo Proyecto de Crowdfunding"}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="technical">Técnico</TabsTrigger>
              <TabsTrigger value="financial">Financiero</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nombre del Proyecto</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Estación Premium Bogotá Norte"
                  />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Bogotá"
                  />
                </div>
                <div>
                  <Label>Zona</Label>
                  <Input
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    placeholder="Usaquén / Zona Norte"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Dirección (opcional)</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Cra 7 # 116-50"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del proyecto..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha Objetivo</Label>
                  <Input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Prioridad</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="technical" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cantidad de Cargadores</Label>
                  <Input
                    type="number"
                    value={formData.chargerCount}
                    onChange={(e) => setFormData({ ...formData, chargerCount: parseInt(e.target.value) || 4 })}
                  />
                </div>
                <div>
                  <Label>Potencia por Cargador (kW)</Label>
                  <Input
                    type="number"
                    value={formData.chargerPowerKw}
                    onChange={(e) => setFormData({ ...formData, chargerPowerKw: parseInt(e.target.value) || 120 })}
                  />
                </div>
                <div>
                  <Label>Potencia Total (kW)</Label>
                  <Input
                    type="number"
                    value={formData.totalPowerKw}
                    onChange={(e) => setFormData({ ...formData, totalPowerKw: parseInt(e.target.value) || 480 })}
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={formData.hasSolarPanels}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasSolarPanels: checked })}
                  />
                  <Label className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" />
                    Incluye Paneles Solares
                  </Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Meta de Inversión (COP)</Label>
                  <Input
                    type="number"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: parseInt(e.target.value) || 1000000000 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCOP(formData.targetAmount)}
                  </p>
                </div>
                <div>
                  <Label>Monto Recaudado (COP)</Label>
                  <Input
                    type="number"
                    value={formData.raisedAmount}
                    onChange={(e) => setFormData({ ...formData, raisedAmount: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCOP(formData.raisedAmount)} ({((formData.raisedAmount / formData.targetAmount) * 100).toFixed(1)}%)
                  </p>
                </div>
                <div>
                  <Label>Inversión Mínima (COP)</Label>
                  <Input
                    type="number"
                    value={formData.minimumInvestment}
                    onChange={(e) => setFormData({ ...formData, minimumInvestment: parseInt(e.target.value) || 50000000 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCOP(formData.minimumInvestment)}
                  </p>
                </div>
                <div>
                  <Label>ROI Estimado (%)</Label>
                  <Input
                    type="number"
                    value={formData.estimatedRoiPercent}
                    onChange={(e) => setFormData({ ...formData, estimatedRoiPercent: parseInt(e.target.value) || 85 })}
                  />
                </div>
                <div>
                  <Label>Payback Estimado (meses)</Label>
                  <Input
                    type="number"
                    value={formData.estimatedPaybackMonths}
                    onChange={(e) => setFormData({ ...formData, estimatedPaybackMonths: parseInt(e.target.value) || 14 })}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participaciones - {selectedProject?.city} ({selectedProject?.zone})
            </DialogTitle>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-4">
              {/* Botón de registro - visible en móvil arriba */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    resetInvestorForm();
                    setShowRegisterInvestorDialog(true);
                  }}
                  className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Registrar Inversionista</span>
                  <span className="sm:hidden">Nuevo Inversionista</span>
                </Button>
              </div>

              {/* Resumen del proyecto - responsive */}
              <Card className="p-3 sm:p-4 bg-muted/50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
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
                          <div>
                            <p className="font-medium text-sm">{participation.investor?.name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{participation.investor?.email || ''}</p>
                          </div>
                          {getPaymentStatusBadge(participation.paymentStatus)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div>
                            <p className="text-muted-foreground text-xs">Monto</p>
                            <p className="font-bold">{formatCOP(Number(participation.amount))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Participación</p>
                            <Badge variant="outline">{Number(participation.participationPercent).toFixed(1)}%</Badge>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-muted-foreground">
                            {new Date(participation.createdAt).toLocaleDateString('es-CO')}
                          </p>
                          {participation.paymentStatus === 'PENDING' && (
                            <Button
                              size="sm"
                              onClick={() => handleConfirmPayment(participation.id)}
                              className="gap-1 text-xs h-8"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Confirmar
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Vista desktop - tabla */}
                  <div className="hidden sm:block">
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
                                <p className="font-medium">{participation.investor?.name || 'N/A'}</p>
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
                              {participation.paymentStatus === 'PENDING' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleConfirmPayment(participation.id)}
                                  className="gap-1"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Confirmar Pago
                                </Button>
                              )}
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
                <span className="hidden sm:inline">Registrar Inversionista</span>
                <span className="sm:hidden">Registrar</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
