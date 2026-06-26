/**
 * Org API & Webhooks Page - Gestión de API Keys y Webhooks del portal de organización
 * Permite crear, ver y revocar API keys propias de la organización
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Webhook,
  Key,
  Plus,
  Copy,
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Code,
  BookOpen,
  Lock,
  Zap,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const AVAILABLE_PERMISSIONS = [
  { key: "stations:read", label: "Estaciones (lectura)", desc: "Listar y ver detalles de estaciones" },
  { key: "transactions:read", label: "Transacciones (lectura)", desc: "Consultar historial de sesiones" },
  { key: "transactions:write", label: "Transacciones (escritura)", desc: "Iniciar/detener sesiones remotamente" },
  { key: "tariffs:read", label: "Tarifas (lectura)", desc: "Consultar precios configurados" },
  { key: "tariffs:write", label: "Tarifas (escritura)", desc: "Modificar precios de carga" },
  { key: "users:read", label: "Usuarios (lectura)", desc: "Listar usuarios de la organización" },
];

export default function OrgApiWebhooks() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);

  const { data: keys, isLoading, refetch } = (trpc.organizations as any).getMyApiKeys.useQuery();

  const revokeKey = (trpc.organizations as any).revokeMyApiKey.useMutation({
    onSuccess: () => { toast.success("API Key revocada"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado al portapapeles"));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando API keys...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-7 w-7 text-green-400" />
            API & Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Integra EVGreen con tus sistemas mediante la API REST
          </p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700 gap-2 self-start"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4" />
          Nueva API Key
        </Button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Code className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Base URL</p>
                <p className="text-sm font-mono font-medium">api.evgreen.lat/v1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Key className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">API Keys activas</p>
                <p className="text-2xl font-bold">{keys?.filter((k: any) => k.isActive).length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Autenticación</p>
                <p className="text-sm font-medium">Bearer Token</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick start */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-green-400" />
            Inicio rápido
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Usa tu API Key en el header de cada petición:</p>
            <div className="bg-muted/30 rounded-lg p-3 font-mono text-xs overflow-x-auto">
              <span className="text-blue-400">curl</span>{" "}
              <span className="text-green-400">-H</span>{" "}
              <span className="text-amber-400">"Authorization: Bearer evg_xxxx..."</span>{" "}
              <span className="text-muted-foreground">\</span>
              <br />
              <span className="ml-4 text-muted-foreground">https://api.evgreen.lat/v1/stations</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {[
                { method: "GET", path: "/v1/stations", desc: "Listar estaciones de tu org" },
                { method: "GET", path: "/v1/transactions", desc: "Historial de transacciones" },
                { method: "GET", path: "/v1/stations/:id/status", desc: "Estado en tiempo real" },
                { method: "POST", path: "/v1/stations/:id/remote-start", desc: "Iniciar carga remota" },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/30">
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      ep.method === "GET"
                        ? "border-blue-500/30 text-blue-400"
                        : "border-green-500/30 text-green-400"
                    }`}
                  >
                    {ep.method}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-mono truncate">{ep.path}</p>
                    <p className="text-[11px] text-muted-foreground">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys list */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-5 w-5 text-green-400" />
            Mis API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!keys || keys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground opacity-30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No tienes API Keys creadas</p>
              <p className="text-xs text-muted-foreground mt-1">Crea tu primera API Key para integrar EVGreen con tus sistemas</p>
              <Button
                size="sm"
                className="mt-4 bg-green-600 hover:bg-green-700 gap-2"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Crear API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key: any) => (
                <div
                  key={key.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    key.isActive
                      ? "border-border/30 bg-muted/10"
                      : "border-border/20 bg-muted/5 opacity-50"
                  }`}
                >
                  <div className={`shrink-0 ${key.isActive ? "text-green-400" : "text-muted-foreground"}`}>
                    {key.isActive ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{key.name}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          key.isActive
                            ? "border-green-500/30 text-green-400"
                            : "border-red-500/30 text-red-400"
                        }`}
                      >
                        {key.isActive ? "Activa" : "Revocada"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-muted-foreground font-mono">{key.keyPrefix}...</code>
                      <button
                        onClick={() => copyToClipboard(key.keyPrefix)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[11px] text-muted-foreground">
                        Creada: {new Date(key.createdAt).toLocaleDateString("es-CO")}
                      </p>
                      {key.lastUsedAt && (
                        <p className="text-[11px] text-muted-foreground">
                          Último uso: {new Date(key.lastUsedAt).toLocaleDateString("es-CO")}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {key.usageCount} llamadas
                      </p>
                    </div>
                  </div>
                  {key.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 shrink-0"
                      onClick={() => revokeKey.mutate({ id: key.id })}
                      disabled={revokeKey.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhooks coming soon */}
      <Card className="bg-card/50 border-border/50 border-dashed opacity-60">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/30">
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Webhooks — Próximamente</p>
              <p className="text-xs text-muted-foreground">
                Recibe notificaciones en tiempo real cuando ocurran eventos en tu red (sesión iniciada, completada, alerta de cargador, etc.)
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs border-muted-foreground/30 text-muted-foreground">
              En desarrollo
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key dialog */}
      <CreateApiKeyDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(key) => {
          setNewKeyVisible(key);
          setShowCreateDialog(false);
          refetch();
        }}
      />

      {/* Show new key dialog */}
      {newKeyVisible && (
        <Dialog open={!!newKeyVisible} onOpenChange={() => setNewKeyVisible(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-5 w-5" />
                API Key creada exitosamente
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-400 font-semibold">
                  ⚠️ Guarda esta API Key ahora. No podrás verla de nuevo.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tu API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted/30 border border-border/30 rounded-lg p-2.5 text-xs font-mono break-all">
                    {newKeyVisible}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(newKeyVisible)}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => setNewKeyVisible(null)}
              >
                Entendido, ya la guardé
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ==========================================
// Create API Key Dialog
// ==========================================
function CreateApiKeyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const [name, setName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(["stations:read", "transactions:read"]);
  const [expiresInDays, setExpiresInDays] = useState<string>("365");

  const createKey = (trpc.organizations as any).createMyApiKey.useMutation({
    onSuccess: (data: any) => {
      onCreated(data.apiKey);
      setName("");
      setSelectedPerms(["stations:read", "transactions:read"]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePerm = (perm: string) => {
    setSelectedPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-green-400" />
            Nueva API Key
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nombre descriptivo</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Integración ERP, App móvil, Dashboard BI..."
            />
          </div>

          <div className="space-y-2">
            <Label>Permisos</Label>
            <div className="space-y-1.5">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label
                  key={perm.key}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedPerms.includes(perm.key)
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border/30 bg-muted/10 hover:bg-muted/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(perm.key)}
                    onChange={() => togglePerm(perm.key)}
                    className="mt-0.5 accent-green-500"
                  />
                  <div>
                    <p className="text-xs font-medium">{perm.label}</p>
                    <p className="text-[11px] text-muted-foreground">{perm.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expiración</Label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="180">6 meses</option>
              <option value="365">1 año</option>
              <option value="0">Sin expiración</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!name.trim() || selectedPerms.length === 0 || createKey.isPending}
              onClick={() => createKey.mutate({
                name: name.trim(),
                permissions: selectedPerms,
                expiresInDays: expiresInDays === "0" ? undefined : parseInt(expiresInDays),
              })}
            >
              {createKey.isPending ? "Creando..." : "Crear API Key"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
