/**
 * Layout para el Portal de Organización SaaS
 * Sidebar dinámico basado en módulos activados por superadmin.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  LayoutDashboard,
  LogOut,
  Settings,
  Zap,
  TicketCheck,
  MapPin,
  CreditCard,
  BarChart2,
  BrainCircuit,
  Users,
  FileText,
  DollarSign,
  Webhook,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { trpc } from "@/lib/trpc";

// Definición completa de todos los módulos disponibles
const ALL_ORG_MENU_ITEMS = [
  { key: 'dashboard',       icon: LayoutDashboard, label: "Dashboard",              path: "/org" },
  { key: 'stations',        icon: MapPin,           label: "Mis Estaciones",         path: "/org/stations" },
  { key: 'transactions',    icon: CreditCard,       label: "Transacciones",          path: "/org/transactions" },
  { key: 'analytics',       icon: BarChart2,        label: "Analítica",              path: "/org/analytics" },
  { key: 'dynamic_pricing', icon: BrainCircuit,     label: "Precios Dinámicos IA",   path: "/org/dynamic-pricing" },
  { key: 'reports',         icon: FileText,         label: "Reportes",               path: "/org/reports" },
  { key: 'users',           icon: Users,            label: "Usuarios",               path: "/org/users" },
  { key: 'billing',         icon: DollarSign,       label: "Facturación",            path: "/org/billing" },
  { key: 'api_webhooks',    icon: Webhook,          label: "API & Webhooks",         path: "/org/api" },
  { key: 'tickets',         icon: TicketCheck,      label: "Soporte / Tickets",      path: "/org/support" },
  { key: 'settings',        icon: Settings,         label: "Configuración",          path: "/org/settings" },
];

const DEFAULT_MODULES = ['dashboard', 'stations', 'tickets', 'settings'];

const SIDEBAR_WIDTH_KEY = "org-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user, logout } = useAuth();
  const { data: org } = (trpc.organizations as any).getMyOrg.useQuery(undefined, {
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const { data: modulesData } = (trpc.organizations as any).getMyModules.useQuery(undefined, {
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  const primaryColor = org?.primaryColor || "#22c55e";
  const secondaryColor = org?.secondaryColor || "#1e40af";
  const logoUrl = org?.logoUrl || null;
  const appName = org?.appName || org?.name || "EVGreen";
  const activeModules: string[] = modulesData?.modules || DEFAULT_MODULES;

  // Filter menu items based on active modules
  const menuItems = ALL_ORG_MENU_ITEMS.filter(item => activeModules.includes(item.key));

  return (
    <SidebarProvider>
      <OrgSidebar
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        user={user}
        logout={logout}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        logoUrl={logoUrl}
        appName={appName}
        menuItems={menuItems}
      />
      <SidebarInset className="bg-muted/30">
        <OrgMobileHeader primaryColor={primaryColor} logoUrl={logoUrl} appName={appName} menuItems={menuItems} />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function OrgMobileHeader({
  primaryColor,
  logoUrl,
  appName,
  menuItems,
}: {
  primaryColor: string;
  logoUrl: string | null;
  appName: string;
  menuItems: typeof ALL_ORG_MENU_ITEMS;
}) {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const activeMenuItem = menuItems.find((item) => item.path === location);

  if (!isMobile) return null;

  return (
    <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="h-10 w-10 rounded-xl bg-background" />
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-7 w-7 object-contain rounded" />
          ) : (
            <Zap className="h-5 w-5" style={{ color: primaryColor }} />
          )}
          <span className="font-bold text-sm" style={{ color: primaryColor }}>
            {activeMenuItem?.label ?? appName}
          </span>
        </div>
      </div>
    </div>
  );
}

function OrgSidebar({
  sidebarWidth,
  setSidebarWidth,
  user,
  logout,
  primaryColor,
  secondaryColor,
  logoUrl,
  appName,
  menuItems,
}: {
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  user: any;
  logout: () => void;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  appName: string;
  menuItems: typeof ALL_ORG_MENU_ITEMS;
}) {
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="relative" style={{ width: isCollapsed || isMobile ? undefined : sidebarWidth }}>
      <Sidebar
        collapsible="icon"
        style={
          !isCollapsed && !isMobile
            ? ({ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties)
            : undefined
        }
        className="border-r border-border/50 bg-background"
      >
        {/* Header con branding dinámico */}
        <SidebarHeader
          className="p-4 border-b border-border/50"
          style={{ backgroundColor: secondaryColor + "22" }}
        >
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ backgroundColor: primaryColor + "20" }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={appName} className="w-8 h-8 object-contain" />
              ) : (
                <Zap className="h-5 w-5" style={{ color: primaryColor }} />
              )}
            </div>
            {!isCollapsed ? (
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-sm leading-none" style={{ color: primaryColor }}>
                  {appName}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase mt-0.5">
                  Portal Organización
                </span>
              </div>
            ) : null}
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 py-4">
          <SidebarMenu className="px-2 space-y-1">
            {menuItems.map((item) => {
              const isActive = location === item.path || (item.path !== "/org" && location.startsWith(item.path));
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className={`h-11 transition-all font-normal rounded-xl ${
                      isActive ? "text-white" : "hover:bg-muted"
                    }`}
                    style={isActive ? { backgroundColor: primaryColor } : undefined}
                  >
                    <item.icon
                      className={`h-5 w-5 ${isActive ? "text-white" : "text-muted-foreground"}`}
                    />
                    <span className={isActive ? "font-medium" : ""}>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar
                  className="h-10 w-10 shrink-0"
                  style={{ borderColor: primaryColor + "40", borderWidth: 2, borderStyle: "solid" }}
                >
                  <AvatarFallback
                    className="text-sm font-bold"
                    style={{ backgroundColor: primaryColor + "20", color: primaryColor }}
                  >
                    {user?.name?.charAt(0).toUpperCase() || "O"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-semibold truncate leading-none">
                    {user?.name || "Organización"}
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
              <DropdownMenuItem onClick={() => setLocation("/org/settings")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${isCollapsed ? "hidden" : ""}`}
        style={{ zIndex: 50 }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = primaryColor + "50")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        onMouseDown={() => {
          if (isCollapsed) return;
          setIsResizing(true);
        }}
      />
    </div>
  );
}
