/**
 * Página de Inversionistas - EVGreen
 * 
 * Página sofisticada para atraer inversionistas potenciales.
 * Incluye calculadora de ROI, casos de uso, gráficos de ingresos
 * y beneficios de la plataforma con IA.
 * 
 * Datos base:
 * - Precio compra energía: $800 COP/kWh
 * - Precio venta energía: $1,800 COP/kWh (promedio país)
 * - Margen bruto: $1,000 COP/kWh
 * - Potencias: 7kW (carga media AC), 100kW (carga rápida DC)
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  MapPin
} from "lucide-react";

// Constantes de negocio
const PRECIO_COMPRA_KWH = 800; // COP
const PRECIO_VENTA_KWH = 1800; // COP promedio
const MARGEN_BRUTO_KWH = PRECIO_VENTA_KWH - PRECIO_COMPRA_KWH; // $1,000 COP
const PORCENTAJE_INVERSIONISTA = 0.80; // 80% para el inversionista

// Tipos de cargadores
const CARGADORES = {
  AC_7KW: { nombre: "Carga Media AC", potencia: 7, tipo: "AC", precio: 8500000 },
  DC_100KW: { nombre: "Carga Rápida DC", potencia: 100, tipo: "DC", precio: 85000000 }
};

export default function Investors() {
  // Estado para la calculadora
  const [horasUso, setHorasUso] = useState(8);
  const [tipoCargador, setTipoCargador] = useState<"AC_7KW" | "DC_100KW">("AC_7KW");
  const [cantidadCargadores, setCantidadCargadores] = useState(2);
  const [precioVenta, setPrecioVenta] = useState(1800);

  // Cálculos de ROI
  const calculos = useMemo(() => {
    const cargador = CARGADORES[tipoCargador];
    const energiaDiaria = cargador.potencia * horasUso * cantidadCargadores; // kWh/día
    const energiaMensual = energiaDiaria * 30; // kWh/mes
    const energiaAnual = energiaDiaria * 365; // kWh/año

    const margenPorKwh = precioVenta - PRECIO_COMPRA_KWH;
    const ingresoBrutoDiario = energiaDiaria * precioVenta;
    const costoDiario = energiaDiaria * PRECIO_COMPRA_KWH;
    const margenBrutoDiario = energiaDiaria * margenPorKwh;
    const ingresoInversionistaDiario = margenBrutoDiario * PORCENTAJE_INVERSIONISTA;

    const ingresoMensual = ingresoInversionistaDiario * 30;
    const ingresoAnual = ingresoInversionistaDiario * 365;

    const inversionTotal = cargador.precio * cantidadCargadores;
    const roiMeses = inversionTotal / ingresoMensual;
    const roiAnual = (ingresoAnual / inversionTotal) * 100;

    return {
      energiaDiaria,
      energiaMensual,
      energiaAnual,
      ingresoBrutoDiario,
      costoDiario,
      margenBrutoDiario,
      ingresoInversionistaDiario,
      ingresoMensual,
      ingresoAnual,
      inversionTotal,
      roiMeses,
      roiAnual,
      margenPorKwh
    };
  }, [horasUso, tipoCargador, cantidadCargadores, precioVenta]);

  // Datos para gráfico de ingresos mensuales
  const datosGrafico = useMemo(() => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    // Simulación de variación estacional (más uso en meses de vacaciones)
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

  // Estadísticas del mercado
  const estadisticas = [
    { valor: "45%", descripcion: "Crecimiento anual del mercado EV en Colombia" },
    { valor: "2030", descripcion: "Meta de 600,000 vehículos eléctricos en el país" },
    { valor: "$1,000", descripcion: "Margen bruto por kWh vendido (COP)" },
    { valor: "80%", descripcion: "De los ingresos para el inversionista" }
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
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-black to-blue-900/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-500/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                <Sparkles className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">Oportunidad de Inversión</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Invierte en el{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  futuro de la movilidad
                </span>
              </h1>
              
              <p className="text-xl text-white/70 leading-relaxed">
                Genera ingresos pasivos con estaciones de carga para vehículos eléctricos. 
                Nosotros operamos, tú recibes el <span className="text-green-400 font-semibold">80% de los ingresos</span>.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">ROI Atractivo</p>
                    <p className="text-sm text-white/60">Recupera tu inversión en 18-36 meses</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Sin Riesgos</p>
                    <p className="text-sm text-white/60">Operación y mantenimiento incluido</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold">IA Integrada</p>
                    <p className="text-sm text-white/60">Optimización automática de precios</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold">24/7 Monitoreo</p>
                    <p className="text-sm text-white/60">Dashboard en tiempo real</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <a href="#calculadora">
                  <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white gap-2">
                    <Calculator className="w-5 h-5" />
                    Calcular mi ROI
                  </Button>
                </a>
                <a href="#contacto">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2">
                    <Phone className="w-5 h-5" />
                    Hablar con un asesor
                  </Button>
                </a>
              </div>
            </div>

            {/* Card de ingresos animada */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-3xl blur-xl" />
              <Card className="relative bg-gradient-to-br from-slate-900 to-slate-800 border-white/10 overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white/80 text-lg">Ingresos Proyectados</CardTitle>
                    <span className="text-green-400 text-sm font-medium bg-green-500/20 px-2 py-1 rounded">
                      +{calculos.roiAnual.toFixed(0)}% ROI anual
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-4xl font-bold text-white">
                      {formatCOP(calculos.ingresoMensual)}
                    </p>
                    <p className="text-white/60">Ingreso mensual estimado</p>
                  </div>

                  {/* Gráfico de barras */}
                  <div className="h-40 flex items-end gap-1">
                    {datosGrafico.map((dato, i) => (
                      <div key={dato.mes} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t transition-all duration-500"
                          style={{ 
                            height: `${(dato.ingreso / maxIngreso) * 100}%`,
                            opacity: 0.5 + (dato.ingreso / maxIngreso) * 0.5
                          }}
                        />
                        <span className="text-[10px] text-white/40">{dato.mes}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{formatCOP(calculos.ingresoAnual)}</p>
                      <p className="text-xs text-white/60">Ingreso anual</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">{calculos.roiMeses.toFixed(0)}</p>
                      <p className="text-xs text-white/60">Meses ROI</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">{calculos.energiaAnual.toLocaleString()}</p>
                      <p className="text-xs text-white/60">kWh/año</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Estadísticas del mercado */}
      <section className="py-16 bg-gradient-to-b from-black to-slate-900">
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
                {/* Tipo de cargador */}
                <div className="space-y-3">
                  <label className="text-white/80 font-medium">Tipo de Cargador</label>
                  <Tabs value={tipoCargador} onValueChange={(v) => setTipoCargador(v as "AC_7KW" | "DC_100KW")}>
                    <TabsList className="grid grid-cols-2 bg-slate-700">
                      <TabsTrigger value="AC_7KW" className="data-[state=active]:bg-green-500">
                        <div className="text-left">
                          <p className="font-medium">Carga Media AC</p>
                          <p className="text-xs opacity-70">7 kW • {formatCOP(CARGADORES.AC_7KW.precio)}</p>
                        </div>
                      </TabsTrigger>
                      <TabsTrigger value="DC_100KW" className="data-[state=active]:bg-blue-500">
                        <div className="text-left">
                          <p className="font-medium">Carga Rápida DC</p>
                          <p className="text-xs opacity-70">100 kW • {formatCOP(CARGADORES.DC_100KW.precio)}</p>
                        </div>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Cantidad de cargadores */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-white/80 font-medium">Cantidad de Cargadores</label>
                    <span className="text-green-400 font-bold">{cantidadCargadores}</span>
                  </div>
                  <Slider
                    value={[cantidadCargadores]}
                    onValueChange={(v) => setCantidadCargadores(v[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>

                {/* Horas de uso diario */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-white/80 font-medium">Horas de Uso Diario</label>
                    <span className="text-green-400 font-bold">{horasUso}h</span>
                  </div>
                  <Slider
                    value={[horasUso]}
                    onValueChange={(v) => setHorasUso(v[0])}
                    min={2}
                    max={20}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>2h (bajo)</span>
                    <span>20h (alto)</span>
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
                    min={1200}
                    max={2500}
                    step={100}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>$1,200 (económico)</span>
                    <span>$2,500 (premium)</span>
                  </div>
                </div>

                {/* Info de costos */}
                <div className="p-4 rounded-lg bg-slate-700/50 border border-white/10">
                  <p className="text-sm text-white/60">
                    <span className="text-white font-medium">Costo de energía:</span> {formatCOP(PRECIO_COMPRA_KWH)}/kWh
                  </p>
                  <p className="text-sm text-white/60 mt-1">
                    <span className="text-white font-medium">Tu margen:</span>{" "}
                    <span className="text-green-400">{formatCOP(calculos.margenPorKwh)}/kWh</span>
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
                  <p className="text-xs text-white/40 mt-1">
                    {cantidadCargadores} × {CARGADORES[tipoCargador].nombre}
                  </p>
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
                    <p className="text-2xl font-bold text-white">{calculos.roiMeses.toFixed(0)} meses</p>
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
              Descubre cómo diferentes negocios están generando ingresos pasivos con estaciones de carga
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {casosDeUso.map((caso, i) => (
              <Card key={i} className="bg-slate-900/50 border-white/10 hover:border-green-500/30 transition-all group overflow-hidden">
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${caso.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <caso.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{caso.titulo}</h3>
                  <p className="text-white/60 mb-4">{caso.descripcion}</p>
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
      <section className="py-20 bg-gradient-to-b from-black to-slate-900">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 text-sm font-medium">Inteligencia Artificial</span>
              </div>
              <h2 className="text-4xl font-bold mb-6">
                Maximiza tus ingresos con{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                  IA Predictiva
                </span>
              </h2>
              <p className="text-white/60 text-lg mb-8">
                Nuestra plataforma utiliza inteligencia artificial para optimizar automáticamente 
                los precios, predecir la demanda y maximizar tus ingresos sin que tengas que hacer nada.
              </p>

              <div className="space-y-4">
                {beneficiosIA.map((beneficio, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-slate-800/50 border border-white/5">
                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-400 font-bold">{beneficio.incremento}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{beneficio.titulo}</h4>
                      <p className="text-sm text-white/60">{beneficio.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-xl" />
              <Card className="relative bg-slate-900/80 border-purple-500/20">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                      <Brain className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">EVGreen AI</h3>
                    <p className="text-white/60">Optimización inteligente 24/7</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
                      <span className="text-white/80">Incremento promedio de ingresos</span>
                      <span className="text-green-400 font-bold">+35%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
                      <span className="text-white/80">Reducción de tiempo inactivo</span>
                      <span className="text-blue-400 font-bold">-40%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
                      <span className="text-white/80">Satisfacción del cliente</span>
                      <span className="text-purple-400 font-bold">98%</span>
                    </div>
                  </div>

                  <div className="mt-8 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <p className="text-sm text-white/80 text-center">
                      "La IA ha incrementado mis ingresos en un 40% ajustando precios automáticamente según la demanda"
                    </p>
                    <p className="text-xs text-purple-400 text-center mt-2">— Inversionista EVGreen</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Por qué elegirnos */}
      <section className="py-20 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              ¿Por qué invertir con{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                EVGreen
              </span>
              ?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-slate-800/50 border-white/10 text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">80% de Ingresos</h3>
              <p className="text-white/60">Tú recibes la mayor parte de los ingresos generados</p>
            </Card>

            <Card className="bg-slate-800/50 border-white/10 text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Operación Incluida</h3>
              <p className="text-white/60">Nosotros nos encargamos de todo el mantenimiento</p>
            </Card>

            <Card className="bg-slate-800/50 border-white/10 text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Dashboard 24/7</h3>
              <p className="text-white/60">Monitorea tus ingresos en tiempo real desde cualquier lugar</p>
            </Card>

            <Card className="bg-slate-800/50 border-white/10 text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
                <Leaf className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Impacto Ambiental</h3>
              <p className="text-white/60">Contribuye a la reducción de emisiones de CO2</p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA y Contacto */}
      <section id="contacto" className="py-20 bg-gradient-to-b from-slate-900 to-black">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/20 overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold mb-4">
                    ¿Listo para{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                      invertir
                    </span>
                    ?
                  </h2>
                  <p className="text-white/60 text-lg">
                    Contáctanos y un asesor te guiará en todo el proceso
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <a href="tel:+573001234567" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Llámanos</p>
                      <p className="text-white font-medium">+57 300 123 4567</p>
                    </div>
                  </a>

                  <a href="mailto:inversiones@evgreen.co" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Escríbenos</p>
                      <p className="text-white font-medium">inversiones@evgreen.co</p>
                    </div>
                  </a>

                  <a href="https://wa.me/573001234567" target="_blank" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">WhatsApp</p>
                      <p className="text-white font-medium">Chatea con nosotros</p>
                    </div>
                  </a>
                </div>

                <div className="text-center">
                  <Link href="/register">
                    <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white gap-2">
                      Registrarme como Inversionista
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <p className="text-white/40 text-sm mt-4">
                    Al registrarte, un asesor te contactará en menos de 24 horas
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-black border-t border-white/10">
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
              <span className="text-white/40 text-sm">by Green House Project</span>
            </div>
            <p className="text-white/40 text-sm">
              © 2026 EVGreen. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
