/**
 * EVGreen SaaS - Landing Page Comercial
 * Página profesional para venta de licencias de la plataforma
 * Modelo: Setup + Renovación anual + Transaction Fee + Soporte opcional
 * @author Green House Project
 */
import { Button } from "@/components/ui/button";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  Zap,
  Server,
  Shield,
  Globe,
  Users,
  BarChart3,
  Headphones,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Building2,
  Plug,
  Network,
  Smartphone,
  Brain,
  Receipt,
  ChevronDown,
  ChevronUp,
  Star,
  TrendingUp,
  DollarSign,
  Lock,
  Wrench,
  MessageSquare,
} from "lucide-react";

// Animated counter component
function Counter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const hasAnimated = useRef(false);

  if (isInView && !hasAnimated.current) {
    hasAnimated.current = true;
    const duration = 1500;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
  }

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count}{suffix}
    </span>
  );
}

// FAQ Accordion item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-medium text-foreground pr-4">{question}</span>
        {open ? <ChevronUp className="w-5 h-5 text-primary shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function SaaSLanding() {
  const [billingPeriod] = useState<"monthly" | "annual">("annual");

  const plans = [
    {
      name: "Starter",
      description: "Ideal para empezar con hasta 10 cargadores",
      setup: 500,
      annual: 125,
      fee: 5,
      feeNetwork: 4,
      support: 20,
      features: [
        "Hasta 10 cargadores",
        "CSMS completo (OCPP 1.6/2.0)",
        "App EVGreen compartida",
        "Dashboard de administración",
        "EVGreen Network (obligatorio)",
        "Co-branded (logo EVGreen)",
        "Subdominio empresa.evgreen.lat",
        "IA básica (chatbot)",
        "API de lectura",
        "SLA 99% uptime",
      ],
      highlight: false,
      cta: "Comenzar",
    },
    {
      name: "Professional",
      description: "Para operadores en crecimiento con marca propia",
      setup: 750,
      annual: 200,
      fee: 4,
      feeNetwork: 3,
      support: 18,
      features: [
        "Hasta 50 cargadores",
        "CSMS completo (OCPP 1.6/2.0)",
        "App EVGreen compartida",
        "Dashboard completo",
        "EVGreen Network o red propia",
        "Marca custom (colores + logo)",
        "Subdominio o dominio propio",
        "IA completa (pricing dinámico)",
        "API lectura + escritura",
        "SLA 99.5% uptime",
        "Facturación propia opcional",
        "Reportes avanzados",
      ],
      highlight: true,
      cta: "Elegir Professional",
    },
    {
      name: "Enterprise",
      description: "White-label completo para grandes operadores",
      setup: 1200,
      annual: 350,
      fee: 3,
      feeNetwork: 2,
      support: 15,
      features: [
        "Cargadores ilimitados",
        "CSMS completo (OCPP 1.6/2.0)",
        "App móvil branded propia",
        "Dashboard personalizado",
        "Red propia o EVGreen Network",
        "100% White-label",
        "Dominio propio",
        "IA completa + personalizada",
        "API completa + webhooks",
        "SLA 99.9% uptime",
        "Facturación con NIT propio",
        "Soporte dedicado",
      ],
      highlight: false,
      cta: "Contactar ventas",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center justify-between h-16 px-4">
          <Link href="/landing" className="flex items-center gap-2">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/GGDXOuWzwOqcapbY.png"
              alt="EVGreen"
              className="h-8 w-auto"
            />
            <span className="font-semibold text-sm text-muted-foreground">for Business</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#planes" className="text-muted-foreground hover:text-foreground transition-colors">Planes</a>
            <a href="#red" className="text-muted-foreground hover:text-foreground transition-colors">EVGreen Network</a>
            <a href="#soporte" className="text-muted-foreground hover:text-foreground transition-colors">Soporte</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
          <Button size="sm" className="gradient-primary text-white">
            <MessageSquare className="w-4 h-4 mr-1" />
            Solicitar demo
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />

        <div className="container relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Plataforma de Carga como Servicio (CPaaS)
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Opera tu red de carga
            <br />
            <span className="text-primary">sin desarrollar tecnología</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10"
          >
            Licencia nuestra plataforma probada en producción. OCPP, pasarela de pagos, app móvil, 
            monitoreo en tiempo real e IA — todo listo para operar desde el día uno.
            <span className="text-foreground font-medium"> Solo pagas cuando generas ingresos.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Button size="lg" className="gradient-primary text-white px-8 py-6 text-lg rounded-xl shadow-glow">
              <Building2 className="w-5 h-5 mr-2" />
              Solicitar demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-xl border-2">
              Ver planes y precios
              <ChevronDown className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>

          {/* Trust metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto"
          >
            {[
              { value: 9, suffix: "+", label: "Estaciones activas" },
              { value: 1200, suffix: "+", label: "Transacciones procesadas" },
              { value: 99, suffix: "%", label: "Uptime plataforma" },
              { value: 24, suffix: "/7", label: "Monitoreo OCPP" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary">
                  <Counter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What's included */}
      <section className="py-20 px-4 border-t border-border/30">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Todo lo que necesitas para operar</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Una plataforma completa que reemplaza 6+ herramientas separadas. Sin servidores que mantener, sin equipo de desarrollo.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Plug, title: "CSMS Completo", desc: "Protocolo OCPP 1.6J y 2.0.1. Comunicación bidireccional en tiempo real con cualquier cargador compatible." },
              { icon: Smartphone, title: "App Móvil", desc: "App para usuarios finales con mapa, pagos, QR, reservas y notificaciones. Lista para usar desde el día uno." },
              { icon: DollarSign, title: "Pasarela de Pagos", desc: "Wompi integrado. Billetera digital, tarjetas de crédito, recarga automática. PCI-DSS compliant." },
              { icon: Brain, title: "Inteligencia Artificial", desc: "Pricing dinámico, predicción de demanda, asistente conversacional. La única plataforma LATAM con IA nativa." },
              { icon: BarChart3, title: "Dashboard en Tiempo Real", desc: "Monitoreo de estaciones, transacciones, ingresos, alertas. Reportes exportables en Excel y PDF." },
              { icon: Shield, title: "Seguridad Enterprise", desc: "Cifrado end-to-end, backups automáticos, auditoría completa. Infraestructura cloud con 99%+ uptime." },
              { icon: Receipt, title: "Facturación Electrónica", desc: "Integración con DIAN/Alegra. Facturación automática por transacción o consolidada mensual." },
              { icon: Wrench, title: "Mantenimiento Predictivo", desc: "Alertas automáticas de fallas, scheduling de preventivos, reportes de salud de cargadores." },
              { icon: Globe, title: "Multi-idioma y Multi-moneda", desc: "Soporte para COP y USD. Preparado para expansión regional en LATAM." },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl border border-border/50 hover:border-primary/30 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planes" className="py-20 px-4 bg-muted/20 border-t border-border/30">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Planes transparentes, sin sorpresas</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Setup por cargador + renovación anual + porcentaje por transacción. Solo pagas más cuando generas más ingresos.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-4">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl p-6 lg:p-8 border ${
                  plan.highlight
                    ? "border-primary bg-gradient-to-b from-primary/5 to-transparent shadow-lg shadow-primary/10"
                    : "border-border/50 bg-card"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    Más popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Pricing breakdown */}
                <div className="space-y-3 mb-6 pb-6 border-b border-border/50">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Setup (por cargador)</span>
                    <span className="text-lg font-bold">${plan.setup} <span className="text-xs text-muted-foreground">USD</span></span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Renovación anual</span>
                    <span className="text-lg font-bold">${plan.annual} <span className="text-xs text-muted-foreground">USD/cargador</span></span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Transaction fee</span>
                    <span className="text-lg font-bold">{plan.fee}%</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">En EVGreen Network</span>
                    <span className="text-lg font-bold text-primary">{plan.feeNetwork}% <span className="text-xs text-muted-foreground">(-1%)</span></span>
                  </div>
                  <div className="flex items-baseline justify-between pt-2 border-t border-dashed border-border/50">
                    <span className="text-sm text-muted-foreground">Con soporte integral</span>
                    <span className="text-lg font-bold text-amber-500">{plan.support}% <span className="text-xs text-muted-foreground">(incluye fee)</span></span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full py-5 rounded-xl ${
                    plan.highlight ? "gradient-primary text-white shadow-glow-sm" : ""
                  }`}
                  variant={plan.highlight ? "default" : "outline"}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Fee justification */}
          <div className="mt-12 p-6 rounded-2xl border border-border/50 bg-card max-w-3xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-2">¿Por qué un % por transacción?</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Solo pagas cuando ganas.</strong> De ese {plans[0].fee}%, aproximadamente 2.5% se va en la pasarela de pagos (Wompi). 
                  El resto cubre infraestructura cloud 24/7, protocolo OCPP, app móvil, IA, actualizaciones continuas y seguridad. 
                  Si lo hicieras por tu cuenta, gastarías entre <strong className="text-foreground">$6,000 y $20,000 USD/mes</strong> en costos fijos — 
                  con EVGreen pagas desde <strong className="text-primary">$360 USD/mes</strong> (5 cargadores, 10 cargas/día).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EVGreen Network Section */}
      <section id="red" className="py-20 px-4 border-t border-border/30">
        <div className="container max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Network className="w-4 h-4" />
                Efecto de red
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Únete a la EVGreen Network y recibe usuarios desde el día uno
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Cuando te unes a la red, tus cargadores aparecen en nuestra app con miles de usuarios activos. 
                No necesitas invertir en marketing ni construir una base de clientes desde cero. 
                Además, obtienes un <strong className="text-foreground">descuento de 1%</strong> en el transaction fee.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Users, text: "Acceso a base de usuarios existente desde el día 1" },
                  { icon: Globe, text: "Visibilidad en mapa público (app + web + Google Maps)" },
                  { icon: DollarSign, text: "-1% de descuento en transaction fee por pertenecer" },
                  { icon: TrendingUp, text: "Roaming revenue: gana cuando tus usuarios cargan en otras estaciones" },
                  { icon: Star, text: "Marketing compartido: push notifications a usuarios cercanos" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Network visualization */}
            <div className="relative">
              <div className="rounded-2xl border border-border/50 p-8 bg-gradient-to-br from-primary/5 to-transparent">
                <h4 className="font-semibold mb-6 text-center">Modelo de Roaming</h4>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-card border border-border/50">
                    <div className="text-xs text-muted-foreground mb-2">Usuario de Empresa A carga en estación de Empresa B</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Empresa B (dueño estación)</span>
                        <span className="font-bold text-primary">80%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "80%" }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">EVGreen (plataforma)</span>
                        <span className="font-bold">15%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: "15%" }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Empresa A (referencia)</span>
                        <span className="font-bold text-amber-500">5%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "5%" }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Todos ganan. Más miembros = más usuarios = más transacciones para todos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section id="soporte" className="py-20 px-4 bg-muted/20 border-t border-border/30">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Soporte: tú decides el nivel</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Siempre tienes la plataforma de tickets. Elige si quieres que EVGreen atienda a tus clientes o si prefieres hacerlo tú.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Without support */}
            <div className="rounded-2xl border border-border/50 p-8 bg-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold">Autogestión</h3>
                  <p className="text-sm text-muted-foreground">Solo fee de plataforma</p>
                </div>
              </div>
              <div className="text-3xl font-bold mb-6">
                5% <span className="text-lg text-muted-foreground font-normal">por transacción</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Plataforma de tickets incluida",
                  "Tú atiendes a tus clientes",
                  "Tú coordinas mantenimiento",
                  "Dashboard de monitoreo en tiempo real",
                  "Soporte L3 (plataforma) siempre incluido",
                  "Ideal si ya tienes equipo técnico",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* With support */}
            <div className="rounded-2xl border border-primary/30 p-8 bg-gradient-to-b from-primary/5 to-transparent relative">
              <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                Recomendado
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Soporte Integral</h3>
                  <p className="text-sm text-muted-foreground">Todo incluido, tú solo cobras</p>
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">
                20% <span className="text-lg text-muted-foreground font-normal">por transacción</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6">(ya incluye el fee de plataforma)</p>
              <ul className="space-y-3">
                {[
                  "EVGreen atiende a tus usuarios (L1)",
                  "Técnicos en campo para preventivo y correctivo (L2)",
                  "Mantenimiento preventivo programado",
                  "SLA de respuesta 4h-24h",
                  "Reportes mensuales de salud",
                  "Calificación de ingenieros (estrellas)",
                  "Escalación L3 incluida",
                  "Ideal si quieres operar sin equipo propio",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison vs doing it alone */}
      <section className="py-20 px-4 border-t border-border/30">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">EVGreen vs. hacerlo por tu cuenta</h2>
            <p className="text-muted-foreground">
              Compara el costo real de operar con y sin nuestra plataforma
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 overflow-hidden">
            <div className="grid grid-cols-3 bg-muted/50 p-4 text-sm font-semibold border-b border-border/50">
              <div>Componente</div>
              <div className="text-center">Por tu cuenta</div>
              <div className="text-center text-primary">Con EVGreen</div>
            </div>
            {[
              { item: "Pasarela de pagos", alone: "2.5-3.5%/tx", evgreen: "Incluido" },
              { item: "Infraestructura cloud", alone: "$200-500/mes", evgreen: "Incluido" },
              { item: "CSMS (OCPP)", alone: "$500-2,000/mes", evgreen: "Incluido" },
              { item: "App móvil", alone: "$1,000-3,000/mes", evgreen: "Incluido" },
              { item: "Equipo de desarrollo", alone: "$3,000-10,000/mes", evgreen: "Incluido" },
              { item: "Seguridad/PCI-DSS", alone: "$500-1,500/mes", evgreen: "Incluido" },
              { item: "IA y analytics", alone: "$500-2,000/mes", evgreen: "Incluido" },
              { item: "TOTAL MENSUAL", alone: "$6,300-19,800", evgreen: "Desde $360" },
            ].map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 p-4 text-sm ${
                  i === 7 ? "bg-primary/5 font-bold border-t-2 border-primary/20" : "border-b border-border/30"
                }`}
              >
                <div>{row.item}</div>
                <div className="text-center text-muted-foreground">{row.alone}</div>
                <div className={`text-center ${i === 7 ? "text-primary" : "text-primary"}`}>{row.evgreen}</div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            * Basado en 5 cargadores con 10 cargas/día promedio a $25,000 COP. Fee de 5% = ~$360 USD/mes.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 bg-muted/20 border-t border-border/30">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Preguntas frecuentes</h2>
          </div>

          <div className="space-y-3">
            <FAQItem
              question="¿Qué cargadores son compatibles?"
              answer="Cualquier cargador que soporte el protocolo OCPP 1.6J o OCPP 2.0.1. Esto incluye las marcas más populares: ABB, Schneider, Wallbox, BYD, Autel, y muchos más. Si tu cargador tiene OCPP, funciona con EVGreen."
            />
            <FAQItem
              question="¿Puedo empezar con 1 cargador y crecer después?"
              answer="Sí. El plan Starter permite hasta 10 cargadores. Puedes empezar con 1 y agregar más en cualquier momento pagando solo el setup del nuevo cargador ($500 USD). No hay penalidad por crecer gradualmente."
            />
            <FAQItem
              question="¿El 20% de soporte incluye el 5% de plataforma?"
              answer="Sí. Si contratas soporte integral, pagas 20% total por transacción (no 25%). De ese 20%, EVGreen destina ~5% a infraestructura y ~15% a cubrir el servicio de soporte técnico y atención al cliente."
            />
            <FAQItem
              question="¿Qué pasa si no tengo transacciones un mes?"
              answer="Solo pagas un fee mínimo de $25 USD/cargador/mes para cubrir costos de infraestructura base (monitoreo, OCPP, backups). Si tus transacciones superan ese mínimo, pagas el porcentaje normal."
            />
            <FAQItem
              question="¿Puedo usar mi propia marca (white-label)?"
              answer="Sí. En el plan Professional puedes personalizar colores y logo. En Enterprise obtienes white-label completo: sin mención a EVGreen, dominio propio, app branded en stores, y emails con tu marca."
            />
            <FAQItem
              question="¿Qué es la EVGreen Network y por qué me conviene?"
              answer="Es la red compartida de estaciones visibles en la app EVGreen. Al unirte, tus cargadores reciben usuarios que ya tienen la app y billetera cargada — tráfico orgánico sin costo de adquisición. Además obtienes -1% de descuento en el fee."
            />
            <FAQItem
              question="¿Los precios son negociables?"
              answer="Los precios base son los publicados, pero para operaciones de más de 20 cargadores o contratos multi-año ofrecemos descuentos por volumen. Contáctanos para una cotización personalizada."
            />
            <FAQItem
              question="¿Cuánto tarda el onboarding?"
              answer="Típicamente 1-2 semanas desde la firma del contrato hasta tener tu primer cargador operando en la plataforma. Incluye configuración, personalización de marca, capacitación y pruebas."
            />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 border-t border-border/30">
        <div className="container max-w-3xl mx-auto text-center">
          <div className="rounded-2xl p-10 sm:p-14 gradient-primary relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                ¿Listo para operar tu red de carga?
              </h2>
              <p className="text-white/80 mb-8 max-w-xl mx-auto">
                Agenda una demo personalizada. Te mostramos la plataforma funcionando con tus cargadores en menos de 30 minutos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg rounded-xl">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Agendar demo
                </Button>
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl">
                  Descargar brochure
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border/50">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/GGDXOuWzwOqcapbY.png"
                alt="EVGreen"
                className="h-10 w-auto object-contain"
              />
              <span className="text-muted-foreground text-sm">for Business — by Green House Project</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/landing" className="hover:text-foreground transition-colors">Usuarios</Link>
              <Link href="/investors" className="hover:text-foreground transition-colors">Inversionistas</Link>
              <a href="#planes" className="hover:text-foreground transition-colors">Planes</a>
              <a href="#" className="hover:text-foreground transition-colors">Contacto</a>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2026 Green House Project. Todos los derechos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
