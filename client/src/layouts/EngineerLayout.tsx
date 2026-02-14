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
  PanelLeft, 
  MapPin,
  Wrench,
  AlertTriangle,
  FileText,
  Settings,
  Zap,
  ClipboardList,
  Activity,
  Terminal,
  Cpu,
  Users,
  Shield
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from '@/components/DashboardLayoutSkeleton';
import { Button } from "@/components/ui/button";

const engineerMenuItems = [
  { icon: LayoutDashboard, label: "Centro de Operaciones", path: "/engineer", section: "principal" },
  { icon: ClipboardList, label: "Gestión de Tickets", path: "/engineer/tickets", section: "principal" },
  { icon: Users, label: "Equipo Técnico", path: "/engineer/technicians", section: "principal" },
  { icon: MapPin, label: "Estaciones", path: "/engineer/stations", section: "operaciones" },
  { icon: AlertTriangle, label: "Alertas", path: "/engineer/alerts", section: "operaciones" },
  { icon: Activity, label: "Diagnóstico", path: "/engineer/diagnostics", section: "operaciones" },
  { icon: Terminal, label: "Monitor OCPP", path: "/engineer/ocpp-monitor", section: "operaciones" },
  { icon: FileText, label: "Logs OCPP", path: "/engineer/ocpp-logs", section: "operaciones" },
  { icon: Wrench, label: "Mantenimiento", path: "/engineer/maintenance", section: "operaciones" },
  { icon: Cpu, label: "Firmware", path: "/engineer/firmware", section: "operaciones" },
  { icon: Settings, label: "Configuración", path: "/engineer/settings", section: "config" },
];

const SIDEBAR_WIDTH_KEY = "engineer-sidebar-width";
const DEFAULT_WIDTH = 270;
const MIN_WIDTH = 220;
const MAX_WIDTH = 400;

export default function EngineerLayout({
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
            <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">
              Portal de Ingeniería
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Centro de control del área técnica. Gestiona operaciones, tickets y equipo de trabajo.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700"
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
      <EngineerLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </EngineerLayoutContent>
    </SidebarProvider>
  );
}

type EngineerLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function EngineerLayoutContent({
  children,
  setSidebarWidth,
}: EngineerLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = engineerMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

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

  // Agrupar items por sección
  const principalItems = engineerMenuItems.filter(i => i.section === "principal");
  const operacionesItems = engineerMenuItems.filter(i => i.section === "operaciones");
  const configItems = engineerMenuItems.filter(i => i.section === "config");

  const renderMenuItems = (items: typeof engineerMenuItems) => (
    items.map(item => {
      const isActive = location === item.path;
      return (
        <SidebarMenuItem key={item.path}>
          <SidebarMenuButton
            isActive={isActive}
            onClick={() => setLocation(item.path)}
            tooltip={item.label}
            className={`h-11 transition-all font-normal rounded-xl ${
              isActive 
                ? "bg-blue-600 text-white hover:bg-blue-700" 
                : "hover:bg-muted"
            }`}
          >
            <item.icon
              className={`h-5 w-5 ${isActive ? "text-white" : "text-muted-foreground"}`}
            />
            <span className={isActive ? "font-medium" : ""}>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    })
  );

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
                className="h-10 w-10 flex items-center justify-center hover:bg-blue-500/10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-5 w-5 text-blue-500" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold tracking-tight text-lg leading-none">
                      <span className="text-blue-500">EV</span>
                      <span className="text-foreground">Green</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
                      Ingeniería
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-4">
            {/* Sección Principal */}
            <SidebarMenu className="px-2 space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1">
                  <span className="text-[10px] font-semibold text-blue-500/80 uppercase tracking-widest">
                    Control
                  </span>
                </div>
              )}
              {renderMenuItems(principalItems)}
            </SidebarMenu>

            {/* Sección Operaciones */}
            <SidebarMenu className="px-2 space-y-1 mt-4">
              {!isCollapsed && (
                <div className="px-3 py-1">
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                    Operaciones
                  </span>
                </div>
              )}
              {renderMenuItems(operacionesItems)}
            </SidebarMenu>

            {/* Sección Config */}
            <SidebarMenu className="px-2 space-y-1 mt-4">
              {renderMenuItems(configItems)}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-10 w-10 border-2 border-blue-500/20 shrink-0">
                    <AvatarFallback className="text-sm font-bold bg-blue-500/10 text-blue-500">
                      {user?.name?.charAt(0).toUpperCase() || 'I'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-semibold truncate leading-none">
                      Ing. {user?.name || "Ingeniero"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">Ing. {user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-blue-500 mt-1 font-medium">Jefe de Ingeniería</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation('/engineer/settings')}
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
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-muted/30">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-10 w-10 rounded-xl bg-background" />
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                <span className="font-bold text-blue-500">
                  {activeMenuItem?.label ?? "Ingeniería"}
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
