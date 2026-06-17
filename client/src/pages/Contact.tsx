/**
 * EVGreen - Página de Contacto
 * Formulario de contacto que envía al email evgreen@greenhproject.com
 * @author Green House Project
 */
import { useState } from "react";
import { ArrowLeft, Mail, MessageSquare, Send, CheckCircle, AlertCircle, MapPin, Clock } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const CONTACT_EMAIL = "evgreen@greenhproject.com";

type ContactTopic = "soporte_tecnico" | "facturacion" | "estaciones" | "cuenta" | "empresas" | "inversores" | "datos_personales" | "otro";

const TOPICS = [
  { value: "soporte_tecnico", label: "Soporte técnico" },
  { value: "facturacion", label: "Facturación y pagos" },
  { value: "estaciones", label: "Estaciones de carga" },
  { value: "cuenta", label: "Mi cuenta" },
  { value: "empresas", label: "Soluciones para empresas" },
  { value: "inversores", label: "Inversores / Alianzas" },
  { value: "datos_personales", label: "Datos personales (HABEAS DATA)" },
  { value: "otro", label: "Otro" },
];

export default function Contact() {
  const [form, setForm] = useState<{ name: string; email: string; topic: ContactTopic | ""; message: string; consent: boolean }>({
    name: "",
    email: "",
    topic: "",
    message: "",
    consent: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendContact = trpc.contact.sendMessage.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Ocurrió un error al enviar el mensaje. Por favor intenta de nuevo.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.topic || !form.message.trim()) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }
    if (!form.consent) {
      setError("Debes aceptar la política de privacidad para enviar el mensaje.");
      return;
    }
    if (!form.topic) return;
    sendContact.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      topic: form.topic,
      message: form.message.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/landing">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Volver</span>
            </button>
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Contacto</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 pb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">¿En qué podemos ayudarte?</h2>
          <p className="text-muted-foreground mt-2">
            Nuestro equipo está disponible para resolver tus dudas sobre carga, facturación, tu cuenta o cualquier otro tema relacionado con EVGreen.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">¡Mensaje enviado!</h3>
                <p className="text-muted-foreground max-w-sm">
                  Hemos recibido tu mensaje y te responderemos en un plazo máximo de <strong className="text-foreground">2 días hábiles</strong> al correo que proporcionaste.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", topic: "", message: "", consent: false }); }}
                  className="mt-6 px-4 py-2 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Nombre completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tu nombre"
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Correo electrónico <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@correo.com"
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Asunto <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value as ContactTopic | "" })}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="">Selecciona un tema</option>
                    {TOPICS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Mensaje <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Describe tu consulta con el mayor detalle posible..."
                    rows={6}
                    maxLength={2000}
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{form.message.length}/2000</p>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={form.consent}
                    onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-primary"
                  />
                  <label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed">
                    He leído y acepto la{" "}
                    <Link href="/privacy">
                      <span className="text-primary hover:underline cursor-pointer">Política de Privacidad</span>
                    </Link>{" "}
                    de EVGreen y autorizo el tratamiento de mis datos personales para la atención de esta solicitud, conforme a la Ley 1581 de 2012.
                    <span className="text-red-400"> *</span>
                  </label>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sendContact.isPending}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {sendContact.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar mensaje
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Información de contacto */}
          <div className="space-y-4">
            <div className="p-5 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Correo electrónico</h3>
              </div>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline text-sm break-all">
                {CONTACT_EMAIL}
              </a>
              <p className="text-xs text-muted-foreground mt-1">Respuesta en máx. 2 días hábiles</p>
            </div>

            <div className="p-5 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Horario de atención</h3>
              </div>
              <p className="text-sm text-muted-foreground">Lunes a viernes</p>
              <p className="text-sm text-foreground font-medium">8:00 a.m. – 6:00 p.m.</p>
              <p className="text-xs text-muted-foreground mt-1">Hora Colombia (COT, UTC-5)</p>
            </div>

            <div className="p-5 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Sede principal</h3>
              </div>
              <p className="text-sm text-muted-foreground">Green House Project S.A.S.</p>
              <p className="text-sm text-foreground">Bogotá D.C., Colombia</p>
            </div>

            <div className="p-5 bg-primary/10 border border-primary/20 rounded-xl">
              <h3 className="font-semibold text-foreground text-sm mb-2">Soporte de emergencia</h3>
              <p className="text-xs text-muted-foreground">
                Si tienes una emergencia activa con una sesión de carga (vehículo bloqueado, cobro incorrecto, etc.), incluye en el asunto <strong className="text-foreground">"URGENTE"</strong> y lo atenderemos con prioridad.
              </p>
            </div>

            <div className="p-5 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-foreground text-sm mb-2">Derechos HABEAS DATA</h3>
              <p className="text-xs text-muted-foreground">
                Para ejercer tus derechos de acceso, rectificación, supresión u oposición sobre tus datos personales (Ley 1581/2012), selecciona el asunto <strong className="text-foreground">"Datos personales (HABEAS DATA)"</strong> en el formulario o escribe directamente a{" "}
                <a href="mailto:privacidad@greenhproject.com" className="text-primary hover:underline">privacidad@greenhproject.com</a>.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm">
          <Link href="/terms">
            <span className="text-primary hover:underline cursor-pointer">Términos y Condiciones</span>
          </Link>
          <Link href="/privacy">
            <span className="text-primary hover:underline cursor-pointer">Política de Privacidad</span>
          </Link>
          <Link href="/landing">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer">Inicio</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
