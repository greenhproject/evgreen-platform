/**
 * EVGreen Platform - Componente Raíz (App.tsx)
 * Enrutamiento por rol, lazy loading de 55+ componentes, tema oscuro/claro
 * Rutas: /admin/*, /technician/*, /investor/*, /user/*, / (landing)
 * @author Green House Project
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { lazy, Suspense, useEffect, useState } from "react";
import { Onboarding, useOnboarding } from "@/components/Onboarding";
import { LoadingGuard } from "@/components/LoadingGuard";

// Páginas públicas (carga inmediata - landing)
import Landing from "./pages/Landing";

// Lazy loading spinner
function LazySpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

// ============================================
// LAZY IMPORTS - Solo se cargan cuando se necesitan
// ============================================

// Páginas públicas secundarias
const Investors = lazy(() => import("./pages/Investors"));
const ThankYouInvestors = lazy(() => import("./pages/ThankYouInvestors"));

// Páginas de usuario
const UserMap = lazy(() => import("./pages/user/Map"));
const UserWallet = lazy(() => import("./pages/user/Wallet"));
const UserHistory = lazy(() => import("./pages/user/History"));
const UserProfile = lazy(() => import("./pages/user/Profile"));
const UserReservations = lazy(() => import("./pages/user/Reservations"));
const UserSupport = lazy(() => import("./pages/user/Support"));
const StationDetail = lazy(() => import("./pages/user/StationDetail"));
const ChargingSession = lazy(() => import("./pages/user/ChargingSession"));
const AIAssistant = lazy(() => import("./pages/user/AIAssistant"));
const ScanPage = lazy(() => import("./pages/user/Scan"));
const StartCharge = lazy(() => import("./pages/user/StartCharge"));
const QRRedirect = lazy(() => import("./pages/QRRedirect"));
const ChargingMonitor = lazy(() => import("./pages/user/ChargingMonitor"));
const OverstayMonitor = lazy(() => import("./pages/user/OverstayMonitor"));
const ChargingSummary = lazy(() => import("./pages/user/ChargingSummary"));
const ChargingWaiting = lazy(() => import("./pages/user/ChargingWaiting"));
const UserSettingsNotifications = lazy(() => import("./pages/user/settings/Notifications"));
const UserSettingsPersonalInfo = lazy(() => import("./pages/user/settings/PersonalInfo"));
const UserSettingsVehicles = lazy(() => import("./pages/user/settings/Vehicles"));
const UserSettingsPaymentMethods = lazy(() => import("./pages/user/settings/PaymentMethods"));
const UserSettingsConfig = lazy(() => import("./pages/user/settings/Config"));
const UserSubscription = lazy(() => import("./pages/user/Subscription"));
const SocAccuracyHistory = lazy(() => import("./pages/user/SocAccuracyHistory"));

// Páginas de inversionista
const InvestorDashboard = lazy(() => import("./pages/investor/Dashboard"));
const InvestorStations = lazy(() => import("./pages/investor/Stations"));
const InvestorTransactions = lazy(() => import("./pages/investor/Transactions"));
const InvestorReports = lazy(() => import("./pages/investor/Reports"));
const InvestorSettings = lazy(() => import("./pages/investor/Settings"));
const InvestorEarnings = lazy(() => import("./pages/investor/Earnings"));
const InvestorSettlements = lazy(() => import("./pages/investor/Settlements"));
const InvestorFinancial = lazy(() => import("./pages/investor/Financial"));
const InvestorOnboarding = lazy(() => import("./pages/investor/InvestorOnboarding"));

// Páginas de técnico
const TechnicianDashboard = lazy(() => import("./pages/technician/Dashboard"));
const TechnicianTickets = lazy(() => import("./pages/technician/Tickets"));
const TechnicianStations = lazy(() => import("./pages/technician/Stations"));
const TechnicianAlerts = lazy(() => import("./pages/technician/Alerts"));
const TechnicianDiagnostics = lazy(() => import("./pages/technician/Diagnostics"));
const TechnicianOCPPMonitor = lazy(() => import("./pages/technician/OCPPMonitor"));
const TechnicianMaintenance = lazy(() => import("./pages/technician/Maintenance"));
const TechnicianSettings = lazy(() => import("./pages/technician/Settings"));
const TechnicianFirmware = lazy(() => import("./pages/technician/Firmware"));
const TechnicianSupport = lazy(() => import("./pages/technician/Support"));

// Páginas de ingeniero (jefe técnico)
const EngineerDashboard = lazy(() => import("./pages/engineer/Dashboard"));
const EngineerTickets = lazy(() => import("./pages/engineer/Tickets"));
const EngineerTechnicians = lazy(() => import("./pages/engineer/Technicians"));
const PreventiveMaintenance = lazy(() => import("./pages/engineer/PreventiveMaintenance"));

// Páginas de administración
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminStations = lazy(() => import("./pages/admin/Stations"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminTransactions = lazy(() => import("./pages/admin/Transactions"));
const AdminTariffs = lazy(() => import("./pages/admin/Tariffs"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminBanners = lazy(() => import("./pages/admin/Banners"));
const AdminNotifications = lazy(() => import("./pages/admin/Notifications"));
const AdminAISettings = lazy(() => import("./pages/admin/AISettings"));
const AdminPayouts = lazy(() => import("./pages/admin/Payouts"));
const AdminCrowdfunding = lazy(() => import("./pages/admin/Crowdfunding"));
const AdminOCPPMonitor = lazy(() => import("./pages/AdminOCPPMonitor"));
const AdminOverstayHistory = lazy(() => import("./pages/admin/OverstayHistory"));
const AdminInvestorManagement = lazy(() => import("./pages/admin/InvestorManagement"));
const AdminDebts = lazy(() => import("./pages/admin/Debts"));
const AdminSupport = lazy(() => import("./pages/admin/Support"));
const AdminRemoteStart = lazy(() => import("./pages/admin/RemoteStart"));
const AdminFinancial = lazy(() => import("./pages/admin/Financial"));
const AdminMaintenanceFund = lazy(() => import("./pages/admin/MaintenanceFund"));

// Páginas de Aliado Comercial (Host)
const HostDashboard = lazy(() => import("./pages/host/Dashboard"));
const HostSpaces = lazy(() => import("./pages/host/Spaces"));
const HostTransactions = lazy(() => import("./pages/host/Transactions"));
const HostSettlements = lazy(() => import("./pages/host/Settlements"));
const HostReports = lazy(() => import("./pages/host/Reports"));
const HostSettings = lazy(() => import("./pages/host/Settings"));

// Páginas de Staff (Evento)
const EventCheckIn = lazy(() => import("./pages/staff/EventCheckIn"));
const StaffGuests = lazy(() => import("./pages/staff/Guests"));
const StaffPayments = lazy(() => import("./pages/staff/Payments"));
const StaffInvitations = lazy(() => import("./pages/staff/Invitations"));
const StaffEventStats = lazy(() => import("./pages/staff/EventStats"));

// Layouts (carga inmediata - necesarios para estructura)
import AdminLayout from "./layouts/AdminLayout";
import InvestorLayout from "./layouts/InvestorLayout";
import TechnicianLayout from "./layouts/TechnicianLayout";
import EngineerLayout from "./layouts/EngineerLayout";
import StaffLayout from "./layouts/StaffLayout";
import HostLayout from "./layouts/HostLayout";

// Widgets (carga diferida)
const AIChatWidget = lazy(() => import("./components/AIChat").then(m => ({ default: m.AIChatWidget })));
const InstallBanner = lazy(() => import("./components/InstallBanner").then(m => ({ default: m.InstallBanner })));
const ActiveChargingBanner = lazy(() => import("./components/ActiveChargingBanner").then(m => ({ default: m.ActiveChargingBanner })));

// Función para obtener la ruta de inicio según el rol
function getHomeRouteByRole(role: string | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "staff":
      return "/staff/event";
    case "investor":
      return "/investor";
    case "technician":
      return "/technician";
    case "engineer":
      return "/engineer";
    case "host":
      return "/host";
    case "user":
    default:
      return "/map";
  }
}

// Detectar si la app se ejecuta como PWA instalada (standalone)
function isPWAInstalled(): boolean {
  // Android Chrome / Edge / Samsung Internet
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari
  if ((navigator as any).standalone === true) return true;
  // TWA (Trusted Web Activity)
  if (document.referrer.includes('android-app://')) return true;
  return false;
}

// Componente para redirigir según el rol
function RoleBasedRedirect() {
  const { user, isAuthenticated, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();
  
  // Verificar si el usuario tiene una sesión de carga activa
  const { data: activeSession, isLoading: sessionLoading } = trpc.charging.getActiveSession.useQuery(
    undefined,
    {
      enabled: !!isAuthenticated && !!user && user.role === "user",
      retry: 1,
    }
  );

  const isStillLoading = loading || (isAuthenticated && user?.role === "user" && sessionLoading);

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && user && user.role === "user" && sessionLoading) return;
    
    if (isAuthenticated && user) {
      if (user.role === "user" && activeSession && activeSession.transactionId > 0 && activeSession.status !== "COMPLETED") {
        setLocation("/charging-monitor");
        return;
      }
      const targetRoute = getHomeRouteByRole(user.role);
      setLocation(targetRoute);
    } else if (isPWAInstalled()) {
      setLocation('/map');
    }
  }, [isAuthenticated, user, loading, setLocation, activeSession, sessionLoading]);

  if (isStillLoading) {
    return (
      <LoadingGuard isLoading={true} timeoutMs={10000} onRetry={() => refresh()}>
        <div />
      </LoadingGuard>
    );
  }

  if (!isAuthenticated && !isPWAInstalled()) {
    return <Landing />;
  }

  return (
    <LoadingGuard isLoading={true} timeoutMs={10000} onRetry={() => refresh()}>
      <div />
    </LoadingGuard>
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
  const { user, isAuthenticated, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <LoadingGuard isLoading={true} timeoutMs={10000} onRetry={() => refresh()}>
        <div />
      </LoadingGuard>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  if (!allowedRoles.includes(user?.role || "user")) {
    const targetRoute = getHomeRouteByRole(user?.role);
    setLocation(targetRoute);
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { loading, refresh } = useAuth();

  if (loading) {
    return (
      <LoadingGuard isLoading={true} timeoutMs={10000} onRetry={() => refresh()}>
        <div />
      </LoadingGuard>
    );
  }

  return (
    <Suspense fallback={<LazySpinner />}>
      <Switch>
        {/* Página de inicio - Redirige según rol */}
        <Route path="/">
          <RoleBasedRedirect />
        </Route>

        {/* Rutas públicas */}
        <Route path="/landing" component={Landing} />
        <Route path="/investors" component={Investors} />
        <Route path="/gracias-inversionistas" component={ThankYouInvestors} />
        
        {/* Ruta para códigos QR - Redirige a StartCharge */}
        <Route path="/c/:code" component={QRRedirect} />

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
        <Route path="/assistant" component={AIAssistant} />
        <Route path="/settings/notifications" component={UserSettingsNotifications} />
        <Route path="/settings/personal" component={UserSettingsPersonalInfo} />
        <Route path="/settings/vehicles" component={UserSettingsVehicles} />
        <Route path="/scan" component={ScanPage} />
        <Route path="/start-charge" component={StartCharge} />
        <Route path="/charging-waiting" component={ChargingWaiting} />
        <Route path="/charging-monitor" component={ChargingMonitor} />
        <Route path="/overstay" component={OverstayMonitor} />
        <Route path="/charging-summary/:transactionId" component={ChargingSummary} />
        <Route path="/vehicles" component={UserSettingsVehicles} />
        <Route path="/settings/payment" component={UserSettingsPaymentMethods} />
        <Route path="/settings/config" component={UserSettingsConfig} />
        <Route path="/subscription" component={UserSubscription} />
        <Route path="/soc-accuracy" component={SocAccuracyHistory} />

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
        <Route path="/investor/financial">
          <ProtectedRoute allowedRoles={["investor", "admin"]}>
            <InvestorLayout>
              <InvestorFinancial />
            </InvestorLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/investor/onboarding">
          <ProtectedRoute allowedRoles={["investor", "admin"]}>
            <InvestorOnboarding />
          </ProtectedRoute>
        </Route>

        {/* ============================================
            RUTAS DE TÉCNICO (con layout)
            ============================================ */}
        {/* ============================================
            RUTAS DE INGENIERO JEFE (con layout propio)
            ============================================ */}
        <Route path="/engineer">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <EngineerDashboard />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/tickets">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <EngineerTickets />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/technicians">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <EngineerTechnicians />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/stations">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <TechnicianStations />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/alerts">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <TechnicianAlerts />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/diagnostics">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <TechnicianDiagnostics />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/ocpp-monitor">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <TechnicianOCPPMonitor />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>

        <Route path="/engineer/maintenance">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <TechnicianMaintenance />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/preventive-maintenance">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <PreventiveMaintenance />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/firmware">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <TechnicianFirmware />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/engineer/settings">
          <ProtectedRoute allowedRoles={["engineer", "admin"]}>
            <EngineerLayout>
              <TechnicianSettings />
            </EngineerLayout>
          </ProtectedRoute>
        </Route>

        {/* ============================================
            RUTAS DE TÉCNICO (con layout - solo ejecución)
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
        <Route path="/technician/alerts">
          <ProtectedRoute allowedRoles={["technician", "admin"]}>
            <TechnicianLayout>
              <TechnicianAlerts />
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
        <Route path="/technician/ocpp-monitor">
          <ProtectedRoute allowedRoles={["technician", "admin"]}>
            <TechnicianLayout>
              <TechnicianOCPPMonitor />
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
        <Route path="/technician/firmware">
          <ProtectedRoute allowedRoles={["technician", "admin"]}>
            <TechnicianLayout>
              <TechnicianFirmware />
            </TechnicianLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/technician/support">
          <ProtectedRoute allowedRoles={["technician", "admin"]}>
            <TechnicianLayout>
              <TechnicianSupport />
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
        <Route path="/admin/payouts">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminPayouts />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/crowdfunding">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminCrowdfunding />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        <Route path="/admin/investors">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminInvestorManagement />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        <Route path="/admin/overstay">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminOverstayHistory />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        <Route path="/admin/debts">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminDebts />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/support">
          <ProtectedRoute allowedRoles={["admin", "engineer", "technician"]}>
            <AdminLayout>
              <AdminSupport />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/remote-start">
          <ProtectedRoute allowedRoles={["admin", "engineer", "technician"]}>
            <AdminLayout>
              <AdminRemoteStart />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/financial">
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <AdminLayout>
              <AdminFinancial />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/maintenance-fund">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminMaintenanceFund />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        {/* ============================================
            RUTAS DE ALIADO COMERCIAL (Host)
            ============================================ */}
        <Route path="/host">
          <ProtectedRoute allowedRoles={["host", "admin"]}>
            <HostLayout>
              <HostDashboard />
            </HostLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/host/spaces">
          <ProtectedRoute allowedRoles={["host", "admin"]}>
            <HostLayout>
              <HostSpaces />
            </HostLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/host/transactions">
          <ProtectedRoute allowedRoles={["host", "admin"]}>
            <HostLayout>
              <HostTransactions />
            </HostLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/host/settlements">
          <ProtectedRoute allowedRoles={["host", "admin"]}>
            <HostLayout>
              <HostSettlements />
            </HostLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/host/reports">
          <ProtectedRoute allowedRoles={["host", "admin"]}>
            <HostLayout>
              <HostReports />
            </HostLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/host/settings">
          <ProtectedRoute allowedRoles={["host", "admin"]}>
            <HostLayout>
              <HostSettings />
            </HostLayout>
          </ProtectedRoute>
        </Route>

        {/* ============================================
            RUTAS DE STAFF (Gestión de Evento)
            ============================================ */}
        <Route path="/staff/event">
          <ProtectedRoute allowedRoles={["staff", "admin"]}>
            <StaffLayout>
              <EventCheckIn />
            </StaffLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/staff/guests">
          <ProtectedRoute allowedRoles={["staff", "admin"]}>
            <StaffLayout>
              <StaffGuests />
            </StaffLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/staff/payments">
          <ProtectedRoute allowedRoles={["staff", "admin"]}>
            <StaffLayout>
              <StaffPayments />
            </StaffLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/staff/invitations">
          <ProtectedRoute allowedRoles={["staff", "admin"]}>
            <StaffLayout>
              <StaffInvitations />
            </StaffLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/staff/stats">
          <ProtectedRoute allowedRoles={["staff", "admin"]}>
            <StaffLayout>
              <StaffEventStats />
            </StaffLayout>
          </ProtectedRoute>
        </Route>

        {/* 404 */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const { showOnboarding, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();
  const { isAuthenticated, loading: authLoading, refresh } = useAuth();

  // Protección principal: si auth tarda más de 10s, mostrar opciones de recuperación
  const isInitialLoading = authLoading || onboardingLoading;
  const shouldShowOnboarding = !onboardingLoading && !authLoading && isAuthenticated && showOnboarding;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <LoadingGuard 
            isLoading={isInitialLoading} 
            timeoutMs={10000} 
            onRetry={() => refresh()}
          >
            {shouldShowOnboarding ? (
              <Onboarding onComplete={completeOnboarding} />
            ) : (
              <>
                <Router />
                <Suspense fallback={null}>
                  <ActiveChargingBanner />
                  <AIChatWidget />
                  <InstallBanner />
                </Suspense>
              </>
            )}
          </LoadingGuard>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
