/**
 * Configuración - Aliado Comercial
 */
import { Settings } from "lucide-react";

export default function HostSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ajustes de tu cuenta de Aliado Comercial
        </p>
      </div>
      <div className="text-center py-16 text-muted-foreground">
        <Settings className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Próximamente</p>
        <p className="text-sm mt-1">Las opciones de configuración estarán disponibles en una próxima actualización</p>
      </div>
    </div>
  );
}
