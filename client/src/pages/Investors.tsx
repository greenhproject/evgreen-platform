/**
 * Página de Inversionistas - EVGreen
 * 
 * Página sofisticada para atraer inversionistas potenciales.
 * Incluye calculadora de ROI, casos de uso, gráficos de ingresos
 * y beneficios de la plataforma con IA.
 * 
 * TODOS los parámetros financieros se cargan dinámicamente desde
 * la configuración de la plataforma (settings.getCalculatorParams).
 * NO hay valores hardcodeados de costos de energía, márgenes ni ROI.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  TrendingDown,
  Crown,
  Star,
  Camera,
  ChevronLeft,
  MessageCircle,
  Filter,
  Loader2,
  X,
  Image as ImageIcon,
  Eye,
  Send,
  User
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MapView } from "@/components/Map";

// ============================================================================
// NOTA: Todos los parámetros financieros (costos de energía, precios de venta,
// distribución, costos operativos) se cargan dinámicamente desde el backend
// a través de trpc.settings.getCalculatorParams. Los defaults solo se usan
// como fallback si el backend no responde.
// ============================================================================

// ============================================================================
// PAQUETES DE INVERSIÓN CORREGIDOS
// ============================================================================

const PAQUETES = {
  AC: {
    nombre: "Paquete AC Básico",
    descripcion: "1 Cargador AC 7.4kW - Ideal para residencias y comercios",
    precio: 8500000, // $8.5 millones COP
    potenciaKw: 7.4, // 7.4 kW carga lenta
    cantidadCargadores: 1,
    tipo: "AC Lento",
    conSolar: false,
    horasUsoConservador: 6,
    horasUsoOptimista: 16,
    horasUsoRealista: 10, // Mayor uso por carga nocturna
    eficienciaCarga: 0.95, // 95% eficiencia AC
    caracteristicas: [
      "Cargador AC 7.4kW Tipo 2",
      "Instalación profesional incluida",
      "100% propiedad del inversionista",
      "Ideal para carga nocturna",
      "Dashboard en tiempo real",
      "Liquidaciones mensuales automáticas"
    ]
  },
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

// Zonas con fee adicional por alta demanda (paquetes Individual y AC)
// El fee se cobra por ubicación en zonas de alto tráfico vehicular eléctrico
const ZONAS_PREMIUM = {
  A: { 
    nombre: "Zona Alta Demanda", 
    zonas: ["Usaquén", "Chapinero", "Zona T", "Aeropuerto", "Centros Comerciales"], 
    fee: 5000000,
    descripcion: "Zonas con mayor flujo de vehículos eléctricos y demanda garantizada"
  },
  B: { 
    nombre: "Zona Media Demanda", 
    zonas: ["Suba Norte", "Cedritos", "Santa Bárbara", "Corredores Viales"], 
    fee: 3000000,
    descripcion: "Zonas con buen tráfico y crecimiento de demanda"
  },
  C: { 
    nombre: "Zona Estándar", 
    zonas: ["Otras zonas de Bogotá y ciudades principales"], 
    fee: 0,
    descripcion: "Sin fee adicional - demanda variable"
  }
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Investors() {
  // Estado para la calculadora
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<"AC" | "INDIVIDUAL" | "COLECTIVO">("COLECTIVO");
  const [horasUso, setHorasUso] = useState(4); // Conservador por defecto
  const [precioVenta, setPrecioVenta] = useState(1800); // Default, se sincroniza con backend
  const [zonaPremium, setZonaPremium] = useState<"A" | "B" | "C">("C");
  const [participacionColectiva, setParticipacionColectiva] = useState(50000000);
  const [escenario, setEscenario] = useState<"pesimista" | "realista" | "optimista">("realista");

  // Cargar parámetros de la calculadora desde el backend
  const { data: calcParams } = trpc.settings.getCalculatorParams.useQuery();

  // Parámetros dinámicos (del backend o defaults)
  const params = useMemo(() => ({
    factorUtilizacionPremium: calcParams?.factorUtilizacionPremium ?? 2.0,
    costosOpIndividual: (calcParams?.costosOperativosIndividual ?? 15) / 100,
    costosOpColectivo: (calcParams?.costosOperativosColectivo ?? 10) / 100,
    costosOpAC: (calcParams?.costosOperativosAC ?? 15) / 100,
    eficienciaDC: (calcParams?.eficienciaCargaDC ?? 92) / 100,
    eficienciaAC: (calcParams?.eficienciaCargaAC ?? 95) / 100,
    costoEnergiaRed: calcParams?.costoEnergiaRed ?? 850,
    costoEnergiaSolar: calcParams?.costoEnergiaSolar ?? 250,
    precioVentaDefault: calcParams?.precioVentaDefault ?? 1800,
    precioVentaMin: calcParams?.precioVentaMin ?? 1400,
    precioVentaMax: calcParams?.precioVentaMax ?? 2200,
    inversionistaPct: (calcParams?.investorPercentage ?? 70) / 100,
    aliadoPct: (calcParams?.hostPercentage ?? 10) / 100,
  }), [calcParams]);

  // Sincronizar precio de venta con el backend cuando se carguen los params
  useEffect(() => {
    if (calcParams?.precioVentaDefault) {
      setPrecioVenta(calcParams.precioVentaDefault);
    }
  }, [calcParams?.precioVentaDefault]);

  // ROI estimado dinámico para las cards de paquetes (escenario conservador: 4h/día)
  const paqueteROIs = useMemo(() => {
    const calcROI = (paquete: typeof PAQUETES.AC | typeof PAQUETES.INDIVIDUAL, costoEnergia: number, costosOpPct: number, horasBase: number, factorUtil: number = 1) => {
      const potencia = 'potenciaTotal' in paquete ? (paquete as any).potenciaTotal : paquete.potenciaKw * paquete.cantidadCargadores;
      const eficiencia = paquete.tipo.includes('AC') ? params.eficienciaAC : params.eficienciaDC;
      const energiaDia = potencia * horasBase * factorUtil * eficiencia;
      // Para colectivo: (PV-CE) × 90% aliado × 70% tu parte (sin costos op separados)
      const margenDia = energiaDia * (params.precioVentaDefault - costoEnergia) * (1 - params.aliadoPct) * (1 - costosOpPct) * params.inversionistaPct;
      const inversion = 'participacionMinima' in paquete ? (paquete as any).participacionMinima : paquete.precio;
      const participacion = 'participacionMinima' in paquete ? (paquete as any).participacionMinima / paquete.precio : 1;
      const ingresoDia = margenDia * participacion;
      const roiAnual = inversion > 0 ? (ingresoDia * 365 / inversion * 100) : 0;
      const paybackMeses = ingresoDia > 0 ? (inversion / (ingresoDia * 30)) : 999;
      return { roiAnual: Math.round(roiAnual), paybackMeses: Math.round(paybackMeses) };
    };
    return {
      AC: calcROI(PAQUETES.AC, params.costoEnergiaRed, params.costosOpAC, PAQUETES.AC.horasUsoConservador),
      INDIVIDUAL: calcROI(PAQUETES.INDIVIDUAL, params.costoEnergiaRed, params.costosOpIndividual, PAQUETES.INDIVIDUAL.horasUsoConservador),
      COLECTIVO: calcROI(PAQUETES.COLECTIVO, params.costoEnergiaSolar, 0, PAQUETES.COLECTIVO.horasUsoConservador, params.factorUtilizacionPremium), // Sin costos op separados en colectivo
    };
  }, [params]);

  // Factores de escenario: afectan las horas de uso y el precio
  const factorEscenario = useMemo(() => {
    switch (escenario) {
      case "pesimista": return { horasMult: 0.6, precioMult: 0.85, label: "Pesimista", desc: "Baja demanda, precios competitivos" };
      case "realista": return { horasMult: 1.0, precioMult: 1.0, label: "Realista", desc: "Proyección base con parámetros actuales" };
      case "optimista": return { horasMult: 1.4, precioMult: 1.10, label: "Optimista", desc: "Alta demanda, precios premium" };
    }
  }, [escenario]);

  // ============================================================================
  // CÁLCULOS DE ROI - MODELO DINÁMICO
  // ============================================================================
  // Todos los parámetros financieros (costos de energía, márgenes, distribución)
  // se cargan dinámicamente desde el backend (settings.getCalculatorParams).
  // No hay valores hardcodeados en los cálculos.
  // ============================================================================
  
  const calculos = useMemo(() => {
    const paquete = PAQUETES[paqueteSeleccionado];
    
    // Costo de energía según tipo de paquete (desde backend)
    const costoEnergia = paquete.conSolar ? params.costoEnergiaSolar : params.costoEnergiaRed;
    
    // Costos operativos diferenciados (desde backend)
    // NOTA: Para COLECTIVO no aplican costos operativos separados (economías de escala)
    // Fórmula colectiva: (PV - CE) × 90% aliado × 70% tu parte
    const costosOperativosPct = paqueteSeleccionado === "COLECTIVO" 
      ? 0  // Sin costos operativos separados en modelo colectivo
      : paqueteSeleccionado === "AC" 
        ? params.costosOpAC 
        : params.costosOpIndividual;
    
    // Horas de uso con factor de escenario
    const horasBase = horasUso * factorEscenario.horasMult;
    
    // Factor de utilización premium (desde backend) para colectivo
    const horasUsoEfectivas = paqueteSeleccionado === "COLECTIVO" 
      ? horasBase * params.factorUtilizacionPremium
      : horasBase;
    
    // Precio de venta ajustado por escenario
    const precioVentaEfectivo = Math.round(precioVenta * factorEscenario.precioMult);
    
    let inversionBase: number;
    let potenciaTotal: number; // Potencia total de la estación/cargador
    let porcentajeParticipacion = 1;

    if (paqueteSeleccionado === "AC") {
      // Paquete AC - cargador lento para residencias/comercios
      inversionBase = paquete.precio;
      potenciaTotal = paquete.potenciaKw * paquete.cantidadCargadores; // 7.4kW
    } else if (paqueteSeleccionado === "INDIVIDUAL") {
      inversionBase = paquete.precio;
      potenciaTotal = paquete.potenciaKw * paquete.cantidadCargadores; // 120kW
    } else {
      // Inversión colectiva - participación proporcional
      inversionBase = participacionColectiva;
      porcentajeParticipacion = participacionColectiva / paquete.precio;
      potenciaTotal = (paquete as any).potenciaTotal; // 480kW total de la estación
    }

    // Fee por zona de alta demanda (aplica a AC e Individual, no a Colectivo)
    const feePremium = (paqueteSeleccionado === "INDIVIDUAL" || paqueteSeleccionado === "AC") ? ZONAS_PREMIUM[zonaPremium].fee : 0;
    const inversionTotal = inversionBase + feePremium;

    // ========================================
    // CÁLCULO DE ENERGÍA VENDIDA (ESTACIÓN COMPLETA)
    // ========================================
    
    // Energía teórica máxima por día de TODA la estación
    const energiaTeoricaDiariaEstacion = potenciaTotal * horasUsoEfectivas; // kWh
    
    // Aplicar eficiencia de carga (desde backend según tipo)
    const eficiencia = paqueteSeleccionado === "AC" ? params.eficienciaAC : params.eficienciaDC;
    const energiaRealDiariaEstacion = energiaTeoricaDiariaEstacion * eficiencia;

    // ========================================
    // CÁLCULO DE INGRESOS DE LA ESTACIÓN
    // ========================================
    
    // Margen bruto por kWh (antes de distribución)
    const margenBrutoPorKwh = precioVentaEfectivo - costoEnergia;
    
    // Ingreso bruto diario de la estación (lo que paga el usuario)
    const ingresoBrutoDiarioEstacion = energiaRealDiariaEstacion * precioVentaEfectivo;
    
    // Costo de energía diario de la estación
    const costoEnergiaDiarioEstacion = energiaRealDiariaEstacion * costoEnergia;
    
    // Margen bruto diario de la estación (antes de distribución)
    const margenBrutoDiarioEstacion = ingresoBrutoDiarioEstacion - costoEnergiaDiarioEstacion;
    
    // Costos operativos de la estación (mantenimiento, seguros, etc.)
    const costosOperativosDiariosEstacion = margenBrutoDiarioEstacion * costosOperativosPct;
    
    // Descuento del aliado comercial (% del margen bruto, se descuenta PRIMERO)
    const aliadoComercialDiarioEstacion = margenBrutoDiarioEstacion * params.aliadoPct;
    
    // Margen después del aliado
    const margenDespuesAliadoEstacion = margenBrutoDiarioEstacion - aliadoComercialDiarioEstacion;
    
    // Margen neto disponible para distribución de la estación
    const margenNetoDistribuibleEstacion = margenDespuesAliadoEstacion - costosOperativosDiariosEstacion;
    
    // Margen para inversionistas (% del margen neto de la estación, desde backend)
    const margenInversionistasEstacion = margenNetoDistribuibleEstacion * params.inversionistaPct;

    // ========================================
    // CÁLCULO DE INGRESOS DEL INVERSIONISTA
    // ========================================
    
    // Ingreso del inversionista según su participación
    const ingresoInversionistaDiario = margenInversionistasEstacion * porcentajeParticipacion;
    
    // Ingresos mensuales y anuales
    const ingresoMensual = ingresoInversionistaDiario * 30;
    const ingresoAnual = ingresoInversionistaDiario * 365;
    
    // Energía proporcional del inversionista (para mostrar)
    const energiaRealDiaria = energiaRealDiariaEstacion * porcentajeParticipacion;
    const energiaMensual = energiaRealDiaria * 30;
    const energiaAnual = energiaRealDiaria * 365;

    // ========================================
    // CÁLCULO DE ROI
    // ========================================
    
    // Meses para recuperar la inversión
    const roiMeses = ingresoMensual > 0 ? inversionTotal / ingresoMensual : 999;
    
    // ROI anual como porcentaje
    const roiAnual = inversionTotal > 0 ? (ingresoAnual / inversionTotal) * 100 : 0;

    // Margen neto por kWh para el inversionista (con factor de escenario)
    const margenNetoPorKwhInversionista = (margenBrutoPorKwh * (1 - params.aliadoPct) * (1 - costosOperativosPct)) * params.inversionistaPct;
    
    // Margen neto BASE por kWh (sin factor de escenario, para mostrar en info box)
    const margenBrutoBase = precioVenta - costoEnergia;
    const margenNetoBaseInversionista = (margenBrutoBase * (1 - params.aliadoPct) * (1 - costosOperativosPct)) * params.inversionistaPct;
    
    // Potencia efectiva del inversionista (para mostrar)
    const potenciaEfectiva = potenciaTotal * porcentajeParticipacion;

    return {
      // Energía (proporcional al inversionista)
      energiaDiaria: Math.round(energiaRealDiaria),
      energiaMensual: Math.round(energiaMensual),
      energiaAnual: Math.round(energiaAnual),
      
      // Ingresos (proporcionales al inversionista)
      ingresoBrutoDiario: Math.round(ingresoBrutoDiarioEstacion * porcentajeParticipacion),
      costoEnergiaDiario: Math.round(costoEnergiaDiarioEstacion * porcentajeParticipacion),
      margenBrutoDiario: Math.round(margenBrutoDiarioEstacion * porcentajeParticipacion),
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
      margenNetoBaseInversionista: Math.round(margenNetoBaseInversionista),
      costosOperativosPct,
      precioVentaBase: precioVenta,
      
      // Participación
      porcentajeParticipacion,
      potenciaEfectiva,
      potenciaTotal,
      horasUsoEfectivas,
      precioVentaEfectivo,
      escenarioLabel: factorEscenario.label
    };
  }, [paqueteSeleccionado, horasUso, precioVenta, zonaPremium, participacionColectiva, params, factorEscenario]);

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

  // Estadísticas del mercado (dinámicas desde params)
  const estadisticas = [
    { valor: "115%", descripcion: "Crecimiento anual del mercado EV en Colombia" },
    { valor: "1:125", descripcion: "Déficit actual de cargadores por vehículo" },
    { valor: `${Math.round(params.inversionistaPct * 100)}%`, descripcion: "Del neto para el inversionista" },
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
                        <a href={`https://wa.me/573054124009?text=${encodeURIComponent(`Hola EVGreen, estoy interesado en invertir en la estación de ${estacion.ciudad}. Me gustaría recibir más información.`)}`} target="_blank" rel="noopener noreferrer">
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
                        <span>Recibes el <strong className="text-white">{Math.round(params.inversionistaPct * 100)}% del neto</strong> (después de aliado comercial) según tu participación</span>
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

  // ============================================================================
  // MAPA INTERACTIVO DE ESPACIOS PUBLICADOS
  // ============================================================================

  const SPACE_TYPE_LABELS: Record<string, string> = {
    parking: "Parqueadero", mall: "Centro comercial", gas_station: "Estación de servicio",
    hotel: "Hotel", restaurant: "Restaurante", office_building: "Oficinas",
    residential: "Residencial", supermarket: "Supermercado", hospital: "Hospital",
    university: "Universidad", airport: "Aeropuerto", highway_rest: "Parador", other: "Otro",
  };

  const PHOTO_TYPE_LABELS: Record<string, string> = {
    general: "Vista general", electrical_panel: "Tablero eléctrico", transformer: "Transformador",
    parking_area: "Área de parqueo", access_road: "Vía de acceso", surroundings: "Alrededores", other: "Otra",
  };

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  }

  function getScoreBg(score: number): string {
    if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30";
    if (score >= 60) return "bg-yellow-500/20 border-yellow-500/30";
    if (score >= 40) return "bg-orange-500/20 border-orange-500/30";
    return "bg-red-500/20 border-red-500/30";
  }

  function formatCOPMap(value: number): string {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString("es-CO")}`;
  }

  const PublishedSpacesMapSection = () => {
    const { data: spaces, isLoading: spacesLoading } = trpc.spaces.listPublished.useQuery();
    const { data: cfProjects } = trpc.crowdfunding.getProjects.useQuery();
    const [selectedSpace, setSelectedSpace] = useState<any>(null);
    const [selectedPremium, setSelectedPremium] = useState<any>(null);
    const [spaceFilter, setSpaceFilter] = useState<string>("all");
    const [mapFilter, setMapFilter] = useState<string>("all"); // "all" | "premium" | "individual"
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [showContactForm, setShowContactForm] = useState(false);
    const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", interestedAmount: "", message: "" });
    const [contactSent, setContactSent] = useState(false);

    // Premium stations from crowdfunding (OPEN, ACTIVE, IN_PROGRESS, FUNDED) with coordinates
    const premiumStations = useMemo(() => {
      if (!cfProjects) return [];
      return (cfProjects as any[]).filter((p: any) => 
        p.status !== 'DRAFT' && p.linkedLatitude && p.linkedLongitude
      ).map((p: any) => ({
        ...p,
        _isPremium: true,
        latitude: p.linkedLatitude,
        longitude: p.linkedLongitude,
      }));
    }, [cfProjects]);

    const incrementViewMut = trpc.spaces.incrementView.useMutation();
    const submitLeadMut = trpc.spaces.submitLead.useMutation({
      onSuccess: () => {
        setContactSent(true);
        toast.success("¡Solicitud enviada! Te contactaremos pronto.");
        setContactForm({ name: "", email: "", phone: "", interestedAmount: "", message: "" });
      },
      onError: (err) => {
        toast.error(err.message || "Error al enviar la solicitud");
      },
    });

    // Increment view when selecting a space
    const handleSelectSpace = useCallback((space: any) => {
      setSelectedSpace(space);
      setShowContactForm(false);
      setContactSent(false);
      incrementViewMut.mutate({ id: space.id });
    }, [incrementViewMut]);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const overlaysRef = useRef<google.maps.OverlayView[]>([]);
    const [mapReady, setMapReady] = useState(false);

    const filteredSpaces = useMemo(() => {
      if (!spaces) return [];
      // Excluir espacios de tipo "colectiva" - esos solo aparecen como Premium (marcadores naranjas)
      const individualSpaces = (spaces as any[]).filter((s: any) => s.investmentType !== "colectiva");
      if (spaceFilter === "all") return individualSpaces;
      return individualSpaces.filter((s: any) => s.spaceType === spaceFilter);
    }, [spaces, spaceFilter]);

    const handleMapReady = useCallback((map: google.maps.Map) => {
      mapRef.current = map;
      setMapReady(true);
    }, []);

    // Custom overlay class for rich HTML markers
    const createCustomOverlay = useCallback((map: google.maps.Map, position: google.maps.LatLng, html: string, onClick: () => void) => {
      class CustomOverlay extends google.maps.OverlayView {
        private div: HTMLDivElement | null = null;
        private pos: google.maps.LatLng;
        private htmlContent: string;
        private clickHandler: () => void;

        constructor(pos: google.maps.LatLng, htmlContent: string, clickHandler: () => void) {
          super();
          this.pos = pos;
          this.htmlContent = htmlContent;
          this.clickHandler = clickHandler;
        }

        onAdd() {
          this.div = document.createElement("div");
          this.div.style.position = "absolute";
          this.div.style.cursor = "pointer";
          this.div.style.transform = "translate(-50%, -100%)";
          this.div.innerHTML = this.htmlContent;
          this.div.addEventListener("click", (e) => {
            e.stopPropagation();
            this.clickHandler();
          });
          const panes = this.getPanes();
          panes?.overlayMouseTarget.appendChild(this.div);
        }

        draw() {
          if (!this.div) return;
          const overlayProjection = this.getProjection();
          const point = overlayProjection.fromLatLngToDivPixel(this.pos);
          if (point) {
            this.div.style.left = point.x + "px";
            this.div.style.top = point.y + "px";
          }
        }

        onRemove() {
          if (this.div?.parentNode) {
            this.div.parentNode.removeChild(this.div);
          }
          this.div = null;
        }
      }

      const overlay = new CustomOverlay(position, html, onClick);
      overlay.setMap(map);
      return overlay;
    }, []);

    // Clustering logic: group nearby markers at low zoom
    const clusterSpaces = useCallback((spaces: any[], zoom: number) => {
      if (zoom >= 10 || spaces.length <= 5) return spaces.map(s => ({ type: 'single' as const, spaces: [s], lat: parseFloat(s.latitude || '0'), lng: parseFloat(s.longitude || '0') }));
      
      const clusters: { type: 'cluster' | 'single'; spaces: any[]; lat: number; lng: number }[] = [];
      const used = new Set<number>();
      const threshold = zoom <= 6 ? 2.0 : zoom <= 8 ? 1.0 : 0.5;

      spaces.forEach((space, i) => {
        if (used.has(i) || !space.latitude || !space.longitude) return;
        const lat = parseFloat(space.latitude);
        const lng = parseFloat(space.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const cluster: { type: 'cluster' | 'single'; spaces: any[]; lat: number; lng: number } = { type: 'cluster', spaces: [space], lat, lng };
        used.add(i);

        spaces.forEach((other, j) => {
          if (used.has(j) || !other.latitude || !other.longitude) return;
          const oLat = parseFloat(other.latitude);
          const oLng = parseFloat(other.longitude);
          if (isNaN(oLat) || isNaN(oLng)) return;
          if (Math.abs(lat - oLat) < threshold && Math.abs(lng - oLng) < threshold) {
            cluster.spaces.push(other);
            used.add(j);
          }
        });

        if (cluster.spaces.length === 1) cluster.type = 'single';
        clusters.push(cluster);
      });
      return clusters;
    }, []);

    // Add markers when spaces load and map is ready
    useEffect(() => {
      if (!mapRef.current || !mapReady || !filteredSpaces?.length) return;
      if (!window.google?.maps) return;
      // Clear old overlays
      try {
        overlaysRef.current.forEach(o => { try { o.setMap(null); } catch {} });
      } catch {}
      overlaysRef.current = [];
      try {
        markersRef.current.forEach(m => { try { m.setMap(null); } catch {} });
      } catch {}
      markersRef.current = [];

      const renderMarkers = () => {
        try { overlaysRef.current.forEach(o => { try { o.setMap(null); } catch {} }); } catch {}
        overlaysRef.current = [];

        if (!mapRef.current) return;
        const zoom = mapRef.current.getZoom() || 6;

        // ========== PREMIUM STATION MARKERS (Gold Star) ==========
        if (mapFilter === 'all' || mapFilter === 'premium') {
          premiumStations.forEach((project: any) => {
            const lat = parseFloat(project.latitude);
            const lng = parseFloat(project.longitude);
            if (isNaN(lat) || isNaN(lng)) return;
            const position = new google.maps.LatLng(lat, lng);

            const fundingPct = project.targetAmount > 0
              ? Math.min(100, Math.round((Number(project.raisedAmount) / Number(project.targetAmount)) * 100))
              : 0;
            const investors = project.investorCount || 0;

            const premiumHtml = `
              <div style="position:relative;">
                <div style="
                  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                  width:64px; height:64px; border-radius:50%;
                  background: rgba(245, 158, 11, 0.25);
                  animation: markerPulse 2s ease-out infinite;
                "></div>
                <div style="
                  position:relative;
                  background: linear-gradient(135deg, #f59e0b, #d97706);
                  color: white; padding: 8px 14px; border-radius: 18px; font-size: 12px;
                  font-weight: 800; box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 30px rgba(245,158,11,0.4);
                  display: flex; align-items: center; gap: 6px; white-space: nowrap;
                  border: 2.5px solid #b45309;
                  animation: markerBounce 3s ease-in-out infinite;
                ">
                  <span style="font-size:16px;">\u2B50</span>
                  <span style="font-size:13px;">${project.city}</span>
                  <span style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:8px;font-size:10px;">${fundingPct}%</span>
                </div>
                <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;
                  border-top:9px solid #d97706;
                  margin:0 auto; position:relative;"></div>
                <div style="text-align:center;margin-top:2px;">
                  <span style="background:rgba(0,0,0,0.8);color:#fbbf24;font-size:9px;padding:2px 6px;border-radius:6px;font-weight:700;letter-spacing:0.5px;">PREMIUM</span>
                </div>
              </div>
            `;

            const overlay = createCustomOverlay(
              mapRef.current!,
              position,
              premiumHtml,
              () => {
                setSelectedSpace(null);
                setSelectedPremium(project);
                if (mapRef.current) {
                  mapRef.current.panTo(position);
                  mapRef.current.setZoom(Math.max(zoom, 12));
                }
              }
            );
            overlaysRef.current.push(overlay);
          });
        }

        // ========== INDIVIDUAL SPACE MARKERS (Green Bolt) ==========
        if (mapFilter === 'all' || mapFilter === 'individual') {
          const clusters = clusterSpaces(filteredSpaces, zoom);

          clusters.forEach((cluster) => {
            if (cluster.type === 'cluster' && cluster.spaces.length > 1) {
              // Render cluster marker
              const totalKw = cluster.spaces.reduce((sum: number, s: any) => sum + (s.estimatedPowerKw || 0), 0);
              const position = new google.maps.LatLng(cluster.lat, cluster.lng);
              const count = cluster.spaces.length;
              const clusterHtml = `
                <div style="position:relative;">
                  <div style="
                    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    width:56px; height:56px; border-radius:50%;
                    background: rgba(16, 185, 129, 0.2);
                    animation: markerPulse 2.5s ease-out infinite;
                  "></div>
                  <div style="
                    position:relative;
                    background: linear-gradient(135deg, #059669, #10b981);
                    color: white; width:44px; height:44px; border-radius:50%;
                    font-weight: 800; box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 24px rgba(16,185,129,0.4);
                    display: flex; align-items: center; justify-content: center; flex-direction: column;
                    border: 3px solid #047857;
                    animation: markerBounce 3s ease-in-out infinite;
                  ">
                    <span style="font-size:14px;line-height:1;">${count}</span>
                    <span style="font-size:8px;opacity:0.8;line-height:1;">puntos</span>
                  </div>
                  <div style="text-align:center;margin-top:2px;">
                    <span style="background:rgba(0,0,0,0.7);color:#10b981;font-size:9px;padding:1px 5px;border-radius:6px;font-weight:600;">${totalKw}kW</span>
                  </div>
                </div>
              `;
              const overlay = createCustomOverlay(
                mapRef.current!,
                position,
                clusterHtml,
                () => {
                  mapRef.current!.setZoom(Math.min(14, zoom + 3));
                  mapRef.current!.panTo(position);
                }
              );
              overlaysRef.current.push(overlay);
            } else {
              // Render single individual marker
              const space = cluster.spaces[0];
              if (!space.latitude || !space.longitude) return;
              const lat = parseFloat(space.latitude);
              const lng = parseFloat(space.longitude);
              if (isNaN(lat) || isNaN(lng)) return;
              const position = new google.maps.LatLng(lat, lng);

              const fundingPct = space.crowdfunding
                ? Math.min(100, Math.round((space.crowdfunding.raisedAmount / space.crowdfunding.targetAmount) * 100))
                : 0;
              const score = space.aiScore || 0;
              const bgColor = fundingPct >= 100 ? '#059669' : fundingPct >= 50 ? '#d97706' : '#10b981';
              const borderColor = fundingPct >= 100 ? '#047857' : fundingPct >= 50 ? '#b45309' : '#059669';

              const html = `
                <div style="position:relative;">
                  <div style="
                    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    width:48px; height:48px; border-radius:50%;
                    background: ${bgColor}33;
                    animation: markerPulse 2s ease-out infinite;
                  "></div>
                  <div style="
                    position:relative;
                    background: ${bgColor};
                    color: white; padding: 6px 12px; border-radius: 16px; font-size: 12px;
                    font-weight: 700; box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 20px ${bgColor}44;
                    display: flex; align-items: center; gap: 5px; white-space: nowrap;
                    border: 2px solid ${borderColor};
                    animation: markerBounce 3s ease-in-out infinite;
                  ">
                    <span style="font-size:14px;">\u26a1</span>
                    <span>${space.estimatedPowerKw || '?'}kW</span>
                    ${score ? `<span style="background:rgba(0,0,0,0.3);padding:1px 5px;border-radius:8px;font-size:10px;margin-left:2px;">${score}pts</span>` : ''}
                  </div>
                  <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;
                    border-top:8px solid ${bgColor};
                    margin:0 auto; position:relative;"></div>
                </div>
              `;

              const overlay = createCustomOverlay(
                mapRef.current!,
                position,
                html,
                () => {
                  setSelectedPremium(null);
                  handleSelectSpace(space);
                }
              );
              overlaysRef.current.push(overlay);
            }
          });
        }
      };

      // Initial render
      renderMarkers();

      // Re-render on zoom change for clustering
      const zoomListener = mapRef.current.addListener('zoom_changed', () => {
        renderMarkers();
      });

      // Fit bounds - wrapped in try-catch to prevent crash on stale map instances
      try {
        const bounds = new google.maps.LatLngBounds();
        let hasValidCoords = false;
        filteredSpaces.forEach((space: any) => {
          if (!space.latitude || !space.longitude) return;
          const lat = parseFloat(space.latitude);
          const lng = parseFloat(space.longitude);
          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
          bounds.extend({ lat, lng });
          hasValidCoords = true;
        });
        if (hasValidCoords && mapRef.current) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          if (ne && sw && typeof ne.lat === 'function' && typeof sw.lat === 'function') {
            mapRef.current.fitBounds(bounds, 60);
          }
        }
      } catch (e) {
        console.warn('[EVGreen] fitBounds error (non-fatal):', e);
      }

      return () => {
        try { google.maps.event.removeListener(zoomListener); } catch {}
      };
    }, [filteredSpaces, mapReady, createCustomOverlay, clusterSpaces, premiumStations, mapFilter]);

    const contactAdvisor = (space: any) => {
      const message = encodeURIComponent(
        `Hola, estoy interesado en el punto de inversión "${space.spaceName}" en ${space.city} (Código: ${space.code}). Me gustaría recibir más información.`
      );
      window.open(`https://wa.me/573054124009?text=${message}`, "_blank");
    };

    const parseAIAnalysis = (analysis: string | null): any => {
      if (!analysis) return null;
      try { return JSON.parse(analysis); } catch { return null; }
    };

    if (!spaces || spaces.length === 0) {
      if (spacesLoading) {
        return (
          <section className="py-16 bg-gradient-to-b from-slate-900 to-black">
            <div className="container mx-auto px-4 text-center">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <p className="text-white/60 mt-3">Cargando puntos de inversión...</p>
            </div>
          </section>
        );
      }
      return null; // No published spaces yet, don't show section
    }

    return (
      <section id="mapa-espacios" className="py-20 bg-gradient-to-b from-black to-slate-900">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">Puntos Verificados por IA</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">
              Mapa de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300">
                Oportunidades
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Explora puntos de carga verificados y evaluados por IA en toda Colombia.
              Cada punto ha sido aprobado técnicamente y cuenta con carta de intención firmada.
            </p>
            {/* Stats */}
            <div className="flex items-center justify-center gap-6 flex-wrap mt-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-gray-300">
                  <strong className="text-amber-400">{premiumStations.length}</strong> estaciones Premium
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">{filteredSpaces?.length || 0}</strong> puntos individuales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">
                    {(spaces as any[])?.reduce((sum: number, s: any) => sum + (s.estimatedPowerKw || 0), 0) || 0}
                  </strong> kW totales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">
                  <strong className="text-white">
                    {new Set((spaces as any[])?.map((s: any) => s.city) || []).size}
                  </strong> ciudades
                </span>
              </div>
            </div>
          </div>

          {/* Main Content: Map + List */}
          <div className="grid lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {/* Left: Map */}
            <div className="lg:col-span-2">
              {/* Map Type Filter: Premium / Individual / Todos */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                {[
                  { key: "all", label: "Todos", icon: "\uD83D\uDCCD", activeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                  { key: "premium", label: "Premium", icon: "\u2B50", activeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
                  { key: "individual", label: "Individual", icon: "\u26A1", activeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setMapFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                      mapFilter === f.key
                        ? f.activeClass
                        : "bg-slate-800 text-gray-400 border-slate-700 hover:border-gray-600"
                    }`}
                  >
                    {f.icon} {f.label}
                  </button>
                ))}
                <span className="text-gray-600 text-xs">|</span>
                {/* Space type sub-filter (only for individual) */}
                {(mapFilter === 'all' || mapFilter === 'individual') && [
                  { key: "all", label: "Todos tipos" },
                  { key: "parking", label: "Parqueadero" },
                  { key: "mall", label: "C. Comercial" },
                  { key: "gas_station", label: "E. Servicio" },
                ].map(f => (
                  <button
                    key={`type-${f.key}`}
                    onClick={() => setSpaceFilter(f.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors border ${
                      spaceFilter === f.key
                        ? "bg-slate-700 text-white border-slate-600"
                        : "bg-slate-800/50 text-gray-500 border-slate-700/50 hover:border-gray-600"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Map */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700 h-[400px] lg:h-[550px]">
                {/* Legend overlay */}
                <div className="absolute bottom-3 left-3 z-10 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
                  <div className="flex items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-700" />
                      <span className="text-amber-400 font-medium">Premium (Colectiva)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-700" />
                      <span className="text-emerald-400 font-medium">Individual</span>
                    </div>
                  </div>
                </div>
                <MapView
                  onMapReady={handleMapReady}
                  initialCenter={{ lat: 4.6, lng: -74.08 }}
                  initialZoom={6}
                />
              </div>
            </div>

            {/* Right: List or Detail */}
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
              {selectedPremium ? (
                /* PREMIUM DETAIL VIEW */
                <div className="bg-gradient-to-br from-amber-900/30 to-slate-800/80 border border-amber-500/30 rounded-2xl overflow-hidden">
                  <div className="relative h-36 bg-gradient-to-br from-amber-600/30 to-amber-800/30 flex items-center justify-center">
                    <div className="text-center">
                      <Star className="w-12 h-12 text-amber-400 mx-auto mb-1" />
                      <span className="text-amber-400 text-xs font-bold tracking-wider">ESTACIÓN PREMIUM</span>
                    </div>
                    <button
                      onClick={() => setSelectedPremium(null)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{selectedPremium.name || `Estación ${selectedPremium.city}`}</h3>
                      <p className="text-sm text-amber-400/80">{selectedPremium.city} • {selectedPremium.zone}</p>
                      {selectedPremium.address && <p className="text-xs text-gray-500 mt-1">{selectedPremium.address}</p>}
                    </div>

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">Meta inversión</p>
                        <p className="text-base font-bold text-amber-400">{formatCOPMap(Number(selectedPremium.targetAmount))}</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">Recaudado</p>
                        <p className="text-base font-bold text-emerald-400">{formatCOPMap(Number(selectedPremium.raisedAmount))}</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">Potencia total</p>
                        <p className="text-base font-bold text-white">{selectedPremium.totalPowerKw} kW</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">Inversionistas</p>
                        <p className="text-base font-bold text-white">{selectedPremium.investorCount || 0}</p>
                      </div>
                    </div>

                    {/* Funding progress */}
                    <div className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Progreso de financiamiento</span>
                        <span className="text-sm font-bold text-amber-400">
                          {Math.min(100, Math.round((Number(selectedPremium.raisedAmount) / Number(selectedPremium.targetAmount)) * 100))}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all"
                          style={{ width: `${Math.min(100, Math.round((Number(selectedPremium.raisedAmount) / Number(selectedPremium.targetAmount)) * 100))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span>{formatCOPMap(Number(selectedPremium.raisedAmount))}</span>
                        <span>Meta: {formatCOPMap(Number(selectedPremium.targetAmount))}</span>
                      </div>
                    </div>

                    {/* Specs */}
                    <div className="bg-black/30 rounded-xl p-3 space-y-2">
                      <h4 className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
                        <Zap className="w-4 h-4" />
                        Especificaciones
                      </h4>
                      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                        <span className="text-gray-500">Cargadores:</span>
                        <span className="text-white font-medium">{selectedPremium.chargerCount} DC</span>
                        <span className="text-gray-500">Potencia/cargador:</span>
                        <span className="text-white font-medium">{selectedPremium.chargerPowerKw} kW</span>
                        <span className="text-gray-500">Paneles solares:</span>
                        <span className="text-white font-medium">{selectedPremium.hasSolarPanels ? 'Sí' : 'No'}</span>
                        <span className="text-gray-500">ROI estimado:</span>
                        <span className="text-emerald-400 font-medium">{selectedPremium.estimatedRoiPercent}%</span>
                        <span className="text-gray-500">Recuperación:</span>
                        <span className="text-white font-medium">{selectedPremium.estimatedPaybackMonths} meses</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="flex gap-2">
                      <Link href={`/crowdfunding/${selectedPremium.id}`} className="flex-1">
                        <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold">
                          <DollarSign className="w-4 h-4 mr-1" />
                          Invertir ahora
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => {
                          const msg = encodeURIComponent(`Hola, estoy interesado en la estación Premium de ${selectedPremium.city} (${selectedPremium.zone}). Me gustaría recibir más información.`);
                          window.open(`https://wa.me/573054124009?text=${msg}`, '_blank');
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : selectedSpace ? (
                /* DETAIL VIEW */
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden">
                  {/* Header image */}
                  <div className="relative">
                    {selectedSpace.thumbnailUrl ? (
                      <img src={selectedSpace.thumbnailUrl} alt={selectedSpace.spaceName} className="w-full h-36 object-cover" />
                    ) : (
                      <div className="w-full h-36 bg-gradient-to-br from-emerald-600/30 to-green-800/30 flex items-center justify-center">
                        <Zap className="w-10 h-10 text-emerald-400/50" />
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedSpace(null)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {selectedSpace.aiScore && (
                      <div className={`absolute top-3 left-3 flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border backdrop-blur-sm ${getScoreBg(selectedSpace.aiScore)}`}>
                        <Star className="w-4 h-4" />
                        <span className={getScoreColor(selectedSpace.aiScore)}>{selectedSpace.aiScore}/100</span>
                      </div>
                    )}
                    {selectedSpace.photos && selectedSpace.photos.length > 1 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                        <Camera className="w-3.5 h-3.5" />
                        {selectedSpace.photos.length} fotos
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Title */}
                    <div>
                      <h3 className="text-lg font-bold text-white">{selectedSpace.spaceName}</h3>
                      <p className="text-sm text-gray-400">
                        {selectedSpace.city}{selectedSpace.department ? `, ${selectedSpace.department}` : ""} · {SPACE_TYPE_LABELS[selectedSpace.spaceType] || selectedSpace.spaceType}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{selectedSpace.address}</p>
                    </div>

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-2">
                      {selectedSpace.estimatedInvestmentCop && (
                        <div className="bg-black/30 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">Inversión total</p>
                          <p className="text-base font-bold text-white">{formatCOPMap(selectedSpace.estimatedInvestmentCop)}</p>
                        </div>
                      )}
                      {selectedSpace.estimatedPowerKw && (
                        <div className="bg-black/30 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">Potencia</p>
                          <p className="text-base font-bold text-emerald-400">{selectedSpace.estimatedPowerKw} kW</p>
                        </div>
                      )}
                      {selectedSpace.estimatedChargerCount && (
                        <div className="bg-black/30 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">Cargadores</p>
                          <p className="text-base font-bold text-white">{selectedSpace.estimatedChargerCount}</p>
                        </div>
                      )}
                      {selectedSpace.socioeconomicStratum && (
                        <div className="bg-black/30 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">Estrato</p>
                          <p className="text-base font-bold text-white">{selectedSpace.socioeconomicStratum}</p>
                        </div>
                      )}
                    </div>

                    {/* Funding progress */}
                    {selectedSpace.crowdfunding && (
                      <div className="bg-black/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Financiamiento</span>
                          <span className="text-sm font-bold text-emerald-400">
                            {Math.min(100, Math.round((selectedSpace.crowdfunding.raisedAmount / selectedSpace.crowdfunding.targetAmount) * 100))}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all"
                            style={{ width: `${Math.min(100, Math.round((selectedSpace.crowdfunding.raisedAmount / selectedSpace.crowdfunding.targetAmount) * 100))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatCOPMap(selectedSpace.crowdfunding.raisedAmount)} recaudado</span>
                          <span>Meta: {formatCOPMap(selectedSpace.crowdfunding.targetAmount)}</span>
                        </div>
                      </div>
                    )}

                    {/* Photo Gallery */}
                    {selectedSpace.photos && selectedSpace.photos.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
                          <Camera className="w-4 h-4" />
                          Fotos del espacio ({selectedSpace.photos.length})
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedSpace.photos.map((photo: any, i: number) => (
                            <button
                              key={i}
                              onClick={() => setLightboxIdx(i)}
                              className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer border border-slate-700 hover:border-emerald-500/40 transition-colors"
                            >
                              <img
                                src={photo.url}
                                alt={photo.caption || PHOTO_TYPE_LABELS[photo.type] || "Foto"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="absolute bottom-1 left-1 right-1">
                                <span className="text-[10px] bg-black/60 text-gray-300 px-1.5 py-0.5 rounded-md backdrop-blur-sm truncate block text-center">
                                  {PHOTO_TYPE_LABELS[photo.type] || photo.type}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Analysis */}
                    {(() => {
                      const aiData = parseAIAnalysis(selectedSpace.aiAnalysis);
                      if (!aiData) return null;
                      return (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
                            <BarChart3 className="w-4 h-4" />
                            Análisis IA
                          </h4>
                          {aiData.summary && <p className="text-sm text-gray-300">{aiData.summary}</p>}
                          {aiData.strengths && aiData.strengths.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Fortalezas</p>
                              <ul className="space-y-1">
                                {aiData.strengths.slice(0, 3).map((s: string, i: number) => (
                                  <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                    <span className="text-emerald-400 mt-0.5">+</span>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiData.investmentAppeal && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Atractivo:</span>
                              <span className={`text-xs font-bold ${
                                aiData.investmentAppeal === "alto" ? "text-emerald-400" :
                                aiData.investmentAppeal === "medio" ? "text-yellow-400" : "text-red-400"
                              }`}>
                                {aiData.investmentAppeal.charAt(0).toUpperCase() + aiData.investmentAppeal.slice(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* View count */}
                    {selectedSpace.viewCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{selectedSpace.viewCount} {selectedSpace.viewCount === 1 ? 'vista' : 'vistas'}</span>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="space-y-2 pt-2">
                      {!showContactForm && !contactSent ? (
                        <>
                          <Button
                            onClick={() => setShowContactForm(true)}
                            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Quiero invertir en este punto
                          </Button>
                          <Button
                            onClick={() => contactAdvisor(selectedSpace)}
                            variant="outline"
                            className="w-full border-slate-600 text-gray-300 hover:bg-slate-700"
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Hablar con asesor por WhatsApp
                          </Button>
                        </>
                      ) : contactSent ? (
                        <div className="text-center py-4">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                          </div>
                          <p className="text-sm font-medium text-white">¡Solicitud enviada!</p>
                          <p className="text-xs text-gray-400 mt-1">Te contactaremos en 24-48 horas hábiles</p>
                          <Button
                            onClick={() => { setContactSent(false); setShowContactForm(false); }}
                            variant="ghost"
                            size="sm"
                            className="mt-3 text-emerald-400 hover:text-emerald-300"
                          >
                            Volver al detalle
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-black/30 rounded-xl p-4 space-y-3">
                          <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Formulario de contacto
                          </h4>
                          <div className="space-y-2">
                            <Input
                              placeholder="Tu nombre completo *"
                              value={contactForm.name}
                              onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                              className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-500 h-9 text-sm"
                            />
                            <Input
                              placeholder="Email *"
                              type="email"
                              value={contactForm.email}
                              onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                              className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-500 h-9 text-sm"
                            />
                            <Input
                              placeholder="Teléfono (opcional)"
                              value={contactForm.phone}
                              onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                              className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-500 h-9 text-sm"
                            />
                            <Input
                              placeholder="Monto a invertir (COP, opcional)"
                              type="number"
                              value={contactForm.interestedAmount}
                              onChange={(e) => setContactForm(prev => ({ ...prev, interestedAmount: e.target.value }))}
                              className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-500 h-9 text-sm"
                            />
                            <Textarea
                              placeholder="Mensaje o preguntas (opcional)"
                              value={contactForm.message}
                              onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                              className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-500 text-sm min-h-[60px] resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setShowContactForm(false)}
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={() => {
                                if (!contactForm.name || !contactForm.email) {
                                  toast.error("Nombre y email son requeridos");
                                  return;
                                }
                                submitLeadMut.mutate({
                                  spaceId: selectedSpace.id,
                                  name: contactForm.name,
                                  email: contactForm.email,
                                  phone: contactForm.phone || undefined,
                                  interestedAmount: contactForm.interestedAmount ? parseInt(contactForm.interestedAmount) : undefined,
                                  message: contactForm.message || undefined,
                                });
                              }}
                              disabled={submitLeadMut.isPending}
                              size="sm"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {submitLeadMut.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5 mr-1.5" />
                                  Enviar solicitud
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : filteredSpaces.length === 0 ? (
                <div className="text-center py-16">
                  <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No hay puntos disponibles con este filtro</p>
                </div>
              ) : (
                /* LIST VIEW */
                filteredSpaces.map((space: any) => {
                  const fundingPct = space.crowdfunding
                    ? Math.min(100, Math.round((space.crowdfunding.raisedAmount / space.crowdfunding.targetAmount) * 100))
                    : 0;
                  return (
                    <button
                      key={space.id}
                      onClick={() => {
                        handleSelectSpace(space);
                        if (space.latitude && space.longitude && mapRef.current) {
                          mapRef.current.panTo({ lat: parseFloat(space.latitude), lng: parseFloat(space.longitude) });
                          mapRef.current.setZoom(14);
                        }
                      }}
                      className="w-full text-left bg-slate-800/60 border border-slate-700 rounded-xl p-4 hover:border-emerald-500/30 transition-all group"
                    >
                      {/* Thumbnail */}
                      {space.thumbnailUrl && (
                        <div className="relative w-full h-28 rounded-lg overflow-hidden mb-3">
                          <img src={space.thumbnailUrl} alt={space.spaceName} className="w-full h-full object-cover" />
                          {space.photos && space.photos.length > 1 && (
                            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                              <Camera className="w-3 h-3" />
                              {space.photos.length}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                            {space.spaceName}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {space.city}{space.department ? `, ${space.department}` : ""} · {SPACE_TYPE_LABELS[space.spaceType] || space.spaceType}
                          </p>
                        </div>
                        {space.aiScore && (
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${getScoreBg(space.aiScore)}`}>
                            <Star className="w-3 h-3" />
                            <span className={getScoreColor(space.aiScore)}>{space.aiScore}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                        {space.estimatedPowerKw && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-emerald-400" />
                            {space.estimatedPowerKw} kW
                          </span>
                        )}
                        {space.estimatedChargerCount && (
                          <span className="flex items-center gap-1">
                            <Battery className="w-3 h-3 text-blue-400" />
                            {space.estimatedChargerCount} cargadores
                          </span>
                        )}
                        {space.estimatedInvestmentCop && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-yellow-400" />
                            {formatCOPMap(space.estimatedInvestmentCop)}
                          </span>
                        )}
                        {space.viewCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3 text-gray-500" />
                            {space.viewCount}
                          </span>
                        )}
                      </div>
                      {space.crowdfunding && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">Financiamiento</span>
                            <span className="text-emerald-400 font-medium">{fundingPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all bg-gradient-to-r from-emerald-500 to-green-400"
                              style={{ width: `${fundingPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Link to full crowdfunding page */}
          <div className="mt-8 text-center">
            <Link href="/crowdfunding">
              <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                Ver mapa completo de oportunidades
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Lightbox */}
        {lightboxIdx !== null && selectedSpace?.photos && (
          <div
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setLightboxIdx(null)}
          >
            <div className="relative w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setLightboxIdx(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              {selectedSpace.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx - 1 + selectedSpace.photos.length) % selectedSpace.photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % selectedSpace.photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <img
                src={selectedSpace.photos[lightboxIdx].url}
                alt={selectedSpace.photos[lightboxIdx].caption || "Foto del espacio"}
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
              <div className="text-center mt-4">
                <span className="text-sm text-emerald-400 font-medium">
                  {PHOTO_TYPE_LABELS[selectedSpace.photos[lightboxIdx].type] || selectedSpace.photos[lightboxIdx].type}
                </span>
                {selectedSpace.photos[lightboxIdx].caption && (
                  <p className="text-sm text-gray-400 mt-1">{selectedSpace.photos[lightboxIdx].caption}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">{lightboxIdx + 1} / {selectedSpace.photos.length}</p>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  };

  // ============================================================================
  // MURO DE FUNDADORES - Sección pública en la landing de inversión
  // ============================================================================
  
  const FoundersWallSection = () => {
    const { data: founders, isLoading } = trpc.investorManagement.getFoundersWall.useQuery();
    
    if (isLoading || !founders || founders.length === 0) return null;
    
    return (
      <section className="py-20 bg-gradient-to-b from-slate-900/50 to-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">Nuestros Fundadores</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">
              Muro de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500">
                Fundadores
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Los visionarios que hicieron posible la revolución de la movilidad eléctrica en Colombia
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {founders.map((founder: any, index: number) => {
              const badgeConfig: Record<string, { label: string; gradient: string }> = {
                emerald: { label: "Esmeralda", gradient: "from-emerald-500 to-emerald-700" },
                gold: { label: "Oro", gradient: "from-yellow-400 to-amber-600" },
                platinum: { label: "Platino", gradient: "from-slate-300 to-slate-500" },
                diamond: { label: "Diamante", gradient: "from-cyan-300 to-blue-500" },
              };
              const badgeInfo = founder.investorBadge ? badgeConfig[founder.investorBadge] : null;
              
              return (
                <div
                  key={founder.id}
                  className="relative group"
                >
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-800/50 to-slate-900/50 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300">
                    {/* Decoración superior */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <Crown className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    <div className="text-center pt-4">
                      {/* Avatar */}
                      <div className="relative inline-block mb-4">
                        <div className="w-20 h-20 rounded-full overflow-hidden ring-3 ring-amber-500/30 ring-offset-4 ring-offset-slate-900 mx-auto">
                          {founder.investorPhotoUrl ? (
                            <img src={founder.investorPhotoUrl} alt={founder.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                              <span className="text-white font-bold text-2xl">
                                {founder.name?.charAt(0)?.toUpperCase() || "F"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Nombre y título */}
                      <h3 className="text-lg font-bold text-white mb-1">{founder.name}</h3>
                      {founder.founderTitle && (
                        <p className="text-amber-400 text-sm font-medium mb-1">{founder.founderTitle}</p>
                      )}
                      {founder.companyName && (
                        <p className="text-white/40 text-xs mb-3">{founder.companyName}</p>
                      )}
                      
                      {/* Insignia */}
                      {badgeInfo && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${badgeInfo.gradient} text-white text-xs font-medium mb-3">
                          <Sparkles className="w-3 h-3" />
                          {badgeInfo.label}
                        </div>
                      )}
                      
                      {/* Frase */}
                      {founder.investorQuote && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-white/60 text-sm italic leading-relaxed">
                            “{founder.investorQuote}”
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
            <a href="https://wa.me/573054124009?text=Hola%20EVGreen%2C%20estoy%20interesado%20en%20conocer%20m%C3%A1s%20sobre%20las%20oportunidades%20de%20inversi%C3%B3n%20en%20estaciones%20de%20carga." target="_blank" rel="noopener noreferrer">
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

      {/* Mapa Interactivo de Espacios Publicados */}
      <PublishedSpacesMapSection />

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

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Paquete AC Básico */}
            <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-500/30 hover:border-blue-500/50 transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
              <CardHeader className="pb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                    Entrada Fácil
                  </span>
                  <Battery className="w-8 h-8 text-blue-400" />
                </div>
                <CardTitle className="text-xl text-white">{PAQUETES.AC.nombre}</CardTitle>
                <p className="text-white/60 text-sm">{PAQUETES.AC.descripcion}</p>
              </CardHeader>
              <CardContent className="space-y-4 relative">
                <div className="text-center py-3 rounded-xl bg-black/30">
                  <p className="text-white/60 text-sm">Inversión Total</p>
                  <p className="text-3xl font-bold text-white">{formatCOP(PAQUETES.AC.precio)}</p>
                  <p className="text-blue-400 text-sm mt-1">
                    {PAQUETES.AC.potenciaKw}kW de potencia
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg bg-black/30 text-center">
                    <p className="text-xl font-bold text-blue-400">~{paqueteROIs.AC.roiAnual}%</p>
                    <p className="text-xs text-white/60">ROI Anual</p>
                  </div>
                  <div className="p-2 rounded-lg bg-black/30 text-center">
                    <p className="text-xl font-bold text-blue-400">~{paqueteROIs.AC.paybackMeses}</p>
                    <p className="text-xs text-white/60">Meses Payback</p>
                  </div>
                </div>

                <ul className="space-y-2">
                  {PAQUETES.AC.caracteristicas.slice(0, 4).map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-white/80 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a href="#calculadora">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white gap-2">
                    Calcular mi ROI
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Paquete DC Individual */}
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
                    <p className="text-2xl font-bold text-green-400">~{paqueteROIs.INDIVIDUAL.roiAnual}%</p>
                    <p className="text-xs text-white/60">ROI Anual ({PAQUETES.INDIVIDUAL.horasUsoConservador}h/día)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-green-400">~{paqueteROIs.INDIVIDUAL.paybackMeses}</p>
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
                    <p className="text-2xl font-bold text-amber-400">~{paqueteROIs.COLECTIVO.roiAnual}%</p>
                    <p className="text-xs text-white/60">ROI Anual (ubicación premium)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 text-center">
                    <p className="text-2xl font-bold text-amber-400">~{paqueteROIs.COLECTIVO.paybackMeses}</p>
                    <p className="text-xs text-white/60">Meses Payback</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {PAQUETES.COLECTIVO.caracteristicas.map((item, i) => {
                    // Reemplazar dinámicamente el porcentaje de reducción de energía solar
                    const displayItem = item.includes("Reducción ~70%") 
                      ? `Reducción ~${params.costoEnergiaRed > 0 ? Math.round((1 - params.costoEnergiaSolar / params.costoEnergiaRed) * 100) : 70}% costo de energía`
                      : item;
                    return (
                    <li key={i} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <span>{displayItem}</span>
                    </li>
                    );
                  })}
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
                  <Tabs value={paqueteSeleccionado} onValueChange={(v) => setPaqueteSeleccionado(v as "AC" | "INDIVIDUAL" | "COLECTIVO")}>
                    <TabsList className="grid grid-cols-3 bg-slate-700">
                      <TabsTrigger value="AC" className="data-[state=active]:bg-blue-500">
                        <div className="text-left">
                          <p className="font-medium text-sm">AC Básico</p>
                          <p className="text-xs opacity-70">{formatCOP(PAQUETES.AC.precio)}</p>
                        </div>
                      </TabsTrigger>
                      <TabsTrigger value="INDIVIDUAL" className="data-[state=active]:bg-green-500">
                        <div className="text-left">
                          <p className="font-medium text-sm">DC Individual</p>
                          <p className="text-xs opacity-70">{formatCOP(PAQUETES.INDIVIDUAL.precio)}</p>
                        </div>
                      </TabsTrigger>
                      <TabsTrigger value="COLECTIVO" className="data-[state=active]:bg-amber-500">
                        <div className="text-left">
                          <p className="font-medium text-sm">Colectivo</p>
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

                {/* Selector de Escenario */}
                <div className="space-y-3">
                  <label className="text-white/80 font-medium">Escenario de Proyección</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: "pesimista" as const, label: "Pesimista", icon: "⚠️", color: "from-red-500/20 to-orange-500/20 border-red-500" },
                      { key: "realista" as const, label: "Realista", icon: "⚖️", color: "from-blue-500/20 to-cyan-500/20 border-blue-500" },
                      { key: "optimista" as const, label: "Optimista", icon: "🚀", color: "from-green-500/20 to-emerald-500/20 border-green-500" },
                    ]).map((esc) => (
                      <button
                        key={esc.key}
                        type="button"
                        onClick={() => setEscenario(esc.key)}
                        className={`p-3 rounded-lg border transition-all text-center ${
                          escenario === esc.key
                            ? `bg-gradient-to-br ${esc.color} text-white`
                            : "bg-slate-700/50 border-white/10 text-white/50 hover:border-white/30"
                        }`}
                      >
                        <span className="text-lg">{esc.icon}</span>
                        <p className="text-xs font-medium mt-1">{esc.label}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/40">
                    {factorEscenario.desc}
                    {escenario === "pesimista" && " — Horas ×0.6, Precio ×0.85"}
                    {escenario === "optimista" && " — Horas ×1.4, Precio ×1.10"}
                  </p>
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
                    min={4}
                    max={20}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>4h (conservador)</span>
                    <span>20h (optimista)</span>
                  </div>
                  {paqueteSeleccionado === "COLECTIVO" && (
                    <p className="text-xs text-amber-400">
                      * Ubicaciones premium: utilización efectiva de {calculos.horasUsoEfectivas.toFixed(1)}h/día
                      (factor {params.factorUtilizacionPremium}x por alto tráfico en zonas estratégicas)
                    </p>
                  )}
                  {escenario !== "realista" && (
                    <p className="text-xs text-cyan-400">
                      Escenario {factorEscenario.label}: horas ajustadas a {(horasUso * factorEscenario.horasMult).toFixed(1)}h base
                    </p>
                  )}
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
                    min={params.precioVentaMin}
                    max={params.precioVentaMax}
                    step={100}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>$1,400 (económico)</span>
                    <span>$2,200 (premium)</span>
                  </div>
                </div>

                {/* Zona de alta demanda (solo para AC e Individual) */}
                {(paqueteSeleccionado === "AC" || paqueteSeleccionado === "INDIVIDUAL") && (
                  <div className="space-y-3">
                    <label className="text-white/80 font-medium">Zona de Ubicación (Fee Alta Demanda)</label>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(ZONAS_PREMIUM).map(([key, zona]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setZonaPremium(key as "A" | "B" | "C")}
                          className={`p-3 rounded-lg border transition-all text-left ${
                            zonaPremium === key
                              ? "bg-green-500/20 border-green-500 text-white"
                              : "bg-slate-700/50 border-white/10 text-white/70 hover:border-white/30"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{zona.nombre}</p>
                              <p className="text-xs opacity-70">{zona.zonas.join(", ")}</p>
                            </div>
                            <div className="text-right">
                              {zona.fee > 0 ? (
                                <span className="text-amber-400 font-bold">+{formatCOP(zona.fee)}</span>
                              ) : (
                                <span className="text-green-400">Sin fee</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-amber-400">
                      * El fee por zona de alta demanda se suma a la inversión base por ubicaciones con mayor tráfico de vehículos eléctricos
                    </p>
                  </div>
                )}

                {/* Info de costos */}
                <div className="p-4 rounded-lg bg-slate-700/50 border border-white/10">
                  <p className="text-sm text-white/60">
                    <span className="text-white font-medium">Costo de energía:</span>{" "}
                    {formatCOP(calculos.costoEnergia)}/kWh
                    {calculos.costoEnergia < params.costoEnergiaRed && (
                      <span className="text-amber-400 ml-2">(con solar)</span>
                    )}
                  </p>
                  <p className="text-sm text-white/60 mt-1">
                    <span className="text-white font-medium">Precio de venta:</span>{" "}
                    {formatCOP(calculos.precioVentaBase)}/kWh
                    {escenario !== "realista" && (
                      <span className="text-cyan-400 ml-2">(ajustado: {formatCOP(calculos.precioVentaEfectivo)}/kWh en esc. {calculos.escenarioLabel})</span>
                    )}
                  </p>
                  <p className="text-sm text-white/60 mt-1">
                    <span className="text-white font-medium">Tu margen neto ({Math.round(params.inversionistaPct * 100)}%):</span>{" "}
                    <span className="text-green-400">{formatCOP(calculos.margenNetoBaseInversionista)}/kWh</span>
                    {escenario !== "realista" && (
                      <span className="text-cyan-400 ml-2">(ajustado: {formatCOP(calculos.margenNetoPorKwhInversionista)}/kWh)</span>
                    )}
                  </p>
                  <p className="text-xs text-white/40 mt-2">
                    {paqueteSeleccionado === "COLECTIVO" 
                      ? `* Margen = (Precio venta - Costo energía) × ${100 - Math.round(params.aliadoPct * 100)}% (después de aliado comercial) × ${Math.round(params.inversionistaPct * 100)}% (tu parte) — economías de escala`
                      : `* Margen = (Precio venta - Costo energía) × ${100 - Math.round(params.aliadoPct * 100)}% (después de aliado comercial) × ${100 - Math.round(calculos.costosOperativosPct * 100)}% (después de costos operativos) × ${Math.round(params.inversionistaPct * 100)}% (tu parte)`
                    }
                  </p>
                  {paqueteSeleccionado === "COLECTIVO" && (
                    <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                      <Shield className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-amber-300/70 leading-relaxed">
                        Los ingresos proyectados son antes de gastos operativos fijos (pólizas, gastos fiduciarios), los cuales se descuentan proporcionalmente en cada liquidación mensual. Del 30% de gestión EVGreen, un 5% se destina al fondo de imprevistos y mantenimiento.
                      </p>
                    </div>
                  )}
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

                {/* Indicador de escenario activo */}
                {escenario !== "realista" && (
                  <div className={`p-3 rounded-lg border text-center text-sm ${
                    escenario === "pesimista" 
                      ? "bg-red-500/10 border-red-500/30 text-red-300" 
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  }`}>
                    Escenario <strong>{factorEscenario.label}</strong>: Precio efectivo {formatCOP(calculos.precioVentaEfectivo)}/kWh
                  </div>
                )}

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

                <a href="https://wa.me/573054124009?text=Hola%20EVGreen%2C%20me%20gustar%C3%ADa%20solicitar%20una%20asesor%C3%ADa%20personalizada%20sobre%20inversi%C3%B3n%20en%20estaciones%20de%20carga%20de%20veh%C3%ADculos%20el%C3%A9ctricos." target="_blank" rel="noopener noreferrer">
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

      {/* ============================================================================
          COMPARADOR LADO A LADO - Individual vs Colectivo
          ============================================================================ */}
      <section id="comparador" className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Compara{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-amber-500">
                Individual vs Colectivo
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Descubre cuál opción se adapta mejor a tu perfil de inversión
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <Card className="bg-slate-800/50 border-white/10 overflow-hidden">
              <CardContent className="p-0">
                {/* Encabezado de la tabla */}
                <div className="grid grid-cols-3 border-b border-white/10">
                  <div className="p-4 bg-slate-900/50">
                    <p className="text-white/60 font-medium">Característica</p>
                  </div>
                  <div className="p-4 bg-green-900/20 text-center border-l border-white/10">
                    <div className="flex items-center justify-center gap-2">
                      <Battery className="w-5 h-5 text-green-400" />
                      <p className="text-green-400 font-bold">Individual</p>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-900/20 text-center border-l border-white/10">
                    <div className="flex items-center justify-center gap-2">
                      <Sun className="w-5 h-5 text-amber-400" />
                      <p className="text-amber-400 font-bold">Colectivo + Solar</p>
                    </div>
                  </div>
                </div>

                {/* Filas de comparación - Valores dinámicos desde params */}
                {(() => {
                  // Cálculos dinámicos para la tabla comparativa
                  const costoIndividual = params.costoEnergiaRed;
                  const costoColectivo = params.costoEnergiaSolar;
                  const precioBase = params.precioVentaDefault;
                  const ahorroSolar = params.costoEnergiaRed > 0 ? Math.round((1 - costoColectivo / costoIndividual) * 100) : 0;
                  
                  // Margen bruto por kWh
                  const margenIndividual = precioBase - costoIndividual;
                  const margenColectivo = precioBase - costoColectivo;
                  const margenDiff = margenIndividual > 0 ? Math.round(((margenColectivo - margenIndividual) / margenIndividual) * 100) : 0;
                  
                  // ROI dinámico (escenario realista, horas base)
                  const horasInd = PAQUETES.INDIVIDUAL.horasUsoConservador;
                  const horasCol = PAQUETES.COLECTIVO.horasUsoConservador * params.factorUtilizacionPremium;
                  const energiaInd = PAQUETES.INDIVIDUAL.potenciaKw * horasInd * params.eficienciaDC;
                  const energiaCol = (PAQUETES.COLECTIVO as any).potenciaTotal * horasCol * params.eficienciaDC;
                  const ingresoIndDia = (energiaInd * (precioBase - costoIndividual) * (1 - params.aliadoPct) * (1 - params.costosOpIndividual) * params.inversionistaPct);
                  // Colectivo: sin costos operativos separados (economías de escala)
                  const ingresoColDia = (energiaCol * (precioBase - costoColectivo) * (1 - params.aliadoPct) * params.inversionistaPct);
                  const roiIndAnual = PAQUETES.INDIVIDUAL.precio > 0 ? ((ingresoIndDia * 365) / PAQUETES.INDIVIDUAL.precio * 100) : 0;
                  const roiColAnual = PAQUETES.COLECTIVO.participacionMinima > 0 ? ((ingresoColDia * 365 * (PAQUETES.COLECTIVO.participacionMinima / PAQUETES.COLECTIVO.precio)) / PAQUETES.COLECTIVO.participacionMinima * 100) : 0;
                  const paybackInd = ingresoIndDia > 0 ? (PAQUETES.INDIVIDUAL.precio / (ingresoIndDia * 30)) : 999;
                  const paybackCol = ingresoColDia > 0 ? (PAQUETES.COLECTIVO.participacionMinima / (ingresoColDia * (PAQUETES.COLECTIVO.participacionMinima / PAQUETES.COLECTIVO.precio) * 30)) : 999;

                  return [
                    { label: "Inversión Mínima", individual: formatCOP(PAQUETES.INDIVIDUAL.precio), colectivo: formatCOP(PAQUETES.COLECTIVO.participacionMinima), winner: "colectivo" },
                    { label: "Potencia Total", individual: `${PAQUETES.INDIVIDUAL.potenciaKw} kW`, colectivo: `${(PAQUETES.COLECTIVO as any).potenciaTotal} kW (${PAQUETES.COLECTIVO.cantidadCargadores}×${PAQUETES.COLECTIVO.potenciaKw}kW)`, winner: "colectivo" },
                    { label: "Fuente de Energía", individual: "Red Eléctrica", colectivo: "Solar + Red", winner: "colectivo" },
                    { label: "Costo Energía/kWh", individual: `${formatCOP(costoIndividual)} COP`, colectivo: `${formatCOP(costoColectivo)} COP (${ahorroSolar}% ahorro)`, winner: "colectivo" },
                    { label: "Margen por kWh", individual: `${formatCOP(margenIndividual)} COP`, colectivo: `${formatCOP(margenColectivo)} COP (+${margenDiff}%)`, winner: "colectivo" },
                    { label: "Costos Operativos", individual: `${Math.round(params.costosOpIndividual * 100)}%`, colectivo: "Incluidos (economías de escala)", winner: "colectivo" },
                    { label: "Gastos Fijos", individual: "A tu cargo (pólizas, mantenimiento)", colectivo: "Prorrateados en liquidación mensual", winner: "colectivo" },
                    { label: "Ubicación", individual: "A elección", colectivo: "Premium garantizada", winner: "colectivo" },
                    { label: "Utilización Esperada", individual: `${horasInd}h/día`, colectivo: `${horasCol.toFixed(0)}h/día (${params.factorUtilizacionPremium}x tráfico)`, winner: "colectivo" },
                    { label: "ROI Anual Estimado", individual: `~${roiIndAnual.toFixed(0)}%`, colectivo: `~${roiColAnual.toFixed(0)}%`, winner: roiColAnual > roiIndAnual ? "colectivo" : "individual" },
                    { label: "Payback", individual: `~${paybackInd.toFixed(0)} meses`, colectivo: `~${paybackCol.toFixed(0)} meses`, winner: paybackCol < paybackInd ? "colectivo" : "individual" },
                    { label: "Seguridad de Ingresos", individual: "Variable", colectivo: "Alta (ubicación estratégica)", winner: "colectivo" },
                    { label: "Riesgo de Demanda", individual: "Medio-Alto", colectivo: "Bajo (alto tráfico)", winner: "colectivo" },
                    { label: "Propiedad", individual: "100% tuya", colectivo: "Proporcional", winner: "individual" },
                    { label: "Flexibilidad", individual: "Total control", colectivo: "Gestión EVGreen", winner: "individual" },
                  ];
                })().map((row, i) => (
                  <div key={i} className={`grid grid-cols-3 ${i % 2 === 0 ? 'bg-slate-900/30' : ''} border-b border-white/5`}>
                    <div className="p-4">
                      <p className="text-white/80 font-medium">{row.label}</p>
                    </div>
                    <div className={`p-4 text-center border-l border-white/10 ${row.winner === 'individual' ? 'bg-green-500/10' : ''}`}>
                      <p className={`font-medium ${row.winner === 'individual' ? 'text-green-400' : 'text-white/70'}`}>
                        {row.individual}
                        {row.winner === 'individual' && <span className="ml-2">✓</span>}
                      </p>
                    </div>
                    <div className={`p-4 text-center border-l border-white/10 ${row.winner === 'colectivo' ? 'bg-amber-500/10' : ''}`}>
                      <p className={`font-medium ${row.winner === 'colectivo' ? 'text-amber-400' : 'text-white/70'}`}>
                        {row.colectivo}
                        {row.winner === 'colectivo' && <span className="ml-2">✓</span>}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Resumen */}
                <div className="grid grid-cols-3 bg-slate-900/50">
                  <div className="p-4">
                    <p className="text-white font-bold">Recomendado para</p>
                  </div>
                  <div className="p-4 text-center border-l border-white/10">
                    <p className="text-green-400 text-sm">
                      Inversionistas que buscan<br/><strong>control total</strong> de su activo
                    </p>
                  </div>
                  <div className="p-4 text-center border-l border-white/10">
                    <p className="text-amber-400 text-sm">
                      Inversionistas que buscan<br/><strong>máxima rentabilidad</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 flex justify-center gap-4">
              <a href="#calculadora">
                <Button className="bg-green-500 hover:bg-green-600 text-white gap-2">
                  <Calculator className="w-4 h-4" />
                  Simular Individual
                </Button>
              </a>
              <a href="#crowdfunding">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
                  <Users className="w-4 h-4" />
                  Ver Estaciones Colectivas
                </Button>
              </a>
            </div>

            {/* Ventajas adicionales del modelo colectivo */}
            <div className="mt-12 grid md:grid-cols-3 gap-6">
              <Card className="bg-amber-900/20 border-amber-500/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Ubicaciones Estratégicas</h3>
                  <p className="text-white/60 text-sm">
                    Centros comerciales, corredores viales y zonas de alto tráfico con <strong className="text-amber-400">2x más demanda</strong> que ubicaciones promedio.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-amber-900/20 border-amber-500/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Seguridad de Ingresos</h3>
                  <p className="text-white/60 text-sm">
                    Menor riesgo de baja demanda gracias a ubicaciones premium con <strong className="text-amber-400">flujo garantizado</strong> de vehículos eléctricos.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-amber-900/20 border-amber-500/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <Leaf className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Energía Solar</h3>
                  <p className="text-white/60 text-sm">
                    Paneles solares integrados reducen el costo de energía en <strong className="text-amber-400">{params.costoEnergiaRed > 0 ? Math.round((1 - params.costoEnergiaSolar / params.costoEnergiaRed) * 100) : 70}%</strong>, aumentando significativamente el margen.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================================
          SIMULADOR DE ESCENARIOS - Proyecciones a 3, 5 y 10 años
          ============================================================================ */}
      <section id="escenarios" className="py-20 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Proyección de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Retorno Acumulado
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Visualiza cómo crece tu inversión a lo largo del tiempo
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            {/* Tarjetas de proyección */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {[
                { anos: 3, meses: 36 },
                { anos: 5, meses: 60 },
                { anos: 10, meses: 120 },
              ].map(({ anos, meses }) => {
                const retornoAcumulado = calculos.ingresoMensual * meses;
                const roiTotal = ((retornoAcumulado / calculos.inversionTotal) * 100);
                const gananciaTotal = retornoAcumulado - calculos.inversionTotal;
                const esRentable = gananciaTotal > 0;
                
                return (
                  <Card key={anos} className={`border-white/10 ${anos === 5 ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30 scale-105' : 'bg-slate-800/50'}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">{anos} Años</CardTitle>
                        {anos === 5 && (
                          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                            Recomendado
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-4 rounded-xl bg-black/30">
                        <p className="text-white/60 text-sm">Retorno Acumulado</p>
                        <p className="text-3xl font-bold text-white">{formatCOP(retornoAcumulado)}</p>
                        <p className={`text-sm mt-1 ${esRentable ? 'text-green-400' : 'text-amber-400'}`}>
                          {roiTotal.toFixed(0)}% de tu inversión
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">Inversión Inicial</span>
                          <span className="text-white">{formatCOP(calculos.inversionTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">Ganancia Neta</span>
                          <span className={esRentable ? 'text-green-400' : 'text-amber-400'}>
                            {esRentable ? '+' : ''}{formatCOP(gananciaTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">Ingreso Mensual Prom.</span>
                          <span className="text-white">{formatCOP(calculos.ingresoMensual)}</span>
                        </div>
                      </div>

                      {/* Barra de progreso visual */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-white/60">
                          <span>Recuperación</span>
                          <span>{Math.min(roiTotal, 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${roiTotal >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(roiTotal, 100)}%` }}
                          />
                        </div>
                        {roiTotal >= 100 && (
                          <p className="text-xs text-green-400 text-center mt-1">
                            ✓ Inversión recuperada + {formatCOP(gananciaTotal)} de ganancia
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Gráfico de crecimiento acumulado */}
            <Card className="bg-slate-800/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Crecimiento del Capital
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative" style={{ height: '280px' }}>
                  {/* Línea de inversión inicial */}
                  {(() => {
                    const maxRetorno = calculos.ingresoMensual * 120;
                    const invPct = maxRetorno > 0 ? Math.min((calculos.inversionTotal / maxRetorno) * 100, 95) : 50;
                    return (
                      <div className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/60 z-10" style={{ bottom: `${invPct + 8}%` }}>
                        <span className="absolute -top-5 left-2 text-xs text-amber-400 font-medium">
                          Inversión: {formatCOPShort(calculos.inversionTotal)}
                        </span>
                      </div>
                    );
                  })()}
                  
                  {/* Barras de años */}
                  <div className="flex items-end gap-1" style={{ height: '100%', paddingTop: '24px', paddingBottom: '24px' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((ano) => {
                      const retorno = calculos.ingresoMensual * (ano * 12);
                      const maxRetorno = calculos.ingresoMensual * 120;
                      const alturaPct = maxRetorno > 0 ? (retorno / maxRetorno) * 100 : 5;
                      const superaInversion = retorno >= calculos.inversionTotal;
                      const barHeight = Math.max(alturaPct, 4);
                      
                      return (
                        <div key={ano} className="flex-1 flex flex-col items-center" style={{ height: '100%', justifyContent: 'flex-end' }}>
                          <span className="text-[10px] text-white/60 mb-1 whitespace-nowrap">
                            {formatCOPShort(retorno)}
                          </span>
                          <div 
                            className={`w-full max-w-[40px] mx-auto rounded-t-md ${superaInversion ? 'bg-gradient-to-t from-green-600 to-green-400' : 'bg-gradient-to-t from-amber-600 to-amber-400'}`}
                            style={{ height: `${barHeight}%` }}
                          />
                          <span className="text-[10px] text-white/60 mt-1">Año {ano}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Leyenda */}
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-8">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500" />
                    <span className="text-white/60 text-sm">Recuperando inversión</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500" />
                    <span className="text-white/60 text-sm">Ganancia neta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                    <span className="text-white/60 text-sm">Línea de inversión</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer Legal Robusto */}
            <div className="mt-8 p-6 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <p className="text-amber-400 font-semibold text-base">Aviso Legal de Inversión</p>
                  
                  <p className="text-white/60 text-sm leading-relaxed">
                    <strong className="text-white/80">Rendimientos pasados no garantizan rendimientos futuros.</strong>{" "}
                    Las proyecciones presentadas en esta calculadora son estimaciones basadas en parámetros actuales del mercado 
                    de carga de vehículos eléctricos en Colombia y no constituyen una promesa, garantía ni compromiso de 
                    rentabilidad por parte de Green House Project S.A.S.
                  </p>
                  
                  <p className="text-white/60 text-sm leading-relaxed">
                    <strong className="text-white/80">Factores de riesgo:</strong> Los resultados reales pueden variar significativamente 
                    debido a cambios en: (i) tarifas de energía reguladas por la CREG, (ii) demanda del mercado de vehículos eléctricos, 
                    (iii) competencia en el sector, (iv) condiciones macroeconómicas (inflación, tipo de cambio), 
                    (v) regulaciones gubernamentales, y (vi) disponibilidad y costo de mantenimiento de equipos.
                  </p>
                  
                  <p className="text-white/60 text-sm leading-relaxed">
                    <strong className="text-white/80">Naturaleza de la inversión:</strong> Esta inversión implica riesgos inherentes 
                    propios de cualquier actividad empresarial. El capital invertido no está garantizado por el Fondo de 
                    Garantías de Instituciones Financieras (FOGAFÍN) ni por ningún otro mecanismo de protección estatal. 
                    Se recomienda al inversionista realizar su propia evaluación de riesgos y consultar con un asesor 
                    financiero independiente antes de tomar cualquier decisión de inversión.
                  </p>
                  
                  <p className="text-white/50 text-xs mt-2 italic">
                    Green House Project S.A.S. — NIT 901.447.678-0. La información contenida en este sitio web 
                    es de carácter informativo y no constituye una oferta pública de valores en los términos de la 
                    Ley 964 de 2005 y sus decretos reglamentarios.
                  </p>
                </div>
              </div>
            </div>
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

      {/* Muro de Fundadores */}
      <FoundersWallSection />

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
                  <a href="mailto:evgreen@greenhproject.com" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Email</p>
                      <p className="text-white font-medium">evgreen@greenhproject.com</p>
                    </div>
                  </a>
                  
                  <a href="https://wa.me/573054124009?text=Hola%20EVGreen%2C%20estoy%20interesado%20en%20invertir%20en%20estaciones%20de%20carga%20EV.%20%C2%BFPodr%C3%ADan%20darme%20m%C3%A1s%20informaci%C3%B3n%3F" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-lg bg-black/30 hover:bg-black/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">WhatsApp</p>
                      <p className="text-white font-medium">+57 305 412 4009</p>
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
