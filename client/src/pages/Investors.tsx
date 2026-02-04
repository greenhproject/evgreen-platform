/**
 * Página de Inversionistas - EVGreen
 * 
 * Página sofisticada para atraer inversionistas potenciales.
 * Incluye calculadora de ROI, casos de uso, gráficos de ingresos
 * y beneficios de la plataforma con IA.
 * 
 * Modelo de Negocio Actualizado (Feb 2026):
 * - Precio compra energía: $850 COP/kWh (promedio)
 * - Precio venta energía: $1,700 COP/kWh (promedio DC)
 * - Distribución: 70% inversionista / 30% plataforma
 * - Paquete Individual: $85M (Huawei FusionCharge 120kW)
 * - Paquete Colectivo: $1,000M (Estación Premium 4x500kW + Solar)
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, 
  TrendingUp, 
  Building2, 
  Home, 
  Fuel, 
  Hotel, 
  UtensilsCrossed,
  Brain,
  Shield,
  Clock,
  DollarSign,
  BarChart3,
  Users,
  Leaf,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Calculator,
  PieChart,
  Target,
  Award,
  Phone,
  Mail,
  MapPin,
  Sun,
  Battery,
  Bolt
} from "lucide-react";

// Constantes de negocio actualizadas (Feb 2026)
const PRECIO_COMPRA_KWH = 850; // COP promedio
const PRECIO_COMPRA_KWH_SOLAR = 250; // COP con energía solar
const PRECIO_VENTA_KWH = 1700; // COP promedio DC
const PORCENTAJE_INVERSIONISTA = 0.70; // 70% para el inversionista

// Paquetes de inversión
const PAQUETES = {
  INDIVIDUAL: {
    nombre: "Paquete Individual",
    descripcion: "1 Cargador Huawei FusionCharge 120kW DC",
    precio: 85000000,
    potencia: 120,
    tipo: "DC",
    horasUsoPromedio: 12,
    conSolar: false,
    caracteristicas: [
      "Cargador Huawei FusionCharge 120kW",
      "Instalación incluida",
      "100% propiedad del inversionista",
      "Mantenimiento por EVGreen",
      "Dashboard en tiempo real",
      "Liquidaciones mensuales"
    ]
  },
  COLECTIVO: {
    nombre: "Estación Premium",
    descripcion: "4 Puntos de carga DC 500kW + Energía Solar",
    precio: 1000000000,
    potencia: 500,
    puntos: 4,
    tipo: "DC Ultra-Rápido",
    horasUsoPromedio: 14,
    conSolar: true,
    participacionMinima: 50000000,
    caracteristicas: [
      "4 cargadores DC 500kW ultra-rápidos",
      "Sistema de energía solar integrado",
      "Reducción 70% costo de energía",
      "Participación como socio",
      "Ubicaciones premium garantizadas",
      "ROI superior con energía solar"
    ]
  }
};

// Zonas premium con fee adicional
const ZONAS_PREMIUM = {
  A: { nombre: "Zona Premium A", zonas: ["Usaquén", "Chapinero", "Zona T"], fee: 5000000 },
  B: { nombre: "Zona Premium B", zonas: ["Suba Norte", "Cedritos", "Santa Bárbara"], fee: 3000000 },
  C: { nombre: "Zona Estándar", zonas: ["Otras zonas de Bogotá"], fee: 0 }
};

export default function Investors() {
  // Estado para la calculadora
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<"INDIVIDUAL" | "COLECTIVO">("INDIVIDUAL");
  const [horasUso, setHorasUso] = useState(12);
  const [precioVenta, setPrecioVenta] = useState(1700);
  const [zonaPremium, setZonaPremium] = useState<"A" | "B" | "C">("C");
  const [participacionColectiva, setParticipacionColectiva] = useState(100000000);
  const [usarSolar, setUsarSolar] = useState(false);

  // Cálculos de ROI
  const calculos = useMemo(() => {
    const paquete = PAQUETES[paqueteSeleccionado];
    const costoEnergia = (paqueteSeleccionado === "COLECTIVO" || usarSolar) ? PRECIO_COMPRA_KWH_SOLAR : PRECIO_COMPRA_KWH;
    
    let inversionBase: number;
    let potenciaTotal: number;
    let porcentajeParticipacion = 1;

    if (paqueteSeleccionado === "INDIVIDUAL") {
      inversionBase = paquete.precio;
      potenciaTotal = paquete.potencia;
    } else {
      // Inversión colectiva - calcular participación
      inversionBase = participacionColectiva;
      porcentajeParticipacion = participacionColectiva / paquete.precio;
      potenciaTotal = paquete.potencia * (paquete as any).puntos * porcentajeParticipacion;
    }

    // Fee por zona premium
    const feePremium = paqueteSeleccionado === "INDIVIDUAL" ? ZONAS_PREMIUM[zonaPremium].fee : 0;
    const inversionTotal = inversionBase + feePremium;

    // Cálculos de energía y margen
    const energiaDiaria = potenciaTotal * horasUso; // kWh/día
    const energiaMensual = energiaDiaria * 30;
    const energiaAnual = energiaDiaria * 365;

    const margenPorKwh = precioVenta - costoEnergia;
    const ingresoBrutoDiario = energiaDiaria * precioVenta;
    const costoDiario = energiaDiaria * costoEnergia;
    const margenBrutoDiario = energiaDiaria * margenPorKwh;
    const ingresoInversionistaDiario = margenBrutoDiario * PORCENTAJE_INVERSIONISTA;

    const ingresoMensual = ingresoInversionistaDiario * 30;
    const ingresoAnual = ingresoInversionistaDiario * 365;

    const roiMeses = inversionTotal / ingresoMensual;
    const roiAnual = (ingresoAnual / inversionTotal) * 100;

    return {
      energiaDiaria,
      energiaMensual,
      energiaAnual,
      ingresoBrutoDiario,
      costoDiario,
      costoEnergia,
      margenBrutoDiario,
      ingresoInversionistaDiario,
      ingresoMensual,
      ingresoAnual,
      inversionTotal,
      inversionBase,
      feePremium,
      roiMeses,
      roiAnual,
      margenPorKwh,
      porcentajeParticipacion
    };
  }, [paqueteSeleccionado, horasUso, precioVenta, zonaPremium, participacionColectiva, usarSolar]);

  // Datos para gráfico de ingresos mensuales
  const datosGrafico = useMemo(() => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const factores = [0.85, 0.90, 0.95, 1.0, 1.05, 1.10, 1.15, 1.10, 1.05, 1.0, 0.95, 1.20];
    return meses.map((mes, i) => ({
      mes,
      ingreso: Math.round(calculos.ingresoMensual * factores[i])
    }));
  }, [calculos.ingresoMensual]);

  const maxIngreso = Math.max(...datosGrafico.map(d => d.ingreso));

  // Casos de uso
  const casosDeUso = [
    {
      icon: UtensilsCrossed,
      titulo: "Restaurantes",
      descripcion: "Atrae clientes que cargan mientras disfrutan de tu menú. Tiempo promedio de estancia: 1-2 horas.",
      beneficio: "Incrementa ticket promedio en 35%",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Building2,
      titulo: "Conjuntos Residenciales",
      descripcion: "Ofrece carga nocturna a residentes. Aprovecha tarifas bajas y alta demanda cautiva.",
      beneficio: "Valorización del inmueble +15%",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Fuel,
      titulo: "Estaciones de Servicio",
      descripcion: "Diversifica tu negocio y prepárate para el futuro. Carga rápida DC ideal.",
      beneficio: "Nueva línea de ingresos sostenible",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Hotel,
      titulo: "Hoteles",
      descripcion: "Diferenciador clave para huéspedes con vehículos eléctricos. Carga durante la noche.",
      beneficio: "Aumenta ocupación en 20%",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Building2,
      titulo: "Centros Comerciales",
      descripcion: "Carga mientras compras. Aumenta tiempo de permanencia y gasto promedio.",
      beneficio: "Mayor tiempo de permanencia",
      color: "from-indigo-500 to-blue-500"
    },
    {
      icon: Home,
      titulo: "Parqueaderos Públicos",
      descripcion: "Monetiza espacios de estacionamiento con carga. Alta rotación de vehículos.",
      beneficio: "Ingresos adicionales por espacio",
      color: "from-teal-500 to-green-500"
    }
  ];

  // Beneficios de la IA
  const beneficiosIA = [
    {
      titulo: "Precios Dinámicos",
      descripcion: "La IA ajusta precios según demanda, hora del día y competencia para maximizar ingresos.",
      incremento: "+25%"
    },
    {
      titulo: "Predicción de Demanda",
      descripcion: "Anticipa picos de uso y optimiza la disponibilidad de tus cargadores.",
      incremento: "+15%"
    },
    {
      titulo: "Mantenimiento Predictivo",
      descripcion: "Detecta problemas antes de que ocurran, minimizando tiempo fuera de servicio.",
      incremento: "-40% downtime"
    },
    {
      titulo: "Análisis de Competencia",
      descripcion: "Monitorea precios de la competencia y sugiere estrategias de pricing.",
      incremento: "+10%"
    }
  ];

  // Estadísticas del mercado actualizadas
  const estadisticas = [
    { valor: "115%", descripcion: "Crecimiento anual del mercado EV en Colombia" },
    { valor: "1:125", descripcion: "Déficit actual de cargadores por vehículo" },
    { valor: "186%", descripcion: "ROI proyectado anual (paquete individual)" },
    { valor: "70%", descripcion: "De los ingresos para el inversionista" }
  ];

  const formatCOP = (valor: number) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-white">EV</span>
              <span className="text-green-400">Green</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="text-white/70 hover:text-white">
                Inicio
              </Button>
            </Link>
            <Link href="/map">
              <Button variant="ghost" className="text-white/70 hover:text-white">
                Estaciones
              </Button>
            </Link>
            <a href="#contacto">
              <Button className="bg-green-500 hover:bg-green-600 text-white">
                Contactar
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-black to-blue-900/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-500/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                <Sparkles className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">Oportunidad de Inversión 2026</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Invierte en el{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  futuro de la movilidad
                </span>
              </h1>
              
              <p className="text-xl text-white/70 leading-relaxed">
                Genera ingresos pasivos con estaciones de carga para vehículos eléctricos. 
                Nosotros operamos, tú recibes el <span className="text-green-400 font-semibold">70% de los ingresos</span>.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">ROI 186%</p>
                    <p className="text-sm text-white/60">Recupera tu inversión en 6-8 meses</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Tecnología Huawei</p>
                    <p className="text-sm text-white/60">Cargadores de clase mundial</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold">IA Integrada</p>
                    <p className="text-sm text-white/60">Precios dinámicos optimizados</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Sun className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Energía Solar</p>
                    <p className="text-sm text-white/60">Reduce costos hasta 70%</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#paquetes">
                  <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white gap-2 w-full sm:w-auto">
                    Ver Paquetes de Inversión
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </a>
                <a href="#calculadora">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2 w-full sm:w-auto">
                    <Calculator className="w-5 h-5" />
                    Calcular mi ROI
                  </Button>
                </a>
              </div>
            </div>

            {/* Stats Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-xl" />
              <Card className="relative bg-slate-900/80 border-white/10 backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <p className="text-white/60 text-sm">Proyección con Paquete Individual</p>
                    <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mt-2">
                      +{calculos.roiAnual.toFixed(0)}% ROI anual
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-black/30">
                      <p className="text-white/60 text-xs">Inversión</p>
                      <p className="text-xl font-bold text-white">{formatCOP(85000000)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-black/30">
                      <p className="text-white/60 text-xs">Ingreso Mensual</p>
                      <p className="text-xl font-bold text-green-400">{formatCOP(calculos.ingresoMensual)}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/60 text-xs">Meses para ROI</p>
                        <p className="text-2xl font-bold text-white">{calculos.roiMeses.toFixed(1)}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Target className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-white/40 text-xs mt-4">
                    *Proyección basada en 12h de uso diario promedio
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Estadísticas del mercado */}
      <section className="py-16 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {estadisticas.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  {stat.valor}
                </p>
                <p className="text-white/60 mt-2">{stat.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Paquetes de Inversión */}
      <section id="paquetes" className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Paquetes de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Inversión
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Dos modalidades diseñadas para diferentes perfiles de inversionista
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Paquete Individual */}
            <Card className="bg-slate-900/50 border-white/10 hover:border-green-500/50 transition-all">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                    Más Popular
                  </span>
                  <Battery className="w-8 h-8 text-green-400" />
                </div>
                <CardTitle className="text-2xl text-white">{PAQUETES.INDIVIDUAL.nombre}</CardTitle>
                <p className="text-white/60">{PAQUETES.INDIVIDUAL.descripcion}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-4 rounded-xl bg-black/30">
                  <p className="text-white/60 text-sm">Inversión Total</p>
                  <p className="text-4xl font-bold text-white">{formatCOP(PAQUETES.INDIVIDUAL.precio)}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-green-400">186%</p>
                    <p className="text-xs text-white/60">ROI Anual</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-green-400">6.4</p>
                    <p className="text-xs text-white/60">Meses Payback</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {PAQUETES.INDIVIDUAL.caracteristicas.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a href="#calculadora">
                  <Button className="w-full bg-green-500 hover:bg-green-600 text-white gap-2">
                    Calcular mi ROI
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Paquete Colectivo */}
            <Card className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-500/30 hover:border-amber-500/50 transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
              <CardHeader className="pb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
                    Mayor Rentabilidad
                  </span>
                  <Sun className="w-8 h-8 text-amber-400" />
                </div>
                <CardTitle className="text-2xl text-white">{PAQUETES.COLECTIVO.nombre}</CardTitle>
                <p className="text-white/60">{PAQUETES.COLECTIVO.descripcion}</p>
              </CardHeader>
              <CardContent className="space-y-6 relative">
                <div className="text-center py-4 rounded-xl bg-black/30">
                  <p className="text-white/60 text-sm">Valor Total Estación</p>
                  <p className="text-4xl font-bold text-white">{formatCOP(PAQUETES.COLECTIVO.precio)}</p>
                  <p className="text-amber-400 text-sm mt-1">
                    Participación mínima: {formatCOP(PAQUETES.COLECTIVO.participacionMinima)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-amber-400">299%</p>
                    <p className="text-xs text-white/60">ROI Anual (con solar)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-amber-400">4.0</p>
                    <p className="text-xs text-white/60">Meses Payback</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {PAQUETES.COLECTIVO.caracteristicas.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a href="#contacto">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2">
                    Solicitar Información
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Calculadora de ROI */}
      <section id="calculadora" className="py-20 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Calcula tu{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Retorno de Inversión
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Ajusta los parámetros según tu ubicación y expectativas para ver el potencial de ingresos
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Panel de configuración */}
            <Card className="bg-slate-800/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-green-400" />
                  Configuración
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Tipo de paquete */}
                <div className="space-y-3">
                  <label className="text-white/80 font-medium">Paquete de Inversión</label>
                  <Tabs value={paqueteSeleccionado} onValueChange={(v) => setPaqueteSeleccionado(v as "INDIVIDUAL" | "COLECTIVO")}>
                    <TabsList className="grid grid-cols-2 bg-slate-700">
                      <TabsTrigger value="INDIVIDUAL" className="data-[state=active]:bg-green-500">
                        <div className="text-left">
                          <p className="font-medium">Individual</p>
                          <p className="text-xs opacity-70">{formatCOP(PAQUETES.INDIVIDUAL.precio)}</p>
                        </div>
                      </TabsTrigger>
                      <TabsTrigger value="COLECTIVO" className="data-[state=active]:bg-amber-500">
                        <div className="text-left">
                          <p className="font-medium">Colectivo</p>
                          <p className="text-xs opacity-70">Desde {formatCOP(PAQUETES.COLECTIVO.participacionMinima)}</p>
                        </div>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Participación colectiva (solo si es colectivo) */}
                {paqueteSeleccionado === "COLECTIVO" && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-white/80 font-medium">Tu Participación</label>
                      <span className="text-amber-400 font-bold">{formatCOP(participacionColectiva)}</span>
                    </div>
                    <Slider
                      value={[participacionColectiva]}
                      onValueChange={(v) => setParticipacionColectiva(v[0])}
                      min={50000000}
                      max={500000000}
                      step={10000000}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-white/40">
                      <span>{formatCOP(50000000)}</span>
                      <span>{formatCOP(500000000)}</span>
                    </div>
                    <p className="text-xs text-amber-400">
                      Participación: {(calculos.porcentajeParticipacion * 100).toFixed(1)}% de la estación
                    </p>
                  </div>
                )}

                {/* Zona premium (solo si es individual) */}
                {paqueteSeleccionado === "INDIVIDUAL" && (
                  <div className="space-y-3">
                    <label className="text-white/80 font-medium">Zona de Ubicación</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(ZONAS_PREMIUM) as [keyof typeof ZONAS_PREMIUM, typeof ZONAS_PREMIUM.A][]).map(([key, zona]) => (
                        <button
                          key={key}
                          onClick={() => setZonaPremium(key)}
                          className={`p-3 rounded-lg border transition-all text-left ${
                            zonaPremium === key
                              ? "bg-green-500/20 border-green-500"
                              : "bg-slate-700/50 border-white/10 hover:border-white/30"
                          }`}
                        >
                          <p className="font-medium text-white text-sm">{zona.nombre}</p>
                          <p className="text-xs text-white/60">{zona.zonas[0]}</p>
                          {zona.fee > 0 && (
                            <p className="text-xs text-green-400 mt-1">+{formatCOP(zona.fee)}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Horas de uso diario */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-white/80 font-medium">Horas de Uso Diario</label>
                    <span className="text-green-400 font-bold">{horasUso}h</span>
                  </div>
                  <Slider
                    value={[horasUso]}
                    onValueChange={(v) => setHorasUso(v[0])}
                    min={4}
                    max={20}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>4h (conservador)</span>
                    <span>20h (optimista)</span>
                  </div>
                </div>

                {/* Precio de venta */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-white/80 font-medium">Precio de Venta (COP/kWh)</label>
                    <span className="text-green-400 font-bold">{formatCOP(precioVenta)}</span>
                  </div>
                  <Slider
                    value={[precioVenta]}
                    onValueChange={(v) => setPrecioVenta(v[0])}
                    min={1400}
                    max={2200}
                    step={100}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>$1,400 (económico)</span>
                    <span>$2,200 (premium)</span>
                  </div>
                </div>

                {/* Info de costos */}
                <div className="p-4 rounded-lg bg-slate-700/50 border border-white/10">
                  <p className="text-sm text-white/60">
                    <span className="text-white font-medium">Costo de energía:</span>{" "}
                    {formatCOP(calculos.costoEnergia)}/kWh
                    {paqueteSeleccionado === "COLECTIVO" && (
                      <span className="text-amber-400 ml-2">(con solar)</span>
                    )}
                  </p>
                  <p className="text-sm text-white/60 mt-1">
                    <span className="text-white font-medium">Tu margen (70%):</span>{" "}
                    <span className="text-green-400">{formatCOP(calculos.margenPorKwh * PORCENTAJE_INVERSIONISTA)}/kWh</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Panel de resultados */}
            <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Proyección de Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Inversión total */}
                <div className="p-4 rounded-lg bg-black/30">
                  <p className="text-white/60 text-sm">Inversión Total</p>
                  <p className="text-3xl font-bold text-white">{formatCOP(calculos.inversionTotal)}</p>
                  {calculos.feePremium > 0 && (
                    <p className="text-xs text-green-400 mt-1">
                      Incluye fee zona premium: {formatCOP(calculos.feePremium)}
                    </p>
                  )}
                </div>

                {/* Ingresos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-black/30">
                    <p className="text-white/60 text-sm">Ingreso Diario</p>
                    <p className="text-2xl font-bold text-green-400">{formatCOP(calculos.ingresoInversionistaDiario)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-black/30">
                    <p className="text-white/60 text-sm">Ingreso Mensual</p>
                    <p className="text-2xl font-bold text-green-400">{formatCOP(calculos.ingresoMensual)}</p>
                  </div>
                </div>

                {/* Ingreso anual destacado */}
                <div className="p-6 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
                  <p className="text-white/80 text-sm">Ingreso Anual Proyectado</p>
                  <p className="text-4xl font-bold text-white mt-1">{formatCOP(calculos.ingresoAnual)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm">
                      {calculos.roiAnual.toFixed(1)}% ROI anual
                    </span>
                  </div>
                </div>

                {/* Tiempo de recuperación */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-black/30">
                  <div>
                    <p className="text-white/60 text-sm">Recuperación de Inversión</p>
                    <p className="text-2xl font-bold text-white">{calculos.roiMeses.toFixed(1)} meses</p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Target className="w-8 h-8 text-green-400" />
                  </div>
                </div>

                {/* Energía vendida */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-black/30">
                    <p className="text-lg font-bold text-white">{calculos.energiaDiaria.toFixed(0)}</p>
                    <p className="text-xs text-white/60">kWh/día</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30">
                    <p className="text-lg font-bold text-white">{calculos.energiaMensual.toLocaleString()}</p>
                    <p className="text-xs text-white/60">kWh/mes</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30">
                    <p className="text-lg font-bold text-white">{calculos.energiaAnual.toLocaleString()}</p>
                    <p className="text-xs text-white/60">kWh/año</p>
                  </div>
                </div>

                <a href="#contacto">
                  <Button className="w-full bg-green-500 hover:bg-green-600 text-white gap-2">
                    Solicitar Asesoría Personalizada
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Casos de uso */}
      <section className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Casos de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Éxito
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Descubre cómo diferentes negocios están generando ingresos con estaciones de carga
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {casosDeUso.map((caso, i) => (
              <Card key={i} className="bg-slate-900/50 border-white/10 hover:border-white/20 transition-all group">
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${caso.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <caso.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{caso.titulo}</h3>
                  <p className="text-white/60 text-sm mb-4">{caso.descripcion}</p>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">{caso.beneficio}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios de la IA */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 text-sm font-medium">Potenciado por IA</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">
              Maximiza tus{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                Ingresos con IA
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Nuestra inteligencia artificial optimiza cada aspecto de tu inversión
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {beneficiosIA.map((beneficio, i) => (
              <Card key={i} className="bg-slate-800/50 border-white/10">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl font-bold text-purple-400">{beneficio.incremento}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{beneficio.titulo}</h3>
                  <p className="text-white/60 text-sm">{beneficio.descripcion}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Gráfico de proyección */}
      <section className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Proyección de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Ingresos Mensuales
              </span>
            </h2>
            <p className="text-white/60 text-lg">
              Estimación basada en variación estacional del mercado
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="bg-slate-900/50 border-white/10">
              <CardContent className="p-8">
                <div className="flex items-end justify-between gap-2 h-64">
                  {datosGrafico.map((dato, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg transition-all hover:from-green-400 hover:to-emerald-300"
                        style={{ height: `${(dato.ingreso / maxIngreso) * 100}%` }}
                      />
                      <span className="text-xs text-white/60">{dato.mes}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Ingreso Promedio Mensual</p>
                    <p className="text-2xl font-bold text-green-400">{formatCOP(calculos.ingresoMensual)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-sm">Ingreso Anual Total</p>
                    <p className="text-2xl font-bold text-white">{formatCOP(calculos.ingresoAnual)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Sección de contacto */}
      <section id="contacto" className="py-20 bg-gradient-to-b from-slate-900 to-black">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                ¿Listo para{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  Invertir?
                </span>
              </h2>
              <p className="text-white/60 text-lg">
                Agenda una reunión con nuestro equipo de inversiones
              </p>
            </div>

            <Card className="bg-slate-800/50 border-white/10">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-3 gap-6">
                  <a href="mailto:inversiones@evgreen.lat" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Email</p>
                      <p className="text-white font-medium">inversiones@evgreen.lat</p>
                    </div>
                  </a>
                  
                  <a href="tel:+573001234567" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">WhatsApp</p>
                      <p className="text-white font-medium">+57 300 123 4567</p>
                    </div>
                  </a>
                  
                  <a href="https://evgreen.lat" target="_blank" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Portal</p>
                      <p className="text-white font-medium">evgreen.lat</p>
                    </div>
                  </a>
                </div>

                <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Award className="w-8 h-8 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Garantía de Transparencia</h3>
                      <p className="text-white/60">
                        Dashboard en tiempo real con todas tus métricas. Liquidaciones mensuales automáticas.
                        Sin letras pequeñas, sin sorpresas.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">
                <span className="text-white">EV</span>
                <span className="text-green-400">Green</span>
              </span>
            </div>
            <p className="text-white/40 text-sm">
              © 2026 EVGreen. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="text-white/40 hover:text-white text-sm">
                Términos
              </Link>
              <Link href="/privacy" className="text-white/40 hover:text-white text-sm">
                Privacidad
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
