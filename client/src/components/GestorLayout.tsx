/**
 * Layout del Portal del Gestor Comercial
 * Sidebar con navegación: Dashboard, Mis Espacios, Mis Estaciones, Liquidación
 */
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  FileText,
  DollarSign,
  MapPin,
  LogOut,
  Menu,
  Zap,
  X,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/gestor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/gestor/cartera", label: "Mi cartera", icon: BriefcaseBusiness },
  { href: "/admin/spaces", label: "Pipeline de espacios", icon: MapPin },
  { href: "/gestor/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/gestor/liquidacion", label: "Liquidación", icon: DollarSign },
];

export function GestorLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return location === href;
    return location.startsWith(href);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">EVGreen</p>
            <p className="text-xs text-slate-400">Portal Comercial</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link key={item.href} href={item.href}>
              <a
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-green-600/20 text-green-400 border border-green-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {active && <ChevronRight className="h-3 w-3 ml-auto" />}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase() ?? "G"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-slate-900 border-r border-slate-700 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-slate-900 border-r border-slate-700">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-slate-400">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-400" />
            <span className="font-bold text-white text-sm">Portal Comercial</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
