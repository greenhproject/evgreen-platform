/**
 * ThankYouInvestors - Página de agradecimiento a las personas que invirtieron en EVGreen
 * 
 * Página pública, moderna y estética que reconoce a quienes creyeron en el proyecto.
 */

import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "wouter";
import {
  Heart,
  Zap,
  TrendingUp,
  Users,
  Leaf,
  Star,
  ChevronDown,
  ArrowRight,
  Globe,
  Battery,
  Sun,
  Shield,
  Sparkles,
} from "lucide-react";

// ─── Datos de inversionistas / participantes ───
const INVESTORS = [
  { name: "Carlos Mendoza", role: "Inversionista Fundador", message: "Creo en un futuro eléctrico para Colombia." },
  { name: "María Fernanda López", role: "Inversionista Estratégica", message: "La movilidad sostenible es el camino." },
  { name: "Andrés Gutiérrez", role: "Inversionista Pionero", message: "EVGreen transformará la infraestructura del país." },
  { name: "Valentina Ríos", role: "Inversionista Visionaria", message: "Invertir en energía limpia es invertir en nuestros hijos." },
  { name: "Santiago Herrera", role: "Inversionista Colectivo", message: "Juntos construimos la red de carga más grande." },
  { name: "Camila Vargas", role: "Inversionista Fundadora", message: "El futuro de la movilidad empieza hoy." },
  { name: "Juan Pablo Morales", role: "Inversionista Estratégico", message: "Colombia necesita esta infraestructura." },
  { name: "Isabella Torres", role: "Inversionista Pionera", message: "Cada estación es un paso hacia la sostenibilidad." },
];

const MILESTONES = [
  { icon: Zap, value: "12+", label: "Estaciones de carga", description: "Desplegadas en ciudades principales" },
  { icon: Users, value: "8", label: "Inversionistas", description: "Que creyeron desde el inicio" },
  { icon: Battery, value: "480kW", label: "Potencia instalada", description: "De carga rápida y ultra-rápida" },
  { icon: Leaf, value: "100%", label: "Energía renovable", description: "Alimentadas con energía solar" },
];

const VALUES = [
  { icon: Globe, title: "Impacto Ambiental", text: "Cada kWh entregado reduce la huella de carbono de Colombia. Nuestros inversionistas hacen posible un futuro más limpio." },
  { icon: TrendingUp, title: "Retorno Sostenible", text: "Un modelo de negocio que genera valor económico mientras transforma la infraestructura de movilidad del país." },
  { icon: Shield, title: "Confianza", text: "Transparencia total con dashboards en tiempo real, reportes mensuales y comunicación directa con cada inversionista." },
  { icon: Sun, title: "Innovación", text: "Tecnología OCPP 2.0.1, inteligencia artificial y energía solar integrada en cada estación de carga." },
];

// ─── Componentes auxiliares ───

function FloatingParticle({ delay, x, y, size }: { delay: number; x: string; y: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-green-400/20"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{
        y: [0, -30, 0],
        opacity: [0.2, 0.6, 0.2],
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration: 4 + Math.random() * 3,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

function SectionTitle({ badge, title, highlight, subtitle }: { badge: string; title: string; highlight: string; subtitle: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="text-center mb-16"
    >
      <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-green-500/10 text-green-400 border border-green-500/20 mb-6">
        {badge}
      </span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
        {title}{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
          {highlight}
        </span>
      </h2>
      <p className="text-white/50 text-lg max-w-2xl mx-auto">{subtitle}</p>
    </motion.div>
  );
}

// ─── Página principal ───

export default function ThankYouInvestors() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ═══════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background con parallax */}
        <motion.div style={{ y: heroY }} className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/sOPbWyPYFdNwEqfF.jpg)`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/40 to-transparent" />
        </motion.div>

        {/* Partículas flotantes */}
        <FloatingParticle delay={0} x="10%" y="20%" size={6} />
        <FloatingParticle delay={1.2} x="80%" y="30%" size={8} />
        <FloatingParticle delay={0.6} x="50%" y="60%" size={5} />
        <FloatingParticle delay={2} x="25%" y="70%" size={7} />
        <FloatingParticle delay={0.8} x="70%" y="15%" size={4} />
        <FloatingParticle delay={1.5} x="90%" y="50%" size={6} />

        {/* Contenido del hero */}
        <motion.div style={{ opacity: heroOpacity }} className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          {/* Logo */}
          <motion.img
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/gekxZzGAUtRrZBzW.png"
            alt="EVGreen"
            className="h-20 sm:h-28 md:h-36 w-auto mx-auto mb-8"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 mb-8">
              <Heart className="w-4 h-4" />
              Gracias por creer en nosotros
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          >
            A quienes hacen{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400">
              posible
            </span>
            <br />
            el futuro eléctrico
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-lg sm:text-xl text-white/50 max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            Cada estación de carga que encendemos, cada vehículo que se conecta, cada gramo de CO₂ que dejamos de emitir
            es gracias a la visión y confianza de nuestros inversionistas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex items-center justify-center gap-4"
          >
            <a
              href="#inversionistas"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold text-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
            >
              Conoce a nuestros inversionistas
              <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="w-6 h-6 text-white/30" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════
          SECCIÓN DE IMPACTO / MÉTRICAS
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-b from-black via-slate-950 to-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <SectionTitle
            badge="Impacto Colectivo"
            title="Lo que hemos"
            highlight="construido juntos"
            subtitle="Cada número representa el compromiso de personas que decidieron ser parte del cambio."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {MILESTONES.map((m, i) => {
              const ref = useRef(null);
              const isInView = useInView(ref, { once: true, margin: "-50px" });
              return (
                <motion.div
                  key={i}
                  ref={ref}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="text-center group"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <m.icon className="w-7 h-7 text-green-400" />
                  </div>
                  <p className="text-3xl sm:text-4xl font-bold text-white mb-1">{m.value}</p>
                  <p className="text-green-400 font-semibold text-sm mb-1">{m.label}</p>
                  <p className="text-white/40 text-xs">{m.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          MURO DE INVERSIONISTAS
          ═══════════════════════════════════════════ */}
      <section id="inversionistas" className="relative py-24 bg-gradient-to-b from-black to-slate-950">
        <div className="container mx-auto px-4">
          <SectionTitle
            badge="Nuestros Inversionistas"
            title="Las personas detrás del"
            highlight="movimiento"
            subtitle="Visionarios que apostaron por la movilidad eléctrica en Colombia cuando nadie más lo hacía."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {INVESTORS.map((investor, i) => {
              const ref = useRef(null);
              const isInView = useInView(ref, { once: true, margin: "-50px" });
              return (
                <motion.div
                  key={i}
                  ref={ref}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="group relative"
                >
                  <div className="relative p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-white/5 hover:border-green-500/30 transition-all duration-500 overflow-hidden h-full">
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-emerald-500/0 group-hover:from-green-500/5 group-hover:to-emerald-500/5 transition-all duration-500" />
                    
                    <div className="relative z-10">
                      {/* Avatar con iniciales */}
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-green-500/20 group-hover:shadow-green-500/40 transition-shadow">
                        <span className="text-white font-bold text-lg">
                          {investor.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </span>
                      </div>

                      <h3 className="text-white font-bold text-lg mb-1">{investor.name}</h3>
                      <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">{investor.role}</p>
                      
                      <div className="relative pl-4 border-l-2 border-green-500/30">
                        <p className="text-white/50 text-sm italic leading-relaxed">"{investor.message}"</p>
                      </div>

                      {/* Star badge */}
                      <div className="mt-4 flex items-center gap-1">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} className="w-3 h-3 text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          VALORES / POR QUÉ INVERTIR
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-b from-slate-950 to-black">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative z-10">
          <SectionTitle
            badge="Nuestra Promesa"
            title="Lo que nos"
            highlight="une"
            subtitle="Los pilares que guían cada decisión y cada estación que construimos."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {VALUES.map((v, i) => {
              const ref = useRef(null);
              const isInView = useInView(ref, { once: true, margin: "-50px" });
              return (
                <motion.div
                  key={i}
                  ref={ref}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.7, delay: i * 0.15 }}
                  className="flex gap-5 p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-green-500/20 transition-all group"
                >
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <v.icon className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg mb-2">{v.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{v.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          GALERÍA DE ESTACIONES
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-b from-black to-slate-950">
        <div className="container mx-auto px-4">
          <SectionTitle
            badge="Infraestructura"
            title="Estaciones que"
            highlight="inspiran"
            subtitle="Tecnología de clase mundial desplegada en las principales ciudades de Colombia."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                img: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/sOPbWyPYFdNwEqfF.jpg",
                title: "Estación Premium",
                desc: "Carga ultra-rápida con diseño arquitectónico",
              },
              {
                img: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/SUPdAshzUAPYhNBL.jpg",
                title: "Hub de Carga",
                desc: "Múltiples puntos de carga simultánea",
              },
              {
                img: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/HxgNIRcRdLtrKtZw.jpg",
                title: "Red Nocturna",
                desc: "Operación 24/7 con iluminación inteligente",
              },
            ].map((item, i) => {
              const ref = useRef(null);
              const isInView = useInView(ref, { once: true, margin: "-50px" });
              return (
                <motion.div
                  key={i}
                  ref={ref}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.7, delay: i * 0.2 }}
                  className="group relative rounded-2xl overflow-hidden aspect-[4/3]"
                >
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-white font-bold text-lg mb-1">{item.title}</h3>
                    <p className="text-white/50 text-sm">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          MENSAJE FINAL / CTA
          ═══════════════════════════════════════════ */}
      <section className="relative py-32 bg-gradient-to-b from-slate-950 to-black overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Sparkles className="w-10 h-10 text-green-400 mx-auto mb-6" />
            
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Gracias por ser parte de la{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                revolución eléctrica
              </span>
            </h2>

            <p className="text-white/40 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Cada inversión no es solo capital, es una declaración de fe en un futuro más limpio, 
              más inteligente y más sostenible para Colombia y el mundo.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/investors"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold text-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
              >
                Quiero invertir
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="https://wa.me/573054124009?text=Hola%20EVGreen%2C%20quiero%20saber%20m%C3%A1s%20sobre%20c%C3%B3mo%20invertir."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/10 text-white/70 font-semibold text-lg hover:border-green-500/30 hover:text-white transition-all"
              >
                Hablar con el equipo
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════ */}
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
          <div className="flex items-center gap-6">
            <Link href="/landing" className="text-white/30 text-sm hover:text-green-400 transition-colors">
              Inicio
            </Link>
            <Link href="/investors" className="text-white/30 text-sm hover:text-green-400 transition-colors">
              Invertir
            </Link>
            <a
              href="https://wa.me/573054124009"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 text-sm hover:text-green-400 transition-colors"
            >
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
