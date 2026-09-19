/**
 * Componente de Historial de Facturas Electrónicas
 * Muestra el registro de emisiones DIAN, desglose de tarifa unitaria calculada,
 * estado, CUFE, enlace a PDF y botón de resincronización forzada bajo demanda.
 */

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Users,
  UserCheck,
} from "lucide-react";

interface Props {
  mode?: "tenant" | "admin";
  organizationId?: number | null;
}

type BillingErrorDetail = {
  title: string;
  summary: string;
  guidance: string;
  codes: string[];
  raw: string;
  transactionId?: number;
};

function cleanBillingError(raw: unknown): string {
  let text = String(raw ?? "Error desconocido");
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart));
      text = parsed?.error?.message || parsed?.message || parsed?.error || text;
    } catch {
      // Alegra ocasionalmente devuelve JSON escapado dentro de otro mensaje.
      text = text.slice(jsonStart);
    }
  }
  return text
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/<\/?li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function parseBillingError(raw: unknown, transactionId?: number): BillingErrorDetail {
  const cleaned = cleanBillingError(raw);
  const codes = Array.from(new Set(cleaned.match(/\b(?:FAZ|FAB|RUT)\d+[A-Za-z]?\b|\b20\d{3}\b/gi) || []));
  const codeSet = new Set(codes.map((code) => code.toUpperCase()));
  const guidance: string[] = [];

  if (codeSet.has("FAB05C")) {
    guidance.push("En DIAN, asocia el prefijo FV al proveedor tecnológico/software de Alegra; EVGreen no puede hacer esa asociación por API.");
  }
  if (codeSet.has("FAZ09")) {
    guidance.push("En Alegra, edita el producto 1900 y agrega su código UNSPSC/productKey. Luego vuelve a sincronizarlo en EVGreen.");
  }
  if (codeSet.has("RUT01")) {
    guidance.push("RUT01 es una notificación informativa de Alegra sobre la validación futura del RUT; no es la causa principal del rechazo.");
  }
  if (codeSet.has("2035")) {
    guidance.push("El contacto facturado no tiene tipo de identificación; completa CC/NIT u otro tipo válido.");
  }
  if (cleaned.toLowerCase().includes("forma de pago")) {
    guidance.push("Verifica que la forma de pago esté guardada en la configuración de Alegra y vuelve a guardar la configuración.");
  }

  return {
    title: codes.length ? `Alegra rechazó la factura (${codes.join(" · ")})` : "Alegra rechazó la factura",
    summary: codes.length ? `Códigos detectados: ${codes.join(" · ")}` : "El proveedor devolvió un rechazo de validación.",
    guidance: guidance.join(" ") || "Revisa el detalle técnico y la configuración del proveedor antes de reintentar.",
    codes,
    raw: cleaned,
    transactionId,
  };
}

export default function ElectronicInvoicesHistory({ mode = "tenant", organizationId }: Props) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [customerSourceFilter, setCustomerSourceFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [retryingInvoiceId, setRetryingInvoiceId] = useState<number | null>(null);
  const [errorDetail, setErrorDetail] = useState<BillingErrorDetail | null>(null);
  const limit = 15;

  const showBillingError = (raw: unknown, transactionId?: number) => {
    const detail = parseBillingError(raw, transactionId);
    setErrorDetail(detail);
    toast.error(detail.title, {
      description: detail.summary,
      duration: 9000,
      action: {
        label: "Ver detalle",
        onClick: () => setErrorDetail(detail),
      },
    });
  };

  const tenantInvoicesQuery = (trpc.organizations as any).getMyElectronicInvoices.useQuery(
    {
      status: statusFilter === "ALL" ? undefined : statusFilter,
      customerSource: customerSourceFilter === "ALL" ? undefined : customerSourceFilter,
      limit,
      offset: page * limit,
    },
    { enabled: mode === "tenant" }
  );

  const adminInvoicesQuery = (trpc.settings as any).billingListInvoices.useQuery(
    {
      organizationId: organizationId || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      customerSource: customerSourceFilter === "ALL" ? undefined : customerSourceFilter,
      limit,
      offset: page * limit,
    },
    { enabled: mode === "admin" }
  );

  const query = mode === "tenant" ? tenantInvoicesQuery : adminInvoicesQuery;
  const invoices = query.data?.data || [];
  const total = query.data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const currentInvoiceIds = invoices.map((inv: any) => inv.id as number);
  const allSelectedOnPage = currentInvoiceIds.length > 0 && currentInvoiceIds.every((id: number) => selectedIds.includes(id));
  const someSelectedOnPage = currentInvoiceIds.some((id: number) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !currentInvoiceIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentInvoiceIds])));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkRetry = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    let successes = 0;
    let failures = 0;
    try {
      for (const id of selectedIds) {
        try {
          const res = mode === "tenant"
            ? await retryTenantMutation.mutateAsync({ invoiceRecordId: id, forceSync: true })
            : await retryAdminMutation.mutateAsync({ invoiceRecordId: id, forceSync: true });
          if (res?.success) successes++;
          else failures++;
        } catch {
          failures++;
        }
      }
      if (successes > 0) {
        toast.success(`Procesadas ${successes} factura(s) exitosamente.`);
      }
      if (failures > 0) {
        toast.error(`${failures} factura(s) no pudieron emitirse.`, {
          description: "Selecciona una factura fallida para consultar el rechazo específico.",
        });
      }
      setSelectedIds([]);
      query.refetch();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Mutación de reintento / resincronización bajo demanda
  const retryTenantMutation = (trpc.organizations as any).retryMyElectronicInvoice.useMutation({
    onSuccess: (data: any) => {
      setRetryingInvoiceId(null);
      if (data.success) {
        toast.success(`Factura emitida/resincronizada: #${data.invoiceNumber || data.invoiceId}`);
      } else {
        showBillingError(data.error);
      }
      (utils.organizations as any).getMyElectronicInvoices.invalidate();
    },
    onError: (err: any) => {
      setRetryingInvoiceId(null);
      showBillingError(err.message);
    },
  });

  const retryAdminMutation = (trpc.settings as any).billingRetryInvoice.useMutation({
    onSuccess: (data: any) => {
      setRetryingInvoiceId(null);
      if (data.success) {
        toast.success(`Factura emitida/resincronizada: #${data.invoiceNumber || data.invoiceId}`);
      } else {
        showBillingError(data.error);
      }
      (utils.settings as any).billingListInvoices.invalidate();
    },
    onError: (err: any) => {
      setRetryingInvoiceId(null);
      showBillingError(err.message);
    },
  });

  const handleResync = (invoiceId: number, forceSync: boolean = false) => {
    setRetryingInvoiceId(invoiceId);
    if (mode === "tenant") {
      retryTenantMutation.mutate({ invoiceRecordId: invoiceId, forceSync });
    } else {
      retryAdminMutation.mutate({ invoiceRecordId: invoiceId, forceSync });
    }
  };

  const isRetrying = retryTenantMutation.isPending || retryAdminMutation.isPending;

  const statusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Emitida
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Procesando DIAN
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Fallida
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const customerSourceBadge = (source?: string) => {
    if (source === "FALLBACK") {
      return (
        <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10 text-[9px] gap-0.5">
          <Users className="h-2.5 w-2.5" /> Mostrador
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-[9px] gap-0.5">
        <UserCheck className="h-2.5 w-2.5" /> Usuario App
      </Badge>
    );
  };

  const providerBadge = (provider: string) => {
    switch (provider) {
      case "alegra":
        return <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Alegra</Badge>;
      case "siigo":
        return <Badge variant="outline" className="text-blue-400 border-blue-400/30">Siigo</Badge>;
      case "world_office":
        return <Badge variant="outline" className="text-amber-400 border-amber-400/30">World Office</Badge>;
      default:
        return <Badge variant="outline">{provider}</Badge>;
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-500" />
              Historial de Facturas y Tarifas Aplicadas
            </CardTitle>
            <CardDescription>
              Seguimiento de facturas generadas por recargas, tarifa unitaria inyectada, estado de timbrado DIAN y resincronización bajo demanda.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleBulkRetry}
                disabled={isBulkProcessing || isRetrying}
                className="h-8 text-xs bg-green-600 hover:bg-green-500 text-white gap-1"
              >
                <RotateCcw className={`h-3 w-3 ${isBulkProcessing ? "animate-spin" : ""}`} />
                Reintentar {selectedIds.length} seleccionada(s)
              </Button>
            )}

            <Select
              value={customerSourceFilter}
              onValueChange={(val) => {
                setCustomerSourceFilter(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Origen cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los clientes</SelectItem>
                <SelectItem value="USER">Solo Usuario App</SelectItem>
                <SelectItem value="FALLBACK">Solo Mostrador</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Filtrar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos estados</SelectItem>
                <SelectItem value="COMPLETED">Emitidas</SelectItem>
                <SelectItem value="FAILED">Fallidas</SelectItem>
                <SelectItem value="PROCESSING">En Proceso</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              className="h-8 w-8 p-0"
              title="Actualizar historial"
            >
              <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin text-green-500" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-green-500" />
            Cargando facturas electrónicas...
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <FileText className="h-10 w-10 mx-auto opacity-30 text-green-500" />
            <p className="text-sm font-medium">No hay facturas electrónicas registradas</p>
            <p className="text-xs">
              Las facturas se generarán automáticamente cuando los usuarios completen sesiones de recarga.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={allSelectedOnPage ? true : someSelectedOnPage ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Seleccionar todas las facturas de la página"
                      />
                    </TableHead>
                    <TableHead className="w-20">Tx #</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Energía</TableHead>
                    <TableHead className="text-right">Tarifa Dinámica</TableHead>
                    <TableHead className="text-right">Total Facturado</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Factura / CUFE</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => {
                    const kwh = parseFloat(inv.energyKwh || 0);
                    const totalAmount = Math.round(parseFloat(inv.totalAmount || 0));
                    const unitPrice = parseFloat(inv.billedUnitPrice || 0);
                    const isSelected = selectedIds.includes(inv.id);

                    return (
                      <TableRow key={inv.id} data-state={isSelected ? "selected" : undefined}>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectOne(inv.id)}
                            aria-label={`Seleccionar factura #${inv.transactionId}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">#{inv.transactionId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground">{inv.customerName || "Cliente"}</span>
                            {customerSourceBadge(inv.customerSource)}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">{inv.customerIdentification || inv.customerEmail || "-"}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {kwh.toFixed(2)} kWh
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {unitPrice > 0 ? (
                            <span className="text-foreground" title="Tarifa unitaria efectiva inyectada">
                              ${unitPrice.toLocaleString("es-CO")}/kWh
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold font-mono text-green-400">
                          ${totalAmount.toLocaleString("es-CO")}
                        </TableCell>
                        <TableCell>{providerBadge(inv.provider)}</TableCell>
                        <TableCell>{statusBadge(inv.status)}</TableCell>
                        <TableCell>
                          {inv.invoiceNumber ? (
                            <div className="space-y-0.5">
                              <span className="font-mono text-xs font-medium text-foreground">{inv.invoiceNumber}</span>
                              {inv.cufe && (
                                <div className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={inv.cufe}>
                                  CUFE: {inv.cufe.slice(0, 10)}...
                                </div>
                              )}
                            </div>
                          ) : inv.errorMessage ? (
                            (() => {
                              const detail = parseBillingError(inv.errorMessage, inv.transactionId);
                              return (
                                <div className="flex items-center gap-1.5 max-w-[190px]">
                                  <span className="text-[10px] text-red-400 truncate" title={detail.guidance}>
                                    {detail.codes.length ? detail.codes.join(" · ") : "Rechazo Alegra"}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-red-300 hover:text-red-200 shrink-0"
                                    onClick={() => setErrorDetail(detail)}
                                  >
                                    Ver detalle
                                  </Button>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.pdfUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-green-400 hover:text-green-300 gap-1 px-2"
                                asChild
                              >
                                <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" /> PDF
                                </a>
                              </Button>
                            )}
                            {inv.status === "FAILED" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResync(inv.id, false)}
                                disabled={retryingInvoiceId === inv.id || isBulkProcessing}
                                className="h-7 text-xs text-amber-400 border-amber-400/30 hover:bg-amber-400/10 gap-1 px-2"
                                title="Reintentar emisión de factura fallida"
                              >
                                <RotateCcw className={`h-3 w-3 ${retryingInvoiceId === inv.id ? "animate-spin text-amber-300" : ""}`} />
                                Reintentar
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResync(inv.id, true)}
                                disabled={retryingInvoiceId === inv.id || isBulkProcessing}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                                title="Resincronizar bajo demanda en caso de discrepancia en el valor total"
                              >
                                <RefreshCw className={`h-3 w-3 ${retryingInvoiceId === inv.id ? "animate-spin text-foreground" : ""}`} />
                                Resincronizar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>
                  Mostrando {invoices.length} de {total} facturas
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="h-7 text-xs"
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {page + 1} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 text-xs"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={!!errorDetail} onOpenChange={(open) => !open && setErrorDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-red-400">{errorDetail?.title || "Rechazo de factura"}</DialogTitle>
            <DialogDescription>{errorDetail?.summary}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              <strong>Qué hacer:</strong> {errorDetail?.guidance}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Respuesta técnica de Alegra</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                {errorDetail?.raw}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
