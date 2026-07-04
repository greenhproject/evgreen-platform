import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, MapPin, CreditCard, Shield, Clock, Leaf, Smartphone, Star } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";

const APP_STORE_URL = "https://apps.apple.com/co/app/evgreen/id6783473071?l=en-GB";

/** Badge oficial de App Store en SVG inline para máxima nitidez */
function AppStoreBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 40"
      aria-label="Download on the App Store"
    >
      <rect width="120" height="40" rx="7" fill="#000" />
      <rect x="0.5" y="0.5" width="119" height="39" rx="6.5" stroke="#A6A6A6" strokeWidth="0.5" fill="none" />
      {/* Apple logo */}
      <path
        d="M24.77 20.3c-.03-3.26 2.66-4.84 2.78-4.91-1.52-2.22-3.88-2.52-4.71-2.55-2-.2-3.91 1.18-4.93 1.18-1.02 0-2.59-1.16-4.26-1.13-2.18.03-4.2 1.27-5.32 3.21-2.27 3.94-.58 9.77 1.63 12.97 1.08 1.56 2.36 3.31 4.04 3.25 1.63-.07 2.24-1.05 4.2-1.05 1.96 0 2.52 1.05 4.24 1.02 1.75-.03 2.85-1.58 3.92-3.15 1.24-1.8 1.75-3.55 1.77-3.64-.04-.02-3.39-1.3-3.36-5.2z"
        fill="#fff"
      />
      <path
        d="M21.6 11.46c.9-1.09 1.5-2.6 1.34-4.11-1.29.05-2.86.86-3.78 1.93-.83.96-1.56 2.5-1.36 3.97 1.44.11 2.9-.73 3.8-1.79z"
        fill="#fff"
      />
      {/* "Download on the" text */}
      <text x="35" y="13" fontFamily="-apple-system, SF Pro Text, Helvetica Neue, sans-serif" fontSize="7" fill="#fff" letterSpacing="0.2">
        Download on the
      </text>
      {/* "App Store" text */}
      <text x="35" y="27" fontFamily="-apple-system, SF Pro Display, Helvetica Neue, sans-serif" fontSize="14" fontWeight="600" fill="#fff" letterSpacing="-0.3">
        App Store
      </text>
    </svg>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "EVGreen - Carga tu Vehículo Eléctrico en Colombia";
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/map");
    }
  }, [isAuthenticated, user, setLocation]);

  const features = [
    {
      icon: MapPin,
      title: "Encuentra Estaciones Cercanas",
      description: "Localiza estaciones de carga para vehículos eléctricos en tiempo real con nuestro mapa interactivo."
    },
    {
      icon: Zap,
      title: "Carga Rápida DC y AC",
      description: "Conectores CCS2, CHAdeMO y Tipo 2 con potencias desde 7kW hasta 150kW para tu carro eléctrico."
    },
    {
      icon: CreditCard,
      title: "Pagos Seguros",
      description: "Paga tu carga de forma segura con billetera digital. Sin efectivo, sin complicaciones."
    },
    {
      icon: Clock,
      title: "Monitoreo en Tiempo Real",
      description: "Sigue el progreso de tu carga desde la app. Recibe notificaciones cuando esté lista."
    },
    {
      icon: Shield,
      title: "Transacciones Protegidas",
      description: "Todas las transacciones están protegidas con encriptación de grado bancario."
    },
    {
      icon: Leaf,
      title: "Movilidad Sostenible",
      description: "Contribuye al medio ambiente con cada carga. Energía limpia para tu vehículo eléctrico."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ─── Hero Section ─── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 via-emerald-500/10 to-transparent" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-full mb-6">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">La red de carga EV más grande de Colombia</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              Carga tu Vehículo Eléctrico con EVGreen
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Encuentra estaciones de carga para carros eléctricos cerca de ti.
              Carga rápida DC, pagos seguros y monitoreo en tiempo real desde tu celular.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {loading ? (
                <Button size="lg" disabled className="min-w-[200px]">
                  <span className="animate-pulse">Cargando...</span>
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 min-w-[200px]"
                    onClick={() => window.location.href = getLoginUrl()}
                  >
                    <Zap className="h-5 w-5 mr-2" />
                    Comenzar a Cargar
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="min-w-[200px]"
                    onClick={() => setLocation("/map")}
                  >
                    <MapPin className="h-5 w-5 mr-2" />
                    Ver Estaciones
                  </Button>
                </>
              )}
            </div>

            {/* App Store pill en el hero */}
            <div className="mt-6 flex justify-center">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-green-400 transition-colors"
              >
                <Smartphone className="h-4 w-4" />
                También disponible en
                <span className="font-semibold text-foreground">App Store</span>
                <span className="text-green-500">↓</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ─── App Download Section ─── */}
      <section className="relative py-16 md:py-20 overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-950/60 via-emerald-900/40 to-background pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

              {/* Lado izquierdo: texto y botón */}
              <div className="flex-1 text-center lg:text-left">
                {/* Badge "Nuevo" */}
                <div className="inline-flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 uppercase tracking-wider">
                  <Zap className="h-3 w-3" />
                  Ya disponible
                </div>

                <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                  Lleva EVGreen
                  <br />
                  <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    en tu bolsillo
                  </span>
                </h2>

                <p className="text-muted-foreground mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed">
                  Descarga la app oficial de EVGreen para iPhone. Encuentra estaciones, inicia cargas y paga — todo desde la palma de tu mano.
                </p>

                {/* Estrellas de rating */}
                <div className="flex items-center gap-2 justify-center lg:justify-start mb-6">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">App Store · iOS</span>
                </div>

                {/* Botón principal App Store */}
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-block"
                  aria-label="Descargar EVGreen en App Store"
                >
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
                    {/* Badge container */}
                    <div className="relative bg-black rounded-xl px-5 py-3 flex items-center gap-4 border border-white/10 group-hover:border-white/20 transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-2xl group-hover:shadow-green-500/20">
                      {/* Apple logo SVG */}
                      <svg viewBox="0 0 24 24" className="h-9 w-9 flex-shrink-0" fill="white" aria-hidden="true">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      <div>
                        <p className="text-white/60 text-[10px] font-medium uppercase tracking-widest leading-none mb-1">
                          Download on the
                        </p>
                        <p className="text-white text-xl font-semibold leading-none tracking-tight">
                          App Store
                        </p>
                      </div>
                    </div>
                  </div>
                </a>

                {/* Micro-copy de confianza */}
                <p className="mt-4 text-xs text-muted-foreground flex items-center gap-3 justify-center lg:justify-start">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-green-500" />
                    Gratis
                  </span>
                  <span className="w-px h-3 bg-border" />
                  <span>Requiere iOS 15.0 o superior</span>
                  <span className="w-px h-3 bg-border" />
                  <span>Colombia 🇨🇴</span>
                </p>
              </div>

              {/* Lado derecho: mockup de teléfono estilizado */}
              <div className="flex-shrink-0 flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Glow de fondo */}
                  <div className="absolute inset-0 bg-gradient-to-b from-green-500/30 to-emerald-500/20 rounded-[3rem] blur-2xl scale-110" />

                  {/* Phone frame */}
                  <div className="relative w-52 h-[26rem] bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[3rem] border-2 border-white/10 shadow-2xl flex flex-col items-center justify-start pt-8 px-4 overflow-hidden">
                    {/* Notch */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-10" />

                    {/* Screen content */}
                    <div className="w-full h-full bg-gradient-to-b from-green-950 to-zinc-950 rounded-[2.4rem] flex flex-col items-center justify-center gap-4 mt-2">
                      {/* App icon */}
                      <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/40">
                        <Zap className="h-9 w-9 text-white" />
                      </div>
                      <p className="text-white font-bold text-lg tracking-tight">EVGreen</p>
                      <p className="text-green-400/70 text-xs text-center px-4">Red de Carga EV</p>

                      {/* Fake UI bars */}
                      <div className="w-full px-4 mt-2 space-y-2">
                        <div className="h-2 bg-white/10 rounded-full w-full" />
                        <div className="h-2 bg-green-500/30 rounded-full w-3/4" />
                        <div className="h-2 bg-white/10 rounded-full w-5/6" />
                      </div>

                      {/* Fake charge indicator */}
                      <div className="mt-3 flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-full px-4 py-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-green-400 text-xs font-medium">Cargando · 47 kWh</span>
                      </div>
                    </div>
                  </div>

                  {/* Floating badge */}
                  <div className="absolute -top-3 -right-3 bg-gradient-to-br from-green-400 to-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-green-500/40 rotate-6">
                    ¡Nuevo!
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Todo lo que necesitas para cargar tu EV
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              EVGreen te ofrece la mejor experiencia de carga para vehículos eléctricos en Colombia
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card/50 backdrop-blur border-border/50 hover:border-green-500/50 transition-colors">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-16 bg-gradient-to-r from-green-600/10 to-emerald-600/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            ¿Listo para cargar tu vehículo eléctrico?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Únete a miles de conductores de carros eléctricos que ya usan EVGreen para cargar en Colombia
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Crear Cuenta Gratis
            </Button>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 bg-black/80 hover:bg-black border border-white/10 hover:border-white/20 text-white px-6 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-green-500/20"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0" fill="white" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="text-left">
                <p className="text-white/50 text-[9px] uppercase tracking-widest leading-none">Download on the</p>
                <p className="text-white font-semibold text-sm leading-tight">App Store</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-8 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-500" />
              <span className="font-semibold">EVGreen</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 GreenH Project. Estaciones de carga para vehículos eléctricos en Colombia.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
