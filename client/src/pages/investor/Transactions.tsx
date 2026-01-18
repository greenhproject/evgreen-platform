import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
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
import { Search, Download, Zap, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function InvestorTransactions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: transactions, isLoading } = trpc.transactions.myTransactions.useQuery();

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: "bg-green-100 text-green-700",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      PENDING: "bg-yellow-100 text-yellow-700",
      FAILED: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      COMPLETED: "Completada",
      IN_PROGRESS: "En progreso",
      PENDING: "Pendiente",
      FAILED: "Fallida",
    };
    return <Badge className={styles[status] || "bg-gray-100"}>{labels[status] || status}</Badge>;
  };

  // Calcular totales
  const totalRevenue = transactions?.reduce((sum: number, t: any) => {
    if (t.status === "COMPLETED") {
      return sum + parseFloat(t.totalAmount || "0");
    }
    return sum;
  }, 0) || 0;

  const myShare = totalRevenue * 0.8;
  const totalEnergy = transactions?.reduce((sum: number, t: any) => {
    if (t.status === "COMPLETED") {
      return sum + parseFloat(t.kwhConsumed || "0");
    }
    return sum;
  }, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transacciones</h1>
          <p className="text-muted-foreground">
            Historial de cargas en tus estaciones
          </p>
        </div>
        <Button variant="outline" onClick={() => toast.info("Exportar próximamente")}>
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(myShare)}</div>
              <div className="text-sm text-muted-foreground">Mis ingresos (80%)</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <div className="text-sm text-muted-foreground">Ingresos brutos</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalEnergy.toFixed(1)} kWh</div>
              <div className="text-sm text-muted-foreground">Energía vendida</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{transactions?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total cargas</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por estación o ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="COMPLETED">Completadas</SelectItem>
              <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
              <SelectItem value="FAILED">Fallidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Estación</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Energía</TableHead>
              <TableHead>Monto bruto</TableHead>
              <TableHead>Mi parte (80%)</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Cargando transacciones...
                </TableCell>
              </TableRow>
            ) : transactions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay transacciones registradas
                </TableCell>
              </TableRow>
            ) : (
              transactions?.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-sm">#{tx.id}</TableCell>
                  <TableCell>ID: {tx.stationId}</TableCell>
                  <TableCell>
                    {new Date(tx.startTime).toLocaleDateString("es-CO")}
                  </TableCell>
                  <TableCell>{parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh</TableCell>
                  <TableCell>{formatCurrency(tx.totalAmount || 0)}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {formatCurrency(parseFloat(tx.totalAmount || "0") * 0.8)}
                  </TableCell>
                  <TableCell>{getStatusBadge(tx.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
