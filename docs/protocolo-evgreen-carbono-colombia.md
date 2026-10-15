# Protocolo EVGreen de cuantificación de reducciones GEI — Colombia

**Versión:** 1.0 propuesta · **Estado propuesto:** preauditoría · **Autor:** Manus AI · **Fecha:** 14 de octubre de 2026

## Método recomendado

EVGreen puede estructurar su expediente con **VM0038 v1.1 — Electric Vehicle Charging Systems** de Verra como método sectorial de referencia, complementado por el marco de proyecto de ISO 14064-2 y la verificación/validación bajo ISO 14064-3. VM0038 está activa desde el 19 de agosto de 2026, es aplicable globalmente a infraestructura de carga y cuantifica reducciones al comparar los vehículos eléctricos atendidos con una flota convencional comparable. También exige analizar adicionalidad mediante VMD0049 o un método de proyecto. [1] [2]

Para Colombia, el expediente debe seguir las reglas nacionales de MRV: la Resolución 1447 de 2018 exige registrar en RENARE desde la factibilidad a las iniciativas que pretendan pagos por resultados o compensaciones similares; el titular responde por la veracidad de la información y debe aplicar los principios MRV. RENARE reporta reducciones generadas, verificadas y canceladas como estados separados. [3] [4]

Cercarbono puede ser una ruta de certificación a evaluar, no una emisión automática. Su protocolo exige metodología, adicionalidad, elegibilidad, línea base, escenario de proyecto, fuentes GEI, cuantificación y procesos independientes de validación y verificación bajo un marco basado en ISO 14064-2. [5]

> La plataforma puede mostrar una **estimación preauditada**. No puede llamar a esa cifra “créditos emitidos”, “bonos verificados” o “créditos vendibles” hasta que una entidad verificadora valide el expediente, el programa emita las unidades y el registro asigne sus seriales.

## Ecuación de cuantificación propuesta

Para cada categoría de vehículo y período de monitoreo, el cálculo debe conservar los parámetros de la fórmula VM0038:

```text
BE = electricidad OCPP entregada × emisiones de combustible de la flota base
     × conversión a distancia / eficiencia eléctrica del EV / eficiencia de la flota fósil

PE = electricidad efectivamente usada por la carga × factor de emisión eléctrico aplicable

Reducción preauditada = BE − PE − fugas aplicables
```

VM0038 calcula la línea base convirtiendo los kWh entregados por los cargadores en distancia recorrida y aplicando el factor del combustible de una flota convencional comparable. Las emisiones de proyecto se calculan con la electricidad efectivamente consumida por la carga y su factor eléctrico. Si hay infraestructura asociada, el sistema debe medir y trazar las fuentes de energía, incluidos red, renovables dedicadas y baterías; la electricidad renovable excedente exportada no se acredita. [6]

La plataforma ya conserva la primera parte de esa trazabilidad: sesiones OCPP completadas y kWh entregados. Para que el cálculo sea auditable faltan parámetros documentados de cada grupo vehicular: categoría, consumo real del EV, vehículo de línea base comparable, eficiencia de combustible, combustible, factor GEI y evidencia de fuente. No es técnicamente válido reemplazarlos por un único porcentaje universal.

## Factores oficiales que sí se pueden fijar ahora

| Parámetro | Valor propuesto | Uso permitido | Fuente |
|---|---:|---|---|
| Factor eléctrico SIN para inventario | **0,220 tCO₂e/MWh** | Emisiones de proyecto o inventario por electricidad de red | UPME, año 2024 [7] |
| Factor eléctrico para primer período de acreditación solar/eólica | **0,660 tCO₂e/MWh** | Ruta solar medida y preauditada; no sustituye la línea base de movilidad | UPME, año 2024 [7] |
| Factor de CO₂ de gasolina motor | **8,808 kgCO₂/galón** | Insumo de línea base cuando la categoría y el rendimiento del vehículo estén documentados | FECOC/UPME [8] |

La Resolución UPME 000085 de 2026 distingue expresamente el factor de inventario de GEI de los factores para proyectos de mitigación. El factor de 0,660 tCO₂e/MWh aplica a plantas eólicas y solares en su primer período de acreditación. No debe aplicarse mecánicamente a todo kWh de recarga EV. [7]

El informe FECOC aporta el factor colombiano de combustibles, pero no convierte por sí solo kWh de recarga en toneladas evitadas. El consumo del vehículo comparable y el consumo eléctrico del vehículo atendido siguen siendo necesarios. La guía UPME de sustitución vehicular confirma que la cuantificación debe combinar eficiencia vehicular, recorrido/actividad, emisiones de combustible y el factor de la red; además propone indicadores MRV de kWh, tipos de vehículos, recorridos y tCO₂e disminuidas. [9] [10]

## Configuración inicial recomendada en EVGreen

La siguiente configuración deja el módulo listo para un expediente y actualizable sin generar una afirmación incorrecta de créditos emitidos:

```text
Programa: EVGreen — Preauditoría de reducción GEI por carga eléctrica
País: Colombia
Código metodológico: EVG-COL-VM0038-PRE-1.0
Metodología: Adaptación preauditada de Verra VM0038 v1.1 + ISO 14064-2/3 + MRV Colombia
Estado: PRE_AUDIT
Factor de red/inventario: 0,220 tCO₂e/MWh (2024, UPME Res. 000085 de 2026)
Factor solar: 0,660 tCO₂e/MWh (2024, UPME Res. 000085 de 2026)
Estimación operativa por movilidad: desactivada hasta registrar parámetros de línea base por categoría
Precio de crédito, comisión y volumen vendible: sin fijar hasta recibir cotización comercial y confirmación metodológica
```

Esta configuración sí puede aplicarse inmediatamente. Mantiene la cifra solar en cero mientras no haya lectura solar verificada, y mantiene la cifra de movilidad pendiente mientras EVGreen no documente los parámetros requeridos por VM0038 para la flota realmente atendida.

## Datos mínimos para activar la estimación de movilidad

1. Clasificación de las sesiones o de los usuarios por categoría: automóvil liviano, SUV, taxi, moto, van, bus o carga.
2. Consumo de electricidad representativo del EV, idealmente por modelo o segmento, expresado en kWh/100 km.
3. Vehículo de combustión comparable y su consumo real o fuente colombiana documentada, en km/galón o L/100 km.
4. Combustible y factor GEI aplicable; para gasolina motor, FECOC entrega el factor de CO₂ colombiano, pero deben incorporarse los componentes metodológicos requeridos por la línea base elegida. [8]
5. Factor eléctrico de proyecto y, cuando corresponda, medición por horario, red, renovable dedicada y batería.
6. Prueba de adicionalidad, derecho sobre la reducción, exclusión de doble reclamación y un plan de monitoreo/versionado de parámetros.

La UPME tiene estudios colombianos de movilidad, ciclos de conducción y eficiencia. Sus líneas base distinguen vehículos, combustible, tipo de operación y condiciones de ruta; deben emplearse para parametrizar cada segmento, no para crear un promedio universal sin respaldo. [11] [12]

## Ruta para créditos y registro

1. Preparar el Documento de Proyecto: límite, titulares, estaciones, período, línea base, adicionalidad y plan de monitoreo.
2. Inscribir la iniciativa en RENARE en fase de factibilidad si se busca pago por resultados o compensación, y controlar traslapes territoriales/períodos. [3] [4]
3. Mantener sesiones OCPP, medidores de red/solar, evidencia de energía renovable, factores, responsables y cambios en una bitácora inmutable.
4. Someter el expediente a revisión metodológica y validación/verificación por una entidad competente conforme al programa elegido.
5. Solo después de la verificación y emisión, registrar en EcoRegistry o en el registro designado los seriales, titularidad, transferencias, listados, ventas y retiros. EcoRegistry provee infraestructura de trazabilidad para programas de créditos; no sustituye la validación ni emite por sí mismo una reducción. [13]

## Decisión para la configuración inmediata

La investigación respalda inyectar **ya** los factores UPME de red y solar y registrar la metodología con estado `PRE_AUDIT`. No respalda inyectar un factor único de movilidad ni marcar toneladas como créditos, porque VM0038 requiere línea base, eficiencia y adicionalidad específicas del proyecto, y las reglas colombianas separan generación, verificación y cancelación.

La opción responsable es configurar el programa preauditado ahora y luego activar la estimación de movilidad con un factor calculado a partir de una matriz de segmentos vehiculares documentada. Esa estimación se mostrará como `tCO₂e preauditadas por movilidad` y permanecerá separada de los créditos verificables y de la energía solar medida.

## Implementación inicial por perfiles de EVGreen

La plataforma ahora asocia de forma conservadora los kWh de una sesión completada al **vehículo predeterminado activo** de su usuario. Una sesión sin ese vínculo, o con un modelo que no tiene factor activo, queda fuera de la estimación y se reporta como cobertura pendiente; nunca se rellena con un promedio de red.

La ecuación por perfil es:

```text
tCO₂e preauditadas = kWh OCPP / 1.000 × [
  (8,808 kgCO₂/galón ÷ km/galón de la línea base)
  ÷ (consumo EV kWh/100 km ÷ 100)
  − factor eléctrico de red (tCO₂e/MWh)
]
```

La matriz es editable y versionada con marca/modelo, segmento, consumo EV, línea base, factor de combustible, factor de red, fuente, calidad y bitácora. La carga inicial usa **21,2 kWh/100 km WLTC** para BYD Sealion 7 AWD de la ficha oficial BYD; aplica **40 km/gal** para automóvil y **22 km/gal** para SUV/camioneta del Balance de Energía Útil UPME, el factor **8,808 kgCO₂/gal** de gasolina motor FECOC y **0,220 tCO₂e/MWh** de la red. Los modelos cuya ficha no publicó consumo explícito se marcan `NEEDS_REVIEW`; son una estimación preauditada visible y editable, no una base apta para emitir créditos.

> Antes de preparar un lote para verificación, EVGreen debe sustituir cada proxy por la ficha/homologación aplicable a la versión exacta registrada, completar la cobertura de perfiles y validar línea base, adicionalidad, fugas y derecho sobre la reducción.

## References

[1]: https://verra.org/methodologies/vm0038-electric-vehicle-charging-systems-v1-1/ "VM0038 Electric Vehicle Charging Systems v1.1"
[2]: https://verra.org/methodology/vmd0049-activity-method-for-determining-additionality-of-electric-vehicle-charging-systems-v1-0/ "VMD0049 Positive List for Electric Vehicle Charging Systems v1.1"
[3]: https://www.minambiente.gov.co/wp-content/uploads/2022/01/15.-Resolucion-1447-de-2018.pdf "Resolución 1447 de 2018 — Sistema MRV nacional"
[4]: https://www.minambiente.gov.co/cambio-climatico-y-gestion-del-riesgo/renare/ "RENARE — Registro Nacional de Reducción de Emisiones de GEI"
[5]: https://cercarbono.com/wp-content/uploads/Protocolo-de-Cercarbono-V-4.4.pdf "Protocolo de Cercarbono para la certificación voluntaria de carbono v4.4"
[6]: https://verra.org/documents/vm0038-electric-vehicle-charging-systems-v1-1/ "VM0038 v1.1 — cuantificación de línea base y emisiones de proyecto"
[7]: https://docs.upme.gov.co/Normatividad/0085_2026.pdf "Resolución UPME 000085 de 2026 — factores del SIN 2024"
[8]: https://app.upme.gov.co/Calculadora_Emisiones1/new/Informe_Final_FECOC_Correcciones_UPME_FunNatura.pdf "FECOC — factores de emisión de combustibles colombianos"
[9]: https://docs.upme.gov.co/DemandayEficiencia/Documents/Nota_metodologica.pdf "UPME — Nota metodológica de la herramienta de sustitución vehicular"
[10]: https://docs.upme.gov.co/DemandayEficiencia/Documents/Guia_metodologica.pdf "UPME — Guía metodológica de transformación de flota a tecnologías de cero y bajas emisiones"
[11]: https://www.upme.gov.co/simec/movilidad-sostenible/ "UPME — Movilidad sostenible y FECOC+"
[12]: https://docs.upme.gov.co/DemandayEficiencia/Documents/1_Reporte_linea_base_EE_carga.pdf "UPME — Línea base de consumo de combustible de vehículos de carga en Colombia"
[13]: https://www.ecoregistry.io/ "EcoRegistry — plataforma de registro de activos ambientales"
