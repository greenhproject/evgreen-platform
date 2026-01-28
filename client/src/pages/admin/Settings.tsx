import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Bell, CreditCard, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function AdminSettings() {
  const { data: settings, isLoading, refetch } = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada exitosamente");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  // Estado local para los formularios
  const [generalForm, setGeneralForm] = useState({
    companyName: "",
    businessLine: "",
    nit: "",
    contactEmail: "",
    investorPercentage: 80,
    platformFeePercentage: 20,
  });

  const [paymentsForm, setPaymentsForm] = useState({
    stripePublicKey: "",
    stripeSecretKey: "",
    stripeTestMode: true,
    enableEnergyBilling: true,
    enableReservationBilling: true,
    enableOccupancyPenalty: true,
  });

  const [notificationsForm, setNotificationsForm] = useState({
    notifyChargeComplete: true,
    notifyReservationReminder: true,
    notifyPromotions: false,
  });

  const [integrationsForm, setIntegrationsForm] = useState({
    upmeEndpoint: "",
    upmeToken: "",
    upmeAutoReport: true,
    ocppPort: 9000,
    ocppServerActive: true,
  });

  // Cargar datos cuando llegan del servidor
  useEffect(() => {
    if (settings) {
      setGeneralForm({
        companyName: settings.companyName || "",
        businessLine: settings.businessLine || "",
        nit: settings.nit || "",
        contactEmail: settings.contactEmail || "",
        investorPercentage: settings.investorPercentage,
        platformFeePercentage: settings.platformFeePercentage,
      });

      setPaymentsForm({
        stripePublicKey: settings.stripePublicKey || "",
        stripeSecretKey: settings.stripeSecretKey || "",
        stripeTestMode: settings.stripeTestMode,
        enableEnergyBilling: settings.enableEnergyBilling,
        enableReservationBilling: settings.enableReservationBilling,
        enableOccupancyPenalty: settings.enableOccupancyPenalty,
      });

      setNotificationsForm({
        notifyChargeComplete: settings.notifyChargeComplete,
        notifyReservationReminder: settings.notifyReservationReminder,
        notifyPromotions: settings.notifyPromotions,
      });

      setIntegrationsForm({
        upmeEndpoint: settings.upmeEndpoint || "",
        upmeToken: settings.upmeToken || "",
        upmeAutoReport: settings.upmeAutoReport,
        ocppPort: settings.ocppPort || 9000,
        ocppServerActive: settings.ocppServerActive,
      });
    }
  }, [settings]);

  const handleSaveGeneral = () => {
    updateMutation.mutate(generalForm);
  };

  const handleSavePayments = () => {
    updateMutation.mutate(paymentsForm);
  };

  const handleSaveNotifications = () => {
    updateMutation.mutate(notificationsForm);
  };

  const handleSaveIntegrations = () => {
    updateMutation.mutate(integrationsForm);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">
          Configura los parámetros de la plataforma
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="w-4 h-4 mr-2" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Globe className="w-4 h-4 mr-2" />
            Integraciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Información de la empresa</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de la empresa</Label>
                  <Input
                    value={generalForm.companyName}
                    onChange={(e) => setGeneralForm({ ...generalForm, companyName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Línea de negocio</Label>
                  <Input
                    value={generalForm.businessLine}
                    onChange={(e) => setGeneralForm({ ...generalForm, businessLine: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input
                    value={generalForm.nit}
                    onChange={(e) => setGeneralForm({ ...generalForm, nit: e.target.value })}
                    placeholder="900.000.000-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email de contacto</Label>
                  <Input
                    value={generalForm.contactEmail}
                    onChange={(e) => setGeneralForm({ ...generalForm, contactEmail: e.target.value })}
                    type="email"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Modelo de negocio</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Porcentaje inversionista (%)</Label>
                  <Input
                    value={generalForm.investorPercentage}
                    onChange={(e) => setGeneralForm({ ...generalForm, investorPercentage: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Porcentaje Green EV (fee) (%)</Label>
                  <Input
                    value={generalForm.platformFeePercentage}
                    onChange={(e) => setGeneralForm({ ...generalForm, platformFeePercentage: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                    max={100}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveGeneral} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Configuración de Stripe</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Stripe Public Key</Label>
                  <Input
                    value={paymentsForm.stripePublicKey}
                    onChange={(e) => setPaymentsForm({ ...paymentsForm, stripePublicKey: e.target.value })}
                    placeholder="pk_test_... o pk_live_..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stripe Secret Key</Label>
                  <Input
                    value={paymentsForm.stripeSecretKey}
                    onChange={(e) => setPaymentsForm({ ...paymentsForm, stripeSecretKey: e.target.value })}
                    placeholder="sk_test_... o sk_live_..."
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Las claves se guardan de forma segura. Si ya hay una clave guardada, verás una versión enmascarada.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Modo de pruebas</Label>
                    <p className="text-sm text-muted-foreground">
                      Usar claves de prueba de Stripe
                    </p>
                  </div>
                  <Switch
                    checked={paymentsForm.stripeTestMode}
                    onCheckedChange={(checked) => setPaymentsForm({ ...paymentsForm, stripeTestMode: checked })}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Métodos de ingreso</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Venta de energía ($/kWh)</Label>
                    <p className="text-sm text-muted-foreground">
                      Cobro por energía consumida
                    </p>
                  </div>
                  <Switch
                    checked={paymentsForm.enableEnergyBilling}
                    onCheckedChange={(checked) => setPaymentsForm({ ...paymentsForm, enableEnergyBilling: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reserva de horario</Label>
                    <p className="text-sm text-muted-foreground">
                      Cobro por reservar un cargador
                    </p>
                  </div>
                  <Switch
                    checked={paymentsForm.enableReservationBilling}
                    onCheckedChange={(checked) => setPaymentsForm({ ...paymentsForm, enableReservationBilling: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Penalización por ocupación</Label>
                    <p className="text-sm text-muted-foreground">
                      Cobro por tiempo excedido post-carga
                    </p>
                  </div>
                  <Switch
                    checked={paymentsForm.enableOccupancyPenalty}
                    onCheckedChange={(checked) => setPaymentsForm({ ...paymentsForm, enableOccupancyPenalty: checked })}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSavePayments} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Notificaciones push</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Carga completada</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar cuando termine una carga
                    </p>
                  </div>
                  <Switch
                    checked={notificationsForm.notifyChargeComplete}
                    onCheckedChange={(checked) => setNotificationsForm({ ...notificationsForm, notifyChargeComplete: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reserva próxima</Label>
                    <p className="text-sm text-muted-foreground">
                      Recordatorio 15 min antes de la reserva
                    </p>
                  </div>
                  <Switch
                    checked={notificationsForm.notifyReservationReminder}
                    onCheckedChange={(checked) => setNotificationsForm({ ...notificationsForm, notifyReservationReminder: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Promociones</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar ofertas y descuentos
                    </p>
                  </div>
                  <Switch
                    checked={notificationsForm.notifyPromotions}
                    onCheckedChange={(checked) => setNotificationsForm({ ...notificationsForm, notifyPromotions: checked })}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveNotifications} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">UPME - Reporte OCPI</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>URL del endpoint UPME</Label>
                  <Input
                    value={integrationsForm.upmeEndpoint}
                    onChange={(e) => setIntegrationsForm({ ...integrationsForm, upmeEndpoint: e.target.value })}
                    placeholder="https://api.upme.gov.co/ocpi/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Token JWT</Label>
                  <Input
                    value={integrationsForm.upmeToken}
                    onChange={(e) => setIntegrationsForm({ ...integrationsForm, upmeToken: e.target.value })}
                    placeholder="Token de autenticación"
                    type="password"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reporte automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar datos cada 60 segundos
                    </p>
                  </div>
                  <Switch
                    checked={integrationsForm.upmeAutoReport}
                    onCheckedChange={(checked) => setIntegrationsForm({ ...integrationsForm, upmeAutoReport: checked })}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">OCPP - Servidor CSMS</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Puerto WebSocket</Label>
                  <Input
                    value={integrationsForm.ocppPort}
                    onChange={(e) => setIntegrationsForm({ ...integrationsForm, ocppPort: parseInt(e.target.value) || 9000 })}
                    type="number"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Servidor activo</Label>
                    <p className="text-sm text-muted-foreground">
                      Aceptar conexiones de cargadores
                    </p>
                  </div>
                  <Switch
                    checked={integrationsForm.ocppServerActive}
                    onCheckedChange={(checked) => setIntegrationsForm({ ...integrationsForm, ocppServerActive: checked })}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveIntegrations} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
