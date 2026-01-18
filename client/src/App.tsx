import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

// Páginas públicas
import Home from "./pages/Home";
import Landing from "./pages/Landing";

// Páginas de usuario
import UserMap from "./pages/user/Map";
import UserWallet from "./pages/user/Wallet";
import UserHistory from "./pages/user/History";
import UserProfile from "./pages/user/Profile";
import UserReservations from "./pages/user/Reservations";
import UserSupport from "./pages/user/Support";
import StationDetail from "./pages/user/StationDetail";
import ChargingSession from "./pages/user/ChargingSession";

// Páginas de inversionista
import InvestorDashboard from "./pages/investor/Dashboard";
import InvestorStations from "./pages/investor/Stations";
import InvestorTransactions from "./pages/investor/Transactions";
import InvestorReports from "./pages/investor/Reports";
import InvestorSettings from "./pages/investor/Settings";

// Páginas de técnico
import TechnicianDashboard from "./pages/technician/Dashboard";
import TechnicianTickets from "./pages/technician/Tickets";
import TechnicianStations from "./pages/technician/Stations";
import TechnicianLogs from "./pages/technician/Logs";

// Páginas de administración
import AdminDashboard from "./pages/admin/Dashboard";
import AdminStations from "./pages/admin/Stations";
import AdminUsers from "./pages/admin/Users";
import AdminTransactions from "./pages/admin/Transactions";
import AdminTariffs from "./pages/admin/Tariffs";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";

// Layouts
import UserLayout from "./layouts/UserLayout";
import DashboardLayout from "./components/DashboardLayout";

// Función para obtener la ruta de inicio según el rol
function getHomeRouteByRole(role: string | undefined): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "investor":
      return "/investor/dashboard";
    case "technician":
      return "/technician/dashboard";
    case "user":
    default:
      return "/map";
  }
}

// Componente para redirigir según el rol
function RoleBasedRedirect() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      const targetRoute = getHomeRouteByRole(user.role);
      setLocation(targetRoute);
    }
  }, [isAuthenticated, user, setLocation]);

  if (!isAuthenticated) {
    return <Landing />;
  }

  // Mostrar loading mientras redirige
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Redirigiendo...</p>
      </div>
    </div>
  );
}

// Componente de protección de rutas por rol
function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  allowedRoles: string[];
}) {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  if (!allowedRoles.includes(user?.role || "user")) {
    // Redirigir a la página correcta según su rol
    const targetRoute = getHomeRouteByRole(user?.role);
    setLocation(targetRoute);
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { user, loading, isAuthenticated } = useAuth();

  // Mientras carga, mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Cargando Green EV...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Página de inicio - Redirige según rol */}
      <Route path="/">
        <RoleBasedRedirect />
      </Route>

      {/* Rutas públicas */}
      <Route path="/landing" component={Landing} />

      {/* ============================================
          RUTAS DE USUARIO (App móvil principal)
          Accesible para todos los roles autenticados
          ============================================ */}
      <Route path="/map" component={UserMap} />
      <Route path="/station/:id" component={StationDetail} />
      <Route path="/charging/:id" component={ChargingSession} />
      <Route path="/wallet" component={UserWallet} />
      <Route path="/history" component={UserHistory} />
      <Route path="/reservations" component={UserReservations} />
      <Route path="/profile" component={UserProfile} />
      <Route path="/support" component={UserSupport} />

      {/* ============================================
          RUTAS DE INVERSIONISTA
          ============================================ */}
      <Route path="/investor">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/investor/dashboard">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/investor/stations">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorStations />
        </ProtectedRoute>
      </Route>
      <Route path="/investor/transactions">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorTransactions />
        </ProtectedRoute>
      </Route>
      <Route path="/investor/reports">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorReports />
        </ProtectedRoute>
      </Route>
      <Route path="/investor/settings">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorSettings />
        </ProtectedRoute>
      </Route>

      {/* ============================================
          RUTAS DE TÉCNICO
          ============================================ */}
      <Route path="/technician">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/technician/dashboard">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/technician/tickets">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianTickets />
        </ProtectedRoute>
      </Route>
      <Route path="/technician/stations">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianStations />
        </ProtectedRoute>
      </Route>
      <Route path="/technician/logs">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLogs />
        </ProtectedRoute>
      </Route>

      {/* ============================================
          RUTAS DE ADMINISTRACIÓN
          ============================================ */}
      <Route path="/admin">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/stations">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminStations />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminUsers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/transactions">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminTransactions />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/tariffs">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminTariffs />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reports">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminReports />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminSettings />
        </ProtectedRoute>
      </Route>

      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
