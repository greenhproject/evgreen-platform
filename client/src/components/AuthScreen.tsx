/**
 * AuthScreen - Pantalla de Login/Registro con animaciones premium
 * Soporta branding personalizado por subdominio de organización SaaS
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, Mail, Lock, User, Phone, ArrowRight, Sparkles, ChevronLeft, Shield } from "lucide-react";
import { getLoginUrl, trpc } from "@/lib/trpc";

// ─── Detección de subdominio de org ───────────────────────────────────────────
function getOrgSlug(): string | null {
  const hostname = window.location.hostname;
  // Detectar subdominios como "empresa.evgreen.lat" o "empresa.app.evgreen.lat"
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const slug = parts[0];
    // Excluir subdominios del sistema
    const systemSubdomains = ["app", "www", "api", "admin", "staging", "dev", "localhost"];
    if (!systemSubdomains.includes(slug)) {
      return slug;
    }
  }
  return null;
}

// ─── Hook para cargar branding de org ─────────────────────────────────────────
function useOrgBranding() {
  const slug = getOrgSlug();
  const { data: orgData } = (trpc.organizations as any).getOrgBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );
  return { slug, org: orgData };
}

// ─── Partículas decorativas ────────────────────────────────────────────────────
const FloatingParticle = ({ delay, size, x, y, color }: { delay: number; size: number; x: number; y: number; color: string }) => (
  <motion.div
    className="absolute rounded-full"
    style={{ width: size, height: size, left: `${x}%`, top: `${y}%`, background: color, opacity: 0.2 }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: [0, 0.4, 0], scale: [0, 1, 0.5], y: [0, -30, -60] }}
    transition={{ duration: 4, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

// ─── Fondo animado ─────────────────────────────────────────────────────────────
const AnimatedBackground = ({ primaryColor = "#10b981" }: { primaryColor?: string }) => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-950" />
    <motion.div
      className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl"
      style={{ background: `${primaryColor}20` }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl"
      style={{ background: `${primaryColor}15` }}
      animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
    {[...Array(12)].map((_, i) => (
      <FloatingParticle
        key={i}
        delay={i * 0.5}
        size={Math.random() * 8 + 4}
        x={Math.random() * 100}
        y={Math.random() * 100}
        color={primaryColor}
      />
    ))}
  </div>
);

// ─── Logo EVGreen (default) ────────────────────────────────────────────────────
const EVGreenLogo = () => (
  <motion.div
    className="flex items-center justify-center gap-3 mb-8"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
  >
    <motion.div
      className="relative"
      animate={{ rotate: [0, 5, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
        <Zap className="w-9 h-9 text-white" fill="currentColor" />
      </div>
      <motion.div
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400"
        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
    <div>
      <h1 className="text-3xl font-bold">
        <span className="text-emerald-400">EV</span>
        <span className="text-white">Green</span>
      </h1>
      <p className="text-emerald-400/60 text-sm">Energía para el futuro</p>
    </div>
  </motion.div>
);

// ─── Logo de Organización (branding personalizado) ─────────────────────────────
const OrgLogo = ({ org, primaryColor }: { org: any; primaryColor: string }) => (
  <motion.div
    className="flex flex-col items-center gap-3 mb-8"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
  >
    {org.logoUrl ? (
      <img
        src={org.logoUrl}
        alt={org.name}
        className="h-16 w-auto object-contain rounded-xl"
      />
    ) : (
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg text-white font-bold text-2xl"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}
      >
        {org.name?.charAt(0)?.toUpperCase() || "O"}
      </div>
    )}
    <div className="text-center">
      <h1 className="text-2xl font-bold text-white">{org.name}</h1>
      <p className="text-sm mt-0.5" style={{ color: `${primaryColor}99` }}>
        Portal de carga eléctrica
      </p>
    </div>
    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
      <span>Powered by</span>
      <span className="text-emerald-400 font-semibold">EVGreen</span>
    </div>
  </motion.div>
);

// ─── Formulario de login ───────────────────────────────────────────────────────
const LoginForm = ({
  onSwitchToRegister,
  primaryColor,
  orgName,
}: {
  onSwitchToRegister: () => void;
  primaryColor: string;
  orgName?: string;
}) => {
  const handleOAuthLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">¡Bienvenido de vuelta!</h2>
        <p className="text-gray-400">
          {orgName ? `Inicia sesión en ${orgName}` : "Inicia sesión para continuar cargando"}
        </p>
      </div>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={handleOAuthLogin}
          className="w-full h-14 text-white font-semibold text-lg rounded-xl shadow-lg transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
            boxShadow: `0 8px 32px ${primaryColor}40`,
          }}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Iniciar sesión
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>

      {/* Registro prominente */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={onSwitchToRegister}
          variant="outline"
          className="w-full h-12 font-semibold text-base rounded-xl border-2 transition-all duration-300"
          style={{
            borderColor: `${primaryColor}60`,
            color: primaryColor,
            backgroundColor: `${primaryColor}10`,
          }}
        >
          <User className="w-5 h-5 mr-2" />
          Crear cuenta gratis
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>

      <p className="text-center text-gray-500 text-xs pt-1">
        ¿Ya tienes cuenta? El botón de arriba también sirve para iniciar sesión.
      </p>
    </motion.div>
  );
};

// ─── Formulario de registro ────────────────────────────────────────────────────
const RegisterForm = ({
  onSwitchToLogin,
  primaryColor,
  orgName,
}: {
  onSwitchToLogin: () => void;
  primaryColor: string;
  orgName?: string;
}) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const allAccepted = termsAccepted && privacyAccepted;

  const handleOAuthRegister = () => {
    if (!allAccepted) return;
    window.location.href = getLoginUrl();
  };

  const benefits = orgName
    ? [
        { icon: "⚡", text: "Carga en red" },
        { icon: "🌟", text: "Puntos por kWh" },
        { icon: "📍", text: "Estaciones cercanas" },
        { icon: "📊", text: "Historial completo" },
      ]
    : [
        { icon: "⚡", text: "Carga rápida" },
        { icon: "🌟", text: "Gana puntos" },
        { icon: "📍", text: "Encuentra estaciones" },
        { icon: "📊", text: "Historial completo" },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-white mb-2">
          {orgName ? `Únete a ${orgName}` : "Únete a EVGreen"}
        </h2>
        <p className="text-gray-400">Crea tu cuenta y empieza a cargar</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {benefits.map((benefit, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700"
          >
            <span className="text-lg">{benefit.icon}</span>
            <span className="text-sm text-gray-300">{benefit.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Términos y condiciones obligatorios */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />
          <p className="text-xs text-gray-400 font-medium">Para registrarte debes aceptar:</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer group">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(v) => setTermsAccepted(!!v)}
            className="mt-0.5 flex-shrink-0"
            style={{ accentColor: primaryColor }}
          />
          <span className="text-sm text-gray-300 leading-relaxed">
            Acepto los{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: primaryColor }}>Términos y Condiciones</a>
            {" "}del servicio EVGreen
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <Checkbox
            id="privacy"
            checked={privacyAccepted}
            onCheckedChange={(v) => setPrivacyAccepted(!!v)}
            className="mt-0.5 flex-shrink-0"
          />
          <span className="text-sm text-gray-300 leading-relaxed">
            Acepto la{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: primaryColor }}>Política de Privacidad</a>
            {" "}y el tratamiento de mis datos personales (Ley 1581/2012)
          </span>
        </label>
      </div>

      <motion.div whileHover={{ scale: allAccepted ? 1.02 : 1 }} whileTap={{ scale: allAccepted ? 0.98 : 1 }}>
        <Button
          onClick={handleOAuthRegister}
          disabled={!allAccepted}
          className="w-full h-14 text-white font-semibold text-lg rounded-xl shadow-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: allAccepted
              ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`
              : "#334155",
            boxShadow: allAccepted ? `0 8px 32px ${primaryColor}40` : "none",
          }}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Crear mi cuenta
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>

      {!allAccepted && (
        <p className="text-center text-amber-400/80 text-xs">
          Debes aceptar los términos para continuar
        </p>
      )}

      <p className="text-center text-gray-400 text-sm">
        ¿Ya tienes cuenta?{" "}
        <button
          onClick={onSwitchToLogin}
          className="font-medium transition-colors hover:opacity-80"
          style={{ color: primaryColor }}
        >
          Inicia sesión
        </button>
      </p>
    </motion.div>
  );
};

// ─── Componente principal AuthScreen ──────────────────────────────────────────
export function AuthScreen({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { slug, org } = useOrgBranding();

  // Colores del branding: usar los de la org si existe, sino EVGreen por defecto
  const primaryColor = org?.primaryColor || "#10b981";
  const orgName = org?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <AnimatedBackground primaryColor={primaryColor} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {onClose && (
          <motion.button
            onClick={onClose}
            className="absolute -top-12 left-0 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            whileHover={{ x: -5 }}
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Volver</span>
          </motion.button>
        )}

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl">
          {/* Logo: org branding o EVGreen default */}
          {slug && org ? (
            <OrgLogo org={org} primaryColor={primaryColor} />
          ) : (
            <EVGreenLogo />
          )}

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <LoginForm
                key="login"
                onSwitchToRegister={() => setMode("register")}
                primaryColor={primaryColor}
                orgName={orgName}
              />
            ) : (
              <RegisterForm
                key="register"
                onSwitchToLogin={() => setMode("login")}
                primaryColor={primaryColor}
                orgName={orgName}
              />
            )}
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-gray-500 text-xs mt-6"
        >
          {org ? (
            <>© 2026 {org.name} · <span className="text-emerald-400">Powered by EVGreen</span></>
          ) : (
            "© 2026 EVGreen. Todos los derechos reservados."
          )}
        </motion.p>
      </motion.div>
    </div>
  );
}

export default AuthScreen;
