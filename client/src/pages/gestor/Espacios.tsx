/**
 * Portal del Gestor Comercial — Mis Espacios + Postulación
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, MapPin, RefreshCw } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendiente",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  reviewing:  { label: "En revisión", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  approved:   { label: "Aprobado",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected:   { label: "Rechazado",   color: "bg-red-500/20 text-red-400 border-red-500/30" },
  active:     { label: "Activo",      color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  contracted: { label: "Contratado",  color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

const SPACE_TYPES = [
  { value: "gas_station", label: "Estación de Servicio (EDS)" },
  { value: "parking", label: "Parqueadero" },
  { value: "mall", label: "Centro Comercial" },
  { value: "hotel", label: "Hotel" },
  { value: "office_building", label: "Edificio de Oficinas" },
  { value: "restaurant", label: "Restaurante" },
  { value: "supermarket", label: "Supermercado" },
  { value: "hospital", label: "Hospital / Clínica" },
  { value: "university", label: "Universidad" },
  { value: "airport", label: "Aeropuerto" },
  { value: "highway_rest", label: "Área de Descanso Vial" },
  { value: "residential", label: "Residencial" },
  { value: "other", label: "Otro" },
];

const INITIAL_FORM = {
  spaceName: "",
  spaceType: "gas_station" as const,
  address: "",
  city: "",
  department: "",
  latitude: "",
  longitude: "",
  submitterName: "",
  submitterEmail: "",
  submitterPhone: "",
  submitterCompany: "",
  estimatedDailyVehicles: "",
  estimatedEvPercent: "",
  transformerCapacityKva: "",
  hasElectricalPanel: false,
  hasInternet: false,
  operatingHoursStart: "06:00",
  operatingHoursEnd: "22:00",
  is24Hours: false,
  additionalNotes: "",
};

export default function GestorEspacios() {
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const { data, isLoading, refetch } = trpc.gestor.getMisEspacios.useQuery({ page, limit: 20 });
  const postularMutation = trpc.gestor.postularEspacio.useMutation({
    onSuccess: (res) => {
      toast.success(`Espacio postulado con código ${res.code}`);
      setShowModal(false);
      setForm(INITIAL_FORM);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    postularMutation.mutate({
      ...form,
      spaceType: form.spaceType as any,
      estimatedDailyVehicles: form.estimatedDailyVehicles ? parseInt(form.estimatedDailyVehicles) : undefined,
      estimatedEvPercent: form.estimatedEvPercent ? parseInt(form.estimatedEvPercent) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Mis Espacios Postulados</h1>
          <p className="text-slate-400 text-sm">Gestiona y postula nuevos espacios para estaciones EVGreen</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" /> Postular Espacio
        </Button>
      </div>

      {/* Lista */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !data?.spaces.length ? (
            <div className="text-center py-12">
              <MapPin className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No has postulado espacios aún</p>
              <Button onClick={() => setShowModal(true)} variant="outline" className="mt-4 border-green-600 text-green-400">
                <Plus className="h-4 w-4 mr-2" /> Postular primer espacio
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.spaces.map((s) => {
                const st = STATUS_LABELS[s.spaceStatus ?? "pending"] ?? STATUS_LABELS.pending;
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/40 border border-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-600/50 mt-0.5">
                        <MapPin className="h-4 w-4 text-slate-300" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{s.spaceName}</p>
                        <p className="text-xs text-slate-400">{s.address} · {s.city}{s.department ? `, ${s.department}` : ""}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Código: {s.code}</p>
                        {s.aiScore && (
                          <p className="text-xs text-blue-400 mt-0.5">Score IA: {s.aiScore}/100</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${st.color}`}>
                        {st.label}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Comisión: {parseFloat(s.gestorCommissionPercent as string).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginación */}
          {(data?.total ?? 0) > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Anterior
              </Button>
              <span className="text-slate-400 text-sm self-center">
                Página {page} de {Math.ceil((data?.total ?? 0) / 20)}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (data?.total ?? 0)}>
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de postulación */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Postular Nuevo Espacio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Datos del espacio */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-1">Datos del Espacio</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-slate-300">Nombre del espacio *</Label>
                  <Input value={form.spaceName} onChange={e => setForm(f => ({ ...f, spaceName: e.target.value }))}
                    placeholder="Ej: EDS El Progreso" className="bg-slate-800 border-slate-600 text-white" required />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Tipo de espacio *</Label>
                  <Select value={form.spaceType} onValueChange={v => setForm(f => ({ ...f, spaceType: v as any }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {SPACE_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Dirección *</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Calle / Carrera / Km" className="bg-slate-800 border-slate-600 text-white" required />
                </div>
                <div>
                  <Label className="text-slate-300">Ciudad *</Label>
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Bogotá" className="bg-slate-800 border-slate-600 text-white" required />
                </div>
                <div>
                  <Label className="text-slate-300">Departamento</Label>
                  <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="Cundinamarca" className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300">Latitud (GPS)</Label>
                  <Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                    placeholder="4.7110" className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300">Longitud (GPS)</Label>
                  <Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                    placeholder="-74.0721" className="bg-slate-800 border-slate-600 text-white" />
                </div>
              </div>
            </div>

            {/* Datos del contacto */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-1">Datos del Propietario / Contacto</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">Nombre *</Label>
                  <Input value={form.submitterName} onChange={e => setForm(f => ({ ...f, submitterName: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white" required />
                </div>
                <div>
                  <Label className="text-slate-300">Empresa</Label>
                  <Input value={form.submitterCompany} onChange={e => setForm(f => ({ ...f, submitterCompany: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300">Email *</Label>
                  <Input type="email" value={form.submitterEmail} onChange={e => setForm(f => ({ ...f, submitterEmail: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white" required />
                </div>
                <div>
                  <Label className="text-slate-300">Teléfono *</Label>
                  <Input value={form.submitterPhone} onChange={e => setForm(f => ({ ...f, submitterPhone: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white" required />
                </div>
              </div>
            </div>

            {/* Datos técnicos */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-1">Datos Técnicos (opcional)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">Vehículos/día estimados</Label>
                  <Input type="number" value={form.estimatedDailyVehicles} onChange={e => setForm(f => ({ ...f, estimatedDailyVehicles: e.target.value }))}
                    placeholder="200" className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300">% Vehículos EV estimado</Label>
                  <Input type="number" value={form.estimatedEvPercent} onChange={e => setForm(f => ({ ...f, estimatedEvPercent: e.target.value }))}
                    placeholder="5" min="0" max="100" className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300">Capacidad transformador (kVA)</Label>
                  <Input value={form.transformerCapacityKva} onChange={e => setForm(f => ({ ...f, transformerCapacityKva: e.target.value }))}
                    placeholder="112.5" className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300">Horario de operación</Label>
                  <div className="flex gap-2">
                    <Input type="time" value={form.operatingHoursStart} onChange={e => setForm(f => ({ ...f, operatingHoursStart: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white" />
                    <Input type="time" value={form.operatingHoursEnd} onChange={e => setForm(f => ({ ...f, operatingHoursEnd: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white" />
                  </div>
                </div>
                <div className="col-span-2 flex gap-4">
                  <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.hasElectricalPanel} onChange={e => setForm(f => ({ ...f, hasElectricalPanel: e.target.checked }))}
                      className="rounded" />
                    Tiene tablero eléctrico
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.hasInternet} onChange={e => setForm(f => ({ ...f, hasInternet: e.target.checked }))}
                      className="rounded" />
                    Tiene internet
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is24Hours} onChange={e => setForm(f => ({ ...f, is24Hours: e.target.checked }))}
                      className="rounded" />
                    Opera 24 horas
                  </label>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Notas adicionales</Label>
              <Textarea value={form.additionalNotes} onChange={e => setForm(f => ({ ...f, additionalNotes: e.target.value }))}
                placeholder="Información relevante sobre el espacio..." className="bg-slate-800 border-slate-600 text-white" rows={3} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 border-slate-600 text-slate-300">
                Cancelar
              </Button>
              <Button type="submit" disabled={postularMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                {postularMutation.isPending ? "Postulando..." : "Postular Espacio"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
