/**
 * ThankYouInvestors - Página de agradecimiento post-pago para inversionistas de EVGreen
 * 
 * Se muestra después de completar el pago de inversión.
 * Enfocada en: gratitud, visión futura, roadmap del proyecto, y próximos pasos.
 */

import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Heart,
  Zap,
  Rocket,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MapPin,
  Sun,
  Wrench,
  BarChart3,
  Users,
  Phone,
  Mail,
  MessageCircle,
  Shield,
  Clock,
  Target,
  TrendingUp,
  PartyPopper,
} from "lucide-react";

// ─── Timeline / Roadmap del proyecto ───
const ROADMAP = [
  {
    icon: CheckCircle2,
    phase: "Fase 1",
    title: "Ronda de inversión cerrada",
    description: "Capital asegurado gracias a la confianza de nuestros inversionistas.",
    status: "completed" as const,
    date: "Feb 2026",
  },
  {
    icon: MapPin,
    phase: "Fase 2",
    title: "Selección de ubicaciones",
    description: "Análisis de tráfico, alianzas comerciales y permisos para las primeras estaciones.",
    status: "current" as const,
    date: "Mar 2026",
  },
  {
    icon: Wrench,
    phase: "Fase 3",
    title: "Instalación de equipos",
    description: "Montaje de cargadores, paneles solares e integración con la plataforma EVGreen.",
    status: "upcoming" as const,
    date: "Abr - May 2026",
  },
  {
    icon: Sun,
    phase: "Fase 4",
    title: "Energía solar operativa",
    description: "Activación de los sistemas fotovoltaicos para alimentar las estaciones.",
    status: "upcoming" as const,
    date: "Jun 2026",
  },
  {
    icon: Zap,
    phase: "Fase 5",
    title: "Primeras cargas",
    description: "Apertura al público y primeras sesiones de carga. Tu inversión generando ingresos.",
    status: "upcoming" as const,
    date: "Jul 2026",
  },
  {
    icon: BarChart3,
    phase: "Fase 6",
    title: "Primer reporte de retorno",
    description: "Primer informe de rendimiento y distribución de utilidades a inversionistas.",
    status: "upcoming" as const,
    date: "Ago 2026",
  },
];

const WHAT_HAPPENS_NEXT = [
  {
    icon: Mail,
    title: "Confirmación por correo",
    description: "Recibirás un email con el resumen de tu inversión, el contrato digital y los datos de tu cuenta de inversionista.",
  },
  {
    icon: BarChart3,
    title: "Acceso al dashboard",
    description: "Tendrás acceso a un panel en tiempo real donde podrás ver el avance del proyecto, métricas y tus retornos proyectados.",
  },
  {
    icon: Calendar,
    title: "Reportes mensuales",
    description: "Cada mes recibirás un informe detallado del progreso de construcción, hitos alcanzados y proyecciones financieras.",
  },
  {
    icon: MessageCircle,
    title: "Canal directo",
    description: "Tendrás acceso a un grupo exclusivo de WhatsApp con el equipo fundador para resolver dudas y recibir actualizaciones.",
  },
];

// ─── Componentes auxiliares ───

function FloatingOrb({ delay, x, y, size, color }: { delay: number; x: string; y: string; size: number; color: string }) {
  return (
    <motion.div
      className={`absolute rounded-full ${color} blur-xl`}
      style={{ left: x, top: y, width: size, height: size }}
      animate={{
        y: [0, -20, 0],
        opacity: [0.15, 0.35, 0.15],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 5 + Math.random() * 3,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// ─── Página principal ───

export default function ThankYouInvestors() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <div className="min-h-screen bg-[#050a0e] text-white overflow-x-hidden">
      {/* ═══════════════════════════════════════════
          HERO - Agradecimiento principal
          ═══════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background abstracto */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0a2e1a_0%,_#050a0e_60%)]" />
          <FloatingOrb delay={0} x="5%" y="15%" size={300} color="bg-green-500/10" />
          <FloatingOrb delay={1.5} x="70%" y="10%" size={250} color="bg-emerald-500/8" />
          <FloatingOrb delay={3} x="40%" y="60%" size={200} color="bg-teal-500/6" />
          <FloatingOrb delay={0.8} x="85%" y="55%" size={180} color="bg-green-400/5" />
        </div>

        {/* Líneas decorativas */}
        <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-green-400 to-transparent" />
          <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-green-400 to-transparent" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-green-400 to-transparent" />
        </div>

        {/* Contenido */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          {/* Confetti icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.5 }}
            className="mb-6"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center">
              <PartyPopper className="w-10 h-10 text-green-400" />
            </div>
          </motion.div>

          {/* Logo */}
          <motion.img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/gekxZzGAUtRrZBzW.png"
            alt="EVGreen"
            className="h-16 sm:h-20 md:h-24 w-auto mx-auto mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400">
              Gracias
            </span>
            <br />
            por ser parte de esto
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            Tu inversión acaba de hacer historia. Eres uno de los primeros en apostar por la revolución 
            de la movilidad eléctrica en Colombia. Lo que viene es extraordinario.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium"
          >
            <CheckCircle2 className="w-4 h-4" />
            Pago confirmado exitosamente
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-16"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="text-white/20 text-sm flex flex-col items-center gap-2"
            >
              <span>Descubre lo que viene</span>
              <ArrowRight className="w-4 h-4 rotate-90" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════
          MENSAJE PERSONAL DEL FUNDADOR
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-b from-[#050a0e] to-[#0a1a12]">
        <div className="container mx-auto px-4 max-w-3xl">
          <MessageSection />
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          QUÉ PASA AHORA - Próximos pasos inmediatos
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-b from-[#0a1a12] to-[#050a0e]">
        <div className="container mx-auto px-4">
          <NextStepsSection />
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          ROADMAP - Timeline del proyecto
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-b from-[#050a0e] to-[#0a1a12]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/5 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative z-10">
          <RoadmapSection />
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TU INVERSIÓN EN NÚMEROS
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-b from-[#0a1a12] to-[#050a0e]">
        <div className="container mx-auto px-4">
          <VisionSection />
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA FINAL - Contacto y comunidad
          ═══════════════════════════════════════════ */}
      <section className="relative py-32 bg-gradient-to-b from-[#050a0e] to-black overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-green-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <FinalCTA />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 bg-black">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/gekxZzGAUtRrZBzW.png"
              alt="EVGreen"
              className="h-8 w-auto"
            />
            <span className="text-white/30 text-sm">2026 EVGreen. Todos los derechos reservados.</span>
          </div>
          <a
            href="https://wa.me/573054124009"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 text-sm hover:text-green-400 transition-colors"
          >
            Contacto
          </a>
        </div>
      </footer>
    </div>
  );
}

// ─── Sección: Mensaje del fundador ───

function MessageSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8 }}
      className="relative"
    >
      <div className="absolute -top-4 -left-4 text-green-500/10 text-8xl font-serif">"</div>
      <div className="relative p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5">
        <Heart className="w-8 h-8 text-green-400 mb-6" />
        
        <p className="text-white/70 text-lg sm:text-xl leading-relaxed mb-6">
          Cuando empezamos EVGreen, muchos nos dijeron que era muy pronto para Colombia. 
          Que la infraestructura de carga no tenía mercado. Que los vehículos eléctricos eran cosa del futuro.
        </p>
        <p className="text-white/70 text-lg sm:text-xl leading-relaxed mb-6">
          <span className="text-white font-semibold">Ustedes demostraron lo contrario.</span> Con su inversión, 
          no solo están financiando estaciones de carga — están construyendo la columna vertebral de la 
          movilidad sostenible en nuestro país.
        </p>
        <p className="text-white/70 text-lg sm:text-xl leading-relaxed mb-8">
          Cada peso invertido se convertirá en kilowatts de energía limpia, en empleos, en tecnología 
          de punta y en un retorno que refleje el valor de su visión. 
          <span className="text-green-400 font-semibold"> Esto apenas comienza.</span>
        </p>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">EV</span>
          </div>
          <div>
            <p className="text-white font-semibold">Equipo Fundador</p>
            <p className="text-white/40 text-sm">EVGreen Colombia</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sección: Qué pasa ahora ───

function NextStepsSection() {
  const titleRef = useRef(null);
  const isTitleInView = useInView(titleRef, { once: true, margin: "-100px" });

  return (
    <>
      <motion.div
        ref={titleRef}
        initial={{ opacity: 0, y: 40 }}
        animate={isTitleInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-green-500/10 text-green-400 border border-green-500/20 mb-6">
          Próximos pasos
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          ¿Qué pasa{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
            ahora?
          </span>
        </h2>
        <p className="text-white/40 text-lg max-w-2xl mx-auto">
          Estas son las acciones inmediatas que sucederán después de tu inversión.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {WHAT_HAPPENS_NEXT.map((item, i) => {
          const ref = useRef(null);
          const isInView = useInView(ref, { once: true, margin: "-50px" });
          return (
            <motion.div
              key={i}
              ref={ref}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-green-500/20 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <item.icon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base mb-1.5">{item.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
              {/* Número de paso */}
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="text-green-400 text-xs font-bold">{i + 1}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

// ─── Sección: Roadmap ───

function RoadmapSection() {
  const titleRef = useRef(null);
  const isTitleInView = useInView(titleRef, { once: true, margin: "-100px" });

  return (
    <>
      <motion.div
        ref={titleRef}
        initial={{ opacity: 0, y: 40 }}
        animate={isTitleInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-green-500/10 text-green-400 border border-green-500/20 mb-6">
          Hoja de ruta
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          El camino hacia las{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
            primeras estaciones
          </span>
        </h2>
        <p className="text-white/40 text-lg max-w-2xl mx-auto">
          Cada fase nos acerca más a encender la primera estación de carga alimentada por tu inversión.
        </p>
      </motion.div>

      {/* Timeline vertical */}
      <div className="max-w-2xl mx-auto relative">
        {/* Línea central */}
        <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-green-500/30 via-green-500/10 to-transparent" />

        {ROADMAP.map((item, i) => {
          const ref = useRef(null);
          const isInView = useInView(ref, { once: true, margin: "-50px" });
          const isCompleted = item.status === "completed";
          const isCurrent = item.status === "current";

          return (
            <motion.div
              key={i}
              ref={ref}
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="relative pl-16 sm:pl-20 pb-10 last:pb-0"
            >
              {/* Nodo del timeline */}
              <div className={`absolute left-3.5 sm:left-5.5 w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${isCompleted 
                  ? "bg-green-500 border-green-500 shadow-lg shadow-green-500/30" 
                  : isCurrent 
                    ? "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20" 
                    : "bg-slate-800 border-white/10"
                }`}
              >
                {isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                {isCurrent && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-green-400"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Contenido */}
              <div className={`p-5 rounded-xl transition-all ${
                isCompleted 
                  ? "bg-green-500/5 border border-green-500/15" 
                  : isCurrent 
                    ? "bg-green-500/5 border border-green-500/20 shadow-lg shadow-green-500/5" 
                    : "bg-white/[0.02] border border-white/5"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <item.icon className={`w-4 h-4 ${isCompleted || isCurrent ? "text-green-400" : "text-white/30"}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${
                      isCompleted || isCurrent ? "text-green-400" : "text-white/30"
                    }`}>
                      {item.phase}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase">
                        En curso
                      </span>
                    )}
                    {isCompleted && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase">
                        Completado
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${isCompleted || isCurrent ? "text-white/50" : "text-white/20"}`}>
                    {item.date}
                  </span>
                </div>
                <h3 className={`font-bold text-base mb-1 ${isCompleted || isCurrent ? "text-white" : "text-white/50"}`}>
                  {item.title}
                </h3>
                <p className={`text-sm leading-relaxed ${isCompleted || isCurrent ? "text-white/50" : "text-white/25"}`}>
                  {item.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

// ─── Sección: Tu inversión (visión) ───

function VisionSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const visionItems = [
    { icon: Target, title: "Tu inversión construirá", items: ["Estaciones de carga rápida y ultra-rápida", "Sistemas de energía solar integrados", "Tecnología OCPP 2.0.1 de última generación", "Infraestructura para el futuro de Colombia"] },
    { icon: TrendingUp, title: "Lo que recibirás", items: ["Dashboard en tiempo real de tu inversión", "Reportes mensuales de avance y finanzas", "Distribución de utilidades operativas", "Acceso prioritario a futuras rondas"] },
  ];

  return (
    <>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-green-500/10 text-green-400 border border-green-500/20 mb-6">
          Tu inversión
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          En qué se convierte tu{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
            capital
          </span>
        </h2>
        <p className="text-white/40 text-lg max-w-2xl mx-auto">
          Cada peso invertido tiene un destino claro y un propósito transformador.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {visionItems.map((section, i) => {
          const itemRef = useRef(null);
          const isItemInView = useInView(itemRef, { once: true, margin: "-50px" });
          return (
            <motion.div
              key={i}
              ref={itemRef}
              initial={{ opacity: 0, y: 30 }}
              animate={isItemInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="p-8 rounded-2xl bg-white/[0.02] border border-white/5"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/15 flex items-center justify-center mb-5">
                <section.icon className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-white font-bold text-xl mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    <span className="text-white/50 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

// ─── CTA Final ───

function FinalCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="text-center max-w-3xl mx-auto"
    >
      <Sparkles className="w-10 h-10 text-green-400 mx-auto mb-6" />

      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
        Bienvenido a la{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
          familia EVGreen
        </span>
      </h2>

      <p className="text-white/40 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
        Estamos construyendo algo que trasciende. Gracias por confiar en nosotros. 
        Cualquier duda, estamos a un mensaje de distancia.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a
          href="https://wa.me/573054124009?text=Hola%20EVGreen%2C%20acabo%20de%20invertir%20y%20quiero%20saber%20los%20pr%C3%B3ximos%20pasos."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold text-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
        >
          <MessageCircle className="w-5 h-5" />
          Escribir al equipo
        </a>
        <a
          href="mailto:admin@greenhproject.com"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/10 text-white/70 font-semibold text-lg hover:border-green-500/30 hover:text-white transition-all"
        >
          <Mail className="w-5 h-5" />
          admin@greenhproject.com
        </a>
      </div>

      {/* Badges de confianza */}
      <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-white/20 text-sm">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Inversión protegida</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Reportes mensuales</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>Comunidad exclusiva</span>
        </div>
      </div>
    </motion.div>
  );
}
