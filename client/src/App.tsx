import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";

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
      {/* Página de inicio - Landing para no autenticados, redirección para autenticados */}
      <Route path="/">
        {isAuthenticated ? <UserMap /> : <Landing />}
      </Route>

      {/* Rutas públicas */}
      <Route path="/landing" component={Landing} />

      {/* ============================================
          RUTAS DE USUARIO (App móvil principal)
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
        <InvestorDashboard />
      </Route>
      <Route path="/investor/dashboard" component={InvestorDashboard} />
      <Route path="/investor/stations" component={InvestorStations} />
      <Route path="/investor/transactions" component={InvestorTransactions} />
      <Route path="/investor/reports" component={InvestorReports} />
      <Route path="/investor/settings" component={InvestorSettings} />

      {/* ============================================
          RUTAS DE TÉCNICO
          ============================================ */}
      <Route path="/technician">
        <TechnicianDashboard />
      </Route>
      <Route path="/technician/dashboard" component={TechnicianDashboard} />
      <Route path="/technician/tickets" component={TechnicianTickets} />
      <Route path="/technician/stations" component={TechnicianStations} />
      <Route path="/technician/logs" component={TechnicianLogs} />

      {/* ============================================
          RUTAS DE ADMINISTRACIÓN
          ============================================ */}
      <Route path="/admin">
        <AdminDashboard />
      </Route>
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/stations" component={AdminStations} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/transactions" component={AdminTransactions} />
      <Route path="/admin/tariffs" component={AdminTariffs} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/admin/settings" component={AdminSettings} />

      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
