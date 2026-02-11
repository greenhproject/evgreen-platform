import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Bell, CreditCard, Building, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function InvestorSettings() {
  const { user, refresh } = useAuth();
  
  // Estados para el formulario de perfil
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileTaxId, setProfileTaxId] = useState("");
  
  // Estados para el formulario de empresa
  const [companyName, setCompanyName] = useState("");
  const [companyNit, setCompanyNit] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyDepartment, setCompanyDepartment] = useState("");
  
  // Estados para datos bancarios
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  
  // Estados para notificaciones
  const [notifyDailySummary, setNotifyDailySummary] = useState(true);
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [notifyPayments, setNotifyPayments] = useState(true);
  const [notifyMonthlyReports, setNotifyMonthlyReports] = useState(true);

  // Mutación para actualizar perfil
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Datos actualizados correctamente");
      refresh();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar los datos");
    },
  });

  // Cargar datos del usuario cuando esté disponible
  useEffect(() => {
    if (user) {
      // Perfil
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setProfilePhone(user.phone || "");
      setProfileTaxId(user.taxId || "");
      
      // Empresa
      setCompanyName(user.companyName || "");
      setCompanyNit(user.taxId || "");
      
      // Datos bancarios
      setBankName(user.bankName || "");
      setBankAccount(user.bankAccount || "");
      setAccountHolder(user.name || "");
    }
  }, [user]);

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      name: profileName || undefined,
      phone: profilePhone || undefined,
      taxId: profileTaxId || undefined,
    });
  };

  const handleSaveCompany = () => {
    updateProfileMutation.mutate({
      companyName: companyName || undefined,
      taxId: companyNit || undefined,
    });
  };

  const handleSaveBanking = () => {
    if (!bankName || !bankAccount) {
      toast.error("Por favor completa el banco y número de cuenta");
      return;
    }
    updateProfileMutation.mutate({
      bankName: bankName,
      bankAccount: bankAccount,
    });
  };

  const handleSaveNotifications = () => {
    toast.success("Preferencias de notificaciones actualizadas");
  };

  const isLoading = updateProfileMutation.isPending;

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input 
                    placeholder="Tu nombre" 
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    placeholder="tu@email.com" 
                    type="email" 
                    value={profileEmail}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input 
                    placeholder="+57 300 000 0000" 
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Documento de identidad</Label>
                  <Input 
                    placeholder="Cédula o NIT" 
                    value={profileTaxId}
                    onChange={(e) => setProfileTaxId(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={isLoading}>
              {isLoading ? (
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

        <TabsContent value="company">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Información de la empresa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razón social</Label>
                  <Input 
                    placeholder="Nombre de la empresa" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input 
                    placeholder="900.000.000-0" 
                    value={companyNit}
                    onChange={(e) => setCompanyNit(e.target.value)}
                  />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <Label>Dirección</Label>
                  <Input 
                    placeholder="Dirección de la empresa" 
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input 
                    placeholder="Ciudad" 
                    value={companyCity}
                    onChange={(e) => setCompanyCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Input 
                    placeholder="Departamento" 
                    value={companyDepartment}
                    onChange={(e) => setCompanyDepartment(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleSaveCompany} disabled={isLoading}>
              {isLoading ? (
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

        <TabsContent value="banking">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Datos bancarios para pagos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Aquí recibirás el 80% de los ingresos generados por tus estaciones.
                Estos datos se usarán automáticamente al solicitar liquidaciones.
              </p>
              
              {user?.bankName && user?.bankAccount && (
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Datos bancarios configurados correctamente
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Banco *</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tu banco" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                      <SelectItem value="Davivienda">Davivienda</SelectItem>
                      <SelectItem value="BBVA">BBVA</SelectItem>
                      <SelectItem value="Banco de Bogotá">Banco de Bogotá</SelectItem>
                      <SelectItem value="Banco de Occidente">Banco de Occidente</SelectItem>
                      <SelectItem value="Banco Popular">Banco Popular</SelectItem>
                      <SelectItem value="Banco AV Villas">Banco AV Villas</SelectItem>
                      <SelectItem value="Banco Caja Social">Banco Caja Social</SelectItem>
                      <SelectItem value="Scotiabank Colpatria">Scotiabank Colpatria</SelectItem>
                      <SelectItem value="Banco Falabella">Banco Falabella</SelectItem>
                      <SelectItem value="Nequi">Nequi</SelectItem>
                      <SelectItem value="Daviplata">Daviplata</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de cuenta</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AHORROS">Cuenta de Ahorros</SelectItem>
                      <SelectItem value="CORRIENTE">Cuenta Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número de cuenta *</Label>
                  <Input 
                    placeholder="Número de cuenta" 
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Titular</Label>
                  <Input 
                    placeholder="Nombre del titular" 
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleSaveBanking} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar datos bancarios"
              )}
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
                  <Switch 
                    checked={notifyDailySummary} 
                    onCheckedChange={setNotifyDailySummary}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Alertas de fallas</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificaciones cuando una estación tenga problemas
                    </p>
                  </div>
                  <Switch 
                    checked={notifyAlerts}
                    onCheckedChange={setNotifyAlerts}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pagos recibidos</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificaciones de pagos y liquidaciones
                    </p>
                  </div>
                  <Switch 
                    checked={notifyPayments}
                    onCheckedChange={setNotifyPayments}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reportes mensuales</Label>
                    <p className="text-sm text-muted-foreground">
                      Reporte detallado al final de cada mes
                    </p>
                  </div>
                  <Switch 
                    checked={notifyMonthlyReports}
                    onCheckedChange={setNotifyMonthlyReports}
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleSaveNotifications}>
              Guardar preferencias
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
