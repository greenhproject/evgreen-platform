/**
 * Admin Claims - Panel de reclamos de cobro incorrecto
 * Muestra reclamos pendientes con opción de resolver/rechazar y reembolsar
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  DollarSign,
  MessageSquare,
  User,
  Zap,
} from "lucide-react";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Pendiente</Badge>;
    case "IN_REVIEW":
      return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">En revisión</Badge>;
    case "RESOLVED":
      return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Resuelto</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Rechazado</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "overcharge": return "Cobro excesivo";
    case "overstay_unfair": return "Sobreestadía injusta";
    case "wrong_kwh": return "kWh incorrectos";
    case "double_charge": return "Cobro doble";
    case "other": return "Otro";
    default: return category;
  }
}

export default function Claims() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; claim: any | null }>({ open: false, claim: null });
  const [resolution, setResolution] = useState("");
  const [resolveStatus, setResolveStatus] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundType, setRefundType] = useState<"overstay" | "energy" | "general">("general");
  const [detailTxId, setDetailTxId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const pageSize = 20;

  const utils = trpc.useUtils();

  // Query de reclamos
  const claimsQuery = (trpc as any).claims.list.useQuery({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Query de estadísticas
  const statsQuery = (trpc as any).claims.stats.useQuery();

  // Mutation para resolver
  const resolveMutation = (trpc as any).claims.resolve.useMutation({
    onSuccess: (data: any) => {
      const statusText = data.status === "RESOLVED" ? "aprobado" : "rechazado";
      toast.success(`Reclamo ${statusText} exitosamente`);
      setResolveDialog({ open: false, claim: null });
      setResolution("");
      setRefundAmount("");
      (utils as any).claims.list.invalidate();
      (utils as any).claims.stats.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al resolver reclamo");
    },
  });

  // Mutation para marcar en revisión
  const markInReviewMutation = (trpc as any).claims.markInReview.useMutation({
    onSuccess: () => {
      toast.success("Reclamo marcado como en revisión");
      (utils as any).claims.list.invalidate();
      (utils as any).claims.stats.invalidate();
    },
  });

  const claims = claimsQuery.data?.data || [];
  const totalCount = claimsQuery.data?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const stats = statsQuery.data;

  // Filtrar por búsqueda
  const filteredClaims = claims.filter((c: any) => {
    if (searchTerm === "") return true;
    return (
      c.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.transactionId?.toString().includes(searchTerm) ||
      c.stationName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            Reclamos de Cobro
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de reclamos reportados por usuarios
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-yellow-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Clock className="w-3.5 h-3.5 text-yellow-400" />
                Pendientes
              </div>
              <p className="text-xl font-bold text-yellow-400">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                En revisión
              </div>
              <p className="text-xl font-bold text-blue-400">{stats.inReview}</p>
            </CardContent>
          </Card>
          <Card className="border-green-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                Resueltos
              </div>
              <p className="text-xl font-bold text-green-400">{stats.resolved}</p>
            </CardContent>
          </Card>
          <Card className="border-red-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                Rechazados
              </div>
              <p className="text-xl font-bold text-red-400">{stats.rejected}</p>
            </CardContent>
          </Card>
          <Card className="border-green-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Total
              </div>
              <p className="text-xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario, estación, TX# o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDING">Pendientes</SelectItem>
            <SelectItem value="IN_REVIEW">En revisión</SelectItem>
            <SelectItem value="RESOLVED">Resueltos</SelectItem>
            <SelectItem value="REJECTED">Rechazados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de reclamos */}
      <Card className="border-green-900/30 hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>TX#</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claimsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredClaims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay reclamos {statusFilter !== "all" ? `con estado "${statusFilter}"` : ""}
                </TableCell>
              </TableRow>
            ) : (
              filteredClaims.map((claim: any) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-mono text-xs">#{claim.id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(claim.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[120px]">{claim.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs font-mono text-green-400 hover:text-green-300"
                      onClick={() => { setDetailTxId(claim.transactionId); setDetailOpen(true); }}
                    >
                      #{claim.transactionId}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {getCategoryLabel(claim.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                      {claim.description}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(claim.status)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {claim.status === "PENDING" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                            onClick={() => markInReviewMutation.mutate({ claimId: claim.id })}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Revisar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                            onClick={() => {
                              setResolveDialog({ open: true, claim });
                              setResolveStatus("RESOLVED");
                              setResolution("");
                              setRefundAmount("");
                            }}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Resolver
                          </Button>
                        </>
                      )}
                      {claim.status === "IN_REVIEW" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                          onClick={() => {
                            setResolveDialog({ open: true, claim });
                            setResolveStatus("RESOLVED");
                            setResolution("");
                            setRefundAmount("");
                          }}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Resolver
                        </Button>
                      )}
                      {(claim.status === "RESOLVED" || claim.status === "REJECTED") && (
                        <span className="text-xs text-muted-foreground">
                          {claim.resolvedByAdminName || "—"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {claimsQuery.isLoading ? (
          <Card className="p-4 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </Card>
        ) : filteredClaims.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            No hay reclamos
          </Card>
        ) : (
          filteredClaims.map((claim: any) => (
            <Card key={claim.id} className="p-3 border-green-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">#{claim.id}</span>
                  {getStatusBadge(claim.status)}
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(claim.createdAt)}</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuario</span>
                  <span className="truncate max-w-[60%] text-right">{claim.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TX#</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs font-mono text-green-400"
                    onClick={() => { setDetailTxId(claim.transactionId); setDetailOpen(true); }}
                  >
                    #{claim.transactionId}
                  </Button>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categoría</span>
                  <span className="text-xs">{getCategoryLabel(claim.category)}</span>
                </div>
                <div className="pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground">{claim.description}</p>
                </div>
                {(claim.status === "PENDING" || claim.status === "IN_REVIEW") && (
                  <div className="flex gap-2 pt-2">
                    {claim.status === "PENDING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => markInReviewMutation.mutate({ claimId: claim.id })}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Revisar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1 text-xs bg-green-700 hover:bg-green-600"
                      onClick={() => {
                        setResolveDialog({ open: true, claim });
                        setResolveStatus("RESOLVED");
                        setResolution("");
                        setRefundAmount("");
                      }}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Resolver
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Paginación */}
      {!claimsQuery.isLoading && totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} de {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">Pág. {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de resolución */}
      <Dialog open={resolveDialog.open} onOpenChange={(open) => setResolveDialog({ open, claim: open ? resolveDialog.claim : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              Resolver Reclamo #{resolveDialog.claim?.id}
            </DialogTitle>
            <DialogDescription>
              {resolveDialog.claim?.userName} reportó: "{resolveDialog.claim?.description?.slice(0, 100)}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info de la transacción */}
            {resolveDialog.claim && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transacción</span>
                  <span className="font-mono">#{resolveDialog.claim.transactionId}</span>
                </div>
                {resolveDialog.claim.transactionTotal != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total cobrado</span>
                    <span className="font-bold">{formatCurrency(resolveDialog.claim.transactionTotal)}</span>
                  </div>
                )}
                {resolveDialog.claim.overstayCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sobreestadía</span>
                    <span className="text-red-400">{formatCurrency(resolveDialog.claim.overstayCost)}</span>
                  </div>
                )}
                {resolveDialog.claim.requestedAmount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Solicita reembolso</span>
                    <span className="text-yellow-400">{formatCurrency(resolveDialog.claim.requestedAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Decisión */}
            <div className="space-y-2">
              <Label>Decisión</Label>
              <Select value={resolveStatus} onValueChange={(v) => setResolveStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESOLVED">Aprobar (resolver a favor del usuario)</SelectItem>
                  <SelectItem value="REJECTED">Rechazar (cobro es correcto)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reembolso (solo si se aprueba) */}
            {resolveStatus === "RESOLVED" && (
              <div className="space-y-3 p-3 rounded-lg border border-green-900/30 bg-green-950/20">
                <Label className="text-green-400 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  Reembolso (opcional)
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Monto COP</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={refundType} onValueChange={(v) => setRefundType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="overstay">Sobreestadía</SelectItem>
                        <SelectItem value="energy">Energía</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Resolución */}
            <div className="space-y-2">
              <Label>Nota de resolución</Label>
              <Textarea
                placeholder="Explica la decisión..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResolveDialog({ open: false, claim: null })}>
              Cancelar
            </Button>
            <Button
              className={resolveStatus === "RESOLVED" ? "bg-green-700 hover:bg-green-600" : "bg-red-700 hover:bg-red-600"}
              disabled={resolution.length < 3 || resolveMutation.isPending}
              onClick={() => {
                if (resolveDialog.claim) {
                  resolveMutation.mutate({
                    claimId: resolveDialog.claim.id,
                    resolution,
                    status: resolveStatus,
                    refundAmount: refundAmount ? Number(refundAmount) : undefined,
                    refundType: refundAmount ? refundType : undefined,
                  });
                }
              }}
            >
              {resolveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {resolveStatus === "RESOLVED" ? (
                <><CheckCircle className="w-4 h-4 mr-1" /> Aprobar</>
              ) : (
                <><XCircle className="w-4 h-4 mr-1" /> Rechazar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalle de transacción */}
      <TransactionDetailModal
        transactionId={detailTxId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
