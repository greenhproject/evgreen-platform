/**
 * Layout para el Portal de Organización SaaS
 * Para clientes que tienen su propia red de cargadores bajo licencia EVGreen
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
  Building2,
  TicketCheck,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Button } from "@/components/ui/button";

const orgMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/org" },
  { icon: MapPin, label: "Mis Estaciones", path: "/org/stations" },
  { icon: TicketCheck, label: "Soporte / Tickets", path: "/org/support" },
  { icon: Settings, label: "Configuración", path: "/org/settings" },
];

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

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <SidebarProvider>
      <OrgSidebar
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        user={user}
        logout={logout}
      />
      <SidebarInset className="bg-muted/30">
        <OrgMobileHeader />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function OrgMobileHeader() {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const activeMenuItem = orgMenuItems.find((item) => item.path === location);

  if (!isMobile) return null;

  return (
    <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="h-10 w-10 rounded-xl bg-background" />
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-500" />
          <span className="font-bold text-green-500">
            {activeMenuItem?.label ?? "Portal Org"}
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
}: {
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  user: any;
  logout: () => void;
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
        <SidebarHeader className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="h-9 w-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-green-500" />
            </div>
            {!isCollapsed ? (
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-sm leading-none">
                  <span className="text-green-500">EV</span>
                  <span className="text-foreground">Green</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
                  Portal Organización
                </span>
              </div>
            ) : null}
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 py-4">
          <SidebarMenu className="px-2 space-y-1">
            {orgMenuItems.map((item) => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className={`h-11 transition-all font-normal rounded-xl ${
                      isActive
                        ? "bg-green-500 text-white hover:bg-green-600"
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
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-10 w-10 border-2 border-green-500/20 shrink-0">
                  <AvatarFallback className="text-sm font-bold bg-green-500/10 text-green-500">
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
              <DropdownMenuItem
                onClick={() => setLocation("/org/settings")}
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
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-green-500/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
        onMouseDown={() => {
          if (isCollapsed) return;
          setIsResizing(true);
        }}
        style={{ zIndex: 50 }}
      />
    </div>
  );
}
