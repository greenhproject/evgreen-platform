import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Megaphone,
  User,
  LogOut,
  ChevronRight,
  Zap,
  BarChart2,
  PlusCircle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/advertiser/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/advertiser/campaigns",
    label: "Mis Campañas",
    icon: Megaphone,
  },
  {
    href: "/advertiser/campaigns/new",
    label: "Nueva Campaña",
    icon: PlusCircle,
  },
  {
    href: "/advertiser/profile",
    label: "Mi Empresa",
    icon: User,
  },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pendiente", variant: "secondary" },
    approved: { label: "Aprobado", variant: "default" },
    rejected: { label: "Rechazado", variant: "destructive" },
    suspended: { label: "Suspendido", variant: "outline" },
  };
  const info = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

interface AdvertiserLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdvertiserLayout({ children, title }: AdvertiserLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const { data: profile } = trpc.advertiser.getProfile.useQuery(undefined, {
    retry: false,
  });

  return (
    <div className="min-h-screen flex bg-[#0a0f1a]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0d1526] border-r border-white/5 flex flex-col fixed h-full z-20">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">EVGreen Ads</p>
                <p className="text-white/40 text-xs">Portal de Anunciantes</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Estado del perfil */}
        {profile && (
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-white/60 text-xs mb-1">{profile.companyName}</p>
            <StatusBadge status={profile.status} />
          </div>
        )}

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                    active
                      ? "bg-green-500/15 text-green-400 border border-green-500/20"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Usuario */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-green-400 text-xs font-bold">
                {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.name ?? "Anunciante"}</p>
              <p className="text-white/40 text-xs truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/40 hover:text-white/70 hover:bg-white/5 text-xs"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="w-3 h-3 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        {title && (
          <div className="px-8 py-6 border-b border-white/5 bg-[#0d1526]">
            <h1 className="text-xl font-bold text-white">{title}</h1>
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
