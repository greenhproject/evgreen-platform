import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Zap, Building2, ArrowRight, CheckCircle, Users, BarChart2, Target } from "lucide-react";
import { Link } from "wouter";

const INDUSTRIES = [
  "Automotriz", "Tecnología", "Retail", "Energía", "Finanzas",
  "Salud", "Educación", "Turismo", "Inmobiliaria", "Seguros",
  "Alimentación", "Entretenimiento", "Telecomunicaciones", "Otro",
];

export default function AdvertiserRegister() {
  const [, navigate] = useLocation();
  const { user, loginUrl } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    companyName: "",
    taxId: "",
    industry: "",
    website: "",
    contactName: "",
    contactPhone: "",
    contactEmail: user?.email ?? "",
    monthlyBudget: "",
  });

  const registerMutation = trpc.advertiser.register.useMutation({
    onSuccess: () => {
      toast.success("¡Registro exitoso!: Tu perfil está en revisión. Te notificaremos cuando sea aprobado.");
      navigate("/advertiser/dashboard");
    },
    onError: (err) => {
      toast.error("Error: " + String(err.message));
    },
  });

  const { data: existingProfile } = trpc.advertiser.getProfile.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#0d1526] border-white/10">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <CardTitle className="text-white text-xl">Portal de Anunciantes</CardTitle>
            <CardDescription className="text-white/50">
              Inicia sesión para registrar tu empresa y comenzar a anunciar en EVGreen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={loginUrl}>
              <Button className="w-full bg-green-500 hover:bg-green-600 text-white">
                Iniciar sesión
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingProfile) {
    navigate("/advertiser/dashboard");
    return null;
  }

  const handleSubmit = () => {
    if (!form.companyName.trim()) {
      toast.error("Error: " + String("El nombre de la empresa es requerido."));
      return;
    }
    registerMutation.mutate({
      companyName: form.companyName,
      taxId: form.taxId || undefined,
      industry: form.industry || undefined,
      website: form.website || undefined,
      contactName: form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      monthlyBudget: form.monthlyBudget ? parseInt(form.monthlyBudget) : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex">
      {/* Left panel — benefits */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-900/30 to-emerald-900/20 border-r border-white/5 flex-col justify-center p-12">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold">EVGreen Ads</p>
            <p className="text-white/40 text-sm">Plataforma de publicidad para VE</p>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Llega a +10,000 conductores de VE en Colombia
        </h1>
        <p className="text-white/60 mb-10">
          La audiencia más cualificada del sector de movilidad eléctrica. Conductores activos, con alto poder adquisitivo y comprometidos con la sostenibilidad.
        </p>

        <div className="space-y-5">
          {[
            { icon: Users, title: "+10,000 conductores activos", desc: "Audiencia verificada y segmentable" },
            { icon: Target, title: "Segmentación precisa", desc: "Por ciudad, marca de vehículo y hábitos de carga" },
            { icon: BarChart2, title: "Métricas en tiempo real", desc: "Impresiones, clics y CTR por campaña" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">{item.title}</p>
                <p className="text-white/50 text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= s ? "bg-green-500 text-white" : "bg-white/10 text-white/40"
                  }`}
                >
                  {step > s ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                <span className={`text-sm ${step >= s ? "text-white" : "text-white/40"}`}>
                  {s === 1 ? "Empresa" : "Contacto"}
                </span>
                {s < 2 && <div className="w-8 h-px bg-white/10 mx-1" />}
              </div>
            ))}
          </div>

          <Card className="bg-[#0d1526] border-white/10">
            <CardHeader>
              <CardTitle className="text-white">
                {step === 1 ? "Datos de tu empresa" : "Información de contacto"}
              </CardTitle>
              <CardDescription className="text-white/50">
                {step === 1
                  ? "Cuéntanos sobre tu empresa para personalizar tu experiencia."
                  : "¿Cómo podemos contactarte?"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <Label className="text-white/70 text-sm">Nombre de la empresa *</Label>
                    <Input
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      placeholder="Ej: Tecnología Verde S.A.S."
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">NIT / Documento</Label>
                    <Input
                      value={form.taxId}
                      onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                      placeholder="Ej: 900.123.456-7"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Industria</Label>
                    <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                        <SelectValue placeholder="Selecciona tu industria" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((ind) => (
                          <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Sitio web</Label>
                    <Input
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://tuempresa.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Presupuesto mensual estimado (COP)</Label>
                    <Input
                      type="number"
                      value={form.monthlyBudget}
                      onChange={(e) => setForm({ ...form, monthlyBudget: e.target.value })}
                      placeholder="Ej: 500000"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
                    />
                  </div>
                  <Button
                    className="w-full bg-green-500 hover:bg-green-600 text-white mt-2"
                    onClick={() => {
                      if (!form.companyName.trim()) {
                        toast.error("Error: " + String("El nombre de la empresa es requerido."));
                        return;
                      }
                      setStep(2);
                    }}
                  >
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-white/70 text-sm">Nombre del contacto</Label>
                    <Input
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      placeholder="Tu nombre completo"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Teléfono</Label>
                    <Input
                      value={form.contactPhone}
                      onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                      placeholder="+57 300 000 0000"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Email de contacto</Label>
                    <Input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                      placeholder="contacto@tuempresa.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
                    />
                  </div>

                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mt-2">
                    <p className="text-green-400 text-sm font-medium mb-1">¿Qué pasa después?</p>
                    <p className="text-white/60 text-xs">
                      Nuestro equipo revisará tu solicitud en 24-48 horas. Una vez aprobado, podrás crear campañas y usar el AI Campaign Wizard.
                    </p>
                  </div>

                  <div className="flex gap-3 mt-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-white/10 text-white/60 hover:bg-white/5"
                      onClick={() => setStep(1)}
                    >
                      Atrás
                    </Button>
                    <Button
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                      onClick={handleSubmit}
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Registrando..." : "Registrarme"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-white/30 text-xs mt-4">
            ¿Ya tienes cuenta?{" "}
            <Link href="/advertiser/dashboard">
              <span className="text-green-400 cursor-pointer hover:underline">Ir al dashboard</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
