import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { Onboarding, useOnboarding } from "@/components/Onboarding";

// Páginas públicas
import Landing from "./pages/Landing";
import Investors from "./pages/Investors";

// Páginas de usuario
import UserMap from "./pages/user/Map";
import UserWallet from "./pages/user/Wallet";
import UserHistory from "./pages/user/History";
import UserProfile from "./pages/user/Profile";
import UserReservations from "./pages/user/Reservations";
import UserSupport from "./pages/user/Support";
import StationDetail from "./pages/user/StationDetail";
import ChargingSession from "./pages/user/ChargingSession";
import AIAssistant from "./pages/user/AIAssistant";
import ScanPage from "./pages/user/Scan";
import StartCharge from "./pages/user/StartCharge";
import QRRedirect from "./pages/QRRedirect";
import ChargingMonitor from "./pages/user/ChargingMonitor";
import ChargingSummary from "./pages/user/ChargingSummary";
import ChargingWaiting from "./pages/user/ChargingWaiting";
import UserSettingsNotifications from "./pages/user/settings/Notifications";
import UserSettingsPersonalInfo from "./pages/user/settings/PersonalInfo";
import UserSettingsVehicles from "./pages/user/settings/Vehicles";
import UserSettingsPaymentMethods from "./pages/user/settings/PaymentMethods";
import UserSettingsConfig from "./pages/user/settings/Config";

// Páginas de inversionista
import InvestorDashboard from "./pages/investor/Dashboard";
import InvestorStations from "./pages/investor/Stations";
import InvestorTransactions from "./pages/investor/Transactions";
import InvestorReports from "./pages/investor/Reports";
import InvestorSettings from "./pages/investor/Settings";
import InvestorEarnings from "./pages/investor/Earnings";
import InvestorSettlements from "./pages/investor/Settlements";

// Páginas de técnico
import TechnicianDashboard from "./pages/technician/Dashboard";
import TechnicianTickets from "./pages/technician/Tickets";
import TechnicianStations from "./pages/technician/Stations";
import TechnicianLogs from "./pages/technician/Logs";
import TechnicianAlerts from "./pages/technician/Alerts";
import TechnicianDiagnostics from "./pages/technician/Diagnostics";
import TechnicianOCPPLogs from "./pages/technician/OCPPLogs";
import TechnicianOCPPMonitor from "./pages/technician/OCPPMonitor";
import TechnicianMaintenance from "./pages/technician/Maintenance";
import TechnicianSettings from "./pages/technician/Settings";

// Páginas de administración
import AdminDashboard from "./pages/admin/Dashboard";
import AdminStations from "./pages/admin/Stations";
import AdminUsers from "./pages/admin/Users";
import AdminTransactions from "./pages/admin/Transactions";
import AdminTariffs from "./pages/admin/Tariffs";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminBanners from "./pages/admin/Banners";
import AdminNotifications from "./pages/admin/Notifications";
import AdminAISettings from "./pages/admin/AISettings";
import AdminOCPPMonitor from "./pages/AdminOCPPMonitor";
import { AIChatWidget } from "./components/AIChat";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import InvestorLayout from "./layouts/InvestorLayout";
import TechnicianLayout from "./layouts/TechnicianLayout";

// Función para obtener la ruta de inicio según el rol
function getHomeRouteByRole(role: string | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "investor":
      return "/investor";
    case "technician":
      return "/technician";
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
  const { loading } = useAuth();

  // Mientras carga, mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Cargando EVGreen...</p>
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
      <Route path="/investors" component={Investors} />
      
      {/* Ruta para códigos QR - Redirige a StartCharge */}
      <Route path="/c/:code" component={QRRedirect} />

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
      <Route path="/assistant" component={AIAssistant} />
      <Route path="/settings/notifications" component={UserSettingsNotifications} />
      <Route path="/settings/personal" component={UserSettingsPersonalInfo} />
      <Route path="/settings/vehicles" component={UserSettingsVehicles} />
      <Route path="/scan" component={ScanPage} />
      <Route path="/start-charge" component={StartCharge} />
      <Route path="/charging-waiting" component={ChargingWaiting} />
      <Route path="/charging-monitor" component={ChargingMonitor} />
      <Route path="/charging-summary/:transactionId" component={ChargingSummary} />
      <Route path="/vehicles" component={UserSettingsVehicles} />
      <Route path="/settings/payment" component={UserSettingsPaymentMethods} />
      <Route path="/settings/config" component={UserSettingsConfig} />

      {/* ============================================
          RUTAS DE INVERSIONISTA (con layout)
          ============================================ */}
      <Route path="/investor">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorLayout>
            <InvestorDashboard />
          </InvestorLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/investor/stations">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorLayout>
            <InvestorStations />
          </InvestorLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/investor/transactions">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorLayout>
            <InvestorTransactions />
          </InvestorLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/investor/reports">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorLayout>
            <InvestorReports />
          </InvestorLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/investor/settings">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorLayout>
            <InvestorSettings />
          </InvestorLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/investor/earnings">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorLayout>
            <InvestorEarnings />
          </InvestorLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/investor/settlements">
        <ProtectedRoute allowedRoles={["investor", "admin"]}>
          <InvestorLayout>
            <InvestorSettlements />
          </InvestorLayout>
        </ProtectedRoute>
      </Route>

      {/* ============================================
          RUTAS DE TÉCNICO (con layout)
          ============================================ */}
      <Route path="/technician">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianDashboard />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/tickets">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianTickets />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/stations">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianStations />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/logs">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianLogs />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/alerts">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianAlerts />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/diagnostics">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianDiagnostics />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/ocpp-logs">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianOCPPLogs />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/ocpp-monitor">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianOCPPMonitor />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/maintenance">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianMaintenance />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/technician/settings">
        <ProtectedRoute allowedRoles={["technician", "admin"]}>
          <TechnicianLayout>
            <TechnicianSettings />
          </TechnicianLayout>
        </ProtectedRoute>
      </Route>

      {/* ============================================
          RUTAS DE ADMINISTRACIÓN (con layout)
          ============================================ */}
      <Route path="/admin">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/stations">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminStations />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/transactions">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminTransactions />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/tariffs">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminTariffs />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reports">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminReports />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ai-settings">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminAISettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/banners">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminBanners />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/notifications">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminNotifications />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/ocpp-monitor">
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout>
            <AdminOCPPMonitor />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { showOnboarding, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Mostrar onboarding solo para usuarios autenticados que no lo han completado
  const shouldShowOnboarding = !onboardingLoading && !authLoading && isAuthenticated && showOnboarding;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          {shouldShowOnboarding ? (
            <Onboarding onComplete={completeOnboarding} />
          ) : (
            <>
              <Router />
              <AIChatWidget />
            </>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
