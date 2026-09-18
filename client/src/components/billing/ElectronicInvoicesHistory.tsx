/**
 * Componente de Historial de Facturas Electrónicas
 * Muestra el registro de emisiones DIAN, desglose de tarifa unitaria calculada,
 * estado, CUFE, enlace a PDF y botón de resincronización forzada bajo demanda.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "lucide-react";

interface Props {
  mode?: "tenant" | "admin";
  organizationId?: number | null;
}

export default function ElectronicInvoicesHistory({ mode = "tenant", organizationId }: Props) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const limit = 15;

  const tenantInvoicesQuery = (trpc.organizations as any).getMyElectronicInvoices.useQuery(
    {
      status: statusFilter === "ALL" ? undefined : statusFilter,
      limit,
      offset: page * limit,
    },
    { enabled: mode === "tenant" }
  );

  const adminInvoicesQuery = (trpc.settings as any).billingListInvoices.useQuery(
    {
      organizationId: organizationId || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      limit,
      offset: page * limit,
    },
    { enabled: mode === "admin" }
  );

  const query = mode === "tenant" ? tenantInvoicesQuery : adminInvoicesQuery;
  const invoices = query.data?.data || [];
  const total = query.data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Mutación de reintento / resincronización bajo demanda
  const retryTenantMutation = (trpc.organizations as any).retryMyElectronicInvoice.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(`Factura emitida/resincronizada: #${data.invoiceNumber || data.invoiceId}`);
      } else {
        toast.error(`Fallo en resincronización: ${data.error}`);
      }
      (utils.organizations as any).getMyElectronicInvoices.invalidate();
    },
    onError: (err: any) => toast.error(`Error al resincronizar: ${err.message}`),
  });

  const retryAdminMutation = (trpc.settings as any).billingRetryInvoice.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(`Factura emitida/resincronizada: #${data.invoiceNumber || data.invoiceId}`);
      } else {
        toast.error(`Fallo en resincronización: ${data.error}`);
      }
      (utils.settings as any).billingListInvoices.invalidate();
    },
    onError: (err: any) => toast.error(`Error al resincronizar: ${err.message}`),
  });

  const handleResync = (invoiceId: number, forceSync: boolean = false) => {
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Filtrar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
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

                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-semibold">#{inv.transactionId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-foreground">{inv.customerName || "Cliente"}</div>
                          <div className="text-[11px] text-muted-foreground">{inv.customerIdentification || inv.customerEmail || "-"}</div>
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
                            <span className="text-xs text-red-400 truncate max-w-[150px] inline-block" title={inv.errorMessage}>
                              {inv.errorMessage}
                            </span>
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
                                disabled={isRetrying}
                                className="h-7 text-xs text-amber-400 border-amber-400/30 hover:bg-amber-400/10 gap-1 px-2"
                                title="Reintentar emisión de factura fallida"
                              >
                                <RotateCcw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
                                Reintentar
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResync(inv.id, true)}
                                disabled={isRetrying}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                                title="Resincronizar bajo demanda en caso de discrepancia en el valor total"
                              >
                                <RefreshCw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
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
    </Card>
  );
}
