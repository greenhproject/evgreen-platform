/**
 * Panel de Administración - Dashboard de Onboarding de Inversionistas
 * Muestra estadísticas y estado del onboarding de cada inversionista
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, CheckCircle2, Clock, AlertCircle, Search, Send, RotateCcw,
  TrendingUp, Mail, UserCheck, Crown, Building2, CreditCard, Eye,
  ChevronRight, Loader2
} from "lucide-react";
import { toast } from "sonner";

const ONBOARDING_STEPS = [
  { step: 0, label: "Sin iniciar", icon: AlertCircle, color: "text-gray-400" },
  { step: 1, label: "Bienvenida", icon: Users, color: "text-blue-500" },
  { step: 2, label: "Perfil Personal", icon: UserCheck, color: "text-indigo-500" },
  { step: 3, label: "Empresa", icon: Building2, color: "text-purple-500" },
  { step: 4, label: "Datos Bancarios", icon: CreditCard, color: "text-amber-500" },
  { step: 5, label: "Fundador", icon: Crown, color: "text-yellow-500" },
  { step: 6, label: "Tour Dashboard", icon: Eye, color: "text-teal-500" },
  { step: 7, label: "Completado", icon: CheckCircle2, color: "text-green-500" },
];

function getStepInfo(step: number, isFounder: boolean) {
  // Para no-fundadores, paso 5 es Tour Dashboard y paso 6 es Completado
  if (!isFounder && step >= 5) {
    if (step === 5) return ONBOARDING_STEPS[6]; // Tour Dashboard
    if (step >= 6) return ONBOARDING_STEPS[7]; // Completado
  }
  return ONBOARDING_STEPS[step] || ONBOARDING_STEPS[0];
}

export default function OnboardingDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: stats, isLoading: statsLoading } = trpc.onboarding.getOnboardingStats.useQuery();
  const { data: investors, isLoading: investorsLoading, refetch } = trpc.onboarding.getInvestorsOnboardingList.useQuery();
  
  const resendEmailMutation = trpc.onboarding.resendWelcomeEmail.useMutation({
    onSuccess: () => {
      toast.success("Email de bienvenida reenviado exitosamente");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al reenviar el email");
    },
  });

  const resetOnboardingMutation = trpc.onboarding.reset.useMutation({
    onSuccess: () => {
      toast.success("Onboarding reseteado exitosamente");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al resetear el onboarding");
    },
  });

  const handleResendEmail = (userId: number) => {
    if (confirm("¿Reenviar el email de bienvenida a este inversionista?")) {
      resendEmailMutation.mutate({ userId });
    }
  };

  const handleResetOnboarding = (userId: number) => {
    if (confirm("¿Resetear el onboarding de este inversionista? Deberá completarlo de nuevo.")) {
      resetOnboardingMutation.mutate({ userId });
    }
  };

  const filteredInvestors = investors?.filter((inv: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.name.toLowerCase().includes(q) ||
      inv.email.toLowerCase().includes(q) ||
      inv.companyName.toLowerCase().includes(q)
    );
  }) || [];

  const isLoading = statsLoading || investorsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estado de Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitorea el progreso del onboarding de cada inversionista
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalInvestors ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.completedOnboarding ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pendingOnboarding ?? '-'}</p>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.noEmailSent ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Sin Email</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.completionRate ?? 0}%</p>
                <p className="text-xs text-muted-foreground">Tasa</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {stats && stats.totalInvestors > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Progreso General de Onboarding</p>
            <p className="text-sm text-muted-foreground">
              {stats.completedOnboarding} de {stats.totalInvestors} inversionistas
            </p>
          </div>
          <Progress value={stats.completionRate} className="h-3" />
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Investors Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredInvestors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? "No se encontraron inversionistas con ese criterio" : "No hay inversionistas registrados"}
        </div>
      ) : (
        <>
          {/* Vista móvil - tarjetas */}
          <div className="sm:hidden space-y-3">
            {filteredInvestors.map((inv: any) => {
              const stepInfo = getStepInfo(inv.onboardingStep, inv.isFounder);
              const maxSteps = inv.isFounder ? 7 : 6;
              const progressPercent = inv.onboardingCompleted ? 100 : Math.round((inv.onboardingStep / maxSteps) * 100);
              
              return (
                <Card key={inv.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{inv.name}</p>
                        {inv.isFounder && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                    </div>
                    {inv.onboardingCompleted ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                        Completado
                      </Badge>
                    ) : inv.welcomeEmailSent ? (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                        Paso {inv.onboardingStep}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Sin iniciar</Badge>
                    )}
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`flex items-center gap-1 ${stepInfo.color}`}>
                        <stepInfo.icon className="h-3 w-3" />
                        {stepInfo.label}
                      </span>
                      <span className="text-muted-foreground">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    {inv.welcomeEmailSent && <Mail className="h-3 w-3 text-green-500" />}
                    {inv.hasBankInfo && <CreditCard className="h-3 w-3 text-green-500" />}
                    {inv.hasPhoto && <UserCheck className="h-3 w-3 text-green-500" />}
                  </div>

                  <div className="flex gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResendEmail(inv.id)}
                      disabled={resendEmailMutation.isPending}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      <Send className="h-3 w-3" />
                      Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResetOnboarding(inv.id)}
                      disabled={resetOnboardingMutation.isPending}
                      className="h-7 px-2 text-xs gap-1 text-orange-500 hover:text-orange-600"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Vista desktop - tabla */}
          <div className="hidden sm:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversionista</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Paso Actual</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Datos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestors.map((inv: any) => {
                    const stepInfo = getStepInfo(inv.onboardingStep, inv.isFounder);
                    const maxSteps = inv.isFounder ? 7 : 6;
                    const progressPercent = inv.onboardingCompleted ? 100 : Math.round((inv.onboardingStep / maxSteps) * 100);
                    
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm">{inv.name}</p>
                                {inv.isFounder && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                              </div>
                              <p className="text-xs text-muted-foreground">{inv.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{inv.companyName || '-'}</p>
                            <p className="text-xs text-muted-foreground">{inv.taxId || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {inv.onboardingCompleted ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completado
                            </Badge>
                          ) : inv.welcomeEmailSent ? (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <Clock className="h-3 w-3 mr-1" />
                              En Progreso
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Sin Iniciar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1.5 text-sm ${stepInfo.color}`}>
                            <stepInfo.icon className="h-4 w-4" />
                            <span>{stepInfo.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-24">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>{progressPercent}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1" title={inv.welcomeEmailSent ? "Email enviado" : "Email no enviado"}>
                              <Mail className={`h-3.5 w-3.5 ${inv.welcomeEmailSent ? 'text-green-500' : 'text-gray-300'}`} />
                            </div>
                            <div className="flex items-center gap-1" title={inv.hasBankInfo ? "Datos bancarios completos" : "Sin datos bancarios"}>
                              <CreditCard className={`h-3.5 w-3.5 ${inv.hasBankInfo ? 'text-green-500' : 'text-gray-300'}`} />
                            </div>
                            <div className="flex items-center gap-1" title={inv.hasPhoto ? "Foto subida" : "Sin foto"}>
                              <UserCheck className={`h-3.5 w-3.5 ${inv.hasPhoto ? 'text-green-500' : 'text-gray-300'}`} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendEmail(inv.id)}
                              disabled={resendEmailMutation.isPending}
                              className="gap-1 text-blue-500 hover:text-blue-600 hover:border-blue-300"
                              title="Reenviar email de bienvenida"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Email
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetOnboarding(inv.id)}
                              disabled={resetOnboardingMutation.isPending}
                              className="gap-1 text-orange-500 hover:text-orange-600 hover:border-orange-300"
                              title="Resetear onboarding"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reset
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
