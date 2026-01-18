import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, CreditCard, Building } from "lucide-react";
import { toast } from "sonner";

export default function InvestorSettings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">
          Administra tu perfil y preferencias
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building className="w-4 h-4 mr-2" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="banking">
            <CreditCard className="w-4 h-4 mr-2" />
            Datos bancarios
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notificaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Información personal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input placeholder="Tu nombre" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input placeholder="tu@email.com" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input placeholder="+57 300 000 0000" />
                </div>
                <div className="space-y-2">
                  <Label>Documento de identidad</Label>
                  <Input placeholder="Cédula o NIT" />
                </div>
              </div>
            </div>
            <Button onClick={() => toast.success("Perfil actualizado")}>
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Información de la empresa</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razón social</Label>
                  <Input placeholder="Nombre de la empresa" />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input placeholder="900.000.000-0" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Dirección</Label>
                  <Input placeholder="Dirección de la empresa" />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input placeholder="Ciudad" />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Input placeholder="Departamento" />
                </div>
              </div>
            </div>
            <Button onClick={() => toast.success("Datos de empresa actualizados")}>
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="banking">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Datos bancarios para pagos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Aquí recibirás el 80% de los ingresos generados por tus estaciones
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input placeholder="Nombre del banco" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de cuenta</Label>
                  <Input placeholder="Ahorros / Corriente" />
                </div>
                <div className="space-y-2">
                  <Label>Número de cuenta</Label>
                  <Input placeholder="Número de cuenta" />
                </div>
                <div className="space-y-2">
                  <Label>Titular</Label>
                  <Input placeholder="Nombre del titular" />
                </div>
              </div>
            </div>
            <Button onClick={() => toast.success("Datos bancarios actualizados")}>
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Preferencias de notificaciones</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Resumen diario</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe un resumen de tus estaciones cada día
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Alertas de fallas</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificaciones cuando una estación tenga problemas
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pagos recibidos</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificaciones de pagos y liquidaciones
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reportes mensuales</Label>
                    <p className="text-sm text-muted-foreground">
                      Reporte detallado al final de cada mes
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
            <Button onClick={() => toast.success("Notificaciones actualizadas")}>
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
