/**
 * Vista Pública de Cotización - Accesible sin login por token único
 * Diseño ejecutivo profesional para impresionar al cliente
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, Clock, Shield, Zap, Wrench, Brain, Phone, Mail, Globe } from "lucide-react";
import { useState } from "react";

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function QuotePublic() {
  const [, params] = useRoute("/cotizacion/:token");
  const token = params?.token || "";
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, error } = trpc.quotes.getPublic.useQuery(
    { token },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Cargando cotización...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Cotización no encontrada</h1>
          <p className="text-gray-400">El enlace puede haber expirado o ser inválido.</p>
        </div>
      </div>
    );
  }

  const { quote, items, settings } = data;
  const isExpired = quote.expiresAt && new Date(quote.expiresAt) < new Date();

  let benefits: string[] = [];
  try {
    benefits = settings?.benefitsDescription ? JSON.parse(settings.benefitsDescription) : [];
  } catch { benefits = []; }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 text-white">
      {/* Header / Portada */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-transparent" />
        <div className="max-w-4xl mx-auto px-6 py-12 relative">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">EVGreen</h2>
                <p className="text-xs text-emerald-300">Estaciones de Carga Inteligentes</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Cotización</p>
              <p className="text-lg font-bold font-mono">{quote.quoteNumber}</p>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Propuesta Comercial
            </h1>
            <p className="text-emerald-300 text-lg">Estación de Carga para Vehículos Eléctricos</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Preparada para</p>
              <p className="font-semibold">{quote.clientName}</p>
            </div>
            {quote.clientCompany && (
              <div>
                <p className="text-gray-400">Empresa</p>
                <p className="font-semibold">{quote.clientCompany}</p>
              </div>
            )}
            <div>
              <p className="text-gray-400">Fecha</p>
              <p className="font-semibold">{formatDate(quote.createdAt)}</p>
            </div>
            <div>
              <p className="text-gray-400">Válida hasta</p>
              <p className={`font-semibold ${isExpired ? "text-red-400" : "text-emerald-300"}`}>
                {formatDate(quote.expiresAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Mensaje introductorio */}
        {settings?.headerMessage && (
          <div className="text-gray-300 text-lg leading-relaxed border-l-4 border-emerald-500 pl-4">
            {settings.headerMessage}
          </div>
        )}

        {/* Productos Cotizados */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6 text-emerald-400" />
            Equipos Cotizados
          </h2>
          <div className="space-y-4">
            {items.map((item: any, idx: number) => (
              <div key={idx} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{item.productName}</h3>
                    <div className="flex gap-4 mt-1 text-sm text-gray-400">
                      <span>{item.productPowerKw} kW</span>
                      <span>{item.productChargeType}</span>
                      <span>Conector {item.productConnector}</span>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      {item.includesTransformer && <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">Incluye transformador</span>}
                      <span className="bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded">Hasta {item.cableMetersIncluded}m de cableado</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Cantidad: {item.quantity}</p>
                    <p className="text-xl font-bold text-emerald-400">{formatCOP(item.lineTotal)}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-500">c/u {formatCOP(item.unitPrice)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-6 bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 border border-emerald-500/30 rounded-xl p-6">
            {(quote.discount ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Subtotal</span>
                <span>{formatCOP(quote.subtotal)}</span>
              </div>
            )}
            {(quote.discount ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-emerald-300 mb-2">
                <span>Descuento</span>
                <span>-{formatCOP(quote.discount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xl font-semibold">Total Inversión</span>
              <span className="text-3xl font-bold text-emerald-400">{formatCOP(quote.total)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">* Precios incluyen IVA. Instalación llave en mano.</p>
          </div>
        </section>

        {/* Qué incluye */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ¿Qué incluye el precio?
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              "Cargador(es) de última generación",
              "Transformador eléctrico (cuando aplique)",
              "Hasta 10 metros de cableado y tubería",
              "Instalación llave en mano completa",
              "Configuración y puesta en marcha",
              "Garantía de 2 años en equipos",
              "Registro ante UPME y CárgaME",
              "Capacitación de uso",
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Modelo de Negocio EVGreen */}
        {benefits.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-400" />
              Modelo de Operación EVGreen
            </h2>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold">
                      {settings?.ownerSharePercent || 70}%
                    </div>
                    <span className="font-semibold">Para usted (dueño)</span>
                  </div>
                  <p className="text-sm text-gray-400">Del margen neto de cada sesión de carga</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold">
                      {settings?.evgreenFeePercent || 30}%
                    </div>
                    <span className="font-semibold">EVGreen (operación)</span>
                  </div>
                  <p className="text-sm text-gray-400">Operación, soporte y tecnología</p>
                </div>
              </div>

              <h4 className="font-semibold text-emerald-300 mb-3 text-sm uppercase tracking-wide">
                ¿Qué cubre el fee de EVGreen?
              </h4>
              <div className="grid md:grid-cols-2 gap-2">
                {benefits.map((benefit: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <Zap className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Exclusiones */}
        {settings?.exclusions && (
          <section>
            <h2 className="text-lg font-bold mb-3 text-amber-400 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Importante - No incluye
            </h2>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <p className="text-sm text-gray-300 leading-relaxed">{settings.exclusions}</p>
            </div>
          </section>
        )}

        {/* Términos y Condiciones */}
        {settings?.termsAndConditions && (
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-gray-400" />
              Términos y Condiciones
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-sm text-gray-400 leading-relaxed">{settings.termsAndConditions}</p>
            </div>
          </section>
        )}

        {/* Notas del asesor */}
        {quote.clientNotes && (
          <section className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="font-semibold mb-2">Nota del asesor</h3>
            <p className="text-sm text-gray-300">{quote.clientNotes}</p>
          </section>
        )}

        {/* Footer / Contacto */}
        <section className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold">{settings?.companyName || "EVGreen"}</p>
                <p className="text-xs text-gray-400">NIT: {settings?.companyNit}</p>
              </div>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              {settings?.companyPhone && (
                <a href={`tel:${settings.companyPhone}`} className="flex items-center gap-1 hover:text-emerald-400 transition-colors">
                  <Phone className="h-3.5 w-3.5" /> {settings.companyPhone}
                </a>
              )}
              {settings?.companyEmail && (
                <a href={`mailto:${settings.companyEmail}`} className="flex items-center gap-1 hover:text-emerald-400 transition-colors">
                  <Mail className="h-3.5 w-3.5" /> {settings.companyEmail}
                </a>
              )}
              {settings?.companyWebsite && (
                <a href={`https://${settings.companyWebsite}`} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-emerald-400 transition-colors">
                  <Globe className="h-3.5 w-3.5" /> {settings.companyWebsite}
                </a>
              )}
            </div>
          </div>
          {quote.advisorName && (
            <p className="text-center text-xs text-gray-500 mt-6">
              Cotización preparada por: {quote.advisorName}
            </p>
          )}
        </section>

        {/* Vigencia Warning */}
        {isExpired && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-red-400 font-semibold">Esta cotización ha vencido</p>
            <p className="text-sm text-gray-400 mt-1">Contacte a su asesor para obtener una cotización actualizada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
