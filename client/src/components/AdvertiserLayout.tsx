import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Megaphone,
  User,
  LogOut,
  Zap,
  PlusCircle,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  {
    href: "/advertiser/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/advertiser/campaigns",
    label: "Campañas",
    icon: Megaphone,
  },
  {
    href: "/advertiser/campaigns/new",
    label: "Nueva",
    icon: PlusCircle,
  },
  {
    href: "/advertiser/profile",
    label: "Empresa",
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
  return <Badge variant={info.variant} className="text-xs">{info.label}</Badge>;
}

interface AdvertiserLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdvertiserLayout({ children, title }: AdvertiserLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const { data: profile } = trpc.advertiser.getProfile.useQuery(undefined, {
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col md:flex-row">

      {/* ── DESKTOP SIDEBAR (md+) ── */}
      <aside className="hidden md:flex w-64 bg-[#0d1526] border-r border-white/5 flex-col fixed h-full z-20">
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
            <p className="text-white/60 text-xs mb-1 truncate">{profile.companyName}</p>
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

      {/* ── MOBILE HEADER (< md) ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#0d1526] border-b border-white/5 flex items-center justify-between px-4 h-14">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">EVGreen Ads</p>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {profile && <StatusBadge status={profile.status} />}
          <button
            className="p-2 text-white/60 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── MOBILE DRAWER (slide-down menu) ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/60"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute top-14 left-0 right-0 bg-[#0d1526] border-b border-white/5 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info */}
            <div className="flex items-center gap-3 px-2 py-3 mb-3 border-b border-white/5">
              <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-green-400 text-sm font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name ?? "Anunciante"}</p>
                <p className="text-white/40 text-xs truncate">{user?.email ?? ""}</p>
              </div>
            </div>

            {/* Nav items */}
            <nav className="space-y-1 mb-3">
              {navItems.map((item) => {
                const active = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all",
                        active
                          ? "bg-green-500/15 text-green-400 border border-green-500/20"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                      {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </div>
                  </Link>
                );
              })}
            </nav>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-white/40 hover:text-white/70 hover:bg-white/5"
              onClick={() => { logoutMutation.mutate(); setMobileMenuOpen(false); }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Top bar (mobile padding + desktop title) */}
        <div className={cn(
          "md:hidden h-14 flex-shrink-0" // spacer for fixed mobile header
        )} />

        {title && (
          <div className="px-4 md:px-8 py-4 md:py-6 border-b border-white/5 bg-[#0d1526]">
            <h1 className="text-lg md:text-xl font-bold text-white">{title}</h1>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0d1526] border-t border-white/5 flex items-center justify-around px-2 h-16 safe-area-inset-bottom">
        {navItems.map((item) => {
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]",
                  active
                    ? "text-green-400"
                    : "text-white/40"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                  active ? "bg-green-500/20" : ""
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
