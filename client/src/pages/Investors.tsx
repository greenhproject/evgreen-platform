/**
 * Página de Inversionistas - EVGreen
 * 
 * Página sofisticada para atraer inversionistas potenciales.
 * Incluye calculadora de ROI, casos de uso, gráficos de ingresos
 * y beneficios de la plataforma con IA.
 * 
 * Modelo de Negocio Actualizado (Feb 2026):
 * - Precio compra energía: $850 COP/kWh (promedio red)
 * - Precio compra energía solar: $250 COP/kWh
 * - Precio venta energía: $1,700 COP/kWh (promedio DC)
 * - Distribución: 70% inversionista / 30% plataforma
 * - Paquete Individual: $85M (1x Huawei FusionCharge 120kW)
 * - Paquete Colectivo: $1,000M (Estación 4x120kW = 480kW total + Solar)
 */

import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
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
  Bolt,
  Flame,
  Timer,
  TrendingDown
} from "lucide-react";

// ============================================================================
// CONSTANTES DE NEGOCIO - MODELO REALISTA (Feb 2026)
// ============================================================================

// Costos de energía
const PRECIO_COMPRA_KWH_RED = 850; // COP promedio de la red
const PRECIO_COMPRA_KWH_SOLAR = 250; // COP con energía solar propia

// Precio de venta al usuario final
const PRECIO_VENTA_KWH_MIN = 1400;
const PRECIO_VENTA_KWH_MAX = 2200;
const PRECIO_VENTA_KWH_DEFAULT = 1800;

// Distribución de ingresos
const PORCENTAJE_INVERSIONISTA = 0.70; // 70% para el inversionista
const PORCENTAJE_PLATAFORMA = 0.30; // 30% para EVGreen

// Costos operativos estimados (% del ingreso bruto)
const COSTOS_OPERATIVOS_PORCENTAJE = 0.15; // 15% mantenimiento, seguros, etc.

// ============================================================================
// PAQUETES DE INVERSIÓN CORREGIDOS
// ============================================================================

const PAQUETES = {
  INDIVIDUAL: {
    nombre: "Paquete Individual",
    descripcion: "1 Cargador Huawei FusionCharge 120kW DC",
    precio: 85000000, // $85 millones COP
    potenciaKw: 120, // 120 kW por cargador
    cantidadCargadores: 1,
    tipo: "DC Rápido",
    conSolar: false,
    horasUsoConservador: 4,
    horasUsoOptimista: 12,
    horasUsoRealista: 6, // Promedio realista
    eficienciaCarga: 0.92, // 92% eficiencia
    caracteristicas: [
      "Cargador Huawei FusionCharge 120kW",
      "Instalación profesional incluida",
      "100% propiedad del inversionista",
      "Mantenimiento preventivo por EVGreen",
      "Dashboard en tiempo real",
      "Liquidaciones mensuales automáticas"
    ]
  },
  COLECTIVO: {
    nombre: "Estación Premium Colectiva",
    descripcion: "4 Cargadores DC 120kW = 480kW potencia total + Solar",
    precio: 1000000000, // $1,000 millones COP
    potenciaKw: 120, // 120 kW por cargador
    cantidadCargadores: 4, // 4 cargadores
    potenciaTotal: 480, // 4 × 120kW = 480kW total
    tipo: "DC Rápido + Solar",
    conSolar: true,
    horasUsoConservador: 4,
    horasUsoOptimista: 14,
    horasUsoRealista: 8, // Mayor uso por ubicación premium
    eficienciaCarga: 0.92,
    participacionMinima: 50000000, // $50 millones mínimo
    caracteristicas: [
      "4 cargadores DC 120kW (480kW total)",
      "Sistema de energía solar integrado",
      "Reducción ~70% costo de energía",
      "Participación proporcional como socio",
      "Ubicaciones premium garantizadas",
      "Mayor ROI con energía solar"
    ]
  }
};

// ============================================================================
// ROADMAP DE ESTACIONES POR CIUDAD (CROWDFUNDING)
// ============================================================================

const ESTACIONES_ROADMAP = [
  {
    id: "bogota-1",
    ciudad: "Bogotá",
    zona: "Usaquén / Zona Norte",
    metaInversion: 1000000000,
    montoRecaudado: 650000000, // Ejemplo: 65% financiado
    inversionistas: 8,
    fechaObjetivo: "Q2 2026",
    estado: "EN_FINANCIAMIENTO",
    prioridad: 1
  },
  {
    id: "medellin-1",
    ciudad: "Medellín",
    zona: "El Poblado",
    metaInversion: 1000000000,
    montoRecaudado: 420000000, // 42% financiado
    inversionistas: 5,
    fechaObjetivo: "Q3 2026",
    estado: "EN_FINANCIAMIENTO",
    prioridad: 2
  },
  {
    id: "cali-1",
    ciudad: "Cali",
    zona: "Ciudad Jardín",
    metaInversion: 1000000000,
    montoRecaudado: 180000000, // 18% financiado
    inversionistas: 3,
    fechaObjetivo: "Q4 2026",
    estado: "EN_FINANCIAMIENTO",
    prioridad: 3
  },
  {
    id: "barranquilla-1",
    ciudad: "Barranquilla",
    zona: "Alto Prado",
    metaInversion: 1000000000,
    montoRecaudado: 50000000, // 5% financiado
    inversionistas: 1,
    fechaObjetivo: "Q1 2027",
    estado: "ABIERTO",
    prioridad: 4
  },
  {
    id: "cartagena-1",
    ciudad: "Cartagena",
    zona: "Bocagrande",
    metaInversion: 1000000000,
    montoRecaudado: 0,
    inversionistas: 0,
    fechaObjetivo: "Q2 2027",
    estado: "PROXIMAMENTE",
    prioridad: 5
  }
];

// Zonas premium con fee adicional (solo paquete individual)
const ZONAS_PREMIUM = {
  A: { nombre: "Zona Premium A", zonas: ["Usaquén", "Chapinero", "Zona T"], fee: 5000000 },
  B: { nombre: "Zona Premium B", zonas: ["Suba Norte", "Cedritos", "Santa Bárbara"], fee: 3000000 },
  C: { nombre: "Zona Estándar", zonas: ["Otras zonas de Bogotá"], fee: 0 }
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Investors() {
  // Estado para la calculadora
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<"INDIVIDUAL" | "COLECTIVO">("COLECTIVO");
  const [horasUso, setHorasUso] = useState(4); // Conservador por defecto
  const [precioVenta, setPrecioVenta] = useState(PRECIO_VENTA_KWH_DEFAULT);
  const [zonaPremium, setZonaPremium] = useState<"A" | "B" | "C">("C");
  const [participacionColectiva, setParticipacionColectiva] = useState(50000000);

  // ============================================================================
  // CÁLCULOS DE ROI - MODELO REALISTA
  // ============================================================================
  
  const calculos = useMemo(() => {
    const paquete = PAQUETES[paqueteSeleccionado];
    
    // Costo de energía según tipo de paquete
    const costoEnergia = paquete.conSolar ? PRECIO_COMPRA_KWH_SOLAR : PRECIO_COMPRA_KWH_RED;
    
    let inversionBase: number;
    let potenciaEfectiva: number; // kW que realmente usa el inversionista
    let porcentajeParticipacion = 1;

    if (paqueteSeleccionado === "INDIVIDUAL") {
      inversionBase = paquete.precio;
      potenciaEfectiva = paquete.potenciaKw * paquete.cantidadCargadores;
    } else {
      // Inversión colectiva - participación proporcional
      inversionBase = participacionColectiva;
      porcentajeParticipacion = participacionColectiva / paquete.precio;
      // La potencia efectiva es proporcional a la participación
      potenciaEfectiva = (paquete as any).potenciaTotal * porcentajeParticipacion;
    }

    // Fee por zona premium (solo individual)
    const feePremium = paqueteSeleccionado === "INDIVIDUAL" ? ZONAS_PREMIUM[zonaPremium].fee : 0;
    const inversionTotal = inversionBase + feePremium;

    // ========================================
    // CÁLCULO DE ENERGÍA VENDIDA
    // ========================================
    
    // Energía teórica máxima por día = potencia × horas de uso
    const energiaTeoricaDiaria = potenciaEfectiva * horasUso; // kWh
    
    // Aplicar eficiencia de carga (pérdidas en conversión)
    const energiaRealDiaria = energiaTeoricaDiaria * paquete.eficienciaCarga;
    
    const energiaMensual = energiaRealDiaria * 30;
    const energiaAnual = energiaRealDiaria * 365;

    // ========================================
    // CÁLCULO DE INGRESOS Y MÁRGENES
    // ========================================
    
    // Margen bruto por kWh (antes de distribución)
    const margenBrutoPorKwh = precioVenta - costoEnergia;
    
    // Ingreso bruto diario (lo que paga el usuario)
    const ingresoBrutoDiario = energiaRealDiaria * precioVenta;
    
    // Costo de energía diario
    const costoEnergiaDiario = energiaRealDiaria * costoEnergia;
    
    // Margen bruto diario (antes de distribución)
    const margenBrutoDiario = ingresoBrutoDiario - costoEnergiaDiario;
    
    // Costos operativos (mantenimiento, seguros, etc.)
    const costosOperativosDiarios = margenBrutoDiario * COSTOS_OPERATIVOS_PORCENTAJE;
    
    // Margen neto disponible para distribución
    const margenNetoDistribuible = margenBrutoDiario - costosOperativosDiarios;
    
    // Ingreso del inversionista (70% del margen neto)
    const ingresoInversionistaDiario = margenNetoDistribuible * PORCENTAJE_INVERSIONISTA;
    
    // Ingresos mensuales y anuales
    const ingresoMensual = ingresoInversionistaDiario * 30;
    const ingresoAnual = ingresoInversionistaDiario * 365;

    // ========================================
    // CÁLCULO DE ROI
    // ========================================
    
    // Meses para recuperar la inversión
    const roiMeses = ingresoMensual > 0 ? inversionTotal / ingresoMensual : 999;
    
    // ROI anual como porcentaje
    const roiAnual = inversionTotal > 0 ? (ingresoAnual / inversionTotal) * 100 : 0;

    // Margen neto por kWh para el inversionista
    const margenNetoPorKwhInversionista = (margenBrutoPorKwh * (1 - COSTOS_OPERATIVOS_PORCENTAJE)) * PORCENTAJE_INVERSIONISTA;

    return {
      // Energía
      energiaDiaria: Math.round(energiaRealDiaria),
      energiaMensual: Math.round(energiaMensual),
      energiaAnual: Math.round(energiaAnual),
      
      // Ingresos
      ingresoBrutoDiario: Math.round(ingresoBrutoDiario),
      costoEnergiaDiario: Math.round(costoEnergiaDiario),
      margenBrutoDiario: Math.round(margenBrutoDiario),
      ingresoInversionistaDiario: Math.round(ingresoInversionistaDiario),
      ingresoMensual: Math.round(ingresoMensual),
      ingresoAnual: Math.round(ingresoAnual),
      
      // Inversión
      inversionTotal,
      inversionBase,
      feePremium,
      
      // ROI
      roiMeses: Math.max(roiMeses, 0),
      roiAnual: Math.max(roiAnual, 0),
      
      // Márgenes
      costoEnergia,
      margenBrutoPorKwh,
      margenNetoPorKwhInversionista: Math.round(margenNetoPorKwhInversionista),
      
      // Participación
      porcentajeParticipacion,
      potenciaEfectiva
    };
  }, [paqueteSeleccionado, horasUso, precioVenta, zonaPremium, participacionColectiva]);

  // ============================================================================
  // DATOS PARA GRÁFICO DE PROYECCIÓN MENSUAL
  // ============================================================================
  
  const datosGrafico = useMemo(() => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    // Factores de estacionalidad (variación por mes)
    const factores = [0.85, 0.90, 0.95, 1.0, 1.05, 1.10, 1.15, 1.10, 1.05, 1.0, 0.95, 1.20];
    
    return meses.map((mes, i) => ({
      mes,
      ingreso: Math.round(calculos.ingresoMensual * factores[i])
    }));
  }, [calculos.ingresoMensual]);

  const maxIngreso = Math.max(...datosGrafico.map(d => d.ingreso), 1);

  // ============================================================================
  // CASOS DE USO
  // ============================================================================
  
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
    { valor: "115%", descripcion: "Crecimiento anual del mercado EV en Colombia" },
    { valor: "1:125", descripcion: "Déficit actual de cargadores por vehículo" },
    { valor: "70%", descripcion: "De los ingresos para el inversionista" },
    { valor: "480kW", descripcion: "Potencia total estación colectiva" }
  ];

  const formatCOP = (valor: number) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  const formatCOPShort = (valor: number) => {
    if (valor >= 1000000000) {
      return `$${(valor / 1000000000).toFixed(0)}MM`;
    }
    if (valor >= 1000000) {
      return `$${(valor / 1000000).toFixed(0)}M`;
    }
    return formatCOP(valor);
  };

  // ============================================================================
  // COMPONENTE DE CROWDFUNDING CON DATOS DE LA BD
  // ============================================================================
  
  const CrowdfundingSection = () => {
    const { data: proyectos, isLoading } = trpc.crowdfunding.getProjects.useQuery();
    
    // Fallback a datos estáticos si no hay datos de la BD
    const estaciones = proyectos && proyectos.length > 0 ? proyectos.map(p => ({
      id: p.id.toString(),
      ciudad: p.city,
      zona: p.zone,
      metaInversion: Number(p.targetAmount),
      montoRecaudado: Number(p.raisedAmount),
      inversionistas: p.investorCount || 0,
      fechaObjetivo: p.targetDate ? new Date(p.targetDate).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) : 'TBD',
      estado: p.status,
      prioridad: p.priority
    })) : ESTACIONES_ROADMAP;

    return (
      <section id="crowdfunding" className="py-20 bg-gradient-to-b from-black to-slate-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">Inversión Colectiva</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">
              Estaciones en{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                Financiamiento
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Únete a otros inversionistas para financiar estaciones premium en las principales ciudades de Colombia.
              Meta por estación: <span className="text-amber-400 font-bold">$1,000 millones COP</span>
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {estaciones.map((estacion) => {
                const porcentaje = (estacion.montoRecaudado / estacion.metaInversion) * 100;
                const esProximamente = estacion.estado === "DRAFT" || estacion.estado === "PROXIMAMENTE";
                const estaCompleto = porcentaje >= 100 || estacion.estado === "FUNDED";
                
                return (
                  <Card 
                    key={estacion.id} 
                    className={`relative overflow-hidden transition-all ${
                      esProximamente 
                        ? "bg-slate-800/30 border-white/5 opacity-60" 
                        : estaCompleto
                          ? "bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/30"
                          : "bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-500/20 hover:border-amber-500/40"
                    }`}
                  >
                    {/* Badge de estado */}
                    <div className="absolute top-3 right-3">
                      {esProximamente ? (
                        <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-400 text-xs">
                          Próximamente
                        </span>
                      ) : estaCompleto ? (
                        <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Financiado
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {estacion.fechaObjetivo}
                        </span>
                      )}
                    </div>

                    <CardContent className="p-6">
                      {/* Ciudad y zona */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          esProximamente ? "bg-slate-700" : "bg-gradient-to-br from-amber-500 to-orange-600"
                        }`}>
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{estacion.ciudad}</h3>
                          <p className="text-sm text-white/60">{estacion.zona}</p>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-white/60">Progreso</span>
                          <span className={`font-bold ${esProximamente ? "text-slate-500" : "text-amber-400"}`}>
                            {porcentaje.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              estaCompleto 
                                ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                                : "bg-gradient-to-r from-amber-500 to-orange-400"
                            }`}
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Montos */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-black/30">
                          <p className="text-xs text-white/60">Recaudado</p>
                          <p className={`text-lg font-bold ${esProximamente ? "text-slate-500" : "text-white"}`}>
                            {formatCOPShort(estacion.montoRecaudado)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-black/30">
                          <p className="text-xs text-white/60">Meta</p>
                          <p className="text-lg font-bold text-white/80">
                            {formatCOPShort(estacion.metaInversion)}
                          </p>
                        </div>
                      </div>

                      {/* Inversionistas */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-white/60">
                          <Users className="w-4 h-4" />
                          <span>{estacion.inversionistas} inversionistas</span>
                        </div>
                        <span className="text-white/40">
                          Faltan {formatCOPShort(estacion.metaInversion - estacion.montoRecaudado)}
                        </span>
                      </div>

                      {/* Botón de acción */}
                      {!esProximamente && !estaCompleto && (
                        <a href="#contacto">
                          <Button className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white gap-2">
                            Invertir en {estacion.ciudad}
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Info adicional */}
          <div className="mt-12 max-w-3xl mx-auto">
            <Card className="bg-slate-800/50 border-amber-500/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">¿Cómo funciona la inversión colectiva?</h3>
                    <ul className="space-y-2 text-white/70 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span>Inversión mínima de <strong className="text-white">$50 millones COP</strong> por participante</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span>Tu participación es <strong className="text-white">proporcional a tu inversión</strong> (ej: $100M = 10% de la estación)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span>Recibes el <strong className="text-white">70% de los ingresos</strong> según tu porcentaje de participación</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span>Dashboard personalizado con <strong className="text-white">métricas en tiempo real</strong> de tu inversión</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    );
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
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-500/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-medium">Oportunidad de Inversión 2026</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Invierte en el{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Futuro de la Movilidad
              </span>
            </h1>
            
            <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
              Sé parte de la revolución eléctrica en Colombia. Genera ingresos pasivos con estaciones de carga 
              mientras contribuyes a un futuro más sostenible.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <a href="#calculadora">
                <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white gap-2">
                  <Calculator className="w-5 h-5" />
                  Calcular mi ROI
                </Button>
              </a>
              <a href="#crowdfunding">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2">
                  <Users className="w-5 h-5" />
                  Ver Estaciones Disponibles
                </Button>
              </a>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {estadisticas.map((stat, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-2xl md:text-3xl font-bold text-green-400">{stat.valor}</p>
                  <p className="text-sm text-white/60">{stat.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Crowdfunding - Estaciones por Ciudad */}
      <CrowdfundingSection />

      {/* Paquetes de inversión */}
      <section className="py-20 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Paquetes de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Inversión
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Elige el modelo que mejor se adapte a tu capacidad de inversión
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Paquete Individual */}
            <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30 hover:border-green-500/50 transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl" />
              <CardHeader className="pb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                    100% Propietario
                  </span>
                  <Zap className="w-8 h-8 text-green-400" />
                </div>
                <CardTitle className="text-2xl text-white">{PAQUETES.INDIVIDUAL.nombre}</CardTitle>
                <p className="text-white/60">{PAQUETES.INDIVIDUAL.descripcion}</p>
              </CardHeader>
              <CardContent className="space-y-6 relative">
                <div className="text-center py-4 rounded-xl bg-black/30">
                  <p className="text-white/60 text-sm">Inversión Total</p>
                  <p className="text-4xl font-bold text-white">{formatCOP(PAQUETES.INDIVIDUAL.precio)}</p>
                  <p className="text-green-400 text-sm mt-1">
                    {PAQUETES.INDIVIDUAL.potenciaKw}kW de potencia
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-green-400">~50%</p>
                    <p className="text-xs text-white/60">ROI Anual (6h/día)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-green-400">~24</p>
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
                    <p className="text-2xl font-bold text-amber-400">~85%</p>
                    <p className="text-xs text-white/60">ROI Anual (con solar)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-amber-400">~14</p>
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

                <a href="#crowdfunding">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2">
                    Ver Estaciones Disponibles
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Calculadora de ROI */}
      <section id="calculadora" className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Calcula tu{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Retorno de Inversión
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Ajusta los parámetros según tu ubicación y expectativas para ver el potencial de ingresos.
              <br />
              <span className="text-amber-400">Nota: Estos son estimados conservadores basados en 4 horas de uso diario.</span>
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
                      ({calculos.potenciaEfectiva.toFixed(0)}kW de 480kW)
                    </p>
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
                    min={PRECIO_VENTA_KWH_MIN}
                    max={PRECIO_VENTA_KWH_MAX}
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
                    <span className="text-white font-medium">Tu margen neto (70%):</span>{" "}
                    <span className="text-green-400">{formatCOP(calculos.margenNetoPorKwhInversionista)}/kWh</span>
                  </p>
                  <p className="text-xs text-white/40 mt-2">
                    * Se descuenta 15% para costos operativos (mantenimiento, seguros)
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
                  {paqueteSeleccionado === "COLECTIVO" && (
                    <p className="text-xs text-amber-400 mt-1">
                      {(calculos.porcentajeParticipacion * 100).toFixed(1)}% de la estación
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
                    <p className="text-2xl font-bold text-white">
                      {calculos.roiMeses < 100 ? `${calculos.roiMeses.toFixed(1)} meses` : "N/A"}
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Target className="w-8 h-8 text-green-400" />
                  </div>
                </div>

                {/* Energía vendida */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-black/30">
                    <p className="text-lg font-bold text-white">{calculos.energiaDiaria.toLocaleString()}</p>
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

      {/* Gráfico de proyección mensual */}
      <section className="py-20 bg-slate-900">
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
            <Card className="bg-slate-800/50 border-white/10">
              <CardContent className="p-8">
                {/* Gráfico de barras */}
                <div className="flex items-end justify-between gap-2 h-64">
                  {datosGrafico.map((dato, i) => {
                    const altura = maxIngreso > 0 ? (dato.ingreso / maxIngreso) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full flex flex-col items-center justify-end h-48">
                          <span className="text-xs text-white/60 mb-1 transform -rotate-45 origin-bottom-left whitespace-nowrap">
                            {formatCOPShort(dato.ingreso)}
                          </span>
                          <div 
                            className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg transition-all hover:from-green-400 hover:to-emerald-300"
                            style={{ height: `${Math.max(altura, 5)}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/60">{dato.mes}</span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Resumen */}
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
