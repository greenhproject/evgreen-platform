import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Moon, Sun, Globe, MapPin, Battery, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

export default function Config() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    language: "es",
    distanceUnit: "km",
    currency: "COP",
    autoLocate: true,
    saveHistory: true,
    shareUsageData: false,
  });

  const handleChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast.success("Configuración guardada");
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
              <Button variant="outline" className="w-full justify-start">
                Limpiar caché
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
                Eliminar todos mis datos
              </Button>
            </CardContent>
          </Card>

          <Button className="w-full gradient-primary" onClick={handleSave}>
            Guardar configuración
          </Button>

          {/* Versión */}
          <p className="text-center text-sm text-muted-foreground">
            EVGreen v1.0.0
          </p>
        </div>
      </div>
    </UserLayout>
  );
}
