/**
 * Reportes - Aliado Comercial
 */
import { BarChart3 } from "lucide-react";

export default function HostReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reportes financieros y operativos de tus estaciones
        </p>
      </div>
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Próximamente</p>
        <p className="text-sm mt-1">Los reportes detallados estarán disponibles en una próxima actualización</p>
      </div>
    </div>
  );
}
