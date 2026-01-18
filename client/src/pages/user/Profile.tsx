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
  Settings
} from "lucide-react";

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

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
      title: "Soporte",
      items: [
        { icon: HelpCircle, label: "Centro de ayuda", path: "/support" },
        { icon: FileText, label: "Términos y condiciones", path: "/support" },
        { icon: Shield, label: "Política de privacidad", path: "/support" },
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
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border-4 border-primary/20">
                <AvatarImage src={user?.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{user?.name || "Usuario"}</h2>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
                <Badge className="mt-2 bg-primary/10 text-primary">
                  <Crown className="w-3 h-3 mr-1" />
                  Plan Gratuito
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setLocation("/subscription")}
            >
              <Crown className="w-4 h-4 mr-2 text-yellow-500" />
              Actualizar a Premium
            </Button>
          </Card>
        </motion.div>

        {/* Secciones del menú */}
        {menuSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 }}
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
          transition={{ delay: 0.3 }}
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
          Green EV v1.0.0
        </div>
      </div>
    </UserLayout>
  );
}
