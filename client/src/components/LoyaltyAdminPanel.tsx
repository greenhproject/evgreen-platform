/**
 * LoyaltyAdminPanel - Panel de administración del sistema de puntos EVGreen
 * Permite configurar: valor del punto, mínimo de redención, URL del marketplace
 * y ver estadísticas generales del programa de fidelización
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Gift,
  ExternalLink,
  Loader2,
  Users,
  TrendingUp,
  Award,
  Zap,
  Settings2,
  BarChart3,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function LoyaltyAdminPanel() {
  const { data: config, isLoading, refetch } = (trpc as any).loyalty?.getConfig?.useQuery?.() ?? { data: null, isLoading: false, refetch: () => {} };
  const { data: stats } = (trpc as any).loyalty?.adminGetStats?.useQuery?.() ?? { data: null };

  const updateConfigMutation = (trpc as any).loyalty?.adminUpdateConfig?.useMutation?.({
    onSuccess: () => {
      toast.success("Configuración de puntos guardada");
      refetch?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al guardar configuración");
    },
  }) ?? { mutate: () => {}, isPending: false };

  const [form, setForm] = useState({
    pointsPerKwh: 1,
    pointValueCop: 50,
    minRedemptionPoints: 100,
    maxRedemptionPercent: 20,
    marketplaceUrl: "",
    marketplaceName: "Marketplace EVGreen",
    enabled: true,
  });

  useEffect(() => {
    if (config) {
      setForm({
        pointsPerKwh: config.pointsPerKwh ?? 1,
        pointValueCop: config.pointValueCop ?? 50,
        minRedemptionPoints: config.minRedemptionPoints ?? 100,
        maxRedemptionPercent: config.maxRedemptionPercent ?? 20,
        marketplaceUrl: config.marketplaceUrl ?? "",
        marketplaceName: config.marketplaceName ?? "Marketplace EVGreen",
        enabled: config.enabled ?? true,
      });
    }
  }, [config]);

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  const handleSave = () => {
    updateConfigMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas generales */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Usuarios con puntos</span>
            </div>
            <div className="text-2xl font-bold">{(stats.usersWithPoints ?? 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Puntos emitidos</span>
            </div>
            <div className="text-2xl font-bold">{(stats.totalPointsIssued ?? 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Puntos redimidos</span>
            </div>
            <div className="text-2xl font-bold">{(stats.totalPointsRedeemed ?? 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Puntos activos</span>
            </div>
            <div className="text-2xl font-bold">{(stats.totalPointsActive ?? 0).toLocaleString()}</div>
          </Card>
        </div>
      )}

      {/* Configuración */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-500" />
              Configuración del programa de puntos
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define las reglas de acumulación y redención de puntos EVGreen Rewards
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="loyalty-enabled" className="text-sm">Programa activo</Label>
            <Switch
              id="loyalty-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Acumulación */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Acumulación</h4>

            <div className="space-y-2">
              <Label htmlFor="points-per-kwh">Puntos por kWh cargado</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="points-per-kwh"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.pointsPerKwh}
                  onChange={(e) => setForm({ ...form, pointsPerKwh: parseFloat(e.target.value) || 1 })}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">pts / kWh</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ejemplo: con 1 pt/kWh, una carga de 30 kWh = 30 puntos
              </p>
            </div>
          </div>

          {/* Redención */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Redención</h4>

            <div className="space-y-2">
              <Label htmlFor="point-value">Valor por punto (COP)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="point-value"
                  type="number"
                  min={1}
                  step={10}
                  value={form.pointValueCop}
                  onChange={(e) => setForm({ ...form, pointValueCop: parseInt(e.target.value) || 50 })}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">COP / punto</span>
              </div>
              <p className="text-xs text-muted-foreground">
                100 puntos = ${(form.pointValueCop * 100).toLocaleString("es-CO")} COP de descuento
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-redeem">Mínimo para redimir</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="min-redeem"
                  type="number"
                  min={1}
                  step={10}
                  value={form.minRedemptionPoints}
                  onChange={(e) => setForm({ ...form, minRedemptionPoints: parseInt(e.target.value) || 100 })}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">puntos mínimos</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-redeem">Descuento máximo por sesión (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="max-redeem"
                  type="number"
                  min={1}
                  max={100}
                  step={5}
                  value={form.maxRedemptionPercent}
                  onChange={(e) => setForm({ ...form, maxRedemptionPercent: parseFloat(e.target.value) || 20 })}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">% del costo de la sesión</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Máx. {form.maxRedemptionPercent}% de descuento sobre el costo de cada carga
              </p>
            </div>
          </div>
        </div>

        {/* Marketplace */}
        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="marketplace-url" className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-blue-500" />
            URL del Marketplace de beneficios
          </Label>
          <Input
            id="marketplace-url"
            type="url"
            placeholder="https://marketplace.evgreen.lat"
            value={form.marketplaceUrl}
            onChange={(e) => setForm({ ...form, marketplaceUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Si se configura, los usuarios verán un botón para ir al marketplace desde su tarjeta de puntos.
            Déjalo vacío para no mostrar el botón.
          </p>
          {form.marketplaceUrl && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                <ExternalLink className="w-3 h-3 mr-1" />
                URL configurada
              </Badge>
              <button
                onClick={() => window.open(form.marketplaceUrl, "_blank")}
                className="text-xs text-blue-600 hover:underline"
              >
                Probar enlace
              </button>
            </div>
          )}
        </div>

        {/* Resumen del modelo */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <BarChart3 className="w-4 h-4" />
            Resumen del modelo de fidelización
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>• <strong>{form.pointsPerKwh} pt</strong> por kWh cargado</div>
            <div>• Valor: <strong>${form.pointValueCop} COP</strong> por punto</div>
            <div>• Mínimo redención: <strong>{form.minRedemptionPoints} pts</strong></div>
            <div>• Retorno efectivo: <strong>{((form.pointValueCop / 1800) * 100).toFixed(1)}%</strong> sobre tarifa</div>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            Un usuario que carga 20 kWh/semana acumula ~{(20 * 4 * form.pointsPerKwh).toFixed(0)} pts/mes
            ≈ ${(20 * 4 * form.pointsPerKwh * form.pointValueCop).toLocaleString("es-CO")} COP de descuento mensual
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={updateConfigMutation.isPending}
          className="w-full"
          style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
        >
          {updateConfigMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
          ) : (
            "Guardar configuración de puntos"
          )}
        </Button>
      </Card>
    </div>
  );
}

export default LoyaltyAdminPanel;
