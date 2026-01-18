import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Wallet,
  History,
  User,
  QrCode,
  Menu,
  X,
  Zap,
  Calendar,
  MessageCircle,
  Settings,
  LogOut,
  ChevronRight,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { getLoginUrl } from "@/const";

interface UserLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
  showHeader?: boolean;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
}

export default function UserLayout({
  children,
  showBottomNav = true,
  showHeader = true,
  title,
  showBack = false,
  onBack,
  rightAction
}: UserLayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { icon: MapPin, label: "Mapa", path: "/map" },
    { icon: Wallet, label: "Billetera", path: "/wallet" },
    { icon: QrCode, label: "Escanear", path: "/scan", isCenter: true },
    { icon: History, label: "Historial", path: "/history" },
    { icon: User, label: "Perfil", path: "/profile" },
  ];

  const menuItems = [
    { icon: User, label: "Mi cuenta", path: "/profile" },
    { icon: Wallet, label: "Billetera", path: "/wallet" },
    { icon: History, label: "Historial de carga", path: "/history" },
    { icon: Calendar, label: "Reservaciones", path: "/reservations" },
    { icon: Zap, label: "Suscripción VIP", path: "/subscription" },
    { icon: MessageCircle, label: "Soporte", path: "/support" },
    { icon: Settings, label: "Ajustes", path: "/settings" },
  ];

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      {showHeader && (
        <header className="sticky top-0 z-50 glass border-b border-border/50 safe-area-inset-top">
          <div className="flex items-center justify-between h-14 px-4">
            {showBack ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack || (() => window.history.back())}
                className="rounded-full"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
            ) : (
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0 bg-sidebar text-sidebar-foreground">
                  {/* Drawer Header */}
                  <div className="p-6 border-b border-sidebar-border">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16 border-2 border-sidebar-primary">
                        <AvatarImage src={user?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xl">
                          {user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">{user?.name || "Usuario"}</h3>
                        <p className="text-sm text-sidebar-foreground/70">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Menu */}
                  <nav className="p-4 space-y-1">
                    {menuItems.map((item) => (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setDrawerOpen(false)}
                      >
                        <a className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${
                          location === item.path
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/50"
                        }`}>
                          <item.icon className="w-5 h-5 text-sidebar-primary" />
                          <span>{item.label}</span>
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        </a>
                      </Link>
                    ))}
                  </nav>

                  {/* Drawer Footer */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-5 h-5" />
                      Cerrar sesión
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}

            {title ? (
              <h1 className="font-semibold text-lg">{title}</h1>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-semibold">Green EV</span>
              </div>
            )}

            {rightAction || (
              <Button variant="ghost" size="icon" className="rounded-full relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              </Button>
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && (
        <nav className="sticky bottom-0 z-50 glass border-t border-border/50 safe-area-inset-bottom">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const isActive = location === item.path;
              
              if (item.isCenter) {
                return (
                  <Link key={item.path} href={item.path}>
                    <a className="relative -mt-6">
                      <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-glow">
                        <item.icon className="w-6 h-6 text-white" />
                      </div>
                    </a>
                  </Link>
                );
              }

              return (
                <Link key={item.path} href={item.path}>
                  <a className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}>
                    <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                    <span className="text-xs font-medium">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-1 w-1 h-1 bg-primary rounded-full"
                      />
                    )}
                  </a>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
