import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Bell, CreditCard, Globe, Loader2, Calculator, RefreshCw } from "lucide-react";
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
    wompiPublicKey: "",
    wompiPrivateKey: "",
    wompiIntegritySecret: "",
    wompiEventsSecret: "",
    wompiTestMode: true,
    enableEnergyBilling: true,
    enableReservationBilling: true,
    enableOccupancyPenalty: true,
  });

  // Rastrear qué campos secretos tienen valor guardado en BD (para mostrar placeholder)
  const [savedSecrets, setSavedSecrets] = useState({
    wompiPublicKey: false,
    wompiPrivateKey: false,
    wompiIntegritySecret: false,
    wompiEventsSecret: false,
  });

  // Rastrear qué campos secretos fueron tocados/modificados por el usuario
  const [touchedSecrets, setTouchedSecrets] = useState({
    wompiPublicKey: false,
    wompiPrivateKey: false,
    wompiIntegritySecret: false,
    wompiEventsSecret: false,
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

  const [calculatorForm, setCalculatorForm] = useState({
    factorUtilizacionPremium: 2.0,
    costosOperativosIndividual: 15,
    costosOperativosColectivo: 10,
    costosOperativosAC: 15,
    eficienciaCargaDC: 92,
    eficienciaCargaAC: 95,
    costoEnergiaRed: 850,
    costoEnergiaSolar: 250,
    precioVentaDefault: 1800,
    precioVentaMin: 1400,
    precioVentaMax: 2200,
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

      // Para campos secretos: NO llenar con valores enmascarados, dejar vacíos
      // Solo marcar que tienen valor guardado para mostrar placeholder
      setSavedSecrets({
        wompiPublicKey: !!settings.wompiPublicKey,
        wompiPrivateKey: !!settings.wompiPrivateKey,
        wompiIntegritySecret: !!settings.wompiIntegritySecret,
        wompiEventsSecret: !!settings.wompiEventsSecret,
      });
      setTouchedSecrets({
        wompiPublicKey: false,
        wompiPrivateKey: false,
        wompiIntegritySecret: false,
        wompiEventsSecret: false,
      });
      setPaymentsForm({
        wompiPublicKey: "",
        wompiPrivateKey: "",
        wompiIntegritySecret: "",
        wompiEventsSecret: "",
        wompiTestMode: settings.wompiTestMode,
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

      setCalculatorForm({
        factorUtilizacionPremium: parseFloat(String(settings.factorUtilizacionPremium ?? "2.00")),
        costosOperativosIndividual: settings.costosOperativosIndividual ?? 15,
        costosOperativosColectivo: settings.costosOperativosColectivo ?? 10,
        costosOperativosAC: settings.costosOperativosAC ?? 15,
        eficienciaCargaDC: settings.eficienciaCargaDC ?? 92,
        eficienciaCargaAC: settings.eficienciaCargaAC ?? 95,
        costoEnergiaRed: settings.costoEnergiaRed ?? 850,
        costoEnergiaSolar: settings.costoEnergiaSolar ?? 250,
        precioVentaDefault: settings.precioVentaDefault ?? 1800,
        precioVentaMin: settings.precioVentaMin ?? 1400,
        precioVentaMax: settings.precioVentaMax ?? 2200,
      });
    }
  }, [settings]);

  const handleSaveGeneral = () => {
    updateMutation.mutate(generalForm);
  };

  const handleSavePayments = () => {
    // Solo enviar campos secretos que fueron modificados por el usuario
    const payload: any = {
      wompiTestMode: paymentsForm.wompiTestMode,
      enableEnergyBilling: paymentsForm.enableEnergyBilling,
      enableReservationBilling: paymentsForm.enableReservationBilling,
      enableOccupancyPenalty: paymentsForm.enableOccupancyPenalty,
    };
    // Solo incluir credenciales que el usuario modificó explícitamente
    if (touchedSecrets.wompiPublicKey && paymentsForm.wompiPublicKey) {
      payload.wompiPublicKey = paymentsForm.wompiPublicKey;
    }
    if (touchedSecrets.wompiPrivateKey && paymentsForm.wompiPrivateKey) {
      payload.wompiPrivateKey = paymentsForm.wompiPrivateKey;
    }
    if (touchedSecrets.wompiIntegritySecret && paymentsForm.wompiIntegritySecret) {
      payload.wompiIntegritySecret = paymentsForm.wompiIntegritySecret;
    }
    if (touchedSecrets.wompiEventsSecret && paymentsForm.wompiEventsSecret) {
      payload.wompiEventsSecret = paymentsForm.wompiEventsSecret;
    }
    updateMutation.mutate(payload);
  };

  const handleSaveNotifications = () => {
    updateMutation.mutate(notificationsForm);
  };

  const handleSaveIntegrations = () => {
    updateMutation.mutate(integrationsForm);
  };

  const handleSaveCalculator = () => {
    updateMutation.mutate(calculatorForm);
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
          <TabsTrigger value="calculator">
            <Calculator className="w-4 h-4 mr-2" />
            Calculadora
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
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <img src="https://wompi.com/favicon.ico" alt="Wompi" className="w-5 h-5" />
                Configuración de Wompi
                {(savedSecrets.wompiPublicKey || paymentsForm.wompiPublicKey) && (savedSecrets.wompiPrivateKey || paymentsForm.wompiPrivateKey) && (savedSecrets.wompiIntegritySecret || paymentsForm.wompiIntegritySecret) ? (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Configurado
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Sin configurar
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configura las llaves de tu cuenta de Wompi para procesar pagos con tarjetas, PSE, Nequi y Bancolombia.
                Obtén tus llaves en <a href="https://comercios.wompi.co" target="_blank" rel="noopener" className="text-primary underline">comercios.wompi.co</a> &rarr; Desarrolladores.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Llave pública</Label>
                  <Input
                    value={paymentsForm.wompiPublicKey}
                    onChange={(e) => {
                      setPaymentsForm({ ...paymentsForm, wompiPublicKey: e.target.value });
                      setTouchedSecrets({ ...touchedSecrets, wompiPublicKey: true });
                    }}
                    placeholder={savedSecrets.wompiPublicKey ? "✅ Clave guardada — escribe para reemplazar" : "pub_prod_... o pub_test_..."}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usa en el widget de pago del frontend.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Llave privada</Label>
                  <Input
                    value={paymentsForm.wompiPrivateKey}
                    onChange={(e) => {
                      setPaymentsForm({ ...paymentsForm, wompiPrivateKey: e.target.value });
                      setTouchedSecrets({ ...touchedSecrets, wompiPrivateKey: true });
                    }}
                    placeholder={savedSecrets.wompiPrivateKey ? "✅ Clave guardada — escribe para reemplazar" : "prv_prod_... o prv_test_..."}
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usa en el servidor para consultar transacciones.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Secreto de integridad</Label>
                  <Input
                    value={paymentsForm.wompiIntegritySecret}
                    onChange={(e) => {
                      setPaymentsForm({ ...paymentsForm, wompiIntegritySecret: e.target.value });
                      setTouchedSecrets({ ...touchedSecrets, wompiIntegritySecret: true });
                    }}
                    placeholder={savedSecrets.wompiIntegritySecret ? "✅ Clave guardada — escribe para reemplazar" : "prod_integrity_... o test_integrity_..."}
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se encuentra en Desarrolladores &rarr; Secretos para integración técnica.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Secreto de eventos</Label>
                  <Input
                    value={paymentsForm.wompiEventsSecret}
                    onChange={(e) => {
                      setPaymentsForm({ ...paymentsForm, wompiEventsSecret: e.target.value });
                      setTouchedSecrets({ ...touchedSecrets, wompiEventsSecret: true });
                    }}
                    placeholder={savedSecrets.wompiEventsSecret ? "✅ Clave guardada — escribe para reemplazar" : "prod_events_... o test_events_..."}
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usa para verificar la autenticidad de los webhooks de Wompi.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Modo de pruebas (Sandbox)</Label>
                    <p className="text-sm text-muted-foreground">
                      Usar claves de prueba de Wompi (pub_test_, prv_test_)
                    </p>
                  </div>
                  <Switch
                    checked={paymentsForm.wompiTestMode}
                    onCheckedChange={(checked) => setPaymentsForm({ ...paymentsForm, wompiTestMode: checked })}
                  />
                </div>

                {/* URL de Webhook */}
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                  <Label className="text-sm font-medium">URL de Eventos (Webhook)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Configura esta URL en <a href="https://comercios.wompi.co" target="_blank" rel="noopener" className="text-primary underline">comercios.wompi.co</a> &rarr; Desarrolladores &rarr; Seguimiento de transacciones.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/api/wompi/webhook`}
                      className="font-mono text-xs bg-background"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/wompi/webhook`);
                        toast.success("URL copiada al portapapeles");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>

                {/* Botón de reconciliación de transacciones pendientes */}
                <div className="mt-4 p-4 bg-amber-950/20 rounded-lg border border-amber-800/30">
                  <Label className="text-sm font-medium text-amber-300">Reconciliar transacciones pendientes</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Verifica en Wompi las transacciones de recarga rápida y auto-cobro que quedaron pendientes y acredita las que ya fueron aprobadas.
                  </p>
                  <ReconcileButton />
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

        <TabsContent value="calculator">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Calculadora de Inversión</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Estos parámetros controlan los cálculos mostrados en la página pública de inversionistas (/investors).
                Cualquier cambio se refleja inmediatamente en la calculadora interactiva.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Factor de Utilización</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Factor premium (multiplicador)</Label>
                  <Input
                    value={calculatorForm.factorUtilizacionPremium}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, factorUtilizacionPremium: parseFloat(e.target.value) || 1 })}
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Multiplicador de horas para ubicaciones premium (colectivo). Ej: 2.0 = el doble de horas efectivas.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Costos Operativos (%)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Individual DC (%)</Label>
                  <Input
                    value={calculatorForm.costosOperativosIndividual}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, costosOperativosIndividual: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                    max={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colectivo DC (%)</Label>
                  <Input
                    value={calculatorForm.costosOperativosColectivo}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, costosOperativosColectivo: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                    max={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label>AC (%)</Label>
                  <Input
                    value={calculatorForm.costosOperativosAC}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, costosOperativosAC: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                    max={50}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Eficiencia de Carga (%)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>DC (carga rápida)</Label>
                  <Input
                    value={calculatorForm.eficienciaCargaDC}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, eficienciaCargaDC: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={50}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>AC (carga lenta)</Label>
                  <Input
                    value={calculatorForm.eficienciaCargaAC}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, eficienciaCargaAC: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={50}
                    max={100}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Costos de Energía (COP/kWh)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Red eléctrica</Label>
                  <Input
                    value={calculatorForm.costoEnergiaRed}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, costoEnergiaRed: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Energía solar</Label>
                  <Input
                    value={calculatorForm.costoEnergiaSolar}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, costoEnergiaSolar: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Precio de Venta (COP/kWh)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Mínimo</Label>
                  <Input
                    value={calculatorForm.precioVentaMin}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, precioVentaMin: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Por defecto</Label>
                  <Input
                    value={calculatorForm.precioVentaDefault}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, precioVentaDefault: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máximo</Label>
                  <Input
                    value={calculatorForm.precioVentaMax}
                    onChange={(e) => setCalculatorForm({ ...calculatorForm, precioVentaMax: parseInt(e.target.value) || 0 })}
                    type="number"
                    min={0}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveCalculator} disabled={updateMutation.isPending}>
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

// Componente para reconciliar transacciones pendientes de Wompi
function ReconcileButton() {
  const reconcile = trpc.wompi.reconcilePendingTransactions.useMutation({
    onSuccess: (data) => {
      if (data.credited > 0) {
        toast.success(
          `Reconciliación completada: ${data.credited} transacciones acreditadas por $${data.totalCreditedAmount.toLocaleString("es-CO")} COP`
        );
      } else if (data.processed > 0) {
        toast.info(`Se verificaron ${data.processed} transacciones. Ninguna pendiente de acreditar.`);
      } else {
        toast.info("No hay transacciones pendientes de reconciliar.");
      }
    },
    onError: (error) => {
      toast.error(`Error al reconciliar: ${error.message}`);
    },
  });

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => reconcile.mutate()}
        disabled={reconcile.isPending}
        className="border-amber-700 text-amber-300 hover:bg-amber-900/30"
      >
        {reconcile.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Reconciliando...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconciliar ahora
          </>
        )}
      </Button>
      {reconcile.data && reconcile.data.processed > 0 && (
        <div className="text-xs space-y-1">
          <p className="text-muted-foreground">
            Procesadas: {reconcile.data.processed} | Acreditadas: {reconcile.data.credited} | Total: ${reconcile.data.totalCreditedAmount.toLocaleString("es-CO")} COP
          </p>
          {reconcile.data.details.map((d, i) => (
            <p key={i} className={d.credited ? "text-green-400" : "text-muted-foreground"}>
              {d.reference}: {d.oldStatus} → {d.newStatus} {d.credited ? `(+$${d.amount.toLocaleString("es-CO")})` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
