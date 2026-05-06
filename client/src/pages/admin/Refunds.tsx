/**
 * Admin Refunds - Historial de reembolsos para auditoría
 * Muestra todos los reembolsos aplicados con fecha, admin, motivo y monto
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  RotateCcw,
  DollarSign,
  Search,
  Calendar,
  User,
  Shield,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  FileText,
} from "lucide-react";

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

function getRefundTypeBadge(type: string) {
  switch (type) {
    case "overstay":
      return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Sobreestadía</Badge>;
    case "energy":
      return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">Energía</Badge>;
    case "general":
    default:
      return <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30">General</Badge>;
  }
}

export default function Refunds() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const pageSize = 20;

  // Query de reembolsos
  const refundsQuery = (trpc as any).refunds.list.useQuery({
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Query de estadísticas
  const statsQuery = (trpc as any).refunds.stats.useQuery();

  const refunds = refundsQuery.data?.data || [];
  const totalCount = refundsQuery.data?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const stats = statsQuery.data;

  // Filtrar por búsqueda y tipo
  const filteredRefunds = refunds.filter((r: any) => {
    const matchesSearch = searchTerm === "" ||
      r.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.adminName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.transactionId?.toString().includes(searchTerm);
    const matchesType = typeFilter === "all" || r.refundType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-green-400" />
            Historial de Reembolsos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de auditoría de todos los reembolsos aplicados
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-green-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <FileText className="w-3.5 h-3.5" />
                Total reembolsos
              </div>
              <p className="text-xl font-bold">{stats.totalRefunds}</p>
            </CardContent>
          </Card>
          <Card className="border-green-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                Monto total
              </div>
              <p className="text-xl font-bold text-red-400">{formatCurrency(stats.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="border-green-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <TrendingDown className="w-3.5 h-3.5" />
                Últimos 30 días
              </div>
              <p className="text-xl font-bold">{stats.last30Days}</p>
            </CardContent>
          </Card>
          <Card className="border-green-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <RotateCcw className="w-3.5 h-3.5" />
                Por sobreestadía
              </div>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(stats.byType?.overstay || 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario, admin, motivo o TX#..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="overstay">Sobreestadía</SelectItem>
            <SelectItem value="energy">Energía</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de reembolsos */}
      <Card className="border-green-900/30 hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>TX#</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refundsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredRefunds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay reembolsos registrados
                </TableCell>
              </TableRow>
            ) : (
              filteredRefunds.map((refund: any) => (
                <TableRow key={refund.id}>
                  <TableCell className="font-mono text-xs">#{refund.id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(refund.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[120px]">{refund.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">#{refund.transactionId}</TableCell>
                  <TableCell>{getRefundTypeBadge(refund.refundType)}</TableCell>
                  <TableCell className="text-right font-bold text-red-400">
                    -{formatCurrency(refund.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-green-400" />
                      <span className="text-xs truncate max-w-[100px]">{refund.adminName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                      {refund.reason}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {refundsQuery.isLoading ? (
          <Card className="p-4 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </Card>
        ) : filteredRefunds.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            No hay reembolsos registrados
          </Card>
        ) : (
          filteredRefunds.map((refund: any) => (
            <Card key={refund.id} className="p-3 border-green-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">#{refund.id}</span>
                  {getRefundTypeBadge(refund.refundType)}
                </div>
                <span className="font-bold text-red-400">-{formatCurrency(refund.amount)}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuario</span>
                  <span className="truncate max-w-[60%] text-right">{refund.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TX#</span>
                  <span className="font-mono">#{refund.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Admin</span>
                  <span className="truncate max-w-[60%] text-right text-green-400">{refund.adminName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="text-xs">{formatDate(refund.createdAt)}</span>
                </div>
                <div className="pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">{refund.reason}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Paginación */}
      {!refundsQuery.isLoading && totalCount > 0 && (
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
    </div>
  );
}
