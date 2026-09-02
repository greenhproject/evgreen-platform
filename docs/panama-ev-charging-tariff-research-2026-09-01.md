# Investigación tarifaria — Carga rápida pública en Panamá

**Fecha de corte:** 1 de septiembre de 2026. **Moneda:** balboa panameño (B/.) y USD; el estudio usa su paridad legal 1:1 únicamente para presentación.

## Hallazgo principal

El precio público observado para carga rápida DC en Panamá se ubica en un rango publicado de **B/.0,35–0,50/kWh** para la red Evergo. Este rango se documenta como evidencia comercial secundaria y debe confirmarse con capturas de la app, cotización de operador o contrato antes de fijar una tarifa de lanzamiento. [1]

El costo de electricidad no se debe modelar como un único precio por kWh. Una estación rápida supera el umbral de 15 kW y normalmente requerirá una tarifa con demanda. En media tensión, los cargos de energía, demanda máxima, cargo fijo y variación mensual por combustible cambian por distribuidor y horario. [2] [3]

## Precio público de carga rápida

| Operador o evidencia | Hallazgo | Uso en modelo | Confianza |
|---|---:|---|---|
| PideTuCarro, 30-mar-2026 | Evergo: **B/.0,35–0,50/kWh** para Level 3 DC | Banda de tarifa observada; base inicial B/.0,425/kWh si no se dispone de price sheet | Media: fuente secundaria que cita Evergo |
| Evergo — FAQ | La red opera Nivel 3; declara carga al 80% en menos de una hora y más de 300 estaciones instaladas o en proceso | Verificación de formato de red pública, no de precio | Media-alta |
| Terpel Voltex Panamá | Red pública rápida; equipos entre aproximadamente 7 kW y 50 kW | Confirma competencia y oferta pública; no publica tarifa en la página | Alta para existencia, no aplicable a precio |

## Costo regulado de red: tarifas de referencia ASEP

La tabla de tarifas publicada por ASEP para enero–agosto 2026 informa, para clientes de **media tensión con demanda máxima (MTD)**, los siguientes cargos de energía y demanda. El documento indica que la demanda se mide como el máximo de intervalos de 15 minutos. [2]

| Distribuidora | Energía MTD B/./kWh | Demanda MTD B/./kW-mes | Cargo fijo B/./mes |
|---|---:|---:|---:|
| EDEMET | 0,16001 | 20,62 | 14,27 |
| ENSA | 0,15396 | 12,45 | 9,06 |
| EDECHI | 0,13479 | 24,53 | 14,21 |

Para **media tensión horaria (MTH)**, los precios de energía y demanda cambian por bloque. En EDEMET son B/.0,30571/kWh en punta, B/.0,17203/kWh fuera de punta medio y B/.0,09424/kWh fuera de punta bajo; los cargos de demanda respectivos son B/.18,20, B/.2,82 y B/.2,82/kW-mes. ENSA presenta B/.0,14660/kWh en punta/medio, B/.0,09080/kWh en bajo, y B/.8,27/B/.4,78/B/.4,78 por kW-mes. EDECHI presenta B/.0,28181/B/.0,15147/B/.0,09080 por kWh y B/.25,41/B/.3,63/B/.3,63 por kW-mes. [2]

En agosto de 2026, el componente de variación por combustible para MTD fue **-B/.0,00915/kWh** en EDEMET, **+B/.0,00052/kWh** en ENSA y **-B/.0,01510/kWh** en EDECHI. Se trata de un cargo variable mensual, por lo que no se debe fijar permanentemente en el modelo. [3]

## Implicación para modelación

El costo efectivo por kWh para una estación debe calcularse como:

> **Costo efectivo = energía regulada + CVC + (demanda máxima facturada × cargo de demanda + cargo fijo) / kWh mensuales + pérdidas propias del cargador + impuestos aplicables.**

Por tanto, el margen depende críticamente de la utilización. Un cargador de 120–150 kW que registre un pico de 150 kW pero venda pocos kWh mensualiza una carga de demanda material; el caso de baja utilización no puede evaluarse solo contra el componente de energía.

## Marco regulatorio y decisión de compra de energía

La propuesta de pliegos 2026–2030 de EDEMET/EDECHI, publicada como documento de consulta, señala que **no existe todavía una tarifa específica para movilidad eléctrica**. Las estaciones no propiedad de la distribuidora pueden usar las categorías actuales, solicitar medidor separado o mantener el mismo medidor con la actividad principal. Esto confirma que cada proyecto debe comparar MTD/MTH/ATD/ATH con el perfil de carga real; la propuesta no es una tarifa final ni una cotización. [8]

La misma fuente divide los períodos horarios así: **punta** lunes a viernes 09:01–17:00; **fuera de punta medio** lunes a viernes 17:01–24:00 y sábado 11:01–23:00; **fuera de punta bajo** las demás horas, incluidos domingos y festivos. Una estrategia de precio dinámico y gestión de carga puede trasladar demanda fuera de punta, pero no elimina el riesgo de cargo de demanda si la estación registra una máxima en punta. [8]

Para un Gran Cliente, la Ley 6 citada por ASEP permite negociar libremente el suministro de **energía** con agentes del mercado, mientras la potencia y cargos de red continúan sujetos a las reglas y el punto de conexión. La elegibilidad y el beneficio real deben confirmarse con la distribuidora, ASEP y asesor regulatorio por proyecto. [9]

## Mercado y demanda

| Indicador | Dato documentado | Implicación comercial |
|---|---:|---|
| Parque BEV | 1.584 vehículos eléctricos en circulación a enero de 2025 | Base aún pequeña; una red rápida debe iniciar en nodos de alta visibilidad, corredores y flotas, no bajo un supuesto de demanda masiva inmediata. [10] |
| Infraestructura pública | 256 cargadores y 195 estaciones reportadas a marzo de 2025 | Existe competencia y demanda inicial; se requiere estudio micro-local de ubicaciones y disponibilidad. [10] |
| Meta pública a 2030 | 10–20% de vehículos privados eléctricos y 25–40% de ventas privadas eléctricas | Señal de crecimiento potencial, no base de ingresos contratada. [10] |
| Marco de movilidad | Ley 295 de 2022 y Decreto Ejecutivo 51 de 2023; procedimiento para servicio de carga publicado en Gaceta 29809-A | La entrada al mercado exige validar la ruta regulatoria, estructura societaria local y contrato de suministro. [11] |

## Conclusión de inversión preliminar

El precio público observado de B/.0,35–0,50/kWh ofrece un margen bruto aparente frente al componente de energía regulada de aproximadamente B/.0,12–0,16/kWh; sin embargo, **la demanda mensual puede dominar el costo efectivo en una estación subutilizada**. El modelo debe aprobar una ubicación solo después de obtener: (1) estudio de conexión y demanda, (2) tarifa y pliego vigente de su concesionaria, (3) perfil horario de carga, (4) evidencia de precio de competidores mediante apps y (5) esquema definitivo de impuestos, pagos, predio y OPEX.

## Fuentes

[1] [PideTuCarro — How Much Does It Cost to Charge an Electric Car in Panama? Real Costs 2026](https://pidetucarro.com/en/blog/how-much-to-charge-ev-panama/) (30-mar-2026).  
[2] [ASEP — Tarifas de electricidad para clientes regulados, vigentes enero–agosto 2026](https://asep.gob.pa/wp-content/uploads/electricidad/tarifas/01_tarifas_clientes_regulados/tarifas_2023-2026/2026/agosto/II_t_2026.pdf).  
[3] [ASEP — Variación por combustible para clientes regulados, agosto 2026](https://asep.gob.pa/wp-content/uploads/electricidad/tarifas/01_tarifas_clientes_regulados/tarifas_2023-2026/2026/agosto/II_vc_2026.pdf).  
[4] [ENSA — Tarifas y condiciones generales](https://ensa.com.pa/informacion-regulatoria/tarifas/).  
[5] [Naturgy Panamá — Tarifas para EDEMET/EDECHI](https://www.naturgy.com.pa/hogar/distribucion-de-electricidad/tarifas/).  
[6] [Evergo — Preguntas frecuentes](https://evergo.com/soporte/preguntas-frecuentes/).  
[7] [Terpel Voltex Panamá](https://www.terpelpanama.com/productos-y-servicios/estaciones-de-servicio/otros-servicios/voltex.html).
[8] [ASEP — Propuesta de pliegos 2026–2030 EDEMET/EDECHI, Nota DSAN-618-26](https://asep.gob.pa/wp-content/uploads/electricidad/consultas_publicas/2026/cp_008-26/EDEMET/informe_general_pliego_edemet_edechi_2026.pdf).
[9] [ASEP — Criterios y procedimientos para venta de energía y potencia a Grandes Clientes](https://faolex.fao.org/docs/pdf/pan95296.pdf).
[10] [pv magazine — Panamá cuenta con 1.584 vehículos eléctricos en circulación](https://www.pv-magazine-latam.com/2025/03/07/panama-cuenta-con-1584-vehiculos-electricos-en-circulacion/).
[11] [Secretaría Nacional de Energía — Movilidad Eléctrica en Panamá](https://storymaps.arcgis.com/stories/1c91404606574097aa880e3062366451).
