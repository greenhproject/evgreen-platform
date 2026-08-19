# Auditoría inicial — Prospecto SPE-2026-0129

## Hallazgos extraídos del PDF adjunto

Se revisó el archivo `SPE-2026-0129-prospecto-3de58k.pdf` aportado por el usuario.

| Elemento | Hallazgo visible en el prospecto |
|---|---|
| Proyecto | **EDS LAS ORQUÍDEAS ENGATIVÁ** |
| Inversión estimada | **$1.000.000.000** |
| Potencia instalada | **480 kW** |
| Cargadores proyectados | **2 unidades** |
| Tarifa mostrada | **$1.800/kWh** |
| Distribución mostrada | **Inversor 63% / EVGreen 27%** |
| Nota de reparto | “Inversor: 70% del neto (63% del bruto) · EVGreen: 30% del neto (27% del bruto)” |

## Escenarios visibles en el prospecto

| Escenario | Operación | kWh/mes | Ingreso bruto/mes | Retorno/mes mostrado | Retorno/año mostrado | ROI anual mostrado | Recuperación mostrada |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pesimista | 4 h/día | 57.600 | $103.680.000 | $65.318.400 | $783.820.800 | 78,4% | 1,3 años |
| Realista | 6 h/día | 86.400 | $155.520.000 | $97.977.600 | $1.175.731.200 | 117,6% | 10,2 meses |
| Optimista | 9 h/día | 129.600 | $233.280.000 | $146.966.400 | $1.763.596.800 | 176,4% | 6,8 meses |

## Diagnóstico preliminar

Los retornos mostrados parecen calcularse como **63% del ingreso bruto**, porque:

- `103.680.000 × 63% = 65.318.400`
- `155.520.000 × 63% = 97.977.600`
- `233.280.000 × 63% = 146.966.400`

Esto sugiere que el prospecto está aplicando directamente una participación equivalente sobre el **bruto**, sin exponer ni descontar explícitamente:

1. **Costo de energía** por kWh configurable.
2. **Participación/comisión del aliado** configurable.
3. **Margen neto distribuible** resultante.
4. **Reparto neto** entre inversionista y EVGreen como porcentaje del neto, no del bruto.

## Riesgo de modelado detectado

Si el modelo correcto es:

`Ingreso bruto - costo energético = margen bruto`

`Margen bruto - comisión aliado = margen neto`

`Margen neto × % inversionista = retorno inversionista`

entonces el ROI, payback y utilidad anual del prospecto actual probablemente están **sobreestimados** al usar una base de reparto incorrecta.

## Próximo paso técnico

Auditar el código fuente y la configuración financiera usada por Espacios/Crowdfunding/PDF para localizar:

1. dónde se calcula hoy el retorno del inversionista,
2. qué variables son configurables y cuáles están implícitas o ausentes,
3. cómo debe reestructurarse el prospecto para mostrar el puente completo: **bruto → costo kWh → margen bruto → aliado → neto → reparto inversionista/EVGreen → ROI/payback**.

## Corrección implementada y generación publicada

El 19 de agosto de 2026 se publicó el waterfall financiero canónico y se generó exitosamente una nueva versión del prospecto desde **Admin → Espacios** con estos parámetros configurables: tarifa de venta de `$1.800/kWh`, costo energético de `$700/kWh`, participación del aliado del `10 %` del margen bruto y reparto neto de `70 %` para inversionista / `30 %` para EVGreen.

El nuevo archivo generado es: `SPE-2026-0129-prospecto-9i657b.pdf`. El diálogo publicado confirmó visualmente que el aliado se aplica sobre el margen bruto y que el costo de energía está incluido como parámetro explícito.

La revisión visual del PDF confirmó el waterfall completo en cada escenario: ingreso bruto, costo de energía, margen bruto, aliado, margen neto, retorno mensual/anual del inversionista, ROI y recuperación. Esta primera regeneración tomó la potencia automática actual del espacio (`50 kW`). Para contrastar las cifras frente al documento original adjunto, que usaba el supuesto manual de `480 kW`, se debe regenerar una versión equivalente con esa potencia explícita; el cambio de potencia es un supuesto técnico, separado de la corrección financiera.

Se generó una segunda versión comparable con `480 kW`, conservando tarifa de `$1.800/kWh`, costo energético de `$700/kWh`, aliado `10 %` del margen bruto e Inversionista/EVGreen `70 % / 30 %` del margen neto. Archivo generado: `SPE-2026-0129-prospecto-mbuods.pdf`.

La página de proyección financiera fue revisada visualmente. Las cifras del escenario realista quedaron en: ingreso bruto mensual `$155.520.000`, costo energético `$60.480.000`, margen bruto `$95.040.000`, aliado `$9.504.000`, margen neto `$85.536.000`, retorno mensual del inversionista `$59.875.200`, retorno anual `$718.502.400`, ROI anual `71,9 %` y recuperación `1,4 años`. Los escenarios pesimista y optimista muestran el mismo puente y arrojan ROI de `47,9 %` y `107,8 %`, respectivamente.
