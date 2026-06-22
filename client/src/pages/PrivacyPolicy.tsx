export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-green-900 mb-2">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-8">Última actualización: 22 de junio de 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">1. Responsable del tratamiento</h2>
        <p className="text-gray-700 leading-relaxed">
          <strong>Greenh Project SAS</strong> (en adelante "EVGreen"), con domicilio en Bogotá D.C., Colombia,
          es el responsable del tratamiento de los datos personales recopilados a través de la aplicación
          móvil y la plataforma web EVGreen. Para consultas sobre privacidad puede escribirnos a{" "}
          <a href="mailto:privacidad@evgreen.lat" className="text-green-700 underline">privacidad@evgreen.lat</a>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">2. Datos que recopilamos</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li><strong>Datos de identidad:</strong> nombre completo, número de identificación, dirección de correo electrónico y número de teléfono.</li>
          <li><strong>Datos de ubicación:</strong> ubicación geográfica aproximada para mostrar estaciones de carga cercanas. Solo se accede con su permiso explícito.</li>
          <li><strong>Datos de pago:</strong> información de transacciones procesadas a través de Wompi. No almacenamos datos de tarjetas bancarias directamente.</li>
          <li><strong>Datos de uso del servicio:</strong> historial de sesiones de carga, consumo de energía, tiempos de carga y movimientos de billetera virtual.</li>
          <li><strong>Datos del dispositivo:</strong> identificador del dispositivo, sistema operativo y token de notificaciones push (FCM).</li>
          <li><strong>Datos de soporte:</strong> comunicaciones enviadas a través del sistema de tickets de soporte.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">3. Finalidades del tratamiento</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Prestar el servicio de carga de vehículos eléctricos y gestionar su cuenta.</li>
          <li>Procesar pagos y recargas de billetera virtual.</li>
          <li>Enviar notificaciones sobre el estado de su carga, saldo y alertas del servicio.</li>
          <li>Mostrar estaciones de carga disponibles según su ubicación.</li>
          <li>Generar reportes de consumo y facturación.</li>
          <li>Atender solicitudes de soporte técnico.</li>
          <li>Cumplir obligaciones legales y prevenir fraudes.</li>
          <li>Mejorar continuamente el servicio mediante análisis agregado de uso.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">4. Terceros que procesan sus datos</h2>
        <div className="space-y-3 text-gray-700">
          <p><strong>Auth0 (Okta):</strong> gestión de autenticación e inicio de sesión seguro.</p>
          <p><strong>Wompi:</strong> procesador de pagos en Colombia. Sus transacciones se rigen también por la política de privacidad de Wompi.</p>
          <p><strong>Google Firebase:</strong> envío de notificaciones push a dispositivos móviles.</p>
          <p><strong>Google Maps Platform:</strong> visualización de estaciones de carga en el mapa.</p>
          <p><strong>Amazon Web Services (S3):</strong> almacenamiento seguro de documentos y archivos subidos por usuarios.</p>
          <p><strong>Resend:</strong> envío de correos electrónicos transaccionales.</p>
          <p>Todos los terceros están contractualmente obligados a tratar sus datos únicamente para las finalidades aquí descritas y bajo estándares de seguridad equivalentes.</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">5. Base legal del tratamiento</h2>
        <p className="text-gray-700 leading-relaxed">
          El tratamiento de sus datos personales se fundamenta en: (a) la ejecución del contrato de servicio
          que usted acepta al registrarse, (b) su consentimiento explícito para el acceso a ubicación y
          notificaciones, y (c) el cumplimiento de obligaciones legales aplicables en Colombia, conforme a la
          Ley 1581 de 2012 y el Decreto 1377 de 2013.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">6. Conservación de los datos</h2>
        <p className="text-gray-700 leading-relaxed">
          Sus datos se conservan mientras mantenga una cuenta activa en EVGreen y durante el tiempo adicional
          exigido por la normativa fiscal y comercial colombiana (mínimo 5 años para registros de transacciones).
          Al solicitar la eliminación de su cuenta, los datos de uso anónimos y agregados podrán conservarse
          con fines estadísticos.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">7. Sus derechos (Habeas Data)</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          De conformidad con la Ley 1581 de 2012, usted tiene derecho a:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li><strong>Conocer</strong> los datos personales que tenemos sobre usted.</li>
          <li><strong>Actualizar y rectificar</strong> sus datos cuando sean inexactos o incompletos.</li>
          <li><strong>Solicitar prueba</strong> de la autorización otorgada para el tratamiento.</li>
          <li><strong>Revocar la autorización</strong> y solicitar la supresión de sus datos, cuando no exista obligación legal de conservarlos.</li>
          <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mt-3">
          Para ejercer sus derechos, escríbanos a{" "}
          <a href="mailto:privacidad@evgreen.lat" className="text-green-700 underline">privacidad@evgreen.lat</a>.
          Responderemos en un plazo máximo de 15 días hábiles.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">8. Seguridad</h2>
        <p className="text-gray-700 leading-relaxed">
          Implementamos medidas técnicas y organizativas para proteger sus datos, incluyendo cifrado en
          tránsito (HTTPS/TLS), autenticación segura mediante tokens JWT, control de acceso por roles y
          auditorías periódicas. Sin embargo, ningún sistema de transmisión de datos por internet es 100%
          seguro; en caso de una brecha de seguridad que afecte sus datos, le notificaremos conforme a la
          normativa aplicable.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">9. Cookies y almacenamiento local</h2>
        <p className="text-gray-700 leading-relaxed">
          EVGreen utiliza cookies de sesión estrictamente necesarias para mantener su inicio de sesión activo.
          No utilizamos cookies de rastreo publicitario de terceros. En la aplicación móvil, utilizamos
          almacenamiento local (localStorage) como respaldo del token de autenticación en entornos nativos.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">10. Transferencias internacionales</h2>
        <p className="text-gray-700 leading-relaxed">
          Algunos de nuestros proveedores de servicios (Auth0, AWS, Firebase, Resend) procesan datos en
          servidores ubicados fuera de Colombia, principalmente en Estados Unidos. Estas transferencias se
          realizan bajo las garantías y salvaguardas establecidas en la Ley 1581 de 2012 y los estándares
          internacionales de protección de datos aplicables.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">11. Menores de edad</h2>
        <p className="text-gray-700 leading-relaxed">
          EVGreen no está dirigida a menores de 18 años. No recopilamos conscientemente datos de menores
          de edad. Si tiene conocimiento de que un menor ha proporcionado sus datos, contáctenos para
          proceder a su eliminación.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">12. Cambios a esta política</h2>
        <p className="text-gray-700 leading-relaxed">
          Podemos actualizar esta política periódicamente. Cuando realicemos cambios materiales, lo
          notificaremos mediante un aviso en la aplicación o por correo electrónico con al menos 10 días
          de anticipación. El uso continuado del servicio después de la entrada en vigor de los cambios
          constituye su aceptación.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-green-800 mb-3">13. Contacto</h2>
        <p className="text-gray-700 leading-relaxed">
          Para cualquier consulta, solicitud de ejercicio de derechos o reporte de incidentes de privacidad:
        </p>
        <div className="mt-3 text-gray-700 space-y-1">
          <p><strong>Greenh Project SAS</strong></p>
          <p>Bogotá D.C., Colombia</p>
          <p>Correo: <a href="mailto:privacidad@evgreen.lat" className="text-green-700 underline">privacidad@evgreen.lat</a></p>
          <p>Web: <a href="https://app.evgreen.lat" className="text-green-700 underline">app.evgreen.lat</a></p>
        </div>
      </section>
    </div>
  );
}
