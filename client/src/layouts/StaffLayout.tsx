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
  ScanLine, 
  LogOut, 
  PanelLeft, 
  Users,
  CreditCard,
  BarChart3,
  Mail,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from '@/components/DashboardLayoutSkeleton';
import { Button } from "@/components/ui/button";

const staffMenuItems = [
  { icon: ScanLine, label: "Check-in QR", path: "/staff/event" },
  { icon: Users, label: "Invitados", path: "/staff/guests" },
  { icon: CreditCard, label: "Pagos", path: "/staff/payments" },
  { icon: Mail, label: "Invitaciones", path: "/staff/invitations" },
  { icon: BarChart3, label: "Estadísticas", path: "/staff/stats" },
];

const SIDEBAR_WIDTH_KEY = "staff-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function StaffLayout({
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
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--sidebar-width-mobile": "280px",
        } as CSSProperties
      }
    >
      <StaffSidebar
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
      />
      <SidebarInset className="flex flex-col min-h-screen bg-background">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 px-4">
          <SidebarTrigger className="-ml-1">
            <PanelLeft className="h-5 w-5" />
          </SidebarTrigger>
          <div className="flex items-center gap-2 ml-2">
            <Zap className="h-5 w-5 text-green-500" />
            <span className="font-semibold text-sm text-foreground">
              EVGreen Staff - Gestión de Evento
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function StaffSidebar({
  sidebarWidth,
  setSidebarWidth,
}: {
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
}) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { open } = useSidebar();
  const isMobile = useIsMobile();
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setSidebarWidth]);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/trpc/auth.logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="h-5 w-5 text-green-500" />
          </div>
          {open && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-foreground truncate">
                EVGreen
              </span>
              <span className="text-xs text-green-500 truncate">
                Staff Panel
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {staffMenuItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                onClick={() => setLocation(item.path)}
                isActive={location === item.path}
                tooltip={item.label}
                className="gap-3"
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-2 h-auto py-2"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-green-500/20 text-green-500 text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || "S"}
                </AvatarFallback>
              </Avatar>
              {open && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {user?.name || "Staff"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {user?.email || "staff@evgreen.lat"}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              Rol: Staff de Evento
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      {/* Resize handle */}
      {!isMobile && open && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-green-500/30 transition-colors z-50"
        />
      )}
    </Sidebar>
  );
}
