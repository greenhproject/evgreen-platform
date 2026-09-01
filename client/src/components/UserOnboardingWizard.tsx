import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, CarFront, Check, ChevronLeft, ChevronRight, CircleCheckBig, FileText, MapPin, MessageCircle, ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useNotifications } from "@/hooks/useNotifications";
import { VEHICLE_BRANDS } from "@shared/vehicle-brands";

type OnboardingProfile = {
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  city: string;
  electronicInvoiceOptIn: boolean;
  hasVehicle: boolean;
};

type UserOnboardingWizardProps = {
  initialStep: number;
  profile: OnboardingProfile;
  onEnd: () => void;
};

const connectorOptions = [
  { value: "TYPE_2", label: "Tipo 2 (AC)" },
  { value: "CCS_2", label: "CCS2 (DC)" },
  { value: "CCS_1", label: "CCS1 (DC)" },
  { value: "GBT_AC", label: "GB/T (AC)" },
  { value: "GBT_DC", label: "GB/T (DC)" },
] as const;

const steps = [
  { id: 1, label: "Inicio", icon: Sparkles },
  { id: 2, label: "Perfil", icon: UserRound },
  { id: 3, label: "Vehículo", icon: CarFront },
  { id: 4, label: "Factura", icon: FileText },
  { id: 5, label: "Alertas", icon: BellRing },
] as const;

function splitName(name: string) {
  const [firstName = "", ...lastName] = name.trim().split(/\s+/);
  return { firstName, lastName: lastName.join(" ") };
}

export function UserOnboardingWizard({ initialStep, profile, onEnd }: UserOnboardingWizardProps) {
  const utils = trpc.useUtils();
  const name = useMemo(() => splitName(profile.name), [profile.name]);
  const [currentStep, setCurrentStep] = useState(Math.min(Math.max(initialStep, 1), 5));
  const [firstName, setFirstName] = useState(name.firstName);
  const [lastName, setLastName] = useState(name.lastName);
  const [birthDate, setBirthDate] = useState(profile.birthDate || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [city, setCity] = useState(profile.city || "");
  const [address, setAddress] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [batteryCapacityKwh, setBatteryCapacityKwh] = useState("");
  const [connectorType, setConnectorType] = useState<string>("CCS_2");
  const [wantsElectronicInvoice, setWantsElectronicInvoice] = useState(profile.electronicInvoiceOptIn);
  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [kindOfPerson, setKindOfPerson] = useState("PERSON_ENTITY");
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [regime, setRegime] = useState("NOT_RESPONSIBLE_FOR_IVA");
  const [fiscalAddress, setFiscalAddress] = useState("");
  const [fiscalCity, setFiscalCity] = useState("");
  const [fiscalDepartment, setFiscalDepartment] = useState("");
  const [whatsAppEnabled, setWhatsAppEnabled] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [activatingPush, setActivatingPush] = useState(false);
  const { isSupported: pushSupported, isEnabled: pushEnabled, permissionStatus, enableNotifications } = useNotifications();

  const startMutation = trpc.userOnboarding.start.useMutation();
  const saveProfileMutation = trpc.userOnboarding.savePersonalProfile.useMutation();
  const saveVehicleMutation = trpc.userOnboarding.saveVehicle.useMutation();
  const skipVehicleMutation = trpc.userOnboarding.skipVehicle.useMutation();
  const saveBillingMutation = trpc.userOnboarding.saveBilling.useMutation();
  const saveWhatsAppMutation = trpc.userOnboarding.saveWhatsAppPreference.useMutation();
  const recordPushMutation = trpc.userOnboarding.recordPushPreference.useMutation();
  const completeMutation = trpc.userOnboarding.complete.useMutation();
  const skipMutation = trpc.userOnboarding.skip.useMutation();
  const acceptTermsMutation = trpc.auth.acceptTerms.useMutation();

  const isSaving = startMutation.isPending || saveProfileMutation.isPending || saveVehicleMutation.isPending || skipVehicleMutation.isPending || saveBillingMutation.isPending || saveWhatsAppMutation.isPending || recordPushMutation.isPending || completeMutation.isPending || skipMutation.isPending || acceptTermsMutation.isPending || activatingPush;

  const finish = async () => {
    await utils.userOnboarding.getStatus.invalidate();
    onEnd();
  };

  const skip = async () => {
    try {
      await skipMutation.mutateAsync();
      toast.success("Podrás completar tu configuración desde Mi perfil cuando quieras.");
      await finish();
    } catch (error: any) {
      toast.error(error.message || "No se pudo guardar tu preferencia.");
    }
  };

  const next = async () => {
    try {
      if (currentStep === 1) {
        await startMutation.mutateAsync();
        setCurrentStep(2);
        return;
      }

      if (currentStep === 2) {
        await saveProfileMutation.mutateAsync({
          firstName,
          lastName,
          birthDate: birthDate || undefined,
          phone,
          city: city || undefined,
          address: address || undefined,
          emailConfirmed: true,
        });
        setCurrentStep(3);
        return;
      }

      if (currentStep === 3) {
        await saveVehicleMutation.mutateAsync({
          brand,
          model,
          batteryCapacityKwh: batteryCapacityKwh ? Number(batteryCapacityKwh) : undefined,
          connectorTypes: [connectorType as "TYPE_1" | "TYPE_2" | "CCS_1" | "CCS_2" | "CHADEMO" | "TESLA" | "GBT_AC" | "GBT_DC"],
        });
        setCurrentStep(4);
        return;
      }

      if (currentStep === 4) {
        await saveBillingMutation.mutateAsync({
          wantsElectronicInvoice,
          documentType: wantsElectronicInvoice ? documentType as "CC" | "NIT" | "CE" | "PASAPORTE" | "TI" | "PEP" : undefined,
          documentNumber: wantsElectronicInvoice ? documentNumber : undefined,
          kindOfPerson: wantsElectronicInvoice ? kindOfPerson as "PERSON_ENTITY" | "LEGAL_ENTITY" : undefined,
          companyName: wantsElectronicInvoice ? companyName : undefined,
          taxId: wantsElectronicInvoice ? taxId : undefined,
          regime: wantsElectronicInvoice ? regime as "SIMPLIFIED_REGIME" | "COMMON_REGIME" | "NOT_RESPONSIBLE_FOR_IVA" : undefined,
          fiscalAddress: wantsElectronicInvoice ? fiscalAddress : undefined,
          fiscalCity: wantsElectronicInvoice ? fiscalCity : undefined,
          fiscalDepartment: wantsElectronicInvoice ? fiscalDepartment : undefined,
        });
        setCurrentStep(5);
        return;
      }

      if (!acceptTerms) {
        toast.error("Acepta los Términos y la Política de tratamiento de datos para activar tu cuenta.");
        return;
      }
      await saveWhatsAppMutation.mutateAsync({ enabled: whatsAppEnabled });
      await acceptTermsMutation.mutateAsync({ version: "1.0" });
      await completeMutation.mutateAsync();
      toast.success("Tu experiencia EVGreen está lista.");
      await finish();
    } catch (error: any) {
      toast.error(error.message || "Revisa los datos para continuar.");
    }
  };

  const skipVehicle = async () => {
    try {
      await skipVehicleMutation.mutateAsync();
      setCurrentStep(4);
    } catch (error: any) {
      toast.error(error.message || "No se pudo continuar.");
    }
  };

  const enablePush = async () => {
    setActivatingPush(true);
    try {
      await enableNotifications();
      const granted = typeof Notification !== "undefined" ? Notification.permission === "granted" : permissionStatus === "granted";
      await recordPushMutation.mutateAsync({ granted });
      if (granted) toast.success("Notificaciones push activadas.");
    } catch (error: any) {
      await recordPushMutation.mutateAsync({ granted: false }).catch(() => undefined);
      toast.error(error.message || "No se pudieron activar las notificaciones push.");
    } finally {
      setActivatingPush(false);
    }
  };

  const stepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-primary text-primary-foreground shadow-[0_0_40px_hsl(var(--primary)/0.35)]"><Zap className="h-10 w-10" /></div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Configuración inteligente</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Activa tu experiencia EVGreen</h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">Personaliza tus cargas, recibos y alertas en menos de dos minutos. Solo pedimos lo necesario y podrás editarlo después.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-left">
            {[{ icon: CarFront, label: "Vehículo" }, { icon: FileText, label: "Facturación" }, { icon: BellRing, label: "Alertas" }].map(({ icon: Icon, label }) => <div key={label} className="rounded-2xl border border-border/70 bg-muted/30 p-3"><Icon className="mb-2 h-4 w-4 text-primary" /><span className="block text-xs font-medium text-foreground">{label}</span></div>)}
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-5">
          <WizardHeading icon={UserRound} eyebrow="Tu cuenta" title="Empecemos por conocerte" description="Usaremos estos datos para tu cuenta, soporte y facturación cuando la solicites." />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre"><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" placeholder="Tu nombre" /></Field><Field label="Apellido"><Input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" placeholder="Tu apellido" /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha de nacimiento" optional><Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></Field><Field label="WhatsApp"><Input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="+57 300 000 0000" /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Ciudad" optional><Input value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" placeholder="Bogotá" /></Field><Field label="Dirección" optional><Input value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" placeholder="Opcional" /></Field></div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3"><Checkbox checked={emailConfirmed} onCheckedChange={(checked) => setEmailConfirmed(checked === true)} /><span className="text-sm leading-5 text-muted-foreground">Confirmo que <strong className="font-medium text-foreground">{profile.email || "mi correo de cuenta"}</strong> es correcto. Este correo está protegido por el inicio de sesión y no se modifica en este paso.</span></label>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-5">
          <WizardHeading icon={CarFront} eyebrow="Tu vehículo" title="Haz que cada carga sea más precisa" description="Registra tu vehículo principal para mostrar conectores y estimaciones más relevantes. Puedes añadir otros después." />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Marca"><Select value={brand} onValueChange={setBrand}><SelectTrigger><SelectValue placeholder="Selecciona una marca" /></SelectTrigger><SelectContent>{VEHICLE_BRANDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Modelo"><Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Ej. iX3, EX30, e-208" /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Batería útil (kWh)" optional><Input type="number" min="1" max="999" value={batteryCapacityKwh} onChange={(event) => setBatteryCapacityKwh(event.target.value)} placeholder="Ej. 64" /></Field><Field label="Conector principal"><Select value={connectorType} onValueChange={setConnectorType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{connectorOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field></div>
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs leading-5 text-primary">Los datos de batería y conector son opcionales para iniciar; mejoran las estimaciones de carga y se pueden corregir desde <strong>Mis vehículos</strong>.</p>
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div className="space-y-5">
          <WizardHeading icon={FileText} eyebrow="Facturación" title="Recibe tus comprobantes correctamente" description="Activa la factura electrónica solo si la necesitas. Pediremos los datos tributarios únicamente en ese caso." />
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 p-4"><span><span className="block text-sm font-semibold text-foreground">Quiero factura electrónica</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Podrás activarla o modificarla antes de cualquier futura emisión.</span></span><Checkbox checked={wantsElectronicInvoice} onCheckedChange={(checked) => setWantsElectronicInvoice(checked === true)} /></label>
          {wantsElectronicInvoice && <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo de documento"><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CC">Cédula de ciudadanía</SelectItem><SelectItem value="NIT">NIT</SelectItem><SelectItem value="CE">Cédula de extranjería</SelectItem><SelectItem value="PASAPORTE">Pasaporte</SelectItem></SelectContent></Select></Field><Field label="Número de documento"><Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo de persona"><Select value={kindOfPerson} onValueChange={setKindOfPerson}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PERSON_ENTITY">Persona natural</SelectItem><SelectItem value="LEGAL_ENTITY">Persona jurídica</SelectItem></SelectContent></Select></Field><Field label="Régimen"><Select value={regime} onValueChange={setRegime}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NOT_RESPONSIBLE_FOR_IVA">No responsable de IVA</SelectItem><SelectItem value="SIMPLIFIED_REGIME">Régimen simplificado</SelectItem><SelectItem value="COMMON_REGIME">Régimen común</SelectItem></SelectContent></Select></Field></div>{kindOfPerson === "LEGAL_ENTITY" && <div className="grid gap-4 sm:grid-cols-2"><Field label="Razón social"><Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></Field><Field label="NIT"><Input value={taxId} onChange={(event) => setTaxId(event.target.value)} /></Field></div>}<Field label="Dirección fiscal"><Input value={fiscalAddress} onChange={(event) => setFiscalAddress(event.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Ciudad fiscal"><Input value={fiscalCity} onChange={(event) => setFiscalCity(event.target.value)} /></Field><Field label="Departamento fiscal"><Input value={fiscalDepartment} onChange={(event) => setFiscalDepartment(event.target.value)} /></Field></div></div>}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <WizardHeading icon={BellRing} eyebrow="Todo listo" title="Elige cómo quieres estar informado" description="Las alertas operativas son útiles, pero tú decides cuándo y por qué canal recibirlas." />
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 p-4"><span className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><MessageCircle className="h-5 w-5" /></span><span><span className="block text-sm font-semibold text-foreground">WhatsApp operativo</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Inicio y final de carga, movimientos de billetera y alertas de cobro. No incluye promociones.</span></span></span><Checkbox checked={whatsAppEnabled} onCheckedChange={(checked) => setWhatsAppEnabled(checked === true)} /></label>
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><BellRing className="h-5 w-5" /></span><span><span className="block text-sm font-semibold text-foreground">Notificaciones push</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Alertas inmediatas de carga, saldo y disponibilidad. Puedes cambiarlas desde Notificaciones.</span></span></div>{pushEnabled ? <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-500"><Check className="h-4 w-4" /> Activas</span> : <Button type="button" variant="outline" size="sm" disabled={!pushSupported || activatingPush} onClick={enablePush}>{activatingPush ? "Activando…" : pushSupported ? "Activar" : "No disponible"}</Button>}</div>{permissionStatus === "denied" && <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">El permiso fue bloqueado en el dispositivo. Puedes habilitarlo desde los ajustes del sistema o del navegador.</p>}</div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4"><Checkbox checked={acceptTerms} onCheckedChange={(checked) => setAcceptTerms(checked === true)} /><span className="text-xs leading-5 text-muted-foreground">He leído y acepto los <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary underline">Términos y condiciones</a> y la <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary underline">Política de tratamiento de datos</a> de Green House Project SAS.</span></label>
        <div className="flex items-start gap-3 px-1"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">Puedes editar tus datos, administrar notificaciones y revocar preferencias desde <strong className="font-medium text-foreground">Mi perfil</strong>. No usamos tus datos para promociones sin tu elección.</p></div>
      </div>
    );
  };

  const canGoBack = currentStep > 1;
  const primaryLabel = currentStep === 1 ? "Configurar mi cuenta" : currentStep === 5 ? "Finalizar activación" : "Continuar";
  const vehicleMissingData = currentStep === 3 && (!brand || !model);
  const profileMissingData = currentStep === 2 && (!firstName.trim() || !lastName.trim() || !phone.trim() || !emailConfirmed);

  return (
    <div className="fixed inset-0 z-[100] flex min-h-dvh items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <motion.section initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 28 }} className="relative flex max-h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-border/80 bg-background shadow-2xl sm:max-h-[90dvh] sm:rounded-[2rem]">
        <div className="relative shrink-0 overflow-hidden border-b border-border/60 bg-muted/20 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-7 sm:pt-6"><div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-primary/15 blur-3xl" /><div className="relative flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Zap className="h-4 w-4" /></span> EVGreen</div><button type="button" onClick={skip} disabled={isSaving} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Saltar por ahora</button></div><div className="relative mt-5 flex items-center justify-between gap-1">{steps.map((step, index) => { const Icon = step.icon; const done = currentStep > step.id; const active = currentStep === step.id; return <div key={step.id} className="flex min-w-0 flex-1 items-center"><div className="flex min-w-0 flex-col items-center gap-1.5"><span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors ${done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}>{done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><span className={`hidden text-[10px] font-medium sm:block ${active ? "text-primary" : "text-muted-foreground"}`}>{step.label}</span></div>{index < steps.length - 1 && <span className={`mx-1 mt-[-16px] h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />}</div>; })}</div></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7 sm:py-8">{stepContent()}</div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-7"><Button type="button" variant="ghost" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={!canGoBack || isSaving} className="min-w-24">{canGoBack && <ChevronLeft className="mr-1 h-4 w-4" />} {canGoBack ? "Anterior" : ""}</Button><div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:block">Paso {currentStep} de 5</span>{currentStep === 3 && <Button type="button" variant="ghost" onClick={skipVehicle} disabled={isSaving}>Ahora no</Button>}<Button type="button" onClick={next} disabled={isSaving || profileMissingData || vehicleMissingData} className="min-w-36">{isSaving ? "Guardando…" : primaryLabel}{currentStep < 5 && !isSaving && <ChevronRight className="ml-1 h-4 w-4" />}{currentStep === 5 && !isSaving && <CircleCheckBig className="ml-1 h-4 w-4" />}</Button></div></div>
      </motion.section>
    </div>
  );
}

function WizardHeading({ icon: Icon, eyebrow, title, description }: { icon: typeof UserRound; eyebrow: string; title: string; description: string }) {
  return <div className="space-y-2"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"><Icon className="h-4 w-4" /> {eyebrow}</div><h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1><p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p></div>;
}

function Field({ label, children, optional = false }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return <label className="block space-y-2"><span className="flex items-center gap-1 text-sm font-medium text-foreground">{label}{optional && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>}</span>{children}</label>;
}

export function UserOnboardingGate() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.userOnboarding.getStatus.useQuery(undefined, { staleTime: 30_000 });
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed || !data?.shouldShow) return null;

  return <UserOnboardingWizard initialStep={data.currentStep} profile={data.profile} onEnd={() => { setDismissed(true); utils.userOnboarding.getStatus.invalidate(); }} />;
}
