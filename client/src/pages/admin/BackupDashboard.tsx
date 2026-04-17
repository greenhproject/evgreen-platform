/**
 * EVGreen Platform - Dashboard de Backup y Recuperación
 * 
 * Panel de administración para gestionar backups de la base de datos:
 * - Estadísticas generales del sistema de backup
 * - Ejecución de backups manuales (Full, Crítico, Financiero, Usuarios)
 * - Historial de backups con estado, tamaño y duración
 * - Descarga y eliminación de backups
 * - Restauración de backup desde archivo JSON
 * - Configuración de tablas por prioridad
 * 
 * @author Green House Project | @version 2.0.0 (Abril 2026)
 */

import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Database,
  Download,
  Trash2,
  Play,
  Shield,
  DollarSign,
  Users,
  HardDrive,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileArchive,
  Layers,
  Activity,
  Calendar,
  Server,
  Upload,
  RotateCcw,
  FileUp,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

type BackupType = "FULL" | "CRITICAL" | "FINANCIAL" | "USERS" | "MANUAL";

const BACKUP_TYPES: { type: BackupType; label: string; description: string; icon: typeof Database; color: string }[] = [
  { type: "FULL", label: "Completo", description: "Todas las 59 tablas de la base de datos", icon: Database, color: "text-blue-400" },
  { type: "CRITICAL", label: "Crítico (P1)", description: "Transacciones, usuarios, wallets, pagos", icon: Shield, color: "text-red-400" },
  { type: "FINANCIAL", label: "Financiero", description: "Liquidaciones, inversiones, crowdfunding", icon: DollarSign, color: "text-green-400" },
  { type: "USERS", label: "Usuarios", description: "Usuarios, suscripciones, vehículos", icon: Users, color: "text-purple-400" },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BackupDashboard() {
  const [selectedType, setSelectedType] = useState<BackupType | null>(null);
  const [notes, setNotes] = useState("");
  const [showTableConfig, setShowTableConfig] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [expandedBackup, setExpandedBackup] = useState<number | null>(null);

  // Queries
  const backupTrpc = (trpc as any).backup;
  const statsQuery = backupTrpc.getStats.useQuery();
  const historyQuery = backupTrpc.getHistory.useQuery({ limit: 20, offset: 0 });
  const tableConfigQuery = backupTrpc.getTableConfig.useQuery();

  // Mutations
  const executeBackupMutation = backupTrpc.executeBackup.useMutation({
    onSuccess: (result: any) => {
      const statusText = result.status === "COMPLETED" ? "completado" : result.status === "PARTIAL" ? "parcial" : "fallido";
      toast.success(`Backup ${statusText}: ${result.tablesBackedUp.length} tablas, ${result.totalRows.toLocaleString()} filas, ${formatBytes(result.totalSizeBytes)}`);
      statsQuery.refetch();
      historyQuery.refetch();
      setSelectedType(null);
      setNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteBackupMutation = backupTrpc.deleteBackup.useMutation({
    onSuccess: () => {
      toast.success("Backup eliminado");
      historyQuery.refetch();
      statsQuery.refetch();
    },
  });

  const cleanupMutation = backupTrpc.cleanupExpired.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Limpieza completada: ${result.cleaned} backups expirados eliminados`);
      historyQuery.refetch();
      statsQuery.refetch();
    },
  });

  const handleExecuteBackup = (type: BackupType) => {
    executeBackupMutation.mutate({ type, notes: notes || undefined });
  };

  const stats = statsQuery.data;
  const historyRaw = historyQuery.data;
  const history: any[] = historyRaw && 'backups' in historyRaw ? historyRaw.backups : [];
  const tableConfig = tableConfigQuery.data || [];

  return (
    <div className="space-y-4 md:space-y-6 px-1 md:px-0">
      {/* Header - Responsive */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Server className="h-5 w-5 md:h-7 md:w-7 text-blue-400 shrink-0" />
            <span className="truncate">Backup y Recuperación</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Sistema de respaldo de la base de datos EVGreen
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="text-xs"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Limpiar expirados
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRestoreDialog(true)}
            className="text-xs"
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Restaurar Backup
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              statsQuery.refetch();
              historyQuery.refetch();
            }}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estadísticas - Responsive grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
          <Card>
            <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
              <div className="flex items-center gap-1.5 mb-1">
                <FileArchive className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-[10px] md:text-xs text-muted-foreground truncate">Total Backups</span>
              </div>
              <p className="text-lg md:text-2xl font-bold">{stats.totalBackups}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <span className="text-[10px] md:text-xs text-muted-foreground truncate">Completados</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-green-400">{stats.completedBackups}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <span className="text-[10px] md:text-xs text-muted-foreground truncate">Fallidos</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-red-400">{stats.failedBackups}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                <span className="text-[10px] md:text-xs text-muted-foreground truncate">Parciales</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-yellow-400">{stats.partialBackups}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
              <div className="flex items-center gap-1.5 mb-1">
                <HardDrive className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="text-[10px] md:text-xs text-muted-foreground truncate">Almacenamiento</span>
              </div>
              <p className="text-lg md:text-2xl font-bold">{formatBytes((stats as any).totalStorageBytes || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 px-3 md:pt-4 md:pb-3 md:px-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span className="text-[10px] md:text-xs text-muted-foreground truncate">Último Backup</span>
              </div>
              <p className="text-xs md:text-sm font-medium">{stats.lastBackupAt ? formatDateShort(stats.lastBackupAt) : "Nunca"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ejecutar Backup Manual - Responsive */}
      <Card>
        <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Play className="h-4 w-4 md:h-5 md:w-5 text-green-400" />
            Ejecutar Backup Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-4">
            {BACKUP_TYPES.map((bt) => {
              const Icon = bt.icon;
              const isSelected = selectedType === bt.type;
              return (
                <button
                  key={bt.type}
                  onClick={() => setSelectedType(isSelected ? null : bt.type)}
                  className={`p-3 md:p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                    <Icon className={`h-4 w-4 md:h-5 md:w-5 ${bt.color} shrink-0`} />
                    <span className="font-semibold text-xs md:text-sm truncate">{bt.label}</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">{bt.description}</p>
                </button>
              );
            })}
          </div>

          {selectedType && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-3 p-3 md:p-4 bg-muted/20 rounded-lg border border-dashed">
              <div className="flex-1">
                <label className="text-xs md:text-sm font-medium mb-1 block">Notas (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Backup antes de actualización..."
                  className="w-full px-3 py-2 rounded-md border bg-background text-xs md:text-sm"
                />
              </div>
              <Button
                onClick={() => handleExecuteBackup(selectedType)}
                disabled={executeBackupMutation.isPending}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto shrink-0"
                size="sm"
              >
                {executeBackupMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Ejecutar {BACKUP_TYPES.find((t) => t.type === selectedType)?.label}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de Backups - Responsive con cards en móvil */}
      <Card>
        <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-cyan-400" />
              Historial de Backups
            </CardTitle>
            <Badge variant="outline" className="text-xs">{history.length} registros</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          {history.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              <FileArchive className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay backups registrados aún</p>
              <p className="text-xs mt-1">El primer backup automático se ejecutará en 5 minutos</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2">ID</th>
                      <th className="text-left py-2 px-2">Fecha</th>
                      <th className="text-left py-2 px-2">Tipo</th>
                      <th className="text-left py-2 px-2">Estado</th>
                      <th className="text-right py-2 px-2">Tablas</th>
                      <th className="text-right py-2 px-2">Filas</th>
                      <th className="text-right py-2 px-2">Tamaño</th>
                      <th className="text-right py-2 px-2">Duración</th>
                      <th className="text-left py-2 px-2">Ejecutado por</th>
                      <th className="text-right py-2 px-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((backup: any) => (
                      <tr key={backup.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2 px-2 font-mono text-xs">#{backup.id}</td>
                        <td className="py-2 px-2 text-xs">{formatDate(backup.createdAt)}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-xs">{backup.backupType}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <StatusBadge status={backup.status} />
                        </td>
                        <td className="py-2 px-2 text-right">{backup.tablesCount || "-"}</td>
                        <td className="py-2 px-2 text-right">{backup.totalRows?.toLocaleString() || "-"}</td>
                        <td className="py-2 px-2 text-right">{formatBytes(backup.totalSizeBytes || 0)}</td>
                        <td className="py-2 px-2 text-right">{formatDuration(backup.durationMs || 0)}</td>
                        <td className="py-2 px-2 text-xs">
                          <span className={backup.isAutomatic ? "text-cyan-400" : "text-orange-400"}>
                            {backup.isAutomatic ? "Auto" : backup.triggeredBy}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <BackupActions backup={backup} onDelete={(id: number) => {
                            if (confirm("¿Eliminar este backup?")) {
                              deleteBackupMutation.mutate({ backupId: id });
                            }
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden space-y-2">
                {history.map((backup: any) => {
                  const isExpanded = expandedBackup === backup.id;
                  return (
                    <div
                      key={backup.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedBackup(isExpanded ? null : backup.id)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/20"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <StatusDot status={backup.status} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">#{backup.id}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{backup.backupType}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {formatDateShort(backup.createdAt)} · {formatBytes(backup.totalSizeBytes || 0)}
                            </p>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t bg-muted/10">
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Estado</span>
                              <div className="mt-0.5"><StatusBadge status={backup.status} /></div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tablas</span>
                              <p className="font-medium mt-0.5">{backup.tablesCount || "-"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Filas</span>
                              <p className="font-medium mt-0.5">{backup.totalRows?.toLocaleString() || "-"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Duración</span>
                              <p className="font-medium mt-0.5">{formatDuration(backup.durationMs || 0)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Ejecutado por</span>
                              <p className={`font-medium mt-0.5 ${backup.isAutomatic ? "text-cyan-400" : "text-orange-400"}`}>
                                {backup.isAutomatic ? "Automático" : backup.triggeredBy}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tamaño</span>
                              <p className="font-medium mt-0.5">{formatBytes(backup.totalSizeBytes || 0)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            {backup.s3Url && backup.status === "COMPLETED" && (
                              <a
                                href={backup.s3Url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1"
                              >
                                <Button variant="outline" size="sm" className="w-full text-xs">
                                  <Download className="h-3.5 w-3.5 mr-1" />
                                  Descargar
                                </Button>
                              </a>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm("¿Eliminar este backup?")) {
                                  deleteBackupMutation.mutate({ backupId: backup.id });
                                }
                              }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Información del Sistema - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Configuración Automática */}
        <Card>
          <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 md:h-5 md:w-5 text-green-400" />
              Backup Automático
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between p-2.5 md:p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className="h-4 w-4 text-red-400 shrink-0" />
                  <span className="text-xs md:text-sm truncate">Backup Crítico (P1)</span>
                </div>
                <Badge className="bg-green-600/20 text-green-400 text-[10px] md:text-xs shrink-0 ml-2">Diario</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 md:p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="text-xs md:text-sm truncate">Backup Completo</span>
                </div>
                <Badge className="bg-blue-600/20 text-blue-400 text-[10px] md:text-xs shrink-0 ml-2">Domingos</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 md:p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Trash2 className="h-4 w-4 text-yellow-400 shrink-0" />
                  <span className="text-xs md:text-sm truncate">Limpieza de expirados</span>
                </div>
                <Badge className="bg-yellow-600/20 text-yellow-400 text-[10px] md:text-xs shrink-0 ml-2">Diaria</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 md:p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-4 w-4 text-purple-400 shrink-0" />
                  <span className="text-xs md:text-sm truncate">Retención automáticos</span>
                </div>
                <Badge variant="outline" className="text-[10px] md:text-xs shrink-0 ml-2">90 días</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 md:p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span className="text-xs md:text-sm truncate">Retención manuales</span>
                </div>
                <Badge variant="outline" className="text-[10px] md:text-xs shrink-0 ml-2">365 días</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tablas por Prioridad */}
        <Card>
          <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Layers className="h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                Tablas por Prioridad
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowTableConfig(!showTableConfig)} className="text-xs">
                {showTableConfig ? "Ocultar" : "Ver todas"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="space-y-1.5 md:space-y-2 max-h-[350px] md:max-h-[400px] overflow-y-auto">
              {(showTableConfig ? tableConfig : tableConfig.slice(0, 10)).map((table: any) => (
                <div key={table.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        table.priority === "P1"
                          ? "bg-red-400"
                          : table.priority === "P2"
                          ? "bg-orange-400"
                          : table.priority === "P3"
                          ? "bg-yellow-400"
                          : "bg-gray-400"
                      }`}
                    />
                    <span className="text-[10px] md:text-xs font-mono truncate">{table.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Badge variant="outline" className="text-[10px] md:text-xs px-1.5">
                      {table.priority}
                    </Badge>
                    {table.excludedFromAuto && (
                      <Badge className="bg-yellow-600/20 text-yellow-400 text-[10px] px-1.5 hidden sm:inline-flex">Excluida</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t text-[10px] md:text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> P1: Crítica</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> P2: Importante</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> P3: Operacional</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> P4: Logs</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guía de Recuperación - Responsive */}
      <Card>
        <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Shield className="h-4 w-4 md:h-5 md:w-5 text-orange-400" />
            Guía de Recuperación
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="p-3 md:p-4 bg-muted/20 rounded-lg border border-dashed">
              <h3 className="font-semibold text-xs md:text-sm mb-1.5 md:mb-2 text-green-400">1. Descarga del Backup</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Descarga el archivo JSON comprimido desde el historial. Contiene todas las tablas con sus datos.
              </p>
            </div>
            <div className="p-3 md:p-4 bg-muted/20 rounded-lg border border-dashed">
              <h3 className="font-semibold text-xs md:text-sm mb-1.5 md:mb-2 text-blue-400">2. Restaurar desde Interfaz</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Usa el botón "Restaurar Backup" para subir el archivo y restaurar los datos automáticamente.
              </p>
            </div>
            <div className="p-3 md:p-4 bg-muted/20 rounded-lg border border-dashed">
              <h3 className="font-semibold text-xs md:text-sm mb-1.5 md:mb-2 text-purple-400">3. Verificación</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Verifica la integridad comparando filas restauradas con los metadatos del backup.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Restauración */}
      <RestoreBackupDialog
        open={showRestoreDialog}
        onOpenChange={setShowRestoreDialog}
        onSuccess={() => {
          statsQuery.refetch();
          historyQuery.refetch();
        }}
      />
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <Badge className="bg-green-600/20 text-green-400 text-[10px] md:text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" /> OK
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge className="bg-red-600/20 text-red-400 text-[10px] md:text-xs">
        <XCircle className="h-3 w-3 mr-1" /> Error
      </Badge>
    );
  }
  if (status === "RUNNING") {
    return (
      <Badge className="bg-blue-600/20 text-blue-400 text-[10px] md:text-xs">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> En curso
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-600/20 text-yellow-400 text-[10px] md:text-xs">
      <AlertTriangle className="h-3 w-3 mr-1" /> Parcial
    </Badge>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "COMPLETED" ? "bg-green-400" : status === "FAILED" ? "bg-red-400" : status === "RUNNING" ? "bg-blue-400" : "bg-yellow-400";
  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />;
}

function BackupActions({ backup, onDelete }: { backup: any; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {backup.s3Url && backup.status === "COMPLETED" && (
        <a
          href={backup.s3Url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title="Descargar backup"
        >
          <Download className="h-4 w-4 text-blue-400" />
        </a>
      )}
      <button
        onClick={() => onDelete(backup.id)}
        className="p-1.5 rounded hover:bg-muted transition-colors"
        title="Eliminar backup"
      >
        <Trash2 className="h-4 w-4 text-red-400" />
      </button>
    </div>
  );
}

// ============================================================================
// RESTORE BACKUP DIALOG
// ============================================================================

function RestoreBackupDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const backupTrpc = (trpc as any).backup;
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreLog, setRestoreLog] = useState<string[]>([]);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const restoreMutation = backupTrpc.restoreBackup.useMutation({
    onSuccess: (result: any) => {
      setRestoreComplete(true);
      setRestoreResult(result);
      setIsRestoring(false);
      toast.success(`Restauración completada: ${result.tablesRestored} tablas, ${result.totalRowsRestored.toLocaleString()} filas`);
      onSuccess();
    },
    onError: (error: any) => {
      setIsRestoring(false);
      setRestoreLog(prev => [...prev, `Error: ${error.message}`]);
      toast.error(`Error en restauración: ${error.message}`);
    },
  });

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileInfo(null);
    setParseError(null);
    setSelectedTables([]);
    setRestoreComplete(false);
    setRestoreResult(null);
    setRestoreLog([]);

    try {
      // Read and parse the file to show preview
      const text = await selectedFile.text();
      let data: any;

      // Try parsing as JSON (could be gzipped or plain JSON)
      try {
        data = JSON.parse(text);
      } catch {
        setParseError("El archivo no es un JSON válido. Si está comprimido (.gz), descomprímelo primero.");
        return;
      }

      // Validate backup structure
      if (!data.metadata || !data.tables) {
        setParseError("El archivo no tiene la estructura de backup de EVGreen (falta metadata o tables).");
        return;
      }

      const tableNames = Object.keys(data.tables);
      const totalRows = tableNames.reduce((sum: number, t: string) => sum + (data.tables[t]?.count || data.tables[t]?.rows?.length || 0), 0);

      setFileInfo({
        backupId: data.metadata.backupId,
        type: data.metadata.type,
        timestamp: data.metadata.timestamp,
        version: data.metadata.version,
        tables: tableNames,
        totalRows,
        tableDetails: tableNames.map((t: string) => ({
          name: t,
          rows: data.tables[t]?.count || data.tables[t]?.rows?.length || 0,
        })),
      });
      setSelectedTables(tableNames); // Select all by default
    } catch (err: any) {
      setParseError(`Error leyendo el archivo: ${err.message}`);
    }
  }, []);

  const handleRestore = async () => {
    if (!file || !fileInfo || selectedTables.length === 0) return;

    setIsRestoring(true);
    setRestoreProgress(0);
    setRestoreLog(["Iniciando restauración..."]);

    try {
      // Read file content
      const text = await file.text();
      const data = JSON.parse(text);

      // Filter only selected tables
      const tablesToRestore: Record<string, any[]> = {};
      for (const tableName of selectedTables) {
        if (data.tables[tableName]) {
          tablesToRestore[tableName] = data.tables[tableName].rows || [];
        }
      }

      setRestoreLog(prev => [...prev, `Enviando ${selectedTables.length} tablas al servidor...`]);
      setRestoreProgress(20);

      // Send to backend
      restoreMutation.mutate({
        tables: tablesToRestore,
        mode: restoreMode,
        metadata: data.metadata,
      });
    } catch (err: any) {
      setIsRestoring(false);
      setRestoreLog(prev => [...prev, `Error: ${err.message}`]);
      toast.error(`Error preparando restauración: ${err.message}`);
    }
  };

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev =>
      prev.includes(tableName)
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const selectAllTables = () => {
    if (fileInfo) {
      setSelectedTables(
        selectedTables.length === fileInfo.tables.length ? [] : [...fileInfo.tables]
      );
    }
  };

  const resetDialog = () => {
    setFile(null);
    setFileInfo(null);
    setParseError(null);
    setSelectedTables([]);
    setRestoreComplete(false);
    setRestoreResult(null);
    setRestoreLog([]);
    setIsRestoring(false);
    setRestoreProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!isRestoring) {
        onOpenChange(v);
        if (!v) resetDialog();
      }
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <RotateCcw className="h-5 w-5 text-blue-400" />
            Restaurar Backup
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Sube un archivo de backup JSON de EVGreen para restaurar los datos en la base de datos.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File selection */}
        {!fileInfo && !parseError && !restoreComplete && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
            >
              <FileUp className="h-10 w-10 md:h-12 md:w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">
                {file ? file.name : "Haz clic para seleccionar archivo"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Archivo JSON de backup EVGreen (.json)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Parse error */}
        {parseError && (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Error al leer el archivo</p>
                  <p className="text-xs text-muted-foreground mt-1">{parseError}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={resetDialog} className="w-full">
              Seleccionar otro archivo
            </Button>
          </div>
        )}

        {/* Step 2: Preview and configure */}
        {fileInfo && !isRestoring && !restoreComplete && (
          <div className="space-y-4">
            {/* Backup info */}
            <div className="p-3 bg-muted/20 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Backup ID</span>
                <span className="font-mono">#{fileInfo.backupId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tipo</span>
                <Badge variant="outline" className="text-[10px]">{fileInfo.type}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Fecha</span>
                <span>{formatDate(fileInfo.timestamp)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total filas</span>
                <span className="font-bold">{fileInfo.totalRows.toLocaleString()}</span>
              </div>
            </div>

            {/* Restore mode */}
            <div>
              <label className="text-xs font-medium mb-1.5 block">Modo de restauración</label>
              <Select value={restoreMode} onValueChange={(v: any) => setRestoreMode(v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">
                    <div className="text-left">
                      <p className="font-medium text-xs">Fusionar (recomendado)</p>
                      <p className="text-[10px] text-muted-foreground">Inserta filas nuevas, omite duplicados</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="replace">
                    <div className="text-left">
                      <p className="font-medium text-xs">Reemplazar</p>
                      <p className="text-[10px] text-muted-foreground">Elimina datos existentes y reinserta todo</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warning for replace mode */}
            {restoreMode === "replace" && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[10px] md:text-xs text-red-400">
                  El modo "Reemplazar" eliminará los datos actuales de las tablas seleccionadas antes de insertar los datos del backup. Esta acción no se puede deshacer.
                </p>
              </div>
            )}

            {/* Table selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium">Tablas a restaurar</label>
                <button onClick={selectAllTables} className="text-[10px] text-blue-400 hover:underline">
                  {selectedTables.length === fileInfo.tables.length ? "Deseleccionar todas" : "Seleccionar todas"}
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
                {fileInfo.tableDetails.map((table: any) => (
                  <label
                    key={table.name}
                    className="flex items-center justify-between px-3 py-2 hover:bg-muted/20 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(table.name)}
                        onChange={() => toggleTable(table.name)}
                        className="rounded border-border"
                      />
                      <span className="text-xs font-mono truncate">{table.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {table.rows.toLocaleString()} filas
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {selectedTables.length} de {fileInfo.tables.length} tablas seleccionadas
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={resetDialog} className="w-full sm:w-auto text-xs">
                Cancelar
              </Button>
              <Button
                onClick={handleRestore}
                disabled={selectedTables.length === 0}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-xs"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar {selectedTables.length} tablas
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Restoring in progress */}
        {isRestoring && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-blue-400 mb-3" />
              <p className="text-sm font-medium">Restaurando datos...</p>
              <p className="text-xs text-muted-foreground mt-1">No cierres esta ventana</p>
            </div>
            <div className="space-y-2">
              {restoreLog.map((log, i) => (
                <p key={i} className="text-[10px] text-muted-foreground font-mono">
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Restore complete */}
        {restoreComplete && restoreResult && (
          <div className="space-y-4 py-2">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-400 mb-3" />
              <p className="text-sm font-medium text-green-400">Restauración Completada</p>
            </div>
            <div className="p-3 bg-muted/20 rounded-lg space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tablas restauradas</span>
                <span className="font-bold">{restoreResult.tablesRestored}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filas insertadas</span>
                <span className="font-bold">{restoreResult.totalRowsRestored.toLocaleString()}</span>
              </div>
              {restoreResult.tablesSkipped > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tablas omitidas</span>
                  <span className="text-yellow-400">{restoreResult.tablesSkipped}</span>
                </div>
              )}
              {restoreResult.errors && restoreResult.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-muted-foreground mb-1">Errores:</p>
                  {restoreResult.errors.map((err: string, i: number) => (
                    <p key={i} className="text-[10px] text-red-400">{err}</p>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => { onOpenChange(false); resetDialog(); }} className="w-full text-xs">
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
