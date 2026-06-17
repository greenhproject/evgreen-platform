/**
 * EVGreen - Política de Privacidad y Tratamiento de Datos Personales
 * Cumplimiento: Ley 1581/2012, Decreto 1377/2013, Decreto 1074/2015
 * @author Green House Project
 */
import { ArrowLeft, Shield } from "lucide-react";
import { Link } from "wouter";

const LAST_UPDATED = "17 de junio de 2026";
const COMPANY_NAME = "Green House Project S.A.S.";
const NIT = "901.234.567-8";
const ADDRESS = "Bogotá D.C., Colombia";
const EMAIL = "evgreen@greenhproject.com";
const DPO_EMAIL = "privacidad@greenhproject.com";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/landing">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Volver</span>
            </button>
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Política de Privacidad</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-16">
        <div className="mb-8 p-4 bg-card border border-border rounded-xl">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">Última actualización:</strong> {LAST_UPDATED}</span>
            <span><strong className="text-foreground">Responsable:</strong> {COMPANY_NAME} · NIT {NIT}</span>
            <span><strong className="text-foreground">Marco legal:</strong> Ley 1581/2012 · Decreto 1377/2013</span>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Identificación del Responsable del Tratamiento</h2>
            <div className="p-4 bg-card border border-border rounded-lg space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Razón social:</strong> {COMPANY_NAME}</p>
              <p><strong className="text-foreground">NIT:</strong> {NIT}</p>
              <p><strong className="text-foreground">Domicilio:</strong> {ADDRESS}</p>
              <p><strong className="text-foreground">Correo de privacidad:</strong> <a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">{DPO_EMAIL}</a></p>
            </div>
            <p className="text-muted-foreground mt-3">
              En cumplimiento de la <strong className="text-foreground">Ley Estatutaria 1581 de 2012</strong> de Protección de Datos Personales, el <strong className="text-foreground">Decreto 1377 de 2013</strong> y el <strong className="text-foreground">Decreto Único Reglamentario 1074 de 2015</strong>, {COMPANY_NAME} informa a los titulares de datos personales sobre el tratamiento que se da a su información en la plataforma EVGreen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. Datos Personales Recopilados</h2>
            <div className="space-y-3">
              <div className="p-4 bg-card border border-border rounded-lg">
                <h3 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Datos de Identificación</h3>
                <p className="text-muted-foreground text-xs">Nombre completo, correo electrónico, número de teléfono (opcional), documento de identidad (para facturación electrónica).</p>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <h3 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Datos de Uso del Servicio</h3>
                <p className="text-muted-foreground text-xs">Historial de sesiones de carga (fecha, hora, duración, energía consumida, costo), estaciones utilizadas, vehículos registrados (marca, modelo, tipo de conector), saldo y transacciones de la Billetera Digital, reservas realizadas.</p>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <h3 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Datos de Ubicación</h3>
                <p className="text-muted-foreground text-xs">Ubicación geográfica aproximada para mostrar estaciones cercanas — <strong className="text-foreground">solo cuando el Usuario lo autoriza explícitamente</strong> desde la configuración del dispositivo.</p>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <h3 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">Datos Técnicos</h3>
                <p className="text-muted-foreground text-xs">Dirección IP, tipo de dispositivo y sistema operativo, versión de la aplicación, registros de actividad (logs) para soporte técnico, token de notificaciones push.</p>
              </div>
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <h3 className="font-semibold text-foreground mb-1 text-xs uppercase tracking-wide">Datos Sensibles</h3>
                <p className="text-muted-foreground text-xs">EVGreen <strong className="text-foreground">no recopila datos sensibles</strong> según el artículo 5 de la Ley 1581 de 2012 (datos de salud, orientación sexual, origen racial, convicciones políticas o religiosas, datos biométricos).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. Finalidades del Tratamiento</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-card">
                    <th className="text-left p-3 border border-border text-foreground font-semibold">Finalidad</th>
                    <th className="text-left p-3 border border-border text-foreground font-semibold">Base Legal</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    ["Prestación del servicio de carga de vehículos eléctricos", "Ejecución del contrato (Art. 6 Ley 1581/2012)"],
                    ["Gestión de pagos y facturación electrónica", "Ejecución del contrato y obligación legal"],
                    ["Envío de notificaciones sobre el estado de la carga", "Ejecución del contrato"],
                    ["Soporte técnico y atención al usuario", "Ejecución del contrato"],
                    ["Personalización del asistente de IA y recomendaciones", "Consentimiento del titular"],
                    ["Análisis estadístico y mejora del servicio (datos anonimizados)", "Interés legítimo"],
                    ["Envío de comunicaciones comerciales y promociones", "Consentimiento del titular (opt-in)"],
                    ["Cumplimiento de obligaciones legales y regulatorias", "Obligación legal"],
                    ["Prevención de fraude y seguridad de la plataforma", "Interés legítimo"],
                  ].map(([finalidad, base], i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-card/50" : ""}>
                      <td className="p-3 border border-border">{finalidad}</td>
                      <td className="p-3 border border-border">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Derechos del Titular (Artículo 8, Ley 1581/2012)</h2>
            <p className="text-muted-foreground mb-3">Como titular de datos personales, usted tiene los siguientes derechos, que puede ejercer en cualquier momento de forma gratuita:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: "Acceso", desc: "Conocer qué datos personales suyos están siendo tratados por EVGreen." },
                { title: "Rectificación", desc: "Solicitar la corrección de datos inexactos, incompletos o desactualizados." },
                { title: "Supresión", desc: "Solicitar la eliminación de sus datos cuando no sean necesarios para las finalidades declaradas." },
                { title: "Oposición", desc: "Oponerse al tratamiento de sus datos para finalidades de marketing directo." },
                { title: "Portabilidad", desc: "Recibir sus datos en un formato estructurado y de lectura mecánica." },
                { title: "Revocación del Consentimiento", desc: "Retirar el consentimiento otorgado sin que ello afecte la licitud del tratamiento previo." },
              ].map((right) => (
                <div key={right.title} className="p-3 bg-card border border-border rounded-lg">
                  <h3 className="font-semibold text-foreground text-xs mb-1">{right.title}</h3>
                  <p className="text-muted-foreground text-xs">{right.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-foreground font-medium mb-1">¿Cómo ejercer sus derechos?</p>
              <p className="text-xs text-muted-foreground">
                Envíe su solicitud a <a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">{DPO_EMAIL}</a> indicando su nombre completo, tipo y número de documento, descripción del derecho que desea ejercer y datos de contacto. Responderemos en un plazo máximo de <strong className="text-foreground">15 días hábiles</strong>, conforme al artículo 14 de la Ley 1581 de 2012.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Transferencia y Transmisión de Datos</h2>
            <p className="text-muted-foreground mb-3">EVGreen puede compartir datos personales con los siguientes terceros, únicamente para las finalidades declaradas:</p>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Wompi (Bancolombia):</strong> Procesamiento de pagos. Datos: nombre, correo, información de pago.</li>
              <li><strong className="text-foreground">Resend:</strong> Envío de correos electrónicos transaccionales y notificaciones.</li>
              <li><strong className="text-foreground">Auth0 (Okta):</strong> Gestión de autenticación e identidad digital.</li>
              <li><strong className="text-foreground">Proveedores de infraestructura cloud:</strong> Almacenamiento seguro de datos en servidores en América Latina.</li>
              <li><strong className="text-foreground">Autoridades competentes:</strong> Cuando sea requerido por ley, orden judicial o autoridad regulatoria colombiana.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              <strong className="text-foreground">Transferencias internacionales:</strong> Algunos proveedores pueden procesar datos fuera de Colombia. En estos casos, garantizamos protección adecuada mediante cláusulas contractuales estándar, conforme al artículo 26 de la Ley 1581 de 2012.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. Conservación de los Datos</h2>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Datos de cuenta:</strong> Mientras la cuenta esté activa, más 5 años tras su cancelación (obligaciones tributarias).</li>
              <li><strong className="text-foreground">Historial de transacciones:</strong> 10 años (Código de Comercio colombiano).</li>
              <li><strong className="text-foreground">Datos de sesiones de carga:</strong> 5 años.</li>
              <li><strong className="text-foreground">Logs técnicos:</strong> 12 meses.</li>
              <li><strong className="text-foreground">Datos de marketing:</strong> Hasta que el titular retire el consentimiento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. Seguridad de los Datos</h2>
            <p className="text-muted-foreground mb-3">EVGreen implementa medidas técnicas, administrativas y físicas para proteger los datos personales:</p>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li>Cifrado en tránsito mediante TLS 1.3</li>
              <li>Cifrado en reposo de datos sensibles</li>
              <li>Autenticación multifactor para acceso administrativo</li>
              <li>Auditorías de seguridad periódicas</li>
              <li>Control de acceso basado en roles (RBAC)</li>
              <li>Monitoreo continuo de actividad sospechosa</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              En caso de una violación de seguridad que afecte datos personales, notificaremos a los titulares afectados y a la <strong className="text-foreground">Superintendencia de Industria y Comercio (SIC)</strong> en los plazos establecidos por la normativa vigente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">8. Menores de Edad</h2>
            <p className="text-muted-foreground">
              La Plataforma EVGreen no está dirigida a menores de 18 años. No recopilamos intencionalmente datos personales de menores de edad. Si un padre o tutor descubre que su hijo menor ha proporcionado datos personales sin su consentimiento, puede solicitar la eliminación contactándonos en <a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">{DPO_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">9. Reclamaciones ante la SIC</h2>
            <p className="text-muted-foreground">
              Si considera que EVGreen ha vulnerado sus derechos como titular de datos personales y no ha obtenido una respuesta satisfactoria, puede presentar una queja ante la <strong className="text-foreground">Superintendencia de Industria y Comercio (SIC)</strong>, Delegatura para la Protección de Datos Personales, a través del portal{" "}
              <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.sic.gov.co</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">10. Contacto del Responsable de Privacidad</h2>
            <div className="p-4 bg-card border border-border rounded-lg space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Correo de privacidad:</strong> <a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">{DPO_EMAIL}</a></p>
              <p><strong className="text-foreground">Correo general:</strong> <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
              <p><strong className="text-foreground">Dirección:</strong> {ADDRESS}</p>
              <p><strong className="text-foreground">Horario:</strong> Lunes a viernes, 8:00 a.m. – 6:00 p.m. (COT)</p>
            </div>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm">
          <Link href="/terms">
            <span className="text-primary hover:underline cursor-pointer">Términos y Condiciones</span>
          </Link>
          <Link href="/contact">
            <span className="text-primary hover:underline cursor-pointer">Contacto</span>
          </Link>
          <Link href="/landing">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer">Inicio</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
