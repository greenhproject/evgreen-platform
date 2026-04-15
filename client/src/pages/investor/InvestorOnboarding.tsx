/**
 * EVGreen - Onboarding Premium para Inversionistas
 * Wizard animado de 6 pasos con confetti, progress tracking y formularios guiados
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  User,
  Building,
  CreditCard,
  BarChart3,
  PartyPopper,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Shield,
  TrendingUp,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

// ============================================================================
// CONFETTI EFFECT
// ============================================================================
function ConfettiPiece({ delay, x }: { delay: number; x: number }) {
  const colors = ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#f59e0b", "#3b82f6", "#8b5cf6"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 6 + Math.random() * 8;
  const rotation = Math.random() * 360;

  return (
    <motion.div
      className="fixed pointer-events-none z-[100]"
      style={{
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        borderRadius: 2,
        left: x + "%",
        top: -20,
      }}
      initial={{ y: -20, rotate: 0, opacity: 1 }}
      animate={{
        y: window.innerHeight + 50,
        rotate: rotation + 720,
        opacity: [1, 1, 1, 0.8, 0],
        x: [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 300],
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        delay: delay,
        ease: "easeOut",
      }}
    />
  );
}

function Confetti() {
  const pieces = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    x: Math.random() * 100,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} delay={p.delay} x={p.x} />
      ))}
    </div>
  );
}

// ============================================================================
// STEP DEFINITIONS
// ============================================================================
interface StepDef {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}

const steps: StepDef[] = [
  {
    id: 1,
    title: "Bienvenido",
    subtitle: "Tu portal de inversionista",
    icon: <Zap className="w-8 h-8" />,
    gradient: "from-emerald-600 to-teal-500",
  },
  {
    id: 2,
    title: "Perfil Personal",
    subtitle: "Datos de identificación",
    icon: <User className="w-8 h-8" />,
    gradient: "from-blue-600 to-indigo-500",
  },
  {
    id: 3,
    title: "Empresa",
    subtitle: "Información fiscal",
    icon: <Building className="w-8 h-8" />,
    gradient: "from-purple-600 to-violet-500",
  },
  {
    id: 4,
    title: "Datos Bancarios",
    subtitle: "Para recibir rendimientos",
    icon: <CreditCard className="w-8 h-8" />,
    gradient: "from-amber-600 to-orange-500",
  },
  {
    id: 5,
    title: "Tu Dashboard",
    subtitle: "Lo que puedes hacer",
    icon: <BarChart3 className="w-8 h-8" />,
    gradient: "from-cyan-600 to-blue-500",
  },
  {
    id: 6,
    title: "Todo Listo",
    subtitle: "Comienza a invertir",
    icon: <PartyPopper className="w-8 h-8" />,
    gradient: "from-emerald-500 to-green-400",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function InvestorOnboarding() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Form states - Personal
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");

  // Form states - Company
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [fiscalAddress, setFiscalAddress] = useState("");
  const [fiscalCity, setFiscalCity] = useState("");
  const [fiscalDepartment, setFiscalDepartment] = useState("");

  // Form states - Banking
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  // tRPC mutations
  const onboardingStatus = trpc.onboarding.getStatus.useQuery();
  const savePersonal = trpc.onboarding.savePersonalProfile.useMutation({
    onSuccess: () => { toast.success("Perfil personal guardado"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveCompany = trpc.onboarding.saveCompanyProfile.useMutation({
    onSuccess: () => { toast.success("Datos de empresa guardados"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveBanking = trpc.onboarding.saveBankingInfo.useMutation({
    onSuccess: () => { toast.success("Datos bancarios guardados"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateStep = trpc.onboarding.updateStep.useMutation();
  const completeOnboarding = trpc.onboarding.complete.useMutation({
    onSuccess: () => { refresh(); },
  });

  // Load existing data
  useEffect(() => {
    if (onboardingStatus.data?.profile) {
      const p = onboardingStatus.data.profile;
      setName(p.name || "");
      setPhone((user as any)?.phone || "");
      setDocumentType(p.documentType || "");
      setDocumentNumber(p.documentNumber || "");
      setCompanyName(p.companyName || "");
      setTaxId(p.taxId || "");
      setFiscalAddress(p.fiscalAddress || "");
      setFiscalCity(p.fiscalCity || "");
      setFiscalDepartment(p.fiscalDepartment || "");
      setBankName(p.bankName || "");
      setBankAccount(p.bankAccount || "");
    }
    // Resume from last step
    if (onboardingStatus.data?.onboardingStep && onboardingStatus.data.onboardingStep > 0) {
      const savedStep = onboardingStatus.data.onboardingStep;
      if (savedStep <= 6) setCurrentStep(savedStep);
    }
  }, [onboardingStatus.data, user]);

  const goNext = useCallback(() => {
    if (currentStep < 6) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
      updateStep.mutate({ step: currentStep + 1 });
    }
  }, [currentStep, updateStep]);

  const goPrev = useCallback(() => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSavePersonal = () => {
    savePersonal.mutate({
      name: name || undefined,
      phone: phone || undefined,
      documentType: documentType as any || undefined,
      documentNumber: documentNumber || undefined,
    }, { onSuccess: () => goNext() });
  };

  const handleSaveCompany = () => {
    saveCompany.mutate({
      companyName: companyName || undefined,
      taxId: taxId || undefined,
      fiscalAddress: fiscalAddress || undefined,
      fiscalCity: fiscalCity || undefined,
      fiscalDepartment: fiscalDepartment || undefined,
    }, { onSuccess: () => goNext() });
  };

  const handleSaveBanking = () => {
    if (!bankName || !bankAccount) {
      toast.error("Por favor completa banco y número de cuenta");
      return;
    }
    saveBanking.mutate({
      bankName,
      bankAccount,
    }, { onSuccess: () => goNext() });
  };

  const handleComplete = () => {
    setShowConfetti(true);
    completeOnboarding.mutate(undefined, {
      onSuccess: () => {
        setTimeout(() => {
          navigate("/investor");
        }, 3000);
      },
    });
  };

  const handleSkip = () => {
    completeOnboarding.mutate(undefined, {
      onSuccess: () => {
        toast.info("Puedes completar tu perfil en Configuración cuando quieras");
        navigate("/investor");
      },
    });
  };

  const isSaving = savePersonal.isPending || saveCompany.isPending || saveBanking.isPending;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 400 : -400, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 400 : -400, opacity: 0, scale: 0.95 }),
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {showConfetti && <Confetti />}

      {/* Background gradient */}
      <motion.div
        className={`fixed inset-0 bg-gradient-to-br ${steps[currentStep - 1].gradient} opacity-5`}
        key={`bg-${currentStep}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.05 }}
        transition={{ duration: 0.5 }}
      />

      {/* Floating particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500/30"
            style={{ left: `${8 + i * 8}%` }}
            initial={{ y: typeof window !== 'undefined' ? window.innerHeight + 20 : 800, opacity: 0.2 }}
            animate={{
              y: -20,
              opacity: [0.2, 0.5, 0.2],
              transition: { duration: 4 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 },
            }}
          />
        ))}
      </div>

      {/* Skip button */}
      <motion.button
        className="fixed top-6 right-6 text-muted-foreground hover:text-foreground transition-colors z-10 text-sm"
        onClick={handleSkip}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Completar después
      </motion.button>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-20">
        <div className="h-1 bg-muted">
          <motion.div
            className={`h-full bg-gradient-to-r ${steps[currentStep - 1].gradient}`}
            initial={{ width: "0%" }}
            animate={{ width: `${(currentStep / steps.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <motion.div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i + 1 < currentStep
                  ? "bg-emerald-500 text-white"
                  : i + 1 === currentStep
                  ? `bg-gradient-to-r ${step.gradient} text-white shadow-lg`
                  : "bg-muted text-muted-foreground"
              }`}
              animate={{ scale: i + 1 === currentStep ? 1.15 : 1 }}
            >
              {i + 1 < currentStep ? <Check className="w-4 h-4" /> : step.id}
            </motion.div>
            {i < steps.length - 1 && (
              <div className={`w-6 h-0.5 mx-1 ${i + 1 < currentStep ? "bg-emerald-500" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-2xl"
          >
            {/* ============ STEP 1: WELCOME ============ */}
            {currentStep === 1 && (
              <div className="text-center space-y-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                  className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30"
                >
                  <Zap className="w-12 h-12 text-white" />
                </motion.div>

                <div>
                  <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-4xl font-bold mb-2"
                  >
                    Bienvenido a{" "}
                    <span className="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                      EVGreen
                    </span>
                  </motion.h1>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-lg text-muted-foreground"
                  >
                    Tu inversión ha sido confirmada exitosamente
                  </motion.p>
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto"
                >
                  {[
                    { icon: <Shield className="w-6 h-6" />, label: "Inversión segura", desc: "Protegida y transparente" },
                    { icon: <TrendingUp className="w-6 h-6" />, label: "Rendimientos", desc: "Monitoreo en tiempo real" },
                    { icon: <Eye className="w-6 h-6" />, label: "Visibilidad total", desc: "Dashboard personalizado" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.7 + i * 0.1 }}
                      className="p-4 rounded-xl bg-card/50 border border-border/50"
                    >
                      <div className="text-emerald-500 mb-2">{item.icon}</div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </motion.div>
                  ))}
                </motion.div>

                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-sm text-muted-foreground"
                >
                  Configuremos tu cuenta en menos de 3 minutos para que puedas empezar a monitorear tu inversión
                </motion.p>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <Button
                    size="lg"
                    onClick={goNext}
                    className="bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-90 text-white px-8 shadow-lg shadow-emerald-500/25"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Comenzar configuración
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              </div>
            )}

            {/* ============ STEP 2: PERSONAL PROFILE ============ */}
            {currentStep === 2 && (
              <Card className="p-8 bg-card/80 backdrop-blur border-border/50">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Perfil Personal</h2>
                  <p className="text-muted-foreground mt-1">Datos básicos de identificación</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nombre completo *</Label>
                    <Input
                      placeholder="Tu nombre completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Teléfono</Label>
                    <Input
                      placeholder="+57 300 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de documento</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                        <SelectItem value="NIT">NIT</SelectItem>
                        <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                        <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Número de documento</Label>
                    <Input
                      placeholder="Número de documento"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    onClick={handleSavePersonal}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-600 to-indigo-500 hover:opacity-90 text-white px-6"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Guardar y continuar <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </Card>
            )}

            {/* ============ STEP 3: COMPANY ============ */}
            {currentStep === 3 && (
              <Card className="p-8 bg-card/80 backdrop-blur border-border/50">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 mx-auto bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <Building className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Información de Empresa</h2>
                  <p className="text-muted-foreground mt-1">Datos fiscales para facturación y liquidaciones</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Razón social</Label>
                    <Input
                      placeholder="Nombre de la empresa"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">NIT</Label>
                    <Input
                      placeholder="900.000.000-0"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <Label className="text-sm font-medium">Dirección fiscal</Label>
                    <Input
                      placeholder="Dirección de la empresa"
                      value={fiscalAddress}
                      onChange={(e) => setFiscalAddress(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Ciudad</Label>
                    <Input
                      placeholder="Ciudad"
                      value={fiscalCity}
                      onChange={(e) => setFiscalCity(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Departamento</Label>
                    <Input
                      placeholder="Departamento"
                      value={fiscalDepartment}
                      onChange={(e) => setFiscalDepartment(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Si eres persona natural, puedes omitir estos campos y completarlos después.
                </p>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={goNext}>
                      Omitir
                    </Button>
                    <Button
                      onClick={handleSaveCompany}
                      disabled={isSaving}
                      className="bg-gradient-to-r from-purple-600 to-violet-500 hover:opacity-90 text-white px-6"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Guardar y continuar <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* ============ STEP 4: BANKING ============ */}
            {currentStep === 4 && (
              <Card className="p-8 bg-card/80 backdrop-blur border-border/50">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 mx-auto bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <CreditCard className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Datos Bancarios</h2>
                  <p className="text-muted-foreground mt-1">Para recibir tus rendimientos de inversión</p>
                </div>

                <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 mb-6">
                  <p className="text-sm text-amber-200/80">
                    <Shield className="w-4 h-4 inline mr-2 text-amber-500" />
                    Tus datos bancarios están protegidos con encriptación de nivel bancario. Solo se usarán para transferir tus rendimientos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Banco *</Label>
                    <Select value={bankName} onValueChange={setBankName}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecciona tu banco" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                        <SelectItem value="Davivienda">Davivienda</SelectItem>
                        <SelectItem value="BBVA">BBVA</SelectItem>
                        <SelectItem value="Banco de Bogotá">Banco de Bogotá</SelectItem>
                        <SelectItem value="Banco de Occidente">Banco de Occidente</SelectItem>
                        <SelectItem value="Banco AV Villas">Banco AV Villas</SelectItem>
                        <SelectItem value="Banco Caja Social">Banco Caja Social</SelectItem>
                        <SelectItem value="Scotiabank Colpatria">Scotiabank Colpatria</SelectItem>
                        <SelectItem value="Banco Falabella">Banco Falabella</SelectItem>
                        <SelectItem value="Nequi">Nequi</SelectItem>
                        <SelectItem value="Daviplata">Daviplata</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Número de cuenta *</Label>
                    <Input
                      placeholder="Número de cuenta"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={goNext}>
                      Omitir
                    </Button>
                    <Button
                      onClick={handleSaveBanking}
                      disabled={isSaving}
                      className="bg-gradient-to-r from-amber-600 to-orange-500 hover:opacity-90 text-white px-6"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Guardar y continuar <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* ============ STEP 5: DASHBOARD TOUR ============ */}
            {currentStep === 5 && (
              <div className="space-y-8">
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="w-14 h-14 mx-auto bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                  >
                    <BarChart3 className="w-7 h-7 text-white" />
                  </motion.div>
                  <h2 className="text-2xl font-bold">Tu Portal de Inversionista</h2>
                  <p className="text-muted-foreground mt-1">Todo lo que necesitas para monitorear tu inversión</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      icon: <BarChart3 className="w-6 h-6" />,
                      title: "Dashboard en tiempo real",
                      desc: "Monitorea ingresos, sesiones de carga y rendimiento de tus estaciones con gráficas interactivas.",
                      color: "from-emerald-500/20 to-emerald-500/5",
                      border: "border-emerald-500/20",
                    },
                    {
                      icon: <TrendingUp className="w-6 h-6" />,
                      title: "Liquidaciones automáticas",
                      desc: "Recibe reportes detallados de ingresos y gastos con distribución transparente de utilidades.",
                      color: "from-blue-500/20 to-blue-500/5",
                      border: "border-blue-500/20",
                    },
                    {
                      icon: <Eye className="w-6 h-6" />,
                      title: "Reportes exportables",
                      desc: "Genera reportes en Excel y PDF con toda la información financiera de tus inversiones.",
                      color: "from-purple-500/20 to-purple-500/5",
                      border: "border-purple-500/20",
                    },
                    {
                      icon: <Sparkles className="w-6 h-6" />,
                      title: "Asistente IA",
                      desc: "Un asistente inteligente que analiza tus datos y te da recomendaciones personalizadas.",
                      color: "from-amber-500/20 to-amber-500/5",
                      border: "border-amber-500/20",
                    },
                  ].map((feature, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                    >
                      <Card className={`p-5 bg-gradient-to-br ${feature.color} ${feature.border} h-full`}>
                        <div className="text-emerald-400 mb-3">{feature.icon}</div>
                        <h3 className="font-semibold mb-1">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.desc}</p>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={goPrev}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    onClick={goNext}
                    className="bg-gradient-to-r from-cyan-600 to-blue-500 hover:opacity-90 text-white px-6"
                  >
                    Finalizar <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============ STEP 6: COMPLETION ============ */}
            {currentStep === 6 && (
              <div className="text-center space-y-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                  className="w-28 h-28 mx-auto bg-gradient-to-br from-emerald-500 to-green-400 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    <Check className="w-14 h-14 text-white" strokeWidth={3} />
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <h1 className="text-3xl font-bold mb-2">
                    Todo listo,{" "}
                    <span className="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                      {name || user?.name || "Inversionista"}
                    </span>
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Tu cuenta está configurada y lista para usar
                  </p>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {[
                      { done: !!name, label: "Perfil personal" },
                      { done: !!companyName, label: "Empresa" },
                      { done: !!bankName && !!bankAccount, label: "Datos bancarios" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        {item.done ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                        )}
                        <span className={item.done ? "text-foreground" : ""}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <Button
                    size="lg"
                    onClick={handleComplete}
                    className="bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-90 text-white px-10 shadow-lg shadow-emerald-500/25"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Ir a mi Dashboard
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="text-xs text-muted-foreground"
                >
                  Puedes modificar todos tus datos en cualquier momento desde Configuración
                </motion.p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
