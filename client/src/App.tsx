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
import { lazy, Suspense, useEffect, useRef, useState, useCallback } from "react";
import { Onboarding, useOnboarding } from "@/components/Onboarding";
import { LoadingGuard } from "@/components/LoadingGuard";
import { Capacitor } from "@capacitor/core";
import { openLoginBrowser } from "@/const";
import { loadMapScript } from "@/components/Map";

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
const Partners = lazy(() => import("./pages/Partners"));
const SaaSLanding = lazy(() => import("./pages/SaaSLanding"));
const AdminOrganizations = lazy(() => import("./pages/admin/Organizations"));

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
const UserClaimForm = lazy(() => import("./pages/user/ClaimForm"));
const ChargingWaiting = lazy(() => import("./pages/user/ChargingWaiting"));
const UserSettingsNotifications = lazy(() => import("./pages/user/settings/Notifications"));
const UserSettingsPersonalInfo = lazy(() => import("./pages/user/settings/PersonalInfo"));
const UserSettingsVehicles = lazy(() => import("./pages/user/settings/Vehicles"));
const UserSettingsPaymentMethods = lazy(() => import("./pages/user/settings/PaymentMethods"));
const UserSettingsConfig = lazy(() => import("./pages/user/settings/Config"));
const UserPrivacySettings = lazy(() => import("./pages/user/PrivacySettings"));
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
const AdminOnboardingDashboard = lazy(() => import("./pages/admin/OnboardingDashboard"));
const AdminBackupDashboard = lazy(() => import("./pages/admin/BackupDashboard"));
const AdminRefunds = lazy(() => import("./pages/admin/Refunds"));
const AdminClaims = lazy(() => import("./pages/admin/Claims"));
const AdminQuotes = lazy(() => import("./pages/admin/Quotes"));
const AdminQuotesCatalog = lazy(() => import("./pages/admin/QuotesCatalog"));
const AdminQuotesSettings = lazy(() => import("./pages/admin/QuotesSettings"));
const QuotePublic = lazy(() => import("./pages/QuotePublic"));
const SpaceSubmission = lazy(() => import("./pages/SpaceSubmission"));
const SpaceLetterAccept = lazy(() => import("./pages/SpaceLetterAccept"));
const Crowdfunding = lazy(() => import("./pages/Crowdfunding"));
const AdminSpaces = lazy(() => import("./pages/admin/Spaces"));

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
    case "comercial":
      return "/admin/quotes";
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

// Detecta si corre dentro de Capacitor nativo, incluso cuando el bridge tarda en
// inicializarse en Android 10 y Capacitor.isNativePlatform() aún retorna false.
// - Android nativo: Capacitor sirve desde https://localhost (androidScheme: 'https')
// - iOS nativo: Capacitor sirve desde evgreen://localhost (custom scheme)
function isRunningNatively(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  const origin = window.location.origin;
  return origin === 'https://localhost' || (origin.endsWith('://localhost') && !origin.startsWith('http://'));
}

// Componente para redirigir según el rol
function RoleBasedRedirect() {
  const { user, isAuthenticated, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const loginBrowserOpened = useRef(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const pendingBrowserCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutoRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoRetries, setLogoRetries] = useState(0);
  // True once deep-link token arrives but auth.me hasn't confirmed yet
  const [tokenPending, setTokenPending] = useState(false);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
    if (isAuthenticated) {
      setTokenPending(false);
      // Trigger a repaint of the Google Maps canvas (and any WebGL surface) after
      // returning from the Auth0 browser. The WKWebView GPU context may need a
      // nudge to restore textures after the SFSafariViewController dismisses.
      setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    }
  }, [isAuthenticated]);

  // Show manual retry button after 2 seconds if stuck (not during token pending)
  useEffect(() => {
    if (loading || isAuthenticated || tokenPending || !isRunningNatively()) return;
    const timer = setTimeout(() => setShowRetryButton(true), 2000);
    return () => clearTimeout(timer);
  }, [loading, isAuthenticated, tokenPending]);

  // Mark as authenticated immediately when deep-link token arrives (before auth.me completes).
  // Also cancel any pending browserFinished retry timers — the deep link arrived, no need to retry.
  useEffect(() => {
    const handleAuthUpdated = () => {
      if (pendingBrowserCheckRef.current) {
        clearTimeout(pendingBrowserCheckRef.current);
        pendingBrowserCheckRef.current = null;
      }
      if (pendingAutoRetryRef.current) {
        clearTimeout(pendingAutoRetryRef.current);
        pendingAutoRetryRef.current = null;
      }
      isAuthenticatedRef.current = true;
      setTokenPending(true);
      setShowRetryButton(false);
    };
    window.addEventListener('evgreen-auth-updated', handleAuthUpdated);
    return () => window.removeEventListener('evgreen-auth-updated', handleAuthUpdated);
  }, []);

  // Safety timeout: if tokenPending for too long and auth.me never confirmed, retry then give up
  useEffect(() => {
    if (!tokenPending) return;
    // At 6s: retry auth.me in case the refetch silently failed
    const retryTimer = setTimeout(() => {
      if (!isAuthenticatedRef.current) refresh();
    }, 6000);
    // At 15s: give up and let the user tap "Iniciar sesión" again
    const giveUpTimer = setTimeout(() => {
      if (!isAuthenticatedRef.current) {
        setTokenPending(false);
        isAuthenticatedRef.current = false;
        loginBrowserOpened.current = false;
      }
    }, 15000);
    return () => {
      clearTimeout(retryTimer);
      clearTimeout(giveUpTimer);
    };
  }, [tokenPending, refresh]);

  const doOpenLogin = useCallback(async () => {
    loginBrowserOpened.current = true;
    setShowRetryButton(false);
    try {
      await openLoginBrowser();
      const { Browser } = await import('@capacitor/browser');
      // Remove previous listeners to avoid accumulation across retries
      await Browser.removeAllListeners();
      await Browser.addListener('browserFinished', () => {
        // 500ms to let appUrlOpen + evgreen-auth-updated arrive before checking.
        // Both timers are stored in refs so handleAuthUpdated can cancel them
        // if the deep link arrives after browserFinished but before the timers fire.
        pendingBrowserCheckRef.current = setTimeout(() => {
          pendingBrowserCheckRef.current = null;
          if (isAuthenticatedRef.current) return;
          loginBrowserOpened.current = false;
          setShowRetryButton(true);
          pendingAutoRetryRef.current = setTimeout(() => {
            pendingAutoRetryRef.current = null;
            if (!loginBrowserOpened.current && !isAuthenticatedRef.current) {
              doOpenLogin();
            }
          }, 2000);
        }, 500);
      });
    } catch (e) {
      console.error("[Auth] openLoginBrowser failed:", e);
      // Do NOT reset loginBrowserOpened here — a VC may still be visible despite
      // the error (Capacitor returns errors for close/open when a VC is mid-animation).
      // Resetting the flag triggers another doOpenLogin() → cascade of open() calls.
      // The user can tap the retry button if Auth0 truly didn't appear.
      setShowRetryButton(true);
    }
  }, []);

  // On native: auto-open Auth0 login immediately when not authenticated.
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) {
      loginBrowserOpened.current = false;
      setShowRetryButton(false);
      return;
    }
    if (!isRunningNatively()) return;
    // Guard: deep-link token arrived but auth.me hasn't confirmed yet (tokenPending).
    // isAuthenticatedRef is set synchronously on evgreen-auth-updated, before React
    // processes the re-render, so this check is safe even during the transition.
    if (isAuthenticatedRef.current) return;
    if (loginBrowserOpened.current) return;
    // Kick off Maps script download in background while user is in Auth0,
    // so the map is ready to initialize immediately after login completes.
    loadMapScript().catch(() => {});
    doOpenLogin();
  }, [isAuthenticated, loading, doOpenLogin]);

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

  // On native: never show the Landing page — Auth0 browser opens on top
  if ((!isAuthenticated || tokenPending) && isRunningNatively()) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b1a0e', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ── KEYFRAME ANIMATIONS ── */}
        <style>{`
          @keyframes evg-arc-cw { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -440; } }
          @keyframes evg-arc-ccw { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 440; } }
          @keyframes evg-glow-pulse { 0%,100%{ opacity:.35; transform:scale(1); } 50%{ opacity:.7; transform:scale(1.12); } }
          @keyframes evg-spark-1 { 0%{ transform:translate(0,0) scale(1); opacity:1; } 100%{ transform:translate(-18px,-90px) scale(0); opacity:0; } }
          @keyframes evg-spark-2 { 0%{ transform:translate(0,0) scale(1); opacity:1; } 100%{ transform:translate(22px,-100px) scale(0); opacity:0; } }
          @keyframes evg-spark-3 { 0%{ transform:translate(0,0) scale(1); opacity:1; } 100%{ transform:translate(-8px,-75px) scale(0); opacity:0; } }
          @keyframes evg-spark-4 { 0%{ transform:translate(0,0) scale(1); opacity:1; } 100%{ transform:translate(14px,-85px) scale(0); opacity:0; } }
          @keyframes evg-bolt-flash { 0%,85%,100%{ opacity:0; } 88%,96%{ opacity:.9; } 92%{ opacity:.2; } }
          @keyframes evg-bolt-fast { 0%,90%,100%{ opacity:0; } 92%,97%{ opacity:1; } 94%{ opacity:.15; } }
          @keyframes evg-bolt-double { 0%,70%,100%{ opacity:0; } 72%,76%{ opacity:.9; } 74%{ opacity:.1; } 80%,86%{ opacity:.7; } 83%{ opacity:.1; } }
          @keyframes evg-hex-pulse { 0%,100%{ opacity:.12; } 50%{ opacity:.28; } }
          @keyframes evg-orb-breathe { 0%,100%{ transform:translate(-50%,-50%) scale(1); opacity:.18; } 50%{ transform:translate(-50%,-50%) scale(1.18); opacity:.32; } }
        `}</style>

        {/* ── HEXAGONAL GRID BACKGROUND ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <pattern id="hex" x="0" y="0" width="52" height="60" patternUnits="userSpaceOnUse">
              <polygon points="26,2 50,15 50,45 26,58 2,45 2,15" fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth="0.6"
                style={{ animation: 'evg-hex-pulse 4s ease-in-out infinite' }}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex)"/>
        </svg>

        {/* ── ELECTRIC LIGHTNING BOLTS (6 positions, staggered) ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <filter id="bolt-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          {/* ─ TOP-LEFT ─ */}
          <polyline points="8,0 28,90 14,90 38,210 22,210 48,350" fill="none" stroke="#4ade80" strokeWidth="1.5" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-flash 3.5s ease-in-out infinite' }}/>
          <polyline points="18,20 34,100 22,100 44,200" fill="none" stroke="#86efac" strokeWidth="0.8" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-flash 3.5s ease-in-out infinite 0.15s' }}/>
          {/* ─ TOP-RIGHT ─ */}
          <polyline points="382,0 362,90 376,90 352,210 366,210 345,340" fill="none" stroke="#4ade80" strokeWidth="1.5" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-fast 4.8s ease-in-out infinite 0.6s' }}/>
          <polyline points="374,18 358,98 370,98 350,192" fill="none" stroke="#86efac" strokeWidth="0.8" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-fast 4.8s ease-in-out infinite 0.75s' }}/>
          {/* ─ MIDDLE-LEFT (short, double-flash) ─ */}
          <polyline points="0,370 20,420 7,420 30,468" fill="none" stroke="#22c55e" strokeWidth="1.2" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-double 6.5s ease-in-out infinite 2.2s' }}/>
          <polyline points="5,385 22,432 12,432 32,476" fill="none" stroke="#86efac" strokeWidth="0.6" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-double 6.5s ease-in-out infinite 2.35s' }}/>
          {/* ─ MIDDLE-RIGHT (short) ─ */}
          <polyline points="390,450 370,500 383,500 360,548" fill="none" stroke="#22c55e" strokeWidth="1.2" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-fast 5.2s ease-in-out infinite 1.3s' }}/>
          <polyline points="386,466 368,512 380,512 358,558" fill="none" stroke="#86efac" strokeWidth="0.6" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-fast 5.2s ease-in-out infinite 1.45s' }}/>
          {/* ─ BOTTOM-LEFT ─ */}
          <polyline points="14,900 36,800 20,800 48,688 30,688 58,562" fill="none" stroke="#4ade80" strokeWidth="1.5" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-flash 4.0s ease-in-out infinite 3.1s' }}/>
          <polyline points="26,878 44,790 30,790 52,680" fill="none" stroke="#86efac" strokeWidth="0.8" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-flash 4.0s ease-in-out infinite 3.25s' }}/>
          {/* ─ BOTTOM-RIGHT ─ */}
          <polyline points="96%,30% 88%,48% 93%,48% 84%,68% 90%,68% 80%,90%" fill="none" stroke="#4ade80" strokeWidth="1.5" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-flash 4.2s ease-in-out infinite 1.8s' }}/>
          <polyline points="98%,35% 91%,50% 95%,50% 87%,65%" fill="none" stroke="#86efac" strokeWidth="0.8" filter="url(#bolt-glow)"
            style={{ animation: 'evg-bolt-flash 4.2s ease-in-out infinite 1.95s' }}/>
        </svg>

        {/* ── LARGE ORGANIC LEAF SHAPES ── */}
        <svg style={{ position: 'absolute', right: '-15%', top: '8%', width: '75%', height: '55%', pointerEvents: 'none', opacity: 0.07 }}>
          <path d="M200,0 C320,80 340,280 160,400 C40,340 20,120 200,0Z" fill="#22c55e"/>
          <path d="M280,30 C380,120 360,320 180,420 C80,360 100,140 280,30Z" fill="#16a34a" opacity="0.6"/>
        </svg>
        <svg style={{ position: 'absolute', left: '-20%', bottom: '5%', width: '60%', height: '45%', pointerEvents: 'none', opacity: 0.05 }}>
          <path d="M100,300 C20,200 60,60 200,10 C300,80 260,260 100,300Z" fill="#15803d"/>
        </svg>

        {/* ── TOP AMBIENT GLOW ── */}
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '60vh', background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 65%)', pointerEvents: 'none' }}/>

        {/* ── CENTER: LOGO + BRAND ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, zIndex: 10, padding: '12vh 32px 0' }}>

          {/* Logo with electric arcs + sparks */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 220, height: 220 }}>

            {/* Pulsating orb behind logo */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)', filter: 'blur(18px)', animation: 'evg-orb-breathe 3s ease-in-out infinite' }}/>

            {/* Rotating electric arcs */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <filter id="arc-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              {/* Outer arc — clockwise */}
              <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(74,222,128,0.35)" strokeWidth="1.2"
                strokeDasharray="18 8" filter="url(#arc-glow)"
                style={{ animation: 'evg-arc-cw 6s linear infinite', transformOrigin: '110px 110px' }}/>
              {/* Inner arc — counter-clockwise */}
              <circle cx="110" cy="110" r="82" fill="none" stroke="rgba(34,197,94,0.25)" strokeWidth="0.8"
                strokeDasharray="8 14" filter="url(#arc-glow)"
                style={{ animation: 'evg-arc-ccw 9s linear infinite', transformOrigin: '110px 110px' }}/>
              {/* Energy dots on outer ring */}
              <circle cx="110" cy="10" r="3" fill="#4ade80" opacity="0.7" filter="url(#arc-glow)"
                style={{ animation: 'evg-arc-cw 6s linear infinite', transformOrigin: '110px 110px' }}/>
              <circle cx="110" cy="210" r="2" fill="#22c55e" opacity="0.5" filter="url(#arc-glow)"
                style={{ animation: 'evg-arc-ccw 9s linear infinite', transformOrigin: '110px 110px' }}/>
            </svg>

            {/* Floating spark particles */}
            {[
              { x: 85, y: 120, size: 3, delay: '0s', dur: '2.2s', anim: 'evg-spark-1', color: '#4ade80' },
              { x: 138, y: 130, size: 2, delay: '0.7s', dur: '2.6s', anim: 'evg-spark-2', color: '#86efac' },
              { x: 100, y: 145, size: 2.5, delay: '1.3s', dur: '2s', anim: 'evg-spark-3', color: '#22c55e' },
              { x: 125, y: 115, size: 2, delay: '1.9s', dur: '2.4s', anim: 'evg-spark-4', color: '#4ade80' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.size * 2, height: s.size * 2, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}`, animation: `${s.anim} ${s.dur} ease-out infinite ${s.delay}` }}/>
            ))}

            {/* Logo: imagen PNG con fondo transparente; SVG como fallback si carga falla */}
            <div style={{ width: 120, height: 120, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'evg-glow-pulse 3s ease-in-out infinite' }}>
              {logoFailed ? (
                <svg width="90" height="90" fill="none" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 0 14px rgba(34,197,94,1)) drop-shadow(0 0 28px rgba(34,197,94,0.6))' }}>
                  <path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z" fill="#22c55e"/>
                </svg>
              ) : (
                <img
                  key={`evg-splash-logo-${logoRetries}`}
                  src="/icons/splash-logo.png"
                  alt="EVGreen"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(16,185,129,0.7)) drop-shadow(0 0 32px rgba(16,185,129,0.4))' }}
                  onError={() => {
                    if (logoRetries < 2) {
                      setTimeout(() => setLogoRetries(r => r + 1), 600);
                    } else {
                      setLogoFailed(true);
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Brand name — matches banner style */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 62, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1, margin: 0 }}>
              <span style={{ background: 'linear-gradient(135deg, #86efac, #22c55e, #16a34a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EV</span>
              <span style={{ color: '#ffffff' }}>Green</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 1, width: 40, background: 'linear-gradient(to right, transparent, rgba(74,222,128,0.4))' }}/>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(74,222,128,0.55)' }}>By Green House Project</span>
              <div style={{ height: 1, width: 40, background: 'linear-gradient(to left, transparent, rgba(74,222,128,0.4))' }}/>
            </div>
          </div>

          {/* Tagline */}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.6, maxWidth: 210, margin: 0 }}>
            Carga inteligente para vehículos eléctricos en Colombia
          </p>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{ width: '100%', zIndex: 10, padding: '0 32px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {tokenPending ? (
            // Token received — auth.me in flight: show only spinner, no button
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(34,197,94,0.15)', borderTopColor: '#22c55e', animation: 'spin 0.9s linear infinite' }}/>
              <p style={{ fontSize: 11, color: 'rgba(74,222,128,0.35)', margin: 0 }}>Iniciando sesión...</p>
            </div>
          ) : showRetryButton ? (
            <>
              <button
                onClick={doOpenLogin}
                style={{ width: '100%', padding: '18px 0', borderRadius: 18, border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(34,197,94,0.4), 0 0 0 1px rgba(34,197,94,0.25)', letterSpacing: '0.02em' }}
              >
                Iniciar sesión
              </button>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>Toca para continuar con tu cuenta</p>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(34,197,94,0.15)', borderTopColor: '#22c55e', animation: 'spin 0.9s linear infinite' }}/>
              <p style={{ fontSize: 11, color: 'rgba(74,222,128,0.35)', margin: 0 }}>Preparando inicio de sesión...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isPWAInstalled()) {
    return <Landing />;
  }

  // Fallback para cuando no está autenticado pero sí "instalado"
  if (!isAuthenticated) {
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

// Rutas públicas que NO necesitan esperar autenticación
const PUBLIC_PATHS = ["/partners", "/investors", "/landing", "/saas", "/gracias-inversionistas", "/postula-tu-espacio", "/cotizacion", "/carta-intencion", "/crowdfunding"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

function Router() {
  const { loading, refresh } = useAuth();
  const [currentPath] = useLocation();

  // No bloquear rutas públicas mientras auth carga
  if (loading && !isPublicPath(currentPath)) {
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
        <Route path="/partners" component={Partners} />
        <Route path="/saas" component={SaaSLanding} />
        <Route path="/gracias-inversionistas" component={ThankYouInvestors} />
        {/* Ruta para códigos QR - Redirige a StartCharge */}
        <Route path="/c/:code" component={QRRedirect} />

        {/* Cotización pública (sin login) */}
        <Route path="/cotizacion/:token">
          <Suspense fallback={<LazySpinner />}>
            <QuotePublic />
          </Suspense>
        </Route>

        {/* Postulación de espacios (público) */}
        <Route path="/postula-tu-espacio">
          <Suspense fallback={<LazySpinner />}>
            <SpaceSubmission />
          </Suspense>
        </Route>

        {/* Carta de intención (público, por token) */}
        <Route path="/carta-intencion/:token">
          <Suspense fallback={<LazySpinner />}>
            <SpaceLetterAccept />
          </Suspense>
        </Route>

        {/* Muro de crowdfunding (público) */}
        <Route path="/crowdfunding">
          <Suspense fallback={<LazySpinner />}>
            <Crowdfunding />
          </Suspense>
        </Route>

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
        <Route path="/user/claim/:transactionId" component={UserClaimForm} />
        <Route path="/vehicles" component={UserSettingsVehicles} />
        <Route path="/settings/payment" component={UserSettingsPaymentMethods} />
        <Route path="/settings/config" component={UserSettingsConfig} />
        <Route path="/settings/privacy" component={UserPrivacySettings} />
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
        {/* Redirigir /technician/maintenance a /technician/tickets (unificado) */}
        <Route path="/technician/maintenance">
          <ProtectedRoute allowedRoles={["technician", "admin"]}>
            <TechnicianLayout>
              <TechnicianTickets />
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
        <Route path="/admin/onboarding">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminOnboardingDashboard />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        <Route path="/admin/backup">
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout>
              <AdminBackupDashboard />
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

        <Route path="/admin/refunds">
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <AdminLayout>
              <AdminRefunds />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/claims">
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <AdminLayout>
              <AdminClaims />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        {/* Cotizaciones */}
        <Route path="/admin/quotes">
          <ProtectedRoute allowedRoles={["admin", "staff", "host", "comercial"]}>
            <AdminLayout>
              <AdminQuotes />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/quotes/catalog">
          <ProtectedRoute allowedRoles={["admin", "staff", "comercial"]}>
            <AdminLayout>
              <AdminQuotesCatalog />
            </AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/quotes/settings">
          <ProtectedRoute allowedRoles={["admin", "staff", "comercial"]}>
            <AdminLayout>
              <AdminQuotesSettings />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        {/* Administración de Espacios */}
        <Route path="/admin/spaces">
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <AdminLayout>
              <AdminSpaces />
            </AdminLayout>
          </ProtectedRoute>
        </Route>

        {/* Administración de Organizaciones SaaS */}
        <Route path="/admin/organizations">
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <AdminLayout>
              <AdminOrganizations />
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
  const [location] = useLocation();

  // Las rutas públicas se renderizan inmediatamente sin esperar auth
  const isPublic = isPublicPath(location);

  // Protección principal: si auth tarda más de 10s, mostrar opciones de recuperación
  const isInitialLoading = !isPublic && (authLoading || onboardingLoading);
  const shouldShowOnboarding = !isPublic && !onboardingLoading && !authLoading && isAuthenticated && showOnboarding;

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
