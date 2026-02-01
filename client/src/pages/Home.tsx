import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, MapPin, CreditCard, Shield, Clock, Leaf } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Establecer título de página para SEO
  useEffect(() => {
    document.title = "EVGreen - Carga tu Vehículo Eléctrico en Colombia";
  }, []);

  // Si el usuario está autenticado, redirigir al mapa
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
      {/* Hero Section */}
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
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
          </div>
        </div>
      </header>

      {/* Features Section */}
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

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-green-600/10 to-emerald-600/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            ¿Listo para cargar tu vehículo eléctrico?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Únete a miles de conductores de carros eléctricos que ya usan EVGreen para cargar en Colombia
          </p>
          <Button 
            size="lg"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            onClick={() => window.location.href = getLoginUrl()}
          >
            Crear Cuenta Gratis
          </Button>
        </div>
      </section>

      {/* Footer */}
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
