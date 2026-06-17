/**
 * EVGreen - Landing Page Pública
 * Hero con parallax, estadísticas animadas, showcase estaciones, IA, PWA
 * Optimizado para móviles con imágenes WebP y framer-motion
 * @author Green House Project
 */
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";

// SEO title for the landing page (30-60 chars)
const SEO_TITLE = "EVGreen - Red de Carga para Vehículos Eléctricos en Colombia";
import { 
  Zap, 
  MapPin, 
  Wallet, 
  Shield, 
  Clock, 
  TrendingUp,
  ChevronRight,
  Smartphone,
  QrCode,
  Brain,
  Sparkles,
  MessageSquare,
  Route,
  PiggyBank,
  LineChart,
  Bot,
  Lightbulb,
  Target,
  Building2,
  ArrowRight
} from "lucide-react";
import { InstallButton } from "@/components/InstallBanner";

// Componente de conteo animado
function AnimatedCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;
    const duration = 2000;
    const steps = 60;
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
    return () => clearInterval(timer);
  }, [isInView, value]);

  const displayValue = value >= 1000 ? `${(count / 1000).toFixed(count >= value ? 0 : 1)}K` : `${count}`;

  return (
    <div ref={ref} className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">
      {prefix}{value >= 1000 ? displayValue : count}{suffix}
    </div>
  );
}

export default function Landing() {
  // Set SEO-optimized document.title (60 chars, within 30-60 range)
  useEffect(() => {
    document.title = SEO_TITLE;
    return () => { document.title = SEO_TITLE; };
  }, []);

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col justify-center">
        {/* Full-width background image with parallax - desktop version */}
        <motion.div 
          className="absolute inset-0 overflow-hidden hidden sm:block"
          style={{ y: bgY, scale: bgScale }}
        >
          <motion.img 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/UzuNvoZDAYcFYnrV.webp" 
            alt="Estación de carga EVGreen para vehículos eléctricos en Colombia" 
            className="w-full h-full object-cover object-center"
          />
        </motion.div>
        {/* Mobile version - vertical image optimized for phones */}
        <motion.div 
          className="absolute inset-0 overflow-hidden sm:hidden"
          style={{ y: bgY, scale: bgScale }}
        >
          <motion.img 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/aBzFRXnbBhAjtyOP.webp" 
            alt="Estación de carga EVGreen vista móvil con cargadores eléctricos" 
            className="w-full h-full object-cover object-top"
          />
        </motion.div>
        {/* Gradient overlays for text legibility */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/30 via-background/70 to-background" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 z-[1] bg-gradient-to-b from-transparent to-background" />
        
        <div className="container relative z-10 px-4 pt-24 sm:pt-32">
          <div className="max-w-4xl mx-auto text-center">

            {/* EVGreen logo image - original branding with entrance animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 sm:mb-8 flex flex-col items-center"
            >
              <motion.img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/gekxZzGAUtRrZBzW.png" 
                alt="EVGreen" 
                className="h-20 sm:h-28 md:h-36 lg:h-44 w-auto object-contain"
                animate={{
                  filter: [
                    'drop-shadow(0 0 20px rgba(74, 222, 128, 0.25))',
                    'drop-shadow(0 0 40px rgba(74, 222, 128, 0.5))',
                    'drop-shadow(0 0 20px rgba(74, 222, 128, 0.25))',
                  ],
                }}
                transition={{
                  filter: {
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }}
              />
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-xs sm:text-sm md:text-base text-white/70 tracking-[0.25em] uppercase mt-3"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
              >
                by Green House Project
              </motion.div>
            </motion.div>

            {/* Headline with AI emphasis */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6"
            >
              La primera red de carga{" "}
              <span className="text-gradient">potenciada por IA</span>
            </motion.h1>

            {/* Subtitle with AI focus */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
            >
              Nuestro asistente de IA te ayuda a encontrar el mejor momento y lugar para cargar, 
              ahorrando hasta un <span className="text-primary font-semibold">30% en costos</span>. 
              La única plataforma en Colombia con inteligencia artificial integrada.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="lg"
                className="gradient-primary text-white px-8 py-6 text-lg rounded-xl shadow-glow hover:shadow-glow-sm transition-all"
                onClick={() => window.location.href = getLoginUrl()}
              >
                <Brain className="w-5 h-5 mr-2" />
                Probar IA gratis
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg rounded-xl border-2"
                onClick={() => window.location.href = '/map'}
              >
                Ver estaciones
                <MapPin className="w-5 h-5 ml-2" />
              </Button>
              <InstallButton className="px-8 py-6 text-lg" />

            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 sm:mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 max-w-2xl mx-auto"
            >
              <div className="text-center">
                <AnimatedCounter value={30} suffix="%" />
                <div className="text-xs sm:text-sm text-muted-foreground">Ahorro con IA</div>
              </div>
              <div className="text-center">
                <AnimatedCounter value={50} suffix="+" />
                <div className="text-xs sm:text-sm text-muted-foreground">Estaciones</div>
              </div>
              <div className="text-center">
                <AnimatedCounter value={10000} suffix="+" />
                <div className="text-xs sm:text-sm text-muted-foreground">Usuarios</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary">24/7</div>
                <div className="text-xs sm:text-sm text-muted-foreground">IA Activa</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Section - HERO DIFERENCIADOR */}
      <section className="py-12 sm:py-20 px-4 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
        <div className="absolute top-0 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-secondary/20 rounded-full blur-3xl" />
        
        <div className="container relative z-10">
          <div className="text-center mb-10 sm:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 mb-6"
            >
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-sm font-semibold text-primary">EXCLUSIVO: Inteligencia Artificial</span>
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
            >
              Tu asistente personal de carga{" "}
              <span className="text-gradient">con IA</span>
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-lg text-muted-foreground max-w-3xl mx-auto"
            >
              Somos la <strong>única plataforma en Colombia</strong> que integra inteligencia artificial 
              para optimizar tu experiencia de carga. Nuestro asistente aprende de tus hábitos y te 
              ayuda a tomar las mejores decisiones.
            </motion.p>
          </div>

          {/* AI Features Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-16">
            {/* AI Feature 1 - Chat Inteligente */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-4 sm:p-6 rounded-2xl bg-card/80 backdrop-blur border border-primary/20 card-interactive group"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Chat con IA 24/7</h3>
              <p className="text-muted-foreground mb-4">
                Pregunta lo que quieras: "¿Dónde puedo cargar cerca?", "¿Cuánto me costará?", 
                "¿Cuál es el mejor horario?". La IA responde con datos reales de la plataforma.
              </p>
              <div className="flex items-center gap-2 text-primary text-sm font-medium">
                <Bot className="w-4 h-4" />
                <span>Respuestas instantáneas</span>
              </div>
            </motion.div>

            {/* AI Feature 2 - Recomendaciones */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-2xl bg-card/80 backdrop-blur border border-primary/20 card-interactive group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Recomendaciones Personalizadas</h3>
              <p className="text-muted-foreground mb-4">
                La IA analiza tu historial, ubicación y patrones de uso para sugerirte 
                las estaciones más convenientes y los horarios con mejores precios.
              </p>
              <div className="flex items-center gap-2 text-secondary text-sm font-medium">
                <Lightbulb className="w-4 h-4" />
                <span>Aprende de ti</span>
              </div>
            </motion.div>

            {/* AI Feature 3 - Planificador de Viajes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl bg-card/80 backdrop-blur border border-primary/20 card-interactive group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-500/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Route className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Planificador de Viajes</h3>
              <p className="text-muted-foreground mb-4">
                ¿Viaje largo? La IA calcula las paradas de carga óptimas según tu autonomía, 
                el tráfico y los precios en cada estación de la ruta.
              </p>
              <div className="flex items-center gap-2 text-orange-500 text-sm font-medium">
                <MapPin className="w-4 h-4" />
                <span>Rutas optimizadas</span>
              </div>
            </motion.div>

            {/* AI Feature 4 - Ahorro Inteligente */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl bg-card/80 backdrop-blur border border-primary/20 card-interactive group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-green-500/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <PiggyBank className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Ahorro Garantizado</h3>
              <p className="text-muted-foreground mb-4">
                Nuestros usuarios ahorran hasta 30% gracias a las alertas de precios bajos 
                y recomendaciones de horarios valle que la IA envía automáticamente.
              </p>
              <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>Hasta 30% de ahorro</span>
              </div>
            </motion.div>

            {/* AI Feature 5 - Predicciones */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl bg-card/80 backdrop-blur border border-primary/20 card-interactive group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-500/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <LineChart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Predicciones de Demanda</h3>
              <p className="text-muted-foreground mb-4">
                La IA predice cuándo habrá menos demanda y mejores precios, 
                notificándote el momento ideal para cargar tu vehículo.
              </p>
              <div className="flex items-center gap-2 text-purple-500 text-sm font-medium">
                <Clock className="w-4 h-4" />
                <span>Alertas proactivas</span>
              </div>
            </motion.div>

            {/* AI Feature 6 - Análisis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="p-6 rounded-2xl bg-card/80 backdrop-blur border border-primary/20 card-interactive group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-500/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Análisis de Consumo</h3>
              <p className="text-muted-foreground mb-4">
                Visualiza patrones de consumo, compara costos mensuales y recibe 
                insights personalizados para optimizar tu gasto en energía.
              </p>
              <div className="flex items-center gap-2 text-blue-500 text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                <span>Insights inteligentes</span>
              </div>
            </motion.div>
          </div>

          {/* AI Demo Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-card to-card/50 border border-primary/20 p-8">
              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-500 font-medium">IA Activa</span>
              </div>
              
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">EV Assistant</p>
                  <div className="bg-muted/50 rounded-2xl rounded-tl-none p-4">
                    <p className="text-foreground">
                      ¡Hola! Basándome en tu ubicación actual y el nivel de batería de tu vehículo, 
                      te recomiendo cargar en la <strong>Estación EVGreen Mosquera</strong> que está 
                      a solo 2.3 km. El precio actual es <strong>$1,020/kWh</strong> (15% menos que el promedio) 
                      porque estamos en horario valle. ¿Te gustaría que reserve un puesto?
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-4 justify-end">
                <div className="flex-1 max-w-md">
                  <div className="bg-primary/20 rounded-2xl rounded-tr-none p-4 ml-auto">
                    <p className="text-foreground">
                      Sí, reserva para las 3pm. ¿Cuánto me costará cargar 30 kWh?
                    </p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                  <span className="text-lg">👤</span>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">Funciones disponibles:</span>
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs">Reservar</span>
                    <span className="px-2 py-1 rounded bg-secondary/10 text-secondary text-xs">Planificar ruta</span>
                    <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-500 text-xs">Ver precios</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button
              size="lg"
              className="gradient-primary text-white px-10 py-6 text-lg rounded-xl shadow-glow hover:shadow-glow-sm transition-all"
              onClick={() => window.location.href = getLoginUrl()}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Probar el Asistente IA
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Estaciones del Futuro - Showcase */}
      <section className="py-16 sm:py-24 px-4 relative overflow-hidden">
        {/* Fondo sutil */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.03] to-background" />
        
        <div className="container relative z-10">
          {/* Encabezado */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              Visión del Futuro
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
              Nuestras Estaciones
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Así se verán las estaciones de carga EVGreen: tecnología solar, diseño premium y carga ultrarrápida con paneles Huawei.
            </p>
          </motion.div>

          {/* Galería día/noche con toggle */}
          <div className="max-w-5xl mx-auto">
            {/* Imagen principal con efecto de transición */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8 }}
              className="relative rounded-2xl overflow-hidden group"
            >
              {/* Imagen de día */}
              <div className="relative">
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/IkjZGHwZzMBroijl.png"
                  alt="Estación EVGreen - Vista diurna con paneles solares y cargadores Huawei"
                  className="w-full h-auto object-contain rounded-2xl"
                />
                {/* Overlay gradiente inferior */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl" />
                {/* Label */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
                  <div className="flex items-center gap-2 text-white">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-sm sm:text-base font-medium">Vista Diurna</span>
                  </div>
                  <p className="text-white/70 text-xs sm:text-sm mt-1">Paneles solares integrados &middot; Carga ultrarrápida</p>
                </div>
              </div>
            </motion.div>

            {/* Imagen de noche */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="relative rounded-2xl overflow-hidden mt-6 sm:mt-8 group"
            >
              <div className="relative">
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/HAGBjIecmTtStdFv.png"
                  alt="Estación EVGreen - Vista nocturna con iluminación LED verde"
                  className="w-full h-auto object-contain rounded-2xl"
                />
                {/* Overlay gradiente inferior */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl" />
                {/* Efecto glow verde en la noche */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-primary/20" />
                {/* Label */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
                  <div className="flex items-center gap-2 text-white">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm sm:text-base font-medium">Vista Nocturna</span>
                  </div>
                  <p className="text-white/70 text-xs sm:text-sm mt-1">Iluminación LED verde &middot; Operación 24/7</p>
                </div>
              </div>
            </motion.div>

            {/* Características destacadas debajo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-8 sm:mt-12">
              {[
                { icon: Zap, label: "Carga DC", desc: "Hasta 360kW" },
                { icon: Shield, label: "Paneles Solares", desc: "Energía limpia" },
                { icon: Smartphone, label: "App EVGreen", desc: "Control total" },
                { icon: Clock, label: "24/7", desc: "Siempre disponible" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="text-center p-4 rounded-xl bg-card/50 border border-border/50"
                >
                  <item.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="font-semibold text-sm text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20 px-4 bg-muted/30">
        <div className="container">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Todo lo que necesitas para cargar
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Una experiencia de carga completa diseñada para conductores de vehículos eléctricos en Colombia
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-4 sm:p-6 rounded-2xl bg-card border border-border card-interactive"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Mapa en tiempo real</h3>
              <p className="text-muted-foreground">
                Encuentra estaciones cercanas con disponibilidad actualizada al instante
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-4 sm:p-6 rounded-2xl bg-card border border-border card-interactive"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                <QrCode className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Inicio con QR o NFC</h3>
              <p className="text-muted-foreground">
                Escanea el código QR o usa NFC para iniciar tu carga en segundos
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-4 sm:p-6 rounded-2xl bg-card border border-border card-interactive"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Billetera digital</h3>
              <p className="text-muted-foreground">
                Recarga saldo y paga tus cargas de forma segura desde la app
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-4 sm:p-6 rounded-2xl bg-card border border-border card-interactive"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Reserva tu cargador</h3>
              <p className="text-muted-foreground">
                Reserva con anticipación y asegura tu puesto de carga
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="p-4 sm:p-6 rounded-2xl bg-card border border-border card-interactive"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Pagos seguros</h3>
              <p className="text-muted-foreground">
                Transacciones protegidas con los más altos estándares de seguridad
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="p-4 sm:p-6 rounded-2xl bg-card border border-border card-interactive"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Soporte 24/7</h3>
              <p className="text-muted-foreground">
                Asistencia en vivo por chat o llamada cuando lo necesites
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA - Postula tu Espacio */}
      <section className="py-16 sm:py-24 px-4 relative overflow-hidden">
        {/* Background animado */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 via-emerald-600/15 to-teal-600/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl" />
        
        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7 }}
              className="relative rounded-3xl overflow-hidden"
            >
              {/* Borde brillante animado */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-500/30 via-cyan-500/30 to-teal-500/30 p-[1px]">
                <div className="w-full h-full rounded-3xl bg-[#0a1a12]" />
              </div>

              <div className="relative z-10 p-8 sm:p-12 md:p-16">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  {/* Texto */}
                  <div>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium mb-5">
                        <Building2 className="w-4 h-4" />
                        <span>OPORTUNIDAD PARA TU NEGOCIO</span>
                      </div>
                      
                      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                        ¿Tienes un espacio?{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400">
                          ¡Postúlalo!
                        </span>
                      </h2>
                      
                      <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                        Parqueaderos, centros comerciales, estaciones de servicio, hoteles... 
                        Si tienes un espacio con potencial, nosotros instalamos y operamos el cargador. 
                        <strong className="text-emerald-300">Tú ganas un porcentaje de cada carga.</strong>
                      </p>

                      <ul className="space-y-3 mb-8">
                        {[
                          "Evaluación técnica gratuita con IA",
                          "Instalación y mantenimiento sin costo",
                          "Ingresos pasivos mensuales garantizados",
                        ].map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-gray-300">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <Zap className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            {item}
                          </li>
                        ))}
                      </ul>

                      <Link href="/postula-tu-espacio">
                        <Button
                          size="lg"
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all group"
                        >
                          <Building2 className="w-5 h-5 mr-2" />
                          Postular mi espacio
                          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </motion.div>
                  </div>

                  {/* Visual - Mini mapa con puntos */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="hidden md:block"
                  >
                    <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-6 flex flex-col items-center justify-center">
                      {/* Efecto de glow */}
                      <div className="absolute top-6 right-6 w-20 h-20 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
                      <div className="absolute bottom-8 left-8 w-16 h-16 bg-cyan-400/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
                      
                      {/* Icono central */}
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/30 flex items-center justify-center mb-6">
                        <MapPin className="w-12 h-12 text-emerald-400" />
                      </div>
                      
                      {/* Stats del programa */}
                      <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="bg-[#0a1a12]/80 rounded-xl p-4 text-center border border-emerald-500/10">
                          <div className="text-2xl font-bold text-emerald-400">50+</div>
                          <div className="text-xs text-gray-400">Espacios postulados</div>
                        </div>
                        <div className="bg-[#0a1a12]/80 rounded-xl p-4 text-center border border-emerald-500/10">
                          <div className="text-2xl font-bold text-cyan-400">15+</div>
                          <div className="text-xs text-gray-400">Ciudades</div>
                        </div>
                        <div className="bg-[#0a1a12]/80 rounded-xl p-4 text-center border border-emerald-500/10">
                          <div className="text-2xl font-bold text-teal-400">100%</div>
                          <div className="text-xs text-gray-400">Gratis postular</div>
                        </div>
                        <div className="bg-[#0a1a12]/80 rounded-xl p-4 text-center border border-emerald-500/10">
                          <div className="text-2xl font-bold text-emerald-300">IA</div>
                          <div className="text-xs text-gray-400">Evaluación instantánea</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Investor Section - MEJORADO */}
      <section className="py-16 sm:py-24 px-4 relative overflow-hidden">
        {/* Background con gradiente llamativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
        
        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold mb-6">
                <TrendingUp className="w-5 h-5" />
                <span>OPORTUNIDAD DE INVERSIÓN</span>
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                Invierte en el futuro de la{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  movilidad eléctrica
                </span>
              </h2>
              
              <p className="text-lg text-muted-foreground mb-8">
                Adquiere estaciones de carga y genera <strong className="text-amber-400">ingresos pasivos de hasta 126% ROI anual</strong>. 
                Nosotros nos encargamos de la operación, mantenimiento y soporte.
              </p>
              
              {/* Stats destacados */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-2xl sm:text-3xl font-bold text-amber-400">126%</div>
                  <div className="text-xs text-muted-foreground">ROI Anual</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <div className="text-2xl sm:text-3xl font-bold text-orange-400">10</div>
                  <div className="text-xs text-muted-foreground">Meses Payback</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-2xl sm:text-3xl font-bold text-yellow-400">70%</div>
                  <div className="text-xs text-muted-foreground">Tu Participación</div>
                </div>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-foreground">Dashboard en tiempo real con métricas de tu inversión</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <LineChart className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-foreground">Reportes detallados de ingresos y consumo</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-foreground"><strong className="text-purple-400">IA predictiva</strong> para optimizar tus ingresos</span>
                </li>
              </ul>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/investors">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
                  >
                    <PiggyBank className="w-5 h-5 mr-2" />
                    Invertir Ahora
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/investors#calculadora">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 px-8 py-6 text-lg rounded-xl"
                  >
                    Calcular ROI
                    <TrendingUp className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/20 p-8 flex items-center justify-center border border-amber-500/20">
                {/* Efecto de brillo */}
                <div className="absolute top-4 right-4 w-24 h-24 bg-amber-400/30 rounded-full blur-2xl animate-pulse" />
                
                <div className="w-full max-w-sm bg-card/90 backdrop-blur rounded-2xl shadow-2xl p-6 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-muted-foreground">Ingresos del mes</span>
                    <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">+12.5%</span>
                  </div>
                  <div className="text-4xl font-bold text-foreground mb-1">$8,796,937</div>
                  <div className="text-sm text-muted-foreground mb-6">COP / Inversión $85M</div>
                  <div className="h-36 bg-gradient-to-t from-amber-500/5 to-transparent rounded-xl flex items-end justify-around p-4 border border-amber-500/10">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 95, 75, 88, 92].map((h, i) => (
                      <div
                        key={i}
                        className="w-4 bg-gradient-to-t from-amber-500 to-orange-400 rounded-t-md transition-all hover:from-amber-400 hover:to-orange-300"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50 flex justify-between text-sm">
                    <span className="text-muted-foreground">ROI Acumulado</span>
                    <span className="font-bold text-amber-400">+126% anual</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 gradient-primary opacity-90" />
            <div className="relative z-10 py-16 px-8 text-center text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 mb-6">
                <Brain className="w-5 h-5" />
                <span className="text-sm font-medium">Potenciado por Inteligencia Artificial</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                ¿Listo para cargar de forma inteligente?
              </h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8">
                Únete a miles de conductores que ya ahorran hasta 30% con nuestro asistente de IA
              </p>
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg rounded-xl"
                onClick={() => window.location.href = getLoginUrl()}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Crear cuenta gratis
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/GGDXOuWzwOqcapbY.png" 
                alt="EVGreen" 
                className="h-10 w-auto object-contain"
              />
              <span className="text-muted-foreground text-sm">by Green House Project</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/saas" className="hover:text-green-400 transition-colors font-medium">Empresas</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Términos</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacidad</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contacto</Link>
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
