import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Bell, CreditCard, Shield, Globe, Database } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
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
                  <Input defaultValue="Green House Project" />
                </div>
                <div className="space-y-2">
                  <Label>Línea de negocio</Label>
                  <Input defaultValue="Green EV" />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input placeholder="900.000.000-0" />
                </div>
                <div className="space-y-2">
                  <Label>Email de contacto</Label>
                  <Input defaultValue="greenhproject@gmail.com" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Modelo de negocio</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Porcentaje inversionista</Label>
                  <Input defaultValue="80" type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Porcentaje Green EV (fee)</Label>
                  <Input defaultValue="20" type="number" />
                </div>
              </div>
            </div>

            <Button onClick={() => toast.success("Configuración guardada")}>
              Guardar cambios
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
                  <Input placeholder="pk_live_..." type="password" />
                </div>
                <div className="space-y-2">
                  <Label>Stripe Secret Key</Label>
                  <Input placeholder="sk_live_..." type="password" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Modo de pruebas</Label>
                    <p className="text-sm text-muted-foreground">
                      Usar claves de prueba de Stripe
                    </p>
                  </div>
                  <Switch defaultChecked />
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
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reserva de horario</Label>
                    <p className="text-sm text-muted-foreground">
                      Cobro por reservar un cargador
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Penalización por ocupación</Label>
                    <p className="text-sm text-muted-foreground">
                      Cobro por tiempo excedido post-carga
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>

            <Button onClick={() => toast.success("Configuración de pagos guardada")}>
              Guardar cambios
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
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reserva próxima</Label>
                    <p className="text-sm text-muted-foreground">
                      Recordatorio 15 min antes de la reserva
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Promociones</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar ofertas y descuentos
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>

            <Button onClick={() => toast.success("Notificaciones guardadas")}>
              Guardar cambios
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
                  <Input placeholder="https://api.upme.gov.co/ocpi/..." />
                </div>
                <div className="space-y-2">
                  <Label>Token JWT</Label>
                  <Input placeholder="Token de autenticación" type="password" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reporte automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar datos cada 60 segundos
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">OCPP - Servidor CSMS</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Puerto WebSocket</Label>
                  <Input defaultValue="9000" type="number" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Servidor activo</Label>
                    <p className="text-sm text-muted-foreground">
                      Aceptar conexiones de cargadores
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>

            <Button onClick={() => toast.success("Integraciones guardadas")}>
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
