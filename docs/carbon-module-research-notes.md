## Hallazgos que condicionan el diseño

1. **No basta con sumar kWh para afirmar créditos de carbono.** El protocolo de Cercarbono exige un documento de diseño del proyecto (PDD), derecho de uso, elegibilidad y adicionalidad, línea base, plan de monitoreo, datos de origen, incertidumbre, y validación/verificación. El sistema debe, por tanto, conservar evidencia por lectura, periodo y equipo; una proyección comercial debe permanecer separada de una reducción verificada. Fuente: Protocolo Cercarbono v4.4, secciones 7.1 a 7.4.

2. **La ruta Cercarbono/EcoRegistry es una ruta de certificación y registro, no una API de venta instantánea.** EcoRegistry provee registro, trazabilidad y cuentas de participantes; Cercarbono mantiene metodologías propias y permite metodologías MDL aprobadas. La página pública de metodologías de Cercarbono actualmente lista energía renovable y un catálogo de metodologías MDL de transporte, pero no publica una metodología propia específica de carga de EV. Antes de registrar se debe confirmar con Cercarbono la metodología vigente, elegibilidad y el tratamiento de la agregación de estaciones EV.

3. **RENARE es necesario para la trazabilidad nacional de iniciativas que buscan pagos por resultados o compensaciones.** MinAmbiente describe cuatro fases: factibilidad, formulación, implementación y cierre. El módulo debe estructurar los expedientes según esas fases y no marcar una iniciativa como registrada hasta que exista un identificador externo y evidencia de la inscripción.

4. **El factor UPME debe ser versionado, nunca quemado en código.** La Resolución UPME 000085 de 2026 actualiza el factor 2024: 0,220 tCO2eq/MWh para inventarios GEI; 0,660 tCO2eq/MWh para el primer periodo de acreditación de proyectos eólicos y solares; y 0,607/0,554 tCO2eq/MWh para proyectos MDL no solares/eólicos según el periodo. La configuración conserva propósito, período, unidad, fuente, versión y vigencia para impedir mezclar factores.

5. **El impacto de la carga EV y el impacto atribuible a generación solar deben tener libros separados.** Verra VM0038 v1.1 muestra que el enfoque de créditos EV se basa en el desplazamiento de vehículos fósiles, adicionalidad y requisitos de monitoreo reforzados. La generación solar, por su parte, requiere una lectura real y una regla de asignación de energía; no se puede transformar automáticamente una proyección solar de OpenSolar en crédito emitible. El módulo debe bloquear la doble reclamación cuando los mismos kWh solares estén comprometidos a otro proyecto, certificado, REC o crédito.

6. **Las afirmaciones públicas requieren etiqueta de certeza.** GHG Protocol permite reportar emisiones evitadas separadas del inventario, y advierte que no equivalen automáticamente a reducciones globales ni deben reducir una huella corporativa. En landing y perfil deben mostrarse como “estimadas” hasta verificación y como “verificadas” solo al adjuntar el resultado del tercero; nunca como bonos emitidos o vendidos antes de retiro/transferencia registrados.

## Fuentes primarias consultadas

- Cercarbono, metodologías: https://cercarbono.com/es/metodologias/
- Cercarbono, Protocolo de Certificación Voluntaria de Carbono v4.4: https://cercarbono.com/wp-content/uploads/Protocolo-de-Cercarbono-V-4.4.pdf
- Ministerio de Ambiente, RENARE: https://www.minambiente.gov.co/cambio-climatico-y-gestion-del-riesgo/renare/
- UPME, Resolución 000085 de 2026: https://docs.upme.gov.co/Normatividad/085_2026.pdf
- UPME, catálogo de factores de emisión del SIN: https://www.upme.gov.co/simec/oferta-y-demanda/transicion-energetica-justa/cambioclimatico/calculo-del-factor-de-emision-de-co2-del-sin/
- EcoRegistry, plataforma de registro de activos ambientales: https://www.ecoregistry.io/
- Verra, VM0038 Electric Vehicle Charging Systems v1.1: https://verra.org/methodologies/vm0038-electric-vehicle-charging-systems-v1-1/
- GHG Protocol, Scope 2 Guidance: https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf
- UNFCCC, AMS-III.C (histórica/no activa): https://cdm.unfccc.int/methodologies/DB/AWVYMI7E3FP9BDRQ646203OVPKFPQB
