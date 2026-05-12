/**
 * Admin - Configuración de Cotizaciones
 * Permite configurar parámetros generales, textos, modelo de negocio
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Settings2, Building2, FileText } from "lucide-react";

export default function QuotesSettings() {
  const { data: settings, refetch } = trpc.quotes.settings.get.useQuery();
  const updateMutation = trpc.quotes.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada exitosamente");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    validityDays: 30,
    evgreenFeePercent: 30,
    ownerSharePercent: 70,
    companyName: "",
    companyNit: "",
    companyPhone: "",
    companyEmail: "",
    companyWebsite: "",
    headerMessage: "",
    footerMessage: "",
    termsAndConditions: "",
    exclusions: "",
    benefitsDescription: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        validityDays: settings.validityDays,
        evgreenFeePercent: settings.evgreenFeePercent,
        ownerSharePercent: settings.ownerSharePercent,
        companyName: settings.companyName || "",
        companyNit: settings.companyNit || "",
        companyPhone: settings.companyPhone || "",
        companyEmail: settings.companyEmail || "",
        companyWebsite: settings.companyWebsite || "",
        headerMessage: settings.headerMessage || "",
        footerMessage: settings.footerMessage || "",
        termsAndConditions: settings.termsAndConditions || "",
        exclusions: settings.exclusions || "",
        benefitsDescription: settings.benefitsDescription || "",
      });
    }
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración de Cotizaciones</h1>
          <p className="text-muted-foreground">
            Parámetros generales, modelo de negocio y textos de las cotizaciones
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          Guardar Cambios
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Modelo de Negocio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Modelo de Negocio
            </CardTitle>
            <CardDescription>Distribución de ingresos y vigencia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Vigencia (días)</Label>
                <Input
                  type="number"
                  value={form.validityDays}
                  onChange={(e) => setForm({ ...form, validityDays: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fee EVGreen (%)</Label>
                <Input
                  type="number"
                  value={form.evgreenFeePercent}
                  onChange={(e) => {
                    const fee = parseInt(e.target.value) || 30;
                    setForm({ ...form, evgreenFeePercent: fee, ownerSharePercent: 100 - fee });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Dueño (%)</Label>
                <Input
                  type="number"
                  value={form.ownerSharePercent}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-400">
                <strong>Modelo:</strong> El dueño recibe el {form.ownerSharePercent}% del margen neto.
                EVGreen retiene el {form.evgreenFeePercent}% por operación, mantenimiento, soporte 24/7 y tecnología IA.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Datos de la Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Datos de la Empresa
            </CardTitle>
            <CardDescription>Información que aparece en las cotizaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razón Social</Label>
                <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>NIT</Label>
                <Input value={form.companyNit} onChange={(e) => setForm({ ...form, companyNit: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sitio Web</Label>
              <Input value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* Beneficios del Modelo (Justificación del 30%) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Beneficios del Modelo EVGreen
            </CardTitle>
            <CardDescription>
              Justificación del fee del {form.evgreenFeePercent}% que se muestra en la cotización (formato JSON array de strings)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.benefitsDescription}
              onChange={(e) => setForm({ ...form, benefitsDescription: e.target.value })}
              rows={6}
              placeholder='["Operación y monitoreo 24/7", "Mantenimiento preventivo y correctivo", ...]'
            />
          </CardContent>
        </Card>

        {/* Términos y Condiciones */}
        <Card>
          <CardHeader>
            <CardTitle>Términos y Condiciones</CardTitle>
            <CardDescription>Texto que aparece al final de la cotización</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.termsAndConditions}
              onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
              rows={6}
              placeholder="Precios válidos por 30 días calendario..."
            />
          </CardContent>
        </Card>

        {/* Exclusiones */}
        <Card>
          <CardHeader>
            <CardTitle>Exclusiones (Qué NO incluye)</CardTitle>
            <CardDescription>Texto que aclara lo que no está incluido en el precio</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.exclusions}
              onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
              rows={6}
              placeholder="No incluye obras civiles adicionales..."
            />
          </CardContent>
        </Card>

        {/* Mensajes personalizables */}
        <Card>
          <CardHeader>
            <CardTitle>Mensaje de Cabecera</CardTitle>
            <CardDescription>Texto introductorio en la cotización</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.headerMessage}
              onChange={(e) => setForm({ ...form, headerMessage: e.target.value })}
              rows={3}
              placeholder="Es un placer presentarle nuestra propuesta comercial..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensaje de Pie</CardTitle>
            <CardDescription>Nota final de la cotización</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.footerMessage}
              onChange={(e) => setForm({ ...form, footerMessage: e.target.value })}
              rows={3}
              placeholder="Quedamos atentos a cualquier consulta..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
