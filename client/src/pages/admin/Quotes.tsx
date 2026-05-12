/**
 * Admin/Asesor - Dashboard de Cotizaciones
 * Lista, crea y gestiona cotizaciones de cargadores
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Search, FileText, Send, Eye, Copy, BarChart3,
  Clock, CheckCircle2, XCircle, AlertCircle, Mail
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
    onError: (err) => toast.error(err.message),
  });

  const duplicateMutation = trpc.quotes.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success(`Cotización duplicada: ${data.quoteNumber}`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.quotes.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendEmailMutation = trpc.quotes.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Cotización enviada por email exitosamente");
      refetch();
    },
    onError: (err) => toast.error(err.message),
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

  function getQuoteUrl(token: string): string {
    return `${window.location.origin}/cotizacion/${token}`;
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(getQuoteUrl(token));
    toast.success("Link copiado al portapapeles");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-muted-foreground">Gestiona y envía cotizaciones de estaciones de carga</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Cotización
        </Button>
      </div>

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
                        {quote.clientName} {quote.clientCompany && `· ${quote.clientCompany}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quote.clientEmail} · {formatDate(quote.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCOP(quote.total)}</div>
                      {quote.viewCount > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Eye className="h-3 w-3" /> {quote.viewCount} vista(s)
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link" onClick={() => copyLink(quote.publicToken)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver cotización"
                        onClick={() => window.open(getQuoteUrl(quote.publicToken), "_blank")}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar"
                        onClick={() => duplicateMutation.mutate({ id: quote.id })}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {(quote.status === "DRAFT" || quote.status === "SENT") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" title="Enviar por email"
                          onClick={() => sendEmailMutation.mutate({ id: quote.id })}
                          disabled={sendEmailMutation.isPending}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {quote.status === "DRAFT" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400" title="Marcar como aceptada"
                          onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "ACCEPTED" })}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
              <p className="text-muted-foreground mt-1">Crea tu primera cotización para un cliente</p>
              <Button onClick={() => setIsCreateOpen(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Nueva Cotización
              </Button>
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
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Seleccionar Cargadores
              </h3>
              <div className="grid gap-3">
                {catalog?.map((item: any) => {
                  const selected = selectedItems.find((s) => s.catalogItemId === item.id);
                  return (
                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${selected ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${item.chargeType === "DC" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                          <span className="text-xs font-bold">{item.powerKw}kW</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.connectorType} · {formatCOP(item.price)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selected ? (
                          <>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, selected.quantity - 1)}>-</Button>
                            <span className="w-8 text-center font-medium">{selected.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, selected.quantity + 1)}>+</Button>
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
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
                <FileText className="h-4 w-4" />
                Crear Cotización
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
