/**
 * EVGreen - Términos y Condiciones
 * Cumplimiento: Ley 1480/2011 (Estatuto del Consumidor), Ley 142/1994 (Servicios Públicos),
 * Ley 1581/2012 (Protección de Datos), Ley 527/1999 (Comercio Electrónico)
 * @author Green House Project
 */
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "wouter";

const LAST_UPDATED = "17 de junio de 2026";
const COMPANY_NAME = "Green House Project S.A.S.";
const NIT = "901.234.567-8";
const ADDRESS = "Bogotá D.C., Colombia";
const EMAIL = "evgreen@greenhproject.com";

export default function Terms() {
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
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Términos y Condiciones</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-16">
        <div className="mb-8 p-4 bg-card border border-border rounded-xl">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">Última actualización:</strong> {LAST_UPDATED}</span>
            <span><strong className="text-foreground">Empresa:</strong> {COMPANY_NAME} · NIT {NIT}</span>
            <span><strong className="text-foreground">Sede:</strong> {ADDRESS}</span>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Aceptación de los Términos</h2>
            <p className="text-muted-foreground">
              Los presentes Términos y Condiciones de Uso (en adelante, "Términos") regulan el acceso y uso de la plataforma digital <strong className="text-foreground">EVGreen</strong>, incluyendo la aplicación web progresiva (PWA), la aplicación móvil, el sistema de gestión de carga (CSMS) y todos los servicios asociados (en adelante, la "Plataforma"), operada por <strong className="text-foreground">{COMPANY_NAME}</strong>, identificada con NIT {NIT}, con domicilio en {ADDRESS}.
            </p>
            <p className="text-muted-foreground mt-3">
              Al acceder, registrarse o utilizar la Plataforma, el Usuario declara haber leído, comprendido y aceptado íntegramente estos Términos, así como la{" "}
              <Link href="/privacy"><span className="text-primary hover:underline cursor-pointer">Política de Privacidad</span></Link>.
              Si no está de acuerdo con alguna disposición, deberá abstenerse de utilizar la Plataforma.
            </p>
            <p className="text-muted-foreground mt-3">
              Estos Términos se rigen por la legislación colombiana, en particular por la <strong className="text-foreground">Ley 1480 de 2011</strong> (Estatuto del Consumidor), la <strong className="text-foreground">Ley 142 de 1994</strong> (Régimen de Servicios Públicos), la <strong className="text-foreground">Ley 527 de 1999</strong> (Comercio Electrónico), la <strong className="text-foreground">Ley 1581 de 2012</strong> (Protección de Datos Personales) y las resoluciones de la CREG aplicables.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. Definiciones</h2>
            <div className="space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Usuario:</strong> Persona natural o jurídica que accede y utiliza la Plataforma EVGreen para cargar vehículos eléctricos o acceder a servicios relacionados.</p>
              <p><strong className="text-foreground">Operador:</strong> {COMPANY_NAME}, responsable de la operación de la Plataforma y de la red de estaciones de carga.</p>
              <p><strong className="text-foreground">Estación de Carga (EVSE):</strong> Infraestructura física compuesta por cargadores AC (Nivel 2) y DC (Carga Rápida) conectados a la Plataforma mediante el protocolo OCPP.</p>
              <p><strong className="text-foreground">Sesión de Carga:</strong> Período comprendido entre la conexión del vehículo a la estación y la finalización del proceso de carga.</p>
              <p><strong className="text-foreground">Billetera Digital:</strong> Saldo prepagado en pesos colombianos (COP) asociado a la cuenta del Usuario para el pago de servicios de carga.</p>
              <p><strong className="text-foreground">Tarifa de Ocupación:</strong> Cargo por minuto aplicado cuando el vehículo permanece conectado a la estación después de completada la carga, para liberar el punto de carga para otros usuarios.</p>
              <p><strong className="text-foreground">Período de Gracia:</strong> Tiempo de 10 minutos tras la finalización de la carga durante el cual no se aplica tarifa de ocupación, para que el Usuario pueda desconectar su vehículo.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. Registro y Cuenta de Usuario</h2>
            <p className="text-muted-foreground">
              Para acceder a los servicios de carga, el Usuario debe crear una cuenta en la Plataforma. El registro requiere proporcionar información veraz, completa y actualizada. El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas bajo su cuenta.
            </p>
            <p className="text-muted-foreground mt-3">
              El Operador se reserva el derecho de suspender o cancelar cuentas que presenten información falsa, actividad fraudulenta o incumplimiento de estos Términos. La edad mínima para registrarse es de <strong className="text-foreground">18 años</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Descripción de los Servicios</h2>
            <p className="text-muted-foreground">La Plataforma EVGreen ofrece los siguientes servicios:</p>
            <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Carga de vehículos eléctricos:</strong> Acceso a estaciones de carga AC (Tipo 2, hasta 22 kW) y DC Rápida (CCS2, CHAdeMO, GB/T, hasta 150 kW).</li>
              <li><strong className="text-foreground">Gestión de sesiones:</strong> Inicio, monitoreo y finalización remota de sesiones de carga mediante la aplicación.</li>
              <li><strong className="text-foreground">Billetera digital:</strong> Recarga de saldo prepagado y gestión de pagos mediante pasarelas autorizadas (Wompi/Bancolombia).</li>
              <li><strong className="text-foreground">Asistente de IA:</strong> Recomendaciones personalizadas de carga basadas en inteligencia artificial, historial de uso y condiciones de la red.</li>
              <li><strong className="text-foreground">Historial y reportes:</strong> Acceso al historial de sesiones, consumo energético y facturación.</li>
              <li><strong className="text-foreground">Reservas:</strong> Reserva anticipada de puntos de carga disponibles (sujeto a disponibilidad).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Tarifas y Facturación</h2>
            <p className="text-muted-foreground">
              Las tarifas de carga se expresan en pesos colombianos (COP) por kilovatio-hora (kWh) consumido o por minuto de conexión, según el tipo de estación y la modalidad seleccionada. Las tarifas vigentes se publican en la Plataforma antes del inicio de cada sesión y pueden variar según el tipo de cargador, la hora del día, la ubicación de la estación y las promociones vigentes.
            </p>
            <p className="text-muted-foreground mt-3">
              <strong className="text-foreground">Tarifa de Ocupación:</strong> Transcurridos 10 minutos desde la finalización de la carga (período de gracia), se aplicará una tarifa de ocupación por cada minuto adicional que el vehículo permanezca conectado. El Usuario recibirá una notificación push en la aplicación al momento en que la carga finalice.
            </p>
            <p className="text-muted-foreground mt-3">
              Conforme a la <strong className="text-foreground">Ley 1480 de 2011</strong>, el precio informado al inicio de la sesión es el precio máximo a cobrar. No se realizarán cobros adicionales no informados previamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. Medios de Pago y Recargas</h2>
            <p className="text-muted-foreground">
              Los pagos se procesan a través de <strong className="text-foreground">Wompi</strong> (plataforma de pagos de Bancolombia), que acepta tarjetas de crédito y débito Visa, Mastercard, American Express, PSE (débito bancario) y Nequi. El Operador no almacena datos de tarjetas de crédito; toda la información de pago es procesada directamente por Wompi bajo estándares PCI DSS.
            </p>
            <p className="text-muted-foreground mt-3">
              El saldo de la Billetera Digital no es reembolsable en efectivo, salvo en casos de cierre de cuenta o por disposición legal aplicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. Uso Aceptable de la Plataforma</h2>
            <p className="text-muted-foreground">El Usuario se compromete a:</p>
            <ul className="mt-3 space-y-1 text-muted-foreground list-disc list-inside">
              <li>Utilizar la Plataforma únicamente para cargar vehículos eléctricos de uso personal o empresarial legítimo.</li>
              <li>No intentar acceder a sistemas, cuentas o datos de otros usuarios sin autorización.</li>
              <li>No realizar ingeniería inversa, descompilar o modificar la Plataforma.</li>
              <li>No utilizar la Plataforma para actividades ilegales, fraudulentas o que violen derechos de terceros.</li>
              <li>Reportar inmediatamente cualquier falla, anomalía o uso no autorizado detectado.</li>
              <li>Respetar las instrucciones de uso físico de las estaciones de carga.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">8. Responsabilidades y Limitaciones</h2>
            <p className="text-muted-foreground">
              El Operador se compromete a mantener la Plataforma disponible con una disponibilidad objetivo del 99% mensual, sin perjuicio de interrupciones programadas para mantenimiento (notificadas con al menos 24 horas de anticipación) o fallas de terceros (red eléctrica, conectividad, etc.).
            </p>
            <p className="text-muted-foreground mt-3">
              El Operador no será responsable por daños al vehículo derivados del uso incorrecto de las estaciones de carga, incompatibilidad del conector, o fallas en el sistema de gestión de batería (BMS) del vehículo. El Usuario es responsable de verificar la compatibilidad de su vehículo con el tipo de cargador antes de iniciar una sesión.
            </p>
            <p className="text-muted-foreground mt-3">
              Conforme al artículo 5 de la <strong className="text-foreground">Ley 1480 de 2011</strong>, el Operador garantiza la calidad e idoneidad del servicio de carga. En caso de falla imputable al Operador durante una sesión, el Usuario tendrá derecho a la devolución del monto cobrado por esa sesión.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">9. Propiedad Intelectual</h2>
            <p className="text-muted-foreground">
              Todos los derechos de propiedad intelectual sobre la Plataforma EVGreen, incluyendo su diseño, código fuente, algoritmos de inteligencia artificial, marca, logotipos y contenidos, son propiedad exclusiva de <strong className="text-foreground">{COMPANY_NAME}</strong> y están protegidos por la <strong className="text-foreground">Ley 23 de 1982</strong> sobre Derechos de Autor y demás normas aplicables.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">10. Protección de Datos Personales</h2>
            <p className="text-muted-foreground">
              El tratamiento de datos personales se rige por la <strong className="text-foreground">Ley 1581 de 2012</strong> y el <strong className="text-foreground">Decreto 1377 de 2013</strong>. Para información detallada sobre cómo recopilamos, usamos y protegemos sus datos personales, consulte nuestra{" "}
              <Link href="/privacy"><span className="text-primary hover:underline cursor-pointer">Política de Privacidad</span></Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">11. Modificaciones a los Términos</h2>
            <p className="text-muted-foreground">
              El Operador se reserva el derecho de modificar estos Términos en cualquier momento. Los cambios serán notificados al Usuario mediante correo electrónico o notificación en la aplicación con al menos <strong className="text-foreground">15 días de anticipación</strong>. El uso continuado de la Plataforma después de la fecha de vigencia de los cambios constituye aceptación de los nuevos Términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">12. Terminación del Servicio</h2>
            <p className="text-muted-foreground">
              El Usuario puede cancelar su cuenta en cualquier momento desde la sección de Perfil de la aplicación o enviando una solicitud a <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>. El saldo restante en la Billetera Digital será reembolsado dentro de los 15 días hábiles siguientes a la solicitud de cancelación, conforme a la Ley 1480 de 2011.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">13. Ley Aplicable y Jurisdicción</h2>
            <p className="text-muted-foreground">
              Estos Términos se rigen por las leyes de la República de Colombia. Para la resolución de controversias, las partes acuerdan someterse en primera instancia a mecanismos alternativos de solución de conflictos (conciliación). Si no se llega a un acuerdo, la controversia será resuelta por los jueces competentes de la ciudad de Bogotá D.C., Colombia.
            </p>
            <p className="text-muted-foreground mt-3">
              El Usuario podrá presentar reclamaciones ante la <strong className="text-foreground">Superintendencia de Industria y Comercio (SIC)</strong> en ejercicio de sus derechos como consumidor, conforme a la Ley 1480 de 2011.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">14. Contacto y Atención al Usuario</h2>
            <div className="mt-3 p-4 bg-card border border-border rounded-lg space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Correo electrónico:</strong> <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
              <p><strong className="text-foreground">Formulario de contacto:</strong> <Link href="/contact"><span className="text-primary hover:underline cursor-pointer">evgreen.lat/contact</span></Link></p>
              <p><strong className="text-foreground">Dirección:</strong> {ADDRESS}</p>
              <p><strong className="text-foreground">Horario de atención:</strong> Lunes a viernes, 8:00 a.m. – 6:00 p.m. (COT)</p>
            </div>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm">
          <Link href="/privacy">
            <span className="text-primary hover:underline cursor-pointer">Política de Privacidad</span>
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
