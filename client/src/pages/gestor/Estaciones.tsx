/**
 * Portal del Gestor Comercial — Mis Estaciones
 * Vista de las estaciones operativas vinculadas al gestor.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Zap, RefreshCw, MapPin } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function GestorEstaciones() {
  const { data, isLoading } = trpc.gestor.getMisEstaciones.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mis Estaciones</h1>
        <p className="text-slate-400 text-sm">Estaciones operativas vinculadas a tu gestión comercial</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !data?.stations.length ? (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-8 pb-8 text-center">
            <Zap className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Aún no tienes estaciones activas vinculadas.</p>
            <p className="text-slate-500 text-sm mt-1">El administrador de EVGreen las vinculará cuando estén operativas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.stations.map((s) => {
            const gestorPct = parseFloat(s.gestorCommissionPercent as string);
            const hostPct = parseFloat(s.hostSharePercent as string);
            const investorPct = parseFloat(s.investorSharePercent as string);
            const evgreenPct = parseFloat(s.evgreenSharePercent as string);

            return (
              <Card key={s.id} className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {s.isOnline ? (
                        <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-slate-500 shrink-0" />
                      )}
                      <div>
                        <CardTitle className="text-base text-white">{s.name}</CardTitle>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {s.city}{s.department ? `, ${s.department}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      s.isOnline ? "bg-green-500/20 text-green-400" : "bg-slate-600/40 text-slate-400"
                    }`}>
                      {s.isOnline ? "En línea" : "Fuera de línea"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Distribución de ingresos */}
                  <div className="bg-slate-700/40 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-300 mb-2">Distribución del Margen Neto</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Aliado EDS (del bruto)</span>
                        <span className="text-orange-400 font-medium">{hostPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Inversionistas</span>
                        <span className="text-blue-400 font-medium">{investorPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">EVGreen</span>
                        <span className="text-slate-300 font-medium">{evgreenPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-slate-600 pt-1.5 mt-1">
                        <span className="text-emerald-300 font-semibold">Tu comisión (del margen neto)</span>
                        <span className="text-emerald-400 font-bold">{gestorPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Coordenadas */}
                  {s.latitude && s.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <MapPin className="h-3 w-3" />
                      Ver en Google Maps
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
