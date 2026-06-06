/**
 * Página Pública /partners - EVGREEN Partners Program
 * Landing page para distribuidores interesados en el programa de partners.
 * Incluye: Hero, Problema, Solución, Beneficios, Niveles, Cómo Funciona,
 * Efecto de Red, Comunidad, y Formulario de Aplicación.
 */
import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Zap,
  TrendingUp,
  Users,
  Shield,
  Award,
  CheckCircle2,
  ArrowRight,
  Globe,
  Layers,
  DollarSign,
  Handshake,
  Target,
  Star,
  Crown,
  Gem,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Network,
  Repeat,
  Package,
  Rocket,
  BadgeCheck,
  Building2,
  CircleDollarSign,
  Lightbulb,
  ShieldCheck,
  Wifi,
  BarChart3,
  HeartHandshake,
} from "lucide-react";

export default function Partners() {
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    currentBrands: "",
    annualVolume: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const applyMutation = trpc.partners.submitApplication.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("¡Aplicación enviada! Te contactaremos pronto.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al enviar la aplicación");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.contactName || !formData.email || !formData.phone) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }
    setIsSubmitting(true);
    await applyMutation.mutateAsync(formData);
    setIsSubmitting(false);
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a1a0f] text-white overflow-x-hidden">
      {/* ============ NAVBAR ============ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a1a0f]/90 backdrop-blur-md border-b border-emerald-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Zap className="w-7 h-7 text-[#00ff88]" />
            <span className="text-xl font-bold text-white">
              EV<span className="text-[#00ff88]">Green</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/investors">
              <Button variant="ghost" className="text-gray-300 hover:text-[#00ff88]">
                Inversionistas
              </Button>
            </Link>
            <Button
              onClick={scrollToForm}
              className="bg-[#00ff88] text-[#0a1a0f] hover:bg-[#00ff88]/90 font-semibold"
            >
              Aplicar Ahora
            </Button>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a0f] via-[#0d2614] to-[#0a1a0f]" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#00ff88]/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#22c55e]/10 rounded-full blur-[100px]" />
        </div>
        {/* Circuit pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2300ff88' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00ff88]/30 bg-[#00ff88]/5 mb-6">
            <Handshake className="w-4 h-4 text-[#00ff88]" />
            <span className="text-sm text-[#00ff88] font-medium">Programa de Distribuidores Certificados</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Deja de Vender Solo{" "}
            <span className="text-[#00ff88] drop-shadow-[0_0_20px_rgba(0,255,136,0.3)]">Hardware</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto mb-8">
            Vende una <strong className="text-white">solución completa</strong> con ingresos recurrentes, 
            diferenciación real y acceso a la red de carga más inteligente de Latinoamérica.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={scrollToForm}
              size="lg"
              className="bg-[#00ff88] text-[#0a1a0f] hover:bg-[#00ff88]/90 font-bold text-lg px-8 py-6 shadow-[0_0_30px_rgba(0,255,136,0.3)]"
            >
              Quiero ser Partner <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[#00ff88]/50 text-[#00ff88] hover:bg-[#00ff88]/10 font-semibold text-lg px-8 py-6"
              onClick={() => document.getElementById("beneficios")?.scrollIntoView({ behavior: "smooth" })}
            >
              Ver Beneficios
            </Button>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { value: "30%", label: "Comisión máxima" },
              { value: "10+", label: "Marcas compatibles" },
              { value: "24/7", label: "Soporte técnico" },
              { value: "∞", label: "Ingresos recurrentes" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-[#00ff88]">{stat.value}</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PROBLEMA ============ */}
      <section className="py-20 px-4 border-t border-emerald-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              El Problema de Vender Solo <span className="text-red-400">Hardware</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              El modelo tradicional de distribución de cargadores tiene limitaciones serias
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Problemas */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-sm">✗</span>
                Sin ecosistema
              </h3>
              {[
                "Vendes un cargador y el cliente no vuelve",
                "El cliente no sabe cómo operarlo ni monetizarlo",
                "Sin app, sin usuarios, sin soporte post-venta",
                "Compites solo por precio — carrera al fondo",
                "Cero ingresos recurrentes — vives de la próxima venta",
                "El cliente te culpa cuando el cargador no genera dinero",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
            {/* Solución */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-[#00ff88] mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#00ff88]/10 flex items-center justify-center text-sm">✓</span>
                Con EVGREEN Network
              </h3>
              {[
                "Vendes una solución completa: hardware + ecosistema",
                "El cliente genera ingresos desde el día 1 con la app",
                "Miles de usuarios encuentran y pagan en su estación",
                "Te diferencias de la competencia con tecnología + IA",
                "Comisiones recurrentes por cada renovación anual",
                "El cliente te agradece porque su estación es rentable",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 p-3 rounded-lg bg-[#00ff88]/5 border border-[#00ff88]/10">
                  <CheckCircle2 className="w-5 h-5 text-[#00ff88] mt-0.5 shrink-0" />
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ SOLUCIÓN: PAQUETE EVGREEN READY ============ */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0a1a0f] to-[#0d2614] border-t border-emerald-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Paquete <span className="text-[#00ff88]">EVGREEN Ready</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Todo lo que tu cliente necesita para que su estación sea rentable desde el primer día
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Package, title: "Hardware", desc: "Cargador de la marca que prefieras (ABB, Huawei, Autel, Wallbox, Delta...)" },
              { icon: Globe, title: "Ecosistema EVGREEN", desc: "Conexión a la red, app móvil, dashboard, base de usuarios activa" },
              { icon: Shield, title: "Licencia Año 1", desc: "Incluida en el paquete — sin costo adicional para tu cliente el primer año" },
              { icon: Wifi, title: "Configuración OCPP", desc: "Setup completo + activación en plataforma + pruebas de conexión" },
            ].map((item) => (
              <Card key={item.title} className="bg-[#0f2a1a] border-emerald-800/30 hover:border-[#00ff88]/40 transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#00ff88]/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-[#00ff88]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30">
              <Lightbulb className="w-5 h-5 text-[#00ff88]" />
              <span className="text-[#00ff88] font-medium">
                Compatible con +10 marcas de cargadores: ABB, Huawei, Autel, Wallbox, Delta, BYD, Schneider...
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BENEFICIOS ============ */}
      <section id="beneficios" className="py-20 px-4 border-t border-emerald-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Beneficios de Ser <span className="text-[#00ff88]">Partner</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Más que una comisión — un modelo de negocio sostenible
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: CircleDollarSign, title: "Comisiones 20-30%", desc: "Sobre el valor del primer año de licencia. Hasta 30% para partners Platinum." },
              { icon: Repeat, title: "Ingresos Recurrentes", desc: "5-10% de cada renovación anual. Tu base de clientes genera ingresos pasivos." },
              { icon: Target, title: "Leads Calificados", desc: "EVGreen refiere clientes interesados directamente a partners certificados en su zona." },
              { icon: Award, title: "Diferenciación Real", desc: "No vendes un cargador genérico. Vendes la solución más inteligente del mercado con IA." },
              { icon: HeartHandshake, title: "Cliente Satisfecho", desc: "Tu cliente genera ingresos desde el día 1. Eso se traduce en referidos y recompra." },
              { icon: BarChart3, title: "Co-Marketing", desc: "Material de ventas, casos de éxito, presentaciones y soporte comercial de EVGreen." },
            ].map((item) => (
              <Card key={item.title} className="bg-[#0f2a1a] border-emerald-800/30 hover:border-[#00ff88]/40 transition-all group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-[#00ff88]/10 flex items-center justify-center mb-4 group-hover:bg-[#00ff88]/20 transition-colors">
                    <item.icon className="w-6 h-6 text-[#00ff88]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============ NIVELES ============ */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0a1a0f] to-[#0d2614] border-t border-emerald-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Niveles del Programa <span className="text-[#00ff88]">Partners</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Crece con nosotros — más vendes, más ganas
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Silver */}
            <Card className="bg-[#0f2a1a] border-gray-600/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-400 to-gray-300" />
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gray-400/10 flex items-center justify-center">
                    <Star className="w-5 h-5 text-gray-400" />
                  </div>
                  <CardTitle className="text-xl text-gray-200">Silver</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-gray-500/5 border border-gray-500/10">
                  <p className="text-sm text-gray-400">Requisito</p>
                  <p className="text-white font-semibold">1-5 estaciones conectadas/año</p>
                </div>
                <ul className="space-y-2">
                  {["Comisión 20% primer año", "Logo en directorio de partners", "Material de ventas digital", "Soporte técnico por email", "Capacitación básica"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Gold */}
            <Card className="bg-[#0f2a1a] border-yellow-600/40 relative overflow-hidden scale-[1.02] shadow-xl shadow-yellow-900/10">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />
              <div className="absolute top-4 right-4 px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                POPULAR
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-yellow-400" />
                  </div>
                  <CardTitle className="text-xl text-yellow-200">Gold</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <p className="text-sm text-yellow-400/70">Requisito</p>
                  <p className="text-white font-semibold">6-15 estaciones conectadas/año</p>
                </div>
                <ul className="space-y-2">
                  {["Comisión 25% primer año", "5% comisión por renovaciones", "Leads prioritarios de la plataforma", "Co-marketing y eventos", "Soporte técnico prioritario", "Capacitación avanzada"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Platinum */}
            <Card className="bg-[#0f2a1a] border-[#00ff88]/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00ff88] to-[#22c55e]" />
              <div className="absolute top-4 right-4 px-2 py-0.5 rounded text-xs font-bold bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30">
                PREMIUM
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[#00ff88]/10 flex items-center justify-center">
                    <Gem className="w-5 h-5 text-[#00ff88]" />
                  </div>
                  <CardTitle className="text-xl text-[#00ff88]">Platinum</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-[#00ff88]/5 border border-[#00ff88]/10">
                  <p className="text-sm text-[#00ff88]/70">Requisito</p>
                  <p className="text-white font-semibold">16+ estaciones conectadas/año</p>
                </div>
                <ul className="space-y-2">
                  {["Comisión 30% primer año", "10% comisión por renovaciones", "Exclusividad territorial", "Leads garantizados mensuales", "Capacitación premium in-situ", "Acceso a beta de nuevos productos", "Línea directa con equipo ejecutivo"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ============ CÓMO FUNCIONA ============ */}
      <section className="py-20 px-4 border-t border-emerald-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              ¿Cómo <span className="text-[#00ff88]">Funciona</span>?
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Tú vendes, EVGreen opera — tú cobras comisiones recurrentes
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", icon: Handshake, title: "Te Certificas", desc: "Aplicas al programa, te capacitamos y te damos acceso a material comercial y precios." },
              { step: "02", icon: Package, title: "Vendes el Paquete", desc: "Ofreces el Paquete EVGREEN Ready: hardware + ecosistema + licencia primer año incluida." },
              { step: "03", icon: Rocket, title: "EVGreen Activa", desc: "Configuramos el cargador en la plataforma, conectamos OCPP y activamos la estación en la app." },
              { step: "04", icon: CircleDollarSign, title: "Cobras Comisiones", desc: "Recibes tu comisión de adquisición + comisión recurrente por cada renovación anual." },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="text-center">
                  <div className="text-5xl font-bold text-[#00ff88]/10 mb-2">{item.step}</div>
                  <div className="w-14 h-14 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-[#00ff88]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Flow diagram */}
          <div className="mt-12 p-6 rounded-2xl bg-[#0f2a1a] border border-emerald-800/30">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
              <div className="px-4 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                <span className="text-[#00ff88] font-semibold">Partner Vende</span>
              </div>
              <ChevronRight className="w-6 h-6 text-[#00ff88] rotate-90 sm:rotate-0" />
              <div className="px-4 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                <span className="text-[#00ff88] font-semibold">EVGreen Opera</span>
              </div>
              <ChevronRight className="w-6 h-6 text-[#00ff88] rotate-90 sm:rotate-0" />
              <div className="px-4 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                <span className="text-[#00ff88] font-semibold">Cliente Genera $</span>
              </div>
              <ChevronRight className="w-6 h-6 text-[#00ff88] rotate-90 sm:rotate-0" />
              <div className="px-4 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                <span className="text-[#00ff88] font-semibold">Partner Cobra</span>
              </div>
            </div>
            <p className="text-center text-gray-400 text-sm mt-4">
              La relación contractual SaaS es directamente entre EVGreen y el cliente final. 
              El Partner recibe comisión de adquisición y renovación.
            </p>
          </div>
        </div>
      </section>

      {/* ============ EFECTO DE RED ============ */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0a1a0f] to-[#0d2614] border-t border-emerald-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              El <span className="text-[#00ff88]">Efecto de Red</span> Europeo
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Inspirado en ChargePoint, Hubject y Gireve — donde el valor está en la red, no en el hardware
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white">¿Por qué la red es más valiosa que el hardware?</h3>
              {[
                { title: "Más estaciones conectadas", desc: "Cada cargador que vendes fortalece la red completa" },
                { title: "Más usuarios en la app", desc: "Red más grande = más conductores descargando la app" },
                { title: "Más ingresos por estación", desc: "Más usuarios = más sesiones de carga = más dinero para tu cliente" },
                { title: "Más clientes satisfechos", desc: "Clientes rentables = referidos = más ventas para ti" },
              ].map((item, i) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#00ff88]/10 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-[#00ff88] font-bold text-sm">{i + 1}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">{item.title}</h4>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-sm aspect-square">
                {/* Network visualization */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-[#00ff88]/20 border-2 border-[#00ff88] flex items-center justify-center shadow-[0_0_40px_rgba(0,255,136,0.3)]">
                    <Zap className="w-10 h-10 text-[#00ff88]" />
                  </div>
                </div>
                {/* Orbiting nodes */}
                {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                  <div
                    key={deg}
                    className="absolute w-12 h-12 rounded-full bg-[#0f2a1a] border border-[#00ff88]/30 flex items-center justify-center"
                    style={{
                      top: `${50 + 38 * Math.sin((deg * Math.PI) / 180)}%`,
                      left: `${50 + 38 * Math.cos((deg * Math.PI) / 180)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {[<Users />, <Building2 />, <Zap />, <Globe />, <TrendingUp />, <Shield />][i] && (
                      <div className="w-5 h-5 text-[#00ff88]/70">
                        {[<Users key="u" className="w-5 h-5" />, <Building2 key="b" className="w-5 h-5" />, <Zap key="z" className="w-5 h-5" />, <Globe key="g" className="w-5 h-5" />, <TrendingUp key="t" className="w-5 h-5" />, <Shield key="s" className="w-5 h-5" />][i]}
                      </div>
                    )}
                  </div>
                ))}
                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full" style={{ zIndex: -1 }}>
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <line
                      key={deg}
                      x1="50%"
                      y1="50%"
                      x2={`${50 + 38 * Math.cos((deg * Math.PI) / 180)}%`}
                      y2={`${50 + 38 * Math.sin((deg * Math.PI) / 180)}%`}
                      stroke="#00ff88"
                      strokeOpacity="0.2"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ COMUNIDAD ============ */}
      <section className="py-20 px-4 border-t border-emerald-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-[#00ff88]">EVGREEN</span> Certified Partner
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Más que un programa de ventas — una comunidad de profesionales
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BadgeCheck, title: "Certificación Oficial", desc: "Reconocimiento como distribuidor certificado EVGREEN. Badge exclusivo para tu marca." },
              { icon: Users, title: "Leads de la Plataforma", desc: "Clientes que buscan cargadores en tu zona son referidos directamente a ti." },
              { icon: Layers, title: "Capacitación Técnica", desc: "Formación en OCPP, instalación, configuración y troubleshooting de cargadores." },
              { icon: TrendingUp, title: "Co-Marketing", desc: "Campañas conjuntas, material de ventas, casos de éxito y presencia en eventos." },
              { icon: ShieldCheck, title: "Soporte Comercial", desc: "Acceso a presentaciones, calculadoras de ROI y material para cerrar ventas." },
              { icon: Globe, title: "Red de Partners", desc: "Comunidad de distribuidores en toda Latinoamérica. Networking y mejores prácticas." },
            ].map((item) => (
              <div key={item.title} className="p-6 rounded-xl bg-[#0f2a1a]/50 border border-emerald-800/20 hover:border-[#00ff88]/30 transition-all">
                <item.icon className="w-8 h-8 text-[#00ff88] mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FORMULARIO DE APLICACIÓN ============ */}
      <section ref={formRef} className="py-20 px-4 bg-gradient-to-b from-[#0a1a0f] to-[#0d2614] border-t border-emerald-900/20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Aplica al Programa <span className="text-[#00ff88]">Partners</span>
            </h2>
            <p className="text-gray-400 text-lg">
              Cupos limitados por territorio. Completa el formulario y te contactaremos en 24-48 horas.
            </p>
          </div>

          {submitted ? (
            <Card className="bg-[#0f2a1a] border-[#00ff88]/30">
              <CardContent className="p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-[#00ff88]/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#00ff88]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">¡Aplicación Recibida!</h3>
                <p className="text-gray-400 mb-6">
                  Nuestro equipo revisará tu solicitud y te contactará en las próximas 24-48 horas 
                  para agendar una reunión y discutir los próximos pasos.
                </p>
                <Button
                  onClick={() => { setSubmitted(false); setFormData({ companyName: "", contactName: "", email: "", phone: "", city: "", currentBrands: "", annualVolume: "", message: "" }); }}
                  variant="outline"
                  className="border-[#00ff88]/50 text-[#00ff88] hover:bg-[#00ff88]/10"
                >
                  Enviar otra aplicación
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#0f2a1a] border-emerald-800/30">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-gray-300">
                        Empresa <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="companyName"
                        placeholder="Nombre de tu empresa"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactName" className="text-gray-300">
                        Nombre de contacto <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="contactName"
                        placeholder="Tu nombre completo"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88]"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-300">
                        Email <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@empresa.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-gray-300">
                        Teléfono <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="phone"
                        placeholder="+57 300 000 0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88]"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-gray-300">Ciudad</Label>
                      <Input
                        id="city"
                        placeholder="Ciudad principal de operación"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="annualVolume" className="text-gray-300">Volumen anual estimado</Label>
                      <Input
                        id="annualVolume"
                        placeholder="Ej: 5-10 estaciones/año"
                        value={formData.annualVolume}
                        onChange={(e) => setFormData({ ...formData, annualVolume: e.target.value })}
                        className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentBrands" className="text-gray-300">Marcas que distribuyes actualmente</Label>
                    <Input
                      id="currentBrands"
                      placeholder="Ej: ABB, Wallbox, Huawei, Delta..."
                      value={formData.currentBrands}
                      onChange={(e) => setFormData({ ...formData, currentBrands: e.target.value })}
                      className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-gray-300">Mensaje adicional</Label>
                    <Textarea
                      id="message"
                      placeholder="Cuéntanos sobre tu empresa y por qué quieres ser Partner EVGREEN..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                      className="bg-[#0a1a0f] border-emerald-800/40 text-white placeholder:text-gray-500 focus:border-[#00ff88] resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#00ff88] text-[#0a1a0f] hover:bg-[#00ff88]/90 font-bold text-lg py-6 shadow-[0_0_30px_rgba(0,255,136,0.2)]"
                  >
                    {isSubmitting ? "Enviando..." : "Enviar Aplicación"}
                    {!isSubmitting && <ArrowRight className="ml-2 w-5 h-5" />}
                  </Button>
                  <p className="text-center text-gray-500 text-xs">
                    Al enviar aceptas que EVGreen te contacte para discutir el programa de partners.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-10 px-4 border-t border-emerald-900/20 bg-[#071210]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00ff88]" />
            <span className="text-sm text-gray-400">
              © 2026 EVGreen — La primera red de carga inteligente con IA
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:partners@evgreen.lat" className="text-gray-400 hover:text-[#00ff88] text-sm flex items-center gap-1">
              <Mail className="w-4 h-4" /> partners@evgreen.lat
            </a>
            <Link href="/" className="text-gray-400 hover:text-[#00ff88] text-sm">
              Inicio
            </Link>
            <Link href="/investors" className="text-gray-400 hover:text-[#00ff88] text-sm">
              Inversionistas
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
