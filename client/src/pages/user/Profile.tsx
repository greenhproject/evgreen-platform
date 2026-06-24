import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Phone,
  Car,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  Crown,
  Settings,
  Copy,
  Zap,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function UserProfile() {
  const { user, logout, refresh } = useAuth();
  const [, setLocation] = useLocation();

  const { data: socSuggestion } = trpc.charging.getSocAccuracySuggestion.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Obtener suscripción real del usuario
  const { data: subscription } = trpc.wompi.getMySubscription.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

  const isSubscribed = subscription?.isActive && subscription?.tier !== "FREE";
  const planName = subscription?.tier === "PREMIUM" ? "Plan Premium" : subscription?.tier === "BASIC" ? "Plan Básico" : "Plan Gratuito";
  const planColor = subscription?.tier === "PREMIUM" ? "bg-yellow-500/10 text-yellow-500" : subscription?.tier === "BASIC" ? "bg-blue-500/10 text-blue-500" : "bg-primary/10 text-primary";

  const copyIdTag = () => {
    if (user?.idTag) {
      navigator.clipboard.writeText(user.idTag);
      toast.success("idTag copiado al portapapeles");
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const menuSections = [
    {
      title: "Cuenta",
      items: [
        { icon: User, label: "Información personal", path: "/settings/personal" },
        { icon: Car, label: "Mis vehículos", path: "/settings/vehicles" },
        { icon: CreditCard, label: "Métodos de pago", path: "/settings/payment" },
      ],
    },
    {
      title: "Preferencias",
      items: [
        { icon: Bell, label: "Notificaciones", path: "/settings/notifications" },
        { icon: Settings, label: "Configuración", path: "/settings/config" },
      ],
    },
    {
      title: "Privacidad y datos",
      items: [
        { icon: Shield, label: "Mis datos y consentimientos", path: "/settings/privacy" },
      ],
    },
    {
      title: "Soporte",
      items: [
        { icon: HelpCircle, label: "Centro de ayuda", path: "/support" },
        { icon: FileText, label: "Términos y condiciones", path: "/terms" },
      ],
    },
  ];

  return (
    <UserLayout title="Mi perfil" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Header del perfil */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-primary/20 flex-shrink-0">
                <AvatarImage src={user?.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold truncate">{user?.name || "Usuario"}</h2>
                <p className="text-muted-foreground text-xs sm:text-sm truncate">{user?.email}</p>
                <Badge className={`mt-2 ${planColor}`}>
                  <Crown className="w-3 h-3 mr-1" />
                  {planName}
                </Badge>
              </div>
            </div>
            {isSubscribed ? (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setLocation("/subscription")}
              >
                <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                Gestionar mi suscripción
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setLocation("/subscription")}
              >
                <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                Actualizar a Premium
              </Button>
            )}
          </Card>
        </motion.div>

        {/* Sección de idTag OCPP */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Tu idTag de Carga</h3>
                <p className="text-xs text-muted-foreground">Usa este código para identificarte en los cargadores</p>
              </div>
            </div>

            <div className="bg-background/80 rounded-lg p-3 flex items-center justify-between">
              <code className="text-lg font-mono font-bold text-primary">
                {user?.idTag || "Generando..."}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyIdTag}
                disabled={!user?.idTag}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              💡 Presenta este código en el cargador o ingrésalo manualmente para iniciar tu sesión de carga.
            </p>
          </Card>
        </motion.div>

        {/* Sección de Precisión de SoC */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
            Precisión de Batería
          </h3>
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Estimación de SoC</h3>
                <p className="text-xs text-muted-foreground">Precisión de tus estimaciones de batería</p>
              </div>
            </div>

            {socSuggestion ? (
              <div className="space-y-3">
                {/* Estado general */}
                <div className={`flex items-start gap-3 rounded-lg p-3 ${
                  socSuggestion.hasSuggestion
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : socSuggestion.sampleCount >= 2
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-muted/50 border border-border"
                }`}>
                  {socSuggestion.hasSuggestion ? (
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  ) : socSuggestion.sampleCount >= 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <p className="text-xs leading-relaxed">{socSuggestion.message}</p>
                </div>

                {/* Métricas */}
                {socSuggestion.sampleCount > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-primary">{socSuggestion.sampleCount}</div>
                      <div className="text-xs text-muted-foreground mt-1">Cargas analizadas</div>
                    </div>
                    {socSuggestion.avgErrorKwh !== null && (
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <div className={`text-2xl font-bold ${
                          Math.abs(socSuggestion.avgErrorKwh) <= 2 ? "text-green-500" : "text-amber-500"
                        }`}>
                          {socSuggestion.avgErrorKwh > 0 ? "+" : ""}{socSuggestion.avgErrorKwh} kWh
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Error promedio</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sugerencia de capacidad */}
                {socSuggestion.hasSuggestion && socSuggestion.suggestedCapacityKwh && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-primary">Capacidad sugerida</span>
                    </div>
                    <div className="text-2xl font-bold">{socSuggestion.suggestedCapacityKwh} kWh</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Actualiza la capacidad de tu vehículo para mejorar la precisión del SoC.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs"
                      onClick={() => setLocation("/settings/vehicles")}
                    >
                      <Car className="w-3 h-3 mr-1" />
                      Actualizar capacidad
                    </Button>
                  </div>
                )}

                {/* Ver historial */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setLocation("/soc-accuracy")}
                >
                  Ver historial completo de precisión
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Carga tu vehículo con SoC manual para ver estadísticas de precisión</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Secciones del menú */}
        {menuSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + sectionIndex * 0.1 }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
              {section.title}
            </h3>
            <Card className="divide-y">
              {section.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </Card>
          </motion.div>
        ))}

        {/* Botón de cerrar sesión */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </motion.div>

        {/* Versión de la app */}
        <div className="text-center text-xs text-muted-foreground">
          EVGreen v1.0.0
        </div>
      </div>
    </UserLayout>
  );
}
