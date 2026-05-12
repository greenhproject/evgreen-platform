/**
 * Admin/Asesor - Dashboard de Cotizaciones
 * Lista, crea y gestiona cotizaciones de cargadores
 * Incluye sub-navegación a Catálogo y Configuración
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Plus, Search, FileText, Send, Eye, Copy, BarChart3,
  Clock, CheckCircle2, XCircle, AlertCircle, Mail,
  Package, Settings, Minus, ExternalLink, Pencil, Trash2,
  Download, CopyPlus
} from "lucide-react";

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: FileText },
  SENT: { label: "Enviada", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Send },
  VIEWED: { label: "Vista", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Eye },
  ACCEPTED: { label: "Aceptada", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  REJECTED: { label: "Rechazada", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
  EXPIRED: { label: "Vencida", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertCircle },
};

interface QuoteFormItem {
  catalogItemId: number;
  quantity: number;
}

export default function Quotes() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "staff";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientCompany: "",
    clientCity: "",
    clientNotes: "",
    internalNotes: "",
    discount: 0,
  });
  const [selectedItems, setSelectedItems] = useState<QuoteFormItem[]>([]);

  const { data: quotesData, refetch } = trpc.quotes.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    search: search || undefined,
  });
  const { data: stats } = trpc.quotes.stats.useQuery();
  const { data: catalog } = trpc.quotes.catalog.list.useQuery();

  const createMutation = trpc.quotes.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Cotización ${data.quoteNumber} creada exitosamente`);
      refetch();
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const duplicateMutation = trpc.quotes.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success(`Cotización duplicada: ${data.quoteNumber}`);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.quotes.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendEmailMutation = trpc.quotes.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Cotización enviada por email exitosamente");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateQuoteMutation = trpc.quotes.updateQuote.useMutation({
    onSuccess: () => {
      toast.success("Cotización actualizada exitosamente");
      refetch();
      setIsEditOpen(false);
      setEditingQuote(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteQuoteMutation = trpc.quotes.deleteQuote.useMutation({
    onSuccess: () => {
      toast.success("Cotización eliminada");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generatePdfMutation = trpc.quotes.generatePdf.useMutation({
    onSuccess: (data) => {
      // Descargar como archivo HTML para imprimir/guardar como PDF
      const blob = new Blob([data.htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => printWindow.print(), 500);
        };
      }
      URL.revokeObjectURL(url);
      toast.success("Cotización lista para descargar/imprimir");
    },
    onError: (err: any) => toast.error(err.message),
  });

  function resetForm() {
    setFormData({
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientCompany: "",
      clientCity: "",
      clientNotes: "",
      internalNotes: "",
      discount: 0,
    });
    setSelectedItems([]);
  }

  function addItem(catalogItemId: number) {
    const existing = selectedItems.find((i) => i.catalogItemId === catalogItemId);
    if (existing) {
      setSelectedItems(selectedItems.map((i) =>
        i.catalogItemId === catalogItemId ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setSelectedItems([...selectedItems, { catalogItemId, quantity: 1 }]);
    }
  }

  function removeItem(catalogItemId: number) {
    setSelectedItems(selectedItems.filter((i) => i.catalogItemId !== catalogItemId));
  }

  function updateQuantity(catalogItemId: number, quantity: number) {
    if (quantity < 1) return removeItem(catalogItemId);
    setSelectedItems(selectedItems.map((i) =>
      i.catalogItemId === catalogItemId ? { ...i, quantity } : i
    ));
  }

  function calculateTotal(): number {
    let total = 0;
    for (const item of selectedItems) {
      const catalogItem = catalog?.find((c: any) => c.id === item.catalogItemId);
      if (catalogItem) total += catalogItem.price * item.quantity;
    }
    return total - (formData.discount || 0);
  }

  function handleCreate() {
    if (!formData.clientName || !formData.clientEmail || selectedItems.length === 0) {
      toast.error("Completa los campos obligatorios y selecciona al menos un cargador");
      return;
    }
    createMutation.mutate({
      ...formData,
      items: selectedItems,
    });
  }

  function openEdit(quote: any) {
    setEditingQuote(quote);
    setIsEditOpen(true);
  }

  function handleEdit() {
    if (!editingQuote) return;
    updateQuoteMutation.mutate({
      id: editingQuote.id,
      clientName: editingQuote.clientName,
      clientEmail: editingQuote.clientEmail,
      clientPhone: editingQuote.clientPhone || "",
      clientCompany: editingQuote.clientCompany || "",
      clientCity: editingQuote.clientCity || "",
      clientNotes: editingQuote.clientNotes || "",
      internalNotes: editingQuote.internalNotes || "",
      discount: editingQuote.discount || 0,
    });
  }

  function handleDelete(quote: any) {
    if (confirm(`¿Eliminar cotización ${quote.quoteNumber}? Esta acción no se puede deshacer.`)) {
      deleteQuoteMutation.mutate({ id: quote.id });
    }
  }

  function getQuoteUrl(token: string): string {
    return `${window.location.origin}/cotizacion/${token}`;
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(getQuoteUrl(token));
    toast.success("Link copiado al portapapeles");
  }

  const hasCatalog = catalog && catalog.length > 0;

  return (
    <div className="space-y-6">
      {/* Sub-navegación */}
      <div className="flex items-center gap-1 border-b border-border pb-3">
        <Button variant="default" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Cotizaciones
        </Button>
        {isAdmin && (
          <>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/admin/quotes/catalog")}>
              <Package className="h-4 w-4" />
              Catálogo de Cargadores
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/admin/quotes/settings")}>
              <Settings className="h-4 w-4" />
              Configuración
            </Button>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-muted-foreground">Gestiona y envía cotizaciones de estaciones de carga</p>
        </div>
        <Button onClick={() => {
          if (!hasCatalog) {
            toast.error("Primero debes agregar cargadores al catálogo", {
              action: isAdmin ? {
                label: "Ir al Catálogo",
                onClick: () => navigate("/admin/quotes/catalog"),
              } : undefined,
            });
            return;
          }
          setIsCreateOpen(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Cotización
        </Button>
      </div>

      {/* Alerta si no hay catálogo */}
      {!hasCatalog && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Package className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-400">No hay cargadores en el catálogo</p>
                <p className="text-sm text-muted-foreground">
                  {isAdmin
                    ? "Primero configura los cargadores disponibles para venta en el catálogo antes de crear cotizaciones."
                    : "El administrador debe configurar los cargadores disponibles antes de poder crear cotizaciones."
                  }
                </p>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => navigate("/admin/quotes/catalog")}>
                  <Plus className="h-4 w-4" />
                  Configurar Catálogo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-blue-400">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </CardContent>
          </Card>
          <Card className="border-purple-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-purple-400">{stats.viewed}</div>
              <p className="text-xs text-muted-foreground">Vistas</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-emerald-400">{stats.accepted}</div>
              <p className="text-xs text-muted-foreground">Aceptadas</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-amber-400">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">Conversión</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-lg font-bold text-emerald-400">{formatCOP(stats.acceptedValue)}</div>
              <p className="text-xs text-muted-foreground">Valor Aceptado</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="SENT">Enviada</SelectItem>
            <SelectItem value="VIEWED">Vista</SelectItem>
            <SelectItem value="ACCEPTED">Aceptada</SelectItem>
            <SelectItem value="REJECTED">Rechazada</SelectItem>
            <SelectItem value="EXPIRED">Vencida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quotes List */}
      <div className="space-y-3">
        {quotesData?.quotes?.map((quote: any) => {
          const config = statusConfig[quote.status] || statusConfig.DRAFT;
          const StatusIcon = config.icon;
          return (
            <Card key={quote.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{quote.quoteNumber}</span>
                        <Badge variant="outline" className={config.color}>{config.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {quote.clientName} {quote.clientCompany ? `· ${quote.clientCompany}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quote.clientEmail} · {formatDate(quote.createdAt)}
                        {quote.advisorName && ` · Asesor: ${quote.advisorName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCOP(quote.total)}</div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Eye className="h-3 w-3" /> {quote.viewCount || 0} vista(s)
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {/* Copiar link */}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link público" onClick={() => copyLink(quote.publicToken)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {/* Ver cotización online */}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver cotización online"
                        onClick={() => window.open(getQuoteUrl(quote.publicToken), "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {/* Descargar PDF */}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-400" title="Descargar PDF"
                        onClick={() => generatePdfMutation.mutate({ id: quote.id })}
                        disabled={generatePdfMutation.isPending}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {/* Duplicar (icono diferente a copiar) */}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar cotización"
                        onClick={() => duplicateMutation.mutate({ id: quote.id })}>
                        <CopyPlus className="h-3.5 w-3.5" />
                      </Button>
                      {/* Editar */}
                      {(quote.status === "DRAFT" || quote.status === "SENT") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-400" title="Editar cotización"
                          onClick={() => openEdit(quote)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Enviar por email */}
                      {(quote.status === "DRAFT" || quote.status === "SENT") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" title="Enviar por email"
                          onClick={() => sendEmailMutation.mutate({ id: quote.id })}
                          disabled={sendEmailMutation.isPending}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Marcar como aceptada */}
                      {(quote.status === "DRAFT" || quote.status === "SENT" || quote.status === "VIEWED") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400" title="Marcar como aceptada"
                          onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "ACCEPTED" })}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Eliminar */}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" title="Eliminar cotización"
                        onClick={() => handleDelete(quote)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!quotesData?.quotes || quotesData.quotes.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">Sin cotizaciones</h3>
              <p className="text-muted-foreground mt-1">
                {hasCatalog
                  ? "Crea tu primera cotización para un cliente"
                  : isAdmin
                    ? "Primero configura el catálogo de cargadores para poder crear cotizaciones"
                    : "El administrador debe configurar el catálogo de cargadores primero"
                }
              </p>
              {hasCatalog ? (
                <Button onClick={() => setIsCreateOpen(true)} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Cotización
                </Button>
              ) : isAdmin ? (
                <Button onClick={() => navigate("/admin/quotes/catalog")} className="mt-4 gap-2">
                  <Package className="h-4 w-4" />
                  Ir al Catálogo
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Quote Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Cotización</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Datos del Cliente */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" /> Datos del Cliente
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre completo *</Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Correo electrónico *</Label>
                  <Input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    placeholder="juan@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    placeholder="321 456 7890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input
                    value={formData.clientCompany}
                    onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                    placeholder="Empresa S.A.S"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={formData.clientCity}
                    onChange={(e) => setFormData({ ...formData, clientCity: e.target.value })}
                    placeholder="Bogotá"
                  />
                </div>
              </div>
            </div>

            {/* Selección de Cargadores */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Seleccionar Cargadores
                </h3>
                {isAdmin && (
                  <Button variant="link" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => {
                    setIsCreateOpen(false);
                    navigate("/admin/quotes/catalog");
                  }}>
                    <Settings className="h-3 w-3" /> Gestionar catálogo
                  </Button>
                )}
              </div>

              {!hasCatalog ? (
                <div className="p-6 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 text-center">
                  <Package className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-amber-400">No hay cargadores configurados</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAdmin
                      ? "Ve al catálogo para agregar los cargadores disponibles para venta."
                      : "Contacta al administrador para configurar el catálogo de cargadores."
                    }
                  </p>
                  {isAdmin && (
                    <Button variant="outline" size="sm" className="mt-3 gap-2 border-amber-500/30" onClick={() => {
                      setIsCreateOpen(false);
                      navigate("/admin/quotes/catalog");
                    }}>
                      <Plus className="h-3 w-3" /> Agregar Cargadores
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  {catalog?.map((item: any) => {
                    const selected = selectedItems.find((s) => s.catalogItemId === item.id);
                    return (
                      <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded ${item.chargeType === "DC" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                            <span className="text-xs font-bold">{item.powerKw}kW</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.connectorType} · {item.chargeType} · {formatCOP(item.price)}
                              {item.includesTransformer && " · Incluye transformador"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selected ? (
                            <>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, selected.quantity - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{selected.quantity}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, selected.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive ml-2" onClick={() => removeItem(item.id)}>Quitar</Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => addItem(item.id)}>Agregar</Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notas y Descuento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Notas para el cliente</Label>
                <Textarea
                  value={formData.clientNotes}
                  onChange={(e) => setFormData({ ...formData, clientNotes: e.target.value })}
                  placeholder="Notas visibles en la cotización..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Notas internas (solo equipo)</Label>
                <Textarea
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  placeholder="Notas privadas..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descuento (COP)</Label>
              <Input
                type="number"
                value={formData.discount || ""}
                onChange={(e) => setFormData({ ...formData, discount: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            {/* Total */}
            {selectedItems.length > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total de la Cotización:</span>
                  <span className="text-2xl font-bold text-primary">{formatCOP(calculateTotal())}</span>
                </div>
                {formData.discount > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">Descuento aplicado: {formatCOP(formData.discount)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Incluye instalación llave en mano, hasta 10m de cableado y tubería
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !hasCatalog} className="gap-2">
                <FileText className="h-4 w-4" />
                Crear Cotización
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Quote Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingQuote(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cotización {editingQuote?.quoteNumber}</DialogTitle>
          </DialogHeader>
          {editingQuote && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre completo *</Label>
                  <Input
                    value={editingQuote.clientName}
                    onChange={(e) => setEditingQuote({ ...editingQuote, clientName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Correo electrónico *</Label>
                  <Input
                    type="email"
                    value={editingQuote.clientEmail}
                    onChange={(e) => setEditingQuote({ ...editingQuote, clientEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={editingQuote.clientPhone || ""}
                    onChange={(e) => setEditingQuote({ ...editingQuote, clientPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input
                    value={editingQuote.clientCompany || ""}
                    onChange={(e) => setEditingQuote({ ...editingQuote, clientCompany: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={editingQuote.clientCity || ""}
                    onChange={(e) => setEditingQuote({ ...editingQuote, clientCity: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Notas para el cliente</Label>
                  <Textarea
                    value={editingQuote.clientNotes || ""}
                    onChange={(e) => setEditingQuote({ ...editingQuote, clientNotes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas internas</Label>
                  <Textarea
                    value={editingQuote.internalNotes || ""}
                    onChange={(e) => setEditingQuote({ ...editingQuote, internalNotes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descuento (COP)</Label>
                <Input
                  type="number"
                  value={editingQuote.discount || ""}
                  onChange={(e) => setEditingQuote({ ...editingQuote, discount: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingQuote(null); }}>Cancelar</Button>
                <Button onClick={handleEdit} disabled={updateQuoteMutation.isPending} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
