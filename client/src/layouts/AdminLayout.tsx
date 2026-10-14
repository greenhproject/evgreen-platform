import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { matchesNavigationQuery, type NavigationSearchTarget } from "@shared/admin-menu-search";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Users, 
  MapPin,
  Receipt,
  DollarSign,
  BarChart3,
  Settings,
  Zap,
  Image,
  Bell,
  Bot,
  Terminal,
  Wallet,
  Building2,
  Timer,
  Crown,
  Banknote,
  Headphones,
  PhoneCall,
  Calculator,
  Wrench,
  UserCheck,
  Server,
  RotateCcw,
  AlertCircle,
  FileText,
  Building,
  ParkingSquare,
  MessageCircle,
  MonitorPlay,
		Star,
		Megaphone,
		Network,
		FileSignature,
		Leaf,
		Search,
		X
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from '@/components/DashboardLayoutSkeleton';
import { Button } from "@/components/ui/button";

// Items del menú con roles permitidos
type AdminMenuItem = NavigationSearchTarget & { icon: any; roles?: string[] };

const adminMenuItems: AdminMenuItem[] = [
	{ icon: LayoutDashboard, label: "Dashboard", path: "/admin", keywords: ["inicio", "resumen"] },
	{ icon: MapPin, label: "Estaciones", path: "/admin/stations", keywords: ["cargadores", "electrolineras", "puntos de carga"] },
	{ icon: Users, label: "Usuarios", path: "/admin/users", keywords: ["clientes", "perfiles"] },
	{ icon: Receipt, label: "Transacciones", path: "/admin/transactions", keywords: ["pagos", "cargas", "sesiones"] },
	{ icon: DollarSign, label: "Tarifas", path: "/admin/tariffs", keywords: ["precios", "tarifa dinámica"] },
	{ icon: Wallet, label: "Liquidaciones", path: "/admin/payouts", keywords: ["pagos", "aliados", "payouts"] },
	{ icon: Crown, label: "Inversionistas", path: "/admin/investors", keywords: ["inversión", "capital"] },
	{ icon: UserCheck, label: "Onboarding", path: "/admin/onboarding", keywords: ["registro", "configurar experiencia"] },
	{ icon: Server, label: "Backup & Recovery", path: "/admin/backup", keywords: ["respaldo", "recuperación"] },
	{ icon: Building2, label: "Crowdfunding", path: "/admin/crowdfunding", keywords: ["financiación", "proyectos", "inversión"] },
	{ icon: Terminal, label: "Monitor OCPP", path: "/admin/ocpp-monitor", keywords: ["logs", "servidor", "cargadores"] },
	{ icon: Network, label: "OCPI / CargaME", path: "/admin/ocpi", keywords: ["interop", "roaming", "cargame"] },
	{ icon: Timer, label: "Penalizaciones", path: "/admin/overstay", keywords: ["sobreestadía", "ocupación"] },
	{ icon: ParkingSquare, label: "Ocupación Parqueadero", path: "/admin/occupancy-liquidations", keywords: ["parking", "sobreestadía", "estacionamiento"] },
	{ icon: Banknote, label: "Deudas", path: "/admin/debts", keywords: ["cartera", "cobros"] },
	{ icon: BarChart3, label: "Reportes", path: "/admin/reports", keywords: ["analítica", "indicadores"] },
	{ icon: Leaf, label: "Impacto y Bonos", path: "/admin/carbon", keywords: ["carbono", "ambiental", "sostenibilidad"], roles: ["admin", "staff"] },
	{ icon: Image, label: "Banners", path: "/admin/banners", keywords: ["anuncios", "publicidad"] },
	{ icon: Megaphone, label: "Anunciantes", path: "/admin/advertisers", keywords: ["publicidad", "campañas"], roles: ["admin"] },
	{ icon: Bell, label: "Notificaciones", path: "/admin/notifications", keywords: ["push", "avisos"] },
	{ icon: RotateCcw, label: "Reembolsos", path: "/admin/refunds", keywords: ["devoluciones"] },
	{ icon: AlertCircle, label: "Reclamos", path: "/admin/claims", keywords: ["pqrs", "quejas"] },
	{ icon: Headphones, label: "Soporte", path: "/admin/support", keywords: ["ayuda", "tickets"] },
	{ icon: PhoneCall, label: "Inicio Remoto", path: "/admin/remote-start", keywords: ["activar carga", "cargador"] },
	{ icon: FileText, label: "Cotizaciones", path: "/admin/quotes", keywords: ["propuestas", "presupuestos"], roles: ["admin", "staff", "host", "comercial"] },
	{ icon: MapPin, label: "Espacios", path: "/admin/spaces", keywords: ["postulaciones", "sitios", "aliados"], roles: ["admin", "staff", "comercial"] },
	{ icon: FileSignature, label: "Contratos", path: "/admin/contracts", keywords: ["firma", "documentos"], roles: ["admin"] },
	{ icon: Calculator, label: "Centro Financiero", path: "/admin/financial", keywords: ["finanzas", "ingresos", "costos"] },
	{ icon: Wrench, label: "Fondo Mantenimiento", path: "/admin/maintenance-fund", keywords: ["mantenimiento", "reparaciones"] },
	{ icon: Bot, label: "Asistente IA", path: "/admin/ai-settings", keywords: ["inteligencia artificial", "ebe"] },
	{ icon: Building, label: "Organizaciones SaaS", path: "/admin/organizations", keywords: ["empresas", "tenants"] },
	{ icon: MessageCircle, label: "WhatsApp", path: "/admin/whatsapp", keywords: ["mensajes", "plantillas"] },
	{ icon: Star, label: "Feedback Sesiones", path: "/admin/feedback", keywords: ["opiniones", "calificaciones"] },
	{ icon: MonitorPlay, label: "Ver en TV / NOC", path: "/admin/tv", keywords: ["noc", "pantalla", "monitor"] },
	{ icon: Settings, label: "Configuración", path: "/admin/settings", keywords: ["ajustes", "preferencias"] },
];

/** Filtra items del menú según el rol del usuario */
function getMenuItemsForRole(role: string | undefined) {
  if (!role) return [];
  // Admin y staff ven todo
  if (role === "admin" || role === "staff") return adminMenuItems;
  // Comercial accede exclusivamente a cotizaciones y al pipeline de espacios.
  if (role === "comercial") return adminMenuItems.filter(item => item.roles?.includes("comercial"));
  // Host ve todo (es admin de estación)
  if (role === "host") return adminMenuItems;
  // Otros roles: filtrar por roles si está definido, si no mostrar
  return adminMenuItems.filter(item => !item.roles || item.roles.includes(role));
}

const SIDEBAR_WIDTH_KEY = "admin-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">
              <span className="text-primary">EV</span>
              <span className="text-foreground">Green</span>
              <span className="text-muted-foreground ml-2 text-lg">Admin</span>
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Panel de administración de la plataforma EVGreen. Inicia sesión para continuar.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-primary"
          >
            Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <AdminLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </AdminLayoutContent>
    </SidebarProvider>
  );
}

type AdminLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function AdminLayoutContent({
  children,
  setSidebarWidth,
}: AdminLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, openMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuItems = getMenuItemsForRole(user?.role);
  const filteredMenuItems = useMemo(
    () => menuItems.filter((item) => matchesNavigationQuery(item, menuSearch)),
    [menuItems, menuSearch],
  );
  const activeMenuItem = menuItems.find(item => item.path === location) || adminMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  const focusMenuSearch = () => {
    if (isMobile && !openMobile) {
      setOpenMobile(true);
      window.setTimeout(() => searchInputRef.current?.focus(), 180);
      return;
    }
    if (isCollapsed) {
      toggleSidebar();
      window.setTimeout(() => searchInputRef.current?.focus(), 180);
      return;
    }
    searchInputRef.current?.focus();
  };

  const openMenuItem = (path: string) => {
    setLocation(path);
    setMenuSearch("");
    if (isMobile) setOpenMobile(false);
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
      setMenuSearch("");
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleNavigationSearchShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusMenuSearch();
        return;
      }
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        focusMenuSearch();
      }
    };

    window.addEventListener("keydown", handleNavigationSearchShortcut);
    return () => window.removeEventListener("keydown", handleNavigationSearchShortcut);
  }, [isCollapsed, isMobile, openMobile, setOpenMobile, toggleSidebar]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-border/50"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border/50">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-10 w-10 flex items-center justify-center hover:bg-primary/10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-5 w-5 text-primary" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold tracking-tight text-lg leading-none">
                      <span className="text-primary">EV</span>
                      <span className="text-foreground">Green</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
                      Admin Panel
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-4">
            {isCollapsed ? (
              <SidebarMenu className="px-2 pb-3">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={focusMenuSearch}
                    tooltip="Buscar módulo"
                    className="h-11 rounded-xl hover:bg-primary/10"
                    aria-label="Buscar módulo"
                  >
                    <Search className="h-5 w-5 text-primary" />
                    <span>Buscar módulo</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <div className="px-3 pb-3">
                <label htmlFor="admin-navigation-search" className="sr-only">
                  Buscar módulo del panel administrativo
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    id="admin-navigation-search"
                    value={menuSearch}
                    onChange={(event) => setMenuSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setMenuSearch("");
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="Buscar módulo..."
                    className="h-10 rounded-xl border-border/70 bg-muted/45 pl-9 pr-16 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:bg-background"
                    aria-describedby="admin-navigation-search-help"
                  />
                  {menuSearch ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuSearch("");
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Limpiar búsqueda de módulos"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
                      Ctrl K
                    </kbd>
                  )}
                </div>
                <p id="admin-navigation-search-help" className="mt-1.5 px-1 text-[10px] text-muted-foreground" aria-live="polite">
                  {menuSearch ? `${filteredMenuItems.length} de ${menuItems.length} módulos` : `Busca entre ${menuItems.length} módulos · / o Ctrl K`}
                </p>
              </div>
            )}

            <SidebarMenu className="px-2 space-y-1">
              {filteredMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => openMenuItem(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all font-normal rounded-xl ${
                        isActive 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "hover:bg-muted"
                      }`}
                    >
                      <item.icon
                        className={`h-5 w-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}
                      />
                      <span className={isActive ? "font-medium" : ""}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {!isCollapsed && filteredMenuItems.length === 0 ? (
                <li className="mx-1 rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground" role="status">
                  No se encontró un módulo para <span className="font-medium text-foreground">“{menuSearch}”</span>.
                </li>
              ) : null}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-10 w-10 border-2 border-primary/20 shrink-0">
                    <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-semibold truncate leading-none">
                      {user?.name || "Administrador"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation('/admin/settings')}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-muted/30">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 safe-area-inset-top">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-10 w-10 rounded-xl bg-background" />
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="font-bold text-primary">
                  {activeMenuItem?.label ?? "Admin"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
