import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Moon, Sun, Globe, MapPin, Battery, Shield, Loader2, Trash2, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Config() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  // Cargar configuración desde el backend
  const configQuery = trpc.userConfig.get.useQuery();
  const saveMut = trpc.userConfig.save.useMutation({
    onSuccess: () => {
      configQuery.refetch();
      toast.success("Configuración guardada exitosamente");
    },
    onError: (err) => {
      toast.error(err.message || "Error al guardar configuración");
    },
  });
  const clearCacheMut = trpc.userConfig.clearCache.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: () => {
      toast.error("Error al limpiar caché");
    },
  });
  const deleteDataMut = trpc.userConfig.deleteAllData.useMutation({
    onSuccess: () => {
      toast.success("Todos tus datos han sido eliminados");
      setDeleteDialogOpen(false);
      setConfirmEmail("");
      // Cerrar sesión después de eliminar datos
      setTimeout(() => {
        logout?.();
      }, 2000);
    },
    onError: (err) => {
      toast.error(err.message || "Error al eliminar datos");
    },
  });

  // Estado local sincronizado con backend
  const [settings, setSettings] = useState<{
    language: "es" | "en";
    distanceUnit: "km" | "mi";
    currency: "COP" | "USD";
    autoLocate: boolean;
    saveHistory: boolean;
    shareUsageData: boolean;
  }>({
    language: "es",
    distanceUnit: "km",
    currency: "COP",
    autoLocate: true,
    saveHistory: true,
    shareUsageData: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  // Sincronizar estado local cuando llegan datos del backend
  useEffect(() => {
    if (configQuery.data) {
      setSettings({
        language: (configQuery.data.language as "es" | "en") || "es",
        distanceUnit: (configQuery.data.distanceUnit as "km" | "mi") || "km",
        currency: (configQuery.data.currency as "COP" | "USD") || "COP",
        autoLocate: configQuery.data.autoLocate,
        saveHistory: configQuery.data.saveHistory,
        shareUsageData: configQuery.data.shareUsageData,
      });
      setHasChanges(false);
    }
  }, [configQuery.data]);

  const handleChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMut.mutate(settings);
  };

  const handleClearCache = () => {
    clearCacheMut.mutate();
    // También limpiar localStorage
    try {
      const keysToKeep = ["theme"];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignorar errores de localStorage
    }
  };

  const handleDeleteAllData = () => {
    if (!confirmEmail) {
      toast.error("Ingresa tu email para confirmar");
      return;
    }
    deleteDataMut.mutate({ confirmEmail });
  };

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center gap-4 p-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setLocation("/profile")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Configuración</h1>
          </div>
        </div>

        {configQuery.isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="p-4 space-y-4 pb-8">
            {/* Apariencia */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  Apariencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Tema oscuro</Label>
                    <p className="text-sm text-muted-foreground">Reduce el brillo de la pantalla</p>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={() => toggleTheme?.()}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Idioma y región */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Idioma y Región
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select value={settings.language} onValueChange={(v) => handleChange("language", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidad de distancia</Label>
                  <Select value={settings.distanceUnit} onValueChange={(v) => handleChange("distanceUnit", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">Kilómetros (km)</SelectItem>
                      <SelectItem value="mi">Millas (mi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select value={settings.currency} onValueChange={(v) => handleChange("currency", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">Peso Colombiano (COP)</SelectItem>
                      <SelectItem value="USD">Dólar (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Ubicación */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Ubicación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ubicación automática</Label>
                    <p className="text-sm text-muted-foreground">Detectar ubicación al abrir el mapa</p>
                  </div>
                  <Switch
                    checked={settings.autoLocate}
                    onCheckedChange={(checked) => handleChange("autoLocate", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacidad */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Privacidad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Guardar historial de cargas</Label>
                    <p className="text-sm text-muted-foreground">Mantener registro de tus sesiones</p>
                  </div>
                  <Switch
                    checked={settings.saveHistory}
                    onCheckedChange={(checked) => handleChange("saveHistory", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compartir datos de uso</Label>
                    <p className="text-sm text-muted-foreground">Ayúdanos a mejorar la plataforma</p>
                  </div>
                  <Switch
                    checked={settings.shareUsageData}
                    onCheckedChange={(checked) => handleChange("shareUsageData", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Datos de la app */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Battery className="w-4 h-4" />
                  Datos de la App
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleClearCache}
                  disabled={clearCacheMut.isPending}
                >
                  {clearCacheMut.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Limpiar caché
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar todos mis datos
                </Button>
              </CardContent>
            </Card>

            <Button
              className="w-full gradient-primary"
              onClick={handleSave}
              disabled={saveMut.isPending || !hasChanges}
            >
              {saveMut.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : hasChanges ? (
                "Guardar configuración"
              ) : (
                "Sin cambios"
              )}
            </Button>

            {/* Versión */}
            <p className="text-center text-sm text-muted-foreground">
              EVGreen v1.0.0
            </p>
          </div>
        )}

        {/* Dialog de confirmación para eliminar datos */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Eliminar todos mis datos</DialogTitle>
              <DialogDescription>
                Esta acción es irreversible. Se eliminarán tus vehículos guardados, estaciones favoritas,
                notificaciones y se restablecerán todas tus preferencias. Tu cuenta permanecerá activa
                pero sin datos personalizados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label>Ingresa tu email para confirmar</Label>
              <Input
                type="email"
                placeholder={user?.email || "tu@email.com"}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
              />
              {user?.email && (
                <p className="text-xs text-muted-foreground">
                  Ingresa: {user.email}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setConfirmEmail("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAllData}
                disabled={deleteDataMut.isPending || !confirmEmail}
              >
                {deleteDataMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar todo"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UserLayout>
  );
}
