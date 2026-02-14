import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  HardDrive,
  Cpu,
  FileCode,
} from "lucide-react";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; label: string }> = {
    PENDING: { variant: "outline", icon: Clock, label: "Pendiente" },
    DOWNLOADING: { variant: "secondary", icon: Download, label: "Descargando" },
    DOWNLOADED: { variant: "secondary", icon: CheckCircle, label: "Descargado" },
    INSTALLING: { variant: "default", icon: RefreshCw, label: "Instalando" },
    INSTALLED: { variant: "default", icon: CheckCircle, label: "Instalado" },
    FAILED: { variant: "destructive", icon: XCircle, label: "Fallido" },
    INSTALLATION_FAILED: { variant: "destructive", icon: XCircle, label: "Instalación Fallida" },
    DOWNLOAD_FAILED: { variant: "destructive", icon: XCircle, label: "Descarga Fallida" },
    CANCELLED: { variant: "outline", icon: XCircle, label: "Cancelado" },
    IDLE: { variant: "outline", icon: Clock, label: "Inactivo" },
  };
  const c = config[status] || { variant: "outline" as const, icon: Clock, label: status };
  const Icon = c.icon;
  return (
    <Badge variant={c.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

export default function Firmware() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; base64: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "failed">("all");

  // Queries
  const stationsQuery = trpc.stations.listAll.useQuery();
  const firmwareQuery = trpc.ocpp.getFirmwareHistory.useQuery({ limit: 50 });
  const activeQuery = trpc.ocpp.getActiveFirmwareUpdates.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5s for active updates
  });

  // Mutations
  const uploadMutation = trpc.ocpp.uploadAndStartFirmware.useMutation();
  const cancelMutation = trpc.ocpp.cancelFirmwareUpdate.useMutation();

  const stations = stationsQuery.data || [];
  const allUpdates = firmwareQuery.data || [];
  const activeUpdates = activeQuery.data || [];

  const filteredUpdates = useMemo(() => {
    switch (filter) {
      case "active":
        return allUpdates.filter((u: any) => ["PENDING", "DOWNLOADING", "DOWNLOADED", "INSTALLING"].includes(u.status));
      case "completed":
        return allUpdates.filter((u: any) => u.status === "INSTALLED");
      case "failed":
        return allUpdates.filter((u: any) => ["FAILED", "INSTALLATION_FAILED", "DOWNLOAD_FAILED", "CANCELLED"].includes(u.status));
      default:
        return allUpdates;
    }
  }, [allUpdates, filter]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("El archivo no puede superar 50MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setUploadedFile({ name: file.name, size: file.size, base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleStartUpdate = async () => {
    if (!selectedStation || !uploadedFile) {
      toast.error("Selecciona una estación y un archivo de firmware");
      return;
    }

    const station = stations.find((s: any) => s.id.toString() === selectedStation);
    if (!station) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({
        stationId: station.id,
        ocppIdentity: (station as any).ocppIdentity || `CP-${station.id}`,
        fileName: uploadedFile.name,
        fileBase64: uploadedFile.base64,
        fileSize: uploadedFile.size,
        version: firmwareVersion || undefined,
        notes: notes || undefined,
      });

      toast.success(`Firmware enviado a ${station.name}`);
      setShowUploadDialog(false);
      resetForm();
      firmwareQuery.refetch();
      activeQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "No se pudo iniciar la actualización");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelMutation.mutateAsync({ id, reason: "Cancelado por el técnico" });
      toast.success("Actualización cancelada");
      firmwareQuery.refetch();
      activeQuery.refetch();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setSelectedStation("");
    setFirmwareVersion("");
    setNotes("");
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            Gestión de Firmware
          </h1>
          <p className="text-muted-foreground mt-1">
            Actualiza el firmware de los cargadores OCPP de la red
          </p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Nueva Actualización
        </Button>
      </div>

      {/* Active Updates */}
      {activeUpdates.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary animate-spin" />
              Actualizaciones en Progreso ({activeUpdates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeUpdates.map((update: any) => (
              <div key={update.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{update.ocppIdentity}</span>
                    {getStatusBadge(update.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {update.fileName} {update.version && `• v${update.version}`}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${update.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{update.progress}% completado</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancel(update.id)}
                  disabled={cancelMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("all")}>
          <CardContent className="pt-4 pb-3 text-center">
            <HardDrive className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{allUpdates.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("active")}>
          <CardContent className="pt-4 pb-3 text-center">
            <RefreshCw className="h-6 w-6 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold">{activeUpdates.length}</p>
            <p className="text-xs text-muted-foreground">Activas</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("completed")}>
          <CardContent className="pt-4 pb-3 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{allUpdates.filter((u: any) => u.status === "INSTALLED").length}</p>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("failed")}>
          <CardContent className="pt-4 pb-3 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold">{allUpdates.filter((u: any) => ["FAILED", "INSTALLATION_FAILED", "DOWNLOAD_FAILED"].includes(u.status)).length}</p>
            <p className="text-xs text-muted-foreground">Fallidas</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Historial de Actualizaciones
            </CardTitle>
            <div className="flex gap-1">
              {(["all", "active", "completed", "failed"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "Todas" : f === "active" ? "Activas" : f === "completed" ? "Completadas" : "Fallidas"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUpdates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay actualizaciones de firmware</p>
              <p className="text-sm mt-1">Haz clic en "Nueva Actualización" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUpdates.map((update: any) => (
                <div
                  key={update.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{update.ocppIdentity}</span>
                      {getStatusBadge(update.status)}
                      {update.version && (
                        <Badge variant="outline">v{update.version}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {update.fileName} • {formatFileSize(update.fileSize)}
                    </p>
                    {update.errorMessage && (
                      <p className="text-sm text-red-500 mt-1">{update.errorMessage}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(update.createdAt).toLocaleString("es-CO")}
                      {update.completedAt && ` → ${new Date(update.completedAt).toLocaleString("es-CO")}`}
                    </p>
                  </div>
                  {["PENDING", "DOWNLOADING", "DOWNLOADED", "INSTALLING"].includes(update.status) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancel(update.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Nueva Actualización de Firmware
            </DialogTitle>
            <DialogDescription>
              Selecciona la estación y sube el archivo de firmware para iniciar la actualización.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Estación de Carga</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estación..." />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((station: any) => (
                    <SelectItem key={station.id} value={station.id.toString()}>
                      {station.name} ({(station as any).ocppIdentity || `CP-${station.id}`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Archivo de Firmware</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".bin,.hex,.fw,.img,.zip,.tar.gz"
                onChange={handleFileSelect}
                className="mt-1"
              />
              {uploadedFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  {uploadedFile.name} ({formatFileSize(uploadedFile.size)})
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Formatos: .bin, .hex, .fw, .img, .zip, .tar.gz (máx 50MB)
              </p>
            </div>

            <div>
              <Label>Versión (opcional)</Label>
              <Input
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
                placeholder="ej: 2.1.0"
              />
            </div>

            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descripción de la actualización..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleStartUpdate}
              disabled={isUploading || !selectedStation || !uploadedFile}
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Iniciar Actualización
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
