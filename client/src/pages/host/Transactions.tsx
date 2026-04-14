/**
 * Transacciones - Aliado Comercial
 * Muestra las transacciones de carga de las estaciones del aliado
 */
import { toast } from "sonner";
import { Building2, Receipt } from "lucide-react";

export default function HostTransactions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
          Transacciones
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial de transacciones de carga en tus estaciones
        </p>
      </div>
      <div className="text-center py-16 text-muted-foreground">
        <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Próximamente</p>
        <p className="text-sm mt-1">El detalle de transacciones estará disponible en una próxima actualización</p>
      </div>
    </div>
  );
}
