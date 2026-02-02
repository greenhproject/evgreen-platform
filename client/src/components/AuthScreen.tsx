/**
 * AuthScreen - Pantalla de Login/Registro con animaciones premium
 * Diseño consistente con el onboarding de EVGreen
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Mail, Lock, User, Phone, ArrowRight, Sparkles, ChevronLeft } from "lucide-react";
import { getLoginUrl } from "@/lib/trpc";

// Partículas decorativas animadas
const FloatingParticle = ({ delay, size, x, y }: { delay: number; size: number; x: number; y: number }) => (
  <motion.div
    className="absolute rounded-full bg-emerald-400/20"
    style={{ width: size, height: size, left: `${x}%`, top: `${y}%` }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{
      opacity: [0, 0.6, 0],
      scale: [0, 1, 0.5],
      y: [0, -30, -60],
    }}
    transition={{
      duration: 4,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

// Componente de fondo animado con gradiente
const AnimatedBackground = () => (
  <div className="absolute inset-0 overflow-hidden">
    {/* Gradiente base */}
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950/50 to-slate-950" />
    
    {/* Círculos de luz animados */}
    <motion.div
      className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-green-500/10 blur-3xl"
      animate={{
        scale: [1.2, 1, 1.2],
        opacity: [0.2, 0.4, 0.2],
      }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
    
    {/* Partículas flotantes */}
    {[...Array(12)].map((_, i) => (
      <FloatingParticle
        key={i}
        delay={i * 0.5}
        size={Math.random() * 8 + 4}
        x={Math.random() * 100}
        y={Math.random() * 100}
      />
    ))}
    
    {/* Líneas de energía */}
    <svg className="absolute inset-0 w-full h-full opacity-10">
      <motion.path
        d="M0,100 Q250,50 500,100 T1000,100"
        stroke="url(#gradient1)"
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
          <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// Logo animado de EVGreen
const AnimatedLogo = () => (
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

// Formulario de login
const LoginForm = ({ onSwitchToRegister }: { onSwitchToRegister: () => void }) => {
  const handleOAuthLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">¡Bienvenido de vuelta!</h2>
        <p className="text-gray-400">Inicia sesión para continuar cargando</p>
      </div>

      {/* Botón de OAuth principal */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          onClick={handleOAuthLogin}
          className="w-full h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold text-lg rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-300"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Continuar con Manus
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-slate-900 text-gray-500">o continúa con email</span>
        </div>
      </div>

      {/* Formulario de email (deshabilitado por ahora - solo OAuth) */}
      <div className="space-y-4 opacity-50 pointer-events-none">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-300">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              className="pl-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
              disabled
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-300">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="pl-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
              disabled
            />
          </div>
        </div>

        <Button
          className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-xl"
          disabled
        >
          Iniciar sesión
        </Button>
      </div>

      <p className="text-center text-gray-400 text-sm">
        ¿No tienes cuenta?{" "}
        <button
          onClick={onSwitchToRegister}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Regístrate gratis
        </button>
      </p>
    </motion.div>
  );
};

// Formulario de registro
const RegisterForm = ({ onSwitchToLogin }: { onSwitchToLogin: () => void }) => {
  const handleOAuthRegister = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Únete a EVGreen</h2>
        <p className="text-gray-400">Crea tu cuenta y empieza a cargar</p>
      </div>

      {/* Beneficios de registro */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { icon: "⚡", text: "Carga rápida" },
          { icon: "💰", text: "Mejores precios" },
          { icon: "📍", text: "Encuentra estaciones" },
          { icon: "📊", text: "Historial completo" },
        ].map((benefit, i) => (
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

      {/* Botón de OAuth principal */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          onClick={handleOAuthRegister}
          className="w-full h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold text-lg rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-300"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Registrarse con Manus
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-slate-900 text-gray-500">o regístrate con email</span>
        </div>
      </div>

      {/* Formulario de email (deshabilitado por ahora - solo OAuth) */}
      <div className="space-y-4 opacity-50 pointer-events-none">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">Nombre</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                id="name"
                type="text"
                placeholder="Tu nombre"
                className="pl-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 rounded-xl"
                disabled
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-300">Teléfono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                id="phone"
                type="tel"
                placeholder="+57..."
                className="pl-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 rounded-xl"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-email" className="text-gray-300">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              id="reg-email"
              type="email"
              placeholder="tu@email.com"
              className="pl-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 rounded-xl"
              disabled
            />
          </div>
        </div>

        <Button
          className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-xl"
          disabled
        >
          Crear cuenta
        </Button>
      </div>

      <p className="text-center text-gray-400 text-sm">
        ¿Ya tienes cuenta?{" "}
        <button
          onClick={onSwitchToLogin}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Inicia sesión
        </button>
      </p>

      <p className="text-center text-gray-500 text-xs">
        Al registrarte, aceptas nuestros{" "}
        <a href="/terms" className="text-emerald-400 hover:underline">Términos de servicio</a>
        {" "}y{" "}
        <a href="/privacy" className="text-emerald-400 hover:underline">Política de privacidad</a>
      </p>
    </motion.div>
  );
};

// Componente principal AuthScreen
export function AuthScreen({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <AnimatedBackground />
      
      {/* Contenedor principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Botón de cerrar/volver */}
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

        {/* Card de autenticación */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl">
          <AnimatedLogo />
          
          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <LoginForm key="login" onSwitchToRegister={() => setMode("register")} />
            ) : (
              <RegisterForm key="register" onSwitchToLogin={() => setMode("login")} />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-gray-500 text-xs mt-6"
        >
          © 2026 EVGreen. Todos los derechos reservados.
        </motion.p>
      </motion.div>
    </div>
  );
}

export default AuthScreen;
