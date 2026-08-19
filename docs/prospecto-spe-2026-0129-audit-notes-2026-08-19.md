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
