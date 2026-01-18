import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";
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
  CreditCard
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        
        {/* Animated circles */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Zap className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">Green EV by Green House Project</span>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6"
            >
              Carga tu vehículo eléctrico{" "}
              <span className="text-gradient">de forma inteligente</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
            >
              La red de cargadores más grande de Colombia. Encuentra, reserva y paga 
              tu carga desde tu smartphone. Simple, rápido y confiable.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="lg"
                className="gradient-primary text-white px-8 py-6 text-lg rounded-xl shadow-glow hover:shadow-glow-sm transition-all"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Comenzar ahora
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg rounded-xl border-2"
              >
                Ver estaciones
                <MapPin className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">50+</div>
                <div className="text-sm text-muted-foreground">Estaciones</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">10K+</div>
                <div className="text-sm text-muted-foreground">Usuarios</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">24/7</div>
                <div className="text-sm text-muted-foreground">Disponible</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Todo lo que necesitas para cargar
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Una experiencia de carga completa diseñada para conductores de vehículos eléctricos en Colombia
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-card border border-border card-interactive"
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
              className="p-6 rounded-2xl bg-card border border-border card-interactive"
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
              className="p-6 rounded-2xl bg-card border border-border card-interactive"
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
              className="p-6 rounded-2xl bg-card border border-border card-interactive"
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
              className="p-6 rounded-2xl bg-card border border-border card-interactive"
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
              className="p-6 rounded-2xl bg-card border border-border card-interactive"
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

      {/* Investor Section */}
      <section className="py-20 px-4">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium mb-6">
                <TrendingUp className="w-4 h-4" />
                Para inversionistas
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Invierte en el futuro de la movilidad eléctrica
              </h2>
              <p className="text-muted-foreground mb-8">
                Adquiere estaciones de carga y genera ingresos pasivos. Nosotros nos encargamos 
                de la operación, mantenimiento y soporte. Tú recibes el 80% de los ingresos.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <span>Dashboard en tiempo real con métricas de tu inversión</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <span>Reportes detallados de ingresos y consumo</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <span>Configura precios y horarios de operación</span>
                </li>
              </ul>
              <Button
                size="lg"
                variant="outline"
                className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
              >
                Conocer más
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-secondary/20 to-primary/20 p-8 flex items-center justify-center">
                <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-6 border">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-muted-foreground">Ingresos del mes</span>
                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">+12.5%</span>
                  </div>
                  <div className="text-3xl font-bold mb-2">$2,450,000</div>
                  <div className="text-sm text-muted-foreground mb-6">COP</div>
                  <div className="h-32 bg-muted/50 rounded-xl flex items-end justify-around p-4">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="w-6 bg-primary/80 rounded-t-md transition-all hover:bg-primary"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 gradient-primary opacity-90" />
            <div className="relative z-10 py-16 px-8 text-center text-white">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                ¿Listo para comenzar?
              </h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8">
                Únete a miles de conductores que ya disfrutan de la mejor experiencia de carga en Colombia
              </p>
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg rounded-xl"
                onClick={() => window.location.href = getLoginUrl()}
              >
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
              <Zap className="w-6 h-6 text-primary" />
              <span className="font-semibold">Green EV</span>
              <span className="text-muted-foreground">by Green House Project</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Términos</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidad</a>
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
