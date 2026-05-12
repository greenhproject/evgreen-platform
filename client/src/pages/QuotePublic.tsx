/**
 * Vista Pública de Cotización - Accesible sin login por token único
 * Diseño premium futurista con estética EVGreen
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, Clock, Shield, Zap, Phone, Mail, Globe, AlertTriangle, FileText } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/30 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm">Cargando cotización...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Cotización no encontrada</h1>
          <p className="text-gray-400">El enlace puede haber expirado o ser inválido. Contacte a su asesor para obtener un nuevo enlace.</p>
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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Disparar impresión del navegador (Guardar como PDF)
      window.print();
    } catch (e) {
      console.error('Error al imprimir:', e);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* === HERO HEADER === */}
        <div className="relative overflow-hidden border-b border-white/5">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1a] via-[#0d1b2a] to-[#0a2e1a]" />
          {/* Glow orb */}
          <div className="absolute top-[-200px] right-[-100px] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[80px]" />
          {/* Green line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

          <div className="relative max-w-4xl mx-auto px-6 py-12 md:py-16">
            {/* Top bar: Brand + Quote number */}
            <div className="flex items-start justify-between mb-10">
              <div className="flex items-center gap-3">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/zbDIWjuOCDapFXwo.webp" alt="EVGreen" className="h-14 w-auto object-contain" />
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cotización</p>
                <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{quote.quoteNumber}</p>
              </div>
            </div>

            {/* Title */}
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
                Propuesta Comercial
              </h1>
              <p className="text-lg text-emerald-400 font-medium">Estación de Carga para Vehículos Eléctricos</p>
            </div>

            {/* Client info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Preparada para</p>
                <p className="font-semibold text-white">{quote.clientName}</p>
              </div>
              {quote.clientCompany && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Empresa</p>
                  <p className="font-semibold text-white">{quote.clientCompany}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fecha</p>
                <p className="font-semibold text-white">{formatDate(quote.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Válida hasta</p>
                <p className={`font-semibold ${isExpired ? "text-red-400" : "text-emerald-400"}`}>
                  {formatDate(quote.expiresAt)}
                </p>
              </div>
            </div>

            {/* Validity badge */}
            {!isExpired && (
              <div className="mt-6 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Oferta vigente por 30 días</span>
              </div>
            )}
          </div>
        </div>

        {/* === CONTENT === */}
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          {/* Intro message */}
          {settings?.headerMessage && (
            <div className="text-gray-300 text-base leading-relaxed pl-5 border-l-[3px] border-emerald-500 bg-emerald-500/5 py-4 pr-5 rounded-r-lg">
              {settings.headerMessage}
            </div>
          )}

          {/* === PRODUCTS === */}
          <section>
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
              Equipos Cotizados
            </h2>
            <div className="space-y-3">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Product Image or Icon */}
                    {item.productImageUrl ? (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#1f2937] flex-shrink-0">
                        <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-11 h-11 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Zap className="h-6 w-6 text-emerald-400" />
                      </div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white">{item.productName}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{item.productPowerKw} kW</span>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{item.productChargeType}</span>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{item.productConnector}</span>
                      </div>
                    </div>
                    {/* Price */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500">×{item.quantity}</p>
                      <p className="text-xl font-extrabold text-emerald-400 font-mono">{formatCOP(item.lineTotal)}</p>
                    </div>
                  </div>
                  {/* Features */}
                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#1f2937]">
                    {item.includesTransformer && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Incluye transformador
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Hasta {item.cableMetersIncluded}m de cableado
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* === TOTALS === */}
            <div className="mt-6 relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/25 rounded-2xl p-7">
              {/* Top gradient line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />
              
              {(quote.discount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Subtotal</span>
                    <span>{formatCOP(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-300 mb-3">
                    <span>Descuento aplicado</span>
                    <span>-{formatCOP(quote.discount ?? 0)}</span>
                  </div>
                </>
              )}
              <div className={`flex justify-between items-center ${(quote.discount ?? 0) > 0 ? "pt-4 border-t border-emerald-500/20" : ""}`}>
                <span className="text-lg font-bold text-white">Total Inversión</span>
                <span className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  {formatCOP(quote.total)}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-3 text-right">* Precios incluyen IVA. Instalación llave en mano.</p>
            </div>
          </section>

          {/* === INCLUDES === */}
          <section>
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              ¿Qué incluye el precio?
            </h2>
            <div className="grid md:grid-cols-2 gap-2.5">
              {[
                "Cargador(es) de última generación",
                "Transformador eléctrico (cuando aplique)",
                "Hasta 10 metros de cableado y tubería",
                "Instalación llave en mano completa",
                "Configuración y puesta en marcha",
                "Garantía de 2 años en equipos",
                "Registro ante UPME y CárgaME",
                "Capacitación de uso y operación",
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3.5 bg-[#111827] border border-[#1f2937] rounded-lg">
                  <div className="w-5 h-5 bg-emerald-500/15 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-gray-200">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* === BUSINESS MODEL === */}
          {benefits.length > 0 && (
            <section>
              <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                Modelo de Operación EVGreen
              </h2>
              <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-7">
                {/* Shares */}
                <div className="grid grid-cols-2 gap-4 mb-7">
                  <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center">
                    <div className="text-4xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-1">
                      {settings?.ownerSharePercent || 70}%
                    </div>
                    <div className="text-sm font-semibold text-white">Para usted (dueño)</div>
                    <div className="text-[11px] text-gray-500 mt-1">Del margen neto de operación</div>
                  </div>
                  <div className="bg-[#1a2332] border border-[#1f2937] rounded-xl p-6 text-center">
                    <div className="text-4xl font-black text-gray-400 mb-1">
                      {settings?.evgreenFeePercent || 30}%
                    </div>
                    <div className="text-sm font-semibold text-white">EVGreen (operación)</div>
                    <div className="text-[11px] text-gray-500 mt-1">Soporte, tecnología y mantenimiento</div>
                  </div>
                </div>

                {/* Benefits */}
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4">
                  ¿Qué cubre el fee de EVGreen?
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {benefits.map((benefit: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-300">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* === EXCLUSIONS === */}
          {settings?.exclusions && (
            <section>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Importante — No incluye
                </h3>
                <p className="text-sm text-amber-200/80 leading-relaxed">{settings.exclusions}</p>
              </div>
            </section>
          )}

          {/* === TERMS === */}
          {settings?.termsAndConditions && (
            <section>
              <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-400 mb-3">Términos y Condiciones</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{settings.termsAndConditions}</p>
              </div>
            </section>
          )}

          {/* === NOTES === */}
          {quote.clientNotes && (
            <section>
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5">
                <h3 className="text-sm font-bold text-cyan-400 mb-2">Nota del asesor</h3>
                <p className="text-sm text-gray-300">{quote.clientNotes}</p>
              </div>
            </section>
          )}

          {/* === DOWNLOAD CTA === */}
          <section className="text-center py-6">
            <div className="bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-[#1f2937] rounded-2xl p-8">
              <p className="text-gray-400 text-sm mb-4">¿Desea guardar esta propuesta?</p>
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold px-8 py-3 rounded-lg shadow-lg shadow-emerald-500/20 text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                {downloading ? "Preparando..." : "Descargar / Imprimir Cotización"}
              </Button>
            </div>
          </section>

          {/* === FOOTER === */}
          <section className="border-t border-[#1f2937] pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/zbDIWjuOCDapFXwo.webp" alt="EVGreen" className="h-10 w-auto object-contain" />
                <div>
                  <p className="text-xs text-gray-500">NIT: {settings?.companyNit}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-5 text-sm text-gray-400">
                {settings?.companyPhone && (
                  <a href={`tel:${settings.companyPhone}`} className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                    <Phone className="h-3.5 w-3.5" /> {settings.companyPhone}
                  </a>
                )}
                {settings?.companyEmail && (
                  <a href={`mailto:${settings.companyEmail}`} className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                    <Mail className="h-3.5 w-3.5" /> {settings.companyEmail}
                  </a>
                )}
                {settings?.companyWebsite && (
                  <a href={`https://${settings.companyWebsite}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                    <Globe className="h-3.5 w-3.5" /> {settings.companyWebsite}
                  </a>
                )}
              </div>
            </div>
            {quote.advisorName && (
              <p className="text-center text-xs text-gray-600 mt-6">
                Cotización preparada por: <span className="text-gray-400 font-medium">{quote.advisorName}</span>
              </p>
            )}
          </section>

          {/* Expired Warning */}
          {isExpired && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 text-center">
              <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <p className="text-red-400 font-bold">Esta cotización ha vencido</p>
              <p className="text-sm text-gray-400 mt-1">Contacte a su asesor para obtener una cotización actualizada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
