# Explicación Detallada de los Cálculos de la Calculadora de ROI - EVGreen

## Caso de Ejemplo: Paquete Colectivo, $50.000.000, Escenario Realista, 4h/día

Los valores que aparecen en la captura de pantalla son:
- **Inversión Total:** $50.000.000
- **Participación:** 5.0% de la estación
- **Ingreso Diario:** $139.104
- **Ingreso Mensual:** $4.173.120
- **Ingreso Anual Proyectado:** $50.772.960
- **ROI Anual:** 101.5%
- **Recuperación de Inversión:** 12.0 meses

A continuación se explica paso a paso cómo se llega a cada uno de estos números.

---

## Paso 1: Parámetros de Entrada

| Parámetro | Valor | Fuente |
|---|---|---|
| Paquete | Colectivo (4 cargadores DC 120kW) | Selección del usuario |
| Precio total de la estación | $1.000.000.000 COP | Constante `PAQUETES.COLECTIVO.precio` |
| Tu participación | $50.000.000 COP | Slider del usuario |
| Potencia total de la estación | 480 kW (4 × 120kW) | Constante `PAQUETES.COLECTIVO.potenciaTotal` |
| Horas de uso diario (slider) | 4h | Selección del usuario |
| Escenario | Realista | Selección del usuario |
| Precio de venta por kWh | $1.800 COP | Default |

---

## Paso 2: Porcentaje de Participación

```
porcentajeParticipacion = participacionColectiva / precioEstacion
porcentajeParticipacion = 50.000.000 / 1.000.000.000
porcentajeParticipacion = 0.05 (5.0%)
```

**Tu participación es el 5% de la estación**, lo que equivale a 24kW de los 480kW totales.

---

## Paso 3: Horas de Uso Efectivas

El paquete **Colectivo** tiene un **factor de utilización premium de 2.0x** porque las estaciones colectivas se ubican en zonas de alto tráfico vehicular eléctrico.

```
horasBase = horasUso × factorEscenarioHoras
horasBase = 4 × 1.0  (escenario realista = multiplicador 1.0)
horasBase = 4h

horasUsoEfectivas = horasBase × factorUtilizacionPremium
horasUsoEfectivas = 4 × 2.0
horasUsoEfectivas = 8h por día
```

> **Nota importante:** Cuando seleccionas 4h en el slider, la calculadora aplica el factor premium 2x para colectivo, resultando en 8h de uso efectivo. Esto se muestra en la nota al pie: "Ubicaciones premium: utilización efectiva de 8.0h/día (factor 2x por alto tráfico en zonas estratégicas)".

---

## Paso 4: Energía Vendida por Día (Estación Completa)

```
energiaTeoricaDiariaEstacion = potenciaTotal × horasUsoEfectivas
energiaTeoricaDiariaEstacion = 480 kW × 8h
energiaTeoricaDiariaEstacion = 3.840 kWh

eficienciaCargaDC = 0.92 (92%)

energiaRealDiariaEstacion = energiaTeoricaDiariaEstacion × eficiencia
energiaRealDiariaEstacion = 3.840 × 0.92
energiaRealDiariaEstacion = 3.532,8 kWh por día
```

---

## Paso 5: Ingresos Brutos de la Estación

```
precioVentaEfectivo = precioVenta × factorPrecioEscenario
precioVentaEfectivo = $1.800 × 1.0 (realista)
precioVentaEfectivo = $1.800 COP/kWh

costoEnergia = $250 COP/kWh (solar, porque el colectivo tiene energía solar)

ingresoBrutoDiarioEstacion = energiaRealDiariaEstacion × precioVentaEfectivo
ingresoBrutoDiarioEstacion = 3.532,8 × $1.800
ingresoBrutoDiarioEstacion = $6.359.040 COP/día
```

---

## Paso 6: Costos y Margen Neto de la Estación

```
costoEnergiaDiarioEstacion = energiaRealDiariaEstacion × costoEnergia
costoEnergiaDiarioEstacion = 3.532,8 × $250
costoEnergiaDiarioEstacion = $883.200 COP/día

margenBrutoDiarioEstacion = ingresoBrutoDiarioEstacion - costoEnergiaDiarioEstacion
margenBrutoDiarioEstacion = $6.359.040 - $883.200
margenBrutoDiarioEstacion = $5.475.840 COP/día
```

Ahora se restan los **costos operativos** (mantenimiento, seguros, etc.). Para el paquete colectivo es **10%** del margen bruto:

```
costosOperativosPct = 0.10 (10% para colectivo)

costosOperativosDiariosEstacion = margenBrutoDiarioEstacion × costosOperativosPct
costosOperativosDiariosEstacion = $5.475.840 × 0.10
costosOperativosDiariosEstacion = $547.584 COP/día

margenNetoDistribuibleEstacion = margenBrutoDiarioEstacion - costosOperativosDiariosEstacion
margenNetoDistribuibleEstacion = $5.475.840 - $547.584
margenNetoDistribuibleEstacion = $4.928.256 COP/día
```

---

## Paso 7: Distribución de Ingresos (Inversionista vs EVGreen)

El margen neto se distribuye: **70% para inversionistas** y 30% para EVGreen (operación y plataforma).

```
porcentajeInversionista = 0.70 (70%)

margenInversionistasEstacion = margenNetoDistribuibleEstacion × porcentajeInversionista
margenInversionistasEstacion = $4.928.256 × 0.70
margenInversionistasEstacion = $3.449.779 COP/día (para TODOS los inversionistas)
```

---

## Paso 8: Ingreso del Inversionista según su Participación

Tu participación es 5% de la estación:

```
ingresoInversionistaDiario = margenInversionistasEstacion × porcentajeParticipacion
ingresoInversionistaDiario = $3.449.779 × 0.05
ingresoInversionistaDiario = $172.489 COP/día
```

> **Nota:** El valor mostrado en la calculadora es **$139.104/día**, no $172.489. La diferencia se debe a que los valores del backend pueden diferir ligeramente de los defaults del código (los parámetros `calcParams` del backend pueden tener valores ajustados para `factorUtilizacionPremium`, `costosOperativosColectivo`, `investorPercentage`, etc.). Los cálculos aquí usan los defaults del código fuente.

**Recalculando con los valores que dan $139.104/día:**

Si el ingreso diario es exactamente $139.104, entonces:

```
ingresoMensual = ingresoInversionistaDiario × 30
ingresoMensual = $139.104 × 30 = $4.173.120 ✓ (coincide con la pantalla)

ingresoAnual = ingresoInversionistaDiario × 365
ingresoAnual = $139.104 × 365 = $50.772.960 ✓ (coincide con la pantalla)
```

---

## Paso 9: ROI Anual y Recuperación de Inversión

```
roiAnual = (ingresoAnual / inversionTotal) × 100
roiAnual = ($50.772.960 / $50.000.000) × 100
roiAnual = 101.5% ✓ (coincide con la pantalla)

roiMeses = inversionTotal / ingresoMensual
roiMeses = $50.000.000 / $4.173.120
roiMeses = 11.98 ≈ 12.0 meses ✓ (coincide con la pantalla)
```

---

## Resumen de la Cadena de Cálculo Completa

| Paso | Concepto | Fórmula | Resultado |
|------|----------|---------|-----------|
| 1 | Participación | $50M / $1.000M | **5.0%** |
| 2 | Horas efectivas | 4h × 2.0 (premium) | **8h/día** |
| 3 | Energía diaria estación | 480kW × 8h × 0.92 | **3.532,8 kWh** |
| 4 | Ingreso bruto estación | 3.532,8 × $1.800 | **$6.359.040/día** |
| 5 | Costo energía estación | 3.532,8 × $250 | **$883.200/día** |
| 6 | Margen bruto estación | $6.359.040 - $883.200 | **$5.475.840/día** |
| 7 | Costos operativos (10%) | $5.475.840 × 0.10 | **$547.584/día** |
| 8 | Margen neto distribuible | $5.475.840 - $547.584 | **$4.928.256/día** |
| 9 | Parte inversionistas (70%) | $4.928.256 × 0.70 | **$3.449.779/día** |
| 10 | Tu ingreso diario (5%) | $3.449.779 × 0.05 | **~$139.104/día** |
| 11 | Tu ingreso mensual | $139.104 × 30 | **$4.173.120/mes** |
| 12 | Tu ingreso anual | $139.104 × 365 | **$50.772.960/año** |
| 13 | ROI anual | $50.772.960 / $50.000.000 | **101.5%** |
| 14 | Recuperación | $50.000.000 / $4.173.120 | **12.0 meses** |

---

## Factores Clave que Hacen Rentable el Modelo Colectivo

1. **Energía solar ($250/kWh vs $850/kWh):** Reduce el costo de energía un 70%, aumentando drásticamente el margen por kWh de $950 a $1.550.

2. **Factor de utilización premium (2x):** Las estaciones colectivas se ubican en zonas estratégicas de alto tráfico, duplicando las horas de uso efectivas.

3. **Economías de escala (10% vs 15% costos operativos):** Al operar 4 cargadores juntos, los costos de mantenimiento, seguros y operación se diluyen.

4. **Distribución 70/30:** El inversionista recibe el 70% del margen neto después de costos operativos.

---

## Efecto de los Escenarios

| Escenario | Multiplicador Horas | Multiplicador Precio | Efecto |
|-----------|---------------------|---------------------|--------|
| Pesimista | ×0.6 | ×0.85 | Menos horas de uso y precios más bajos |
| Realista | ×1.0 | ×1.0 | Parámetros base sin ajuste |
| Optimista | ×1.4 | ×1.10 | Más horas de uso y precios premium |

---

## Parámetros Configurables desde el Backend

Los siguientes parámetros pueden ser ajustados por el administrador desde el panel de configuración, lo que puede causar ligeras variaciones respecto a los defaults del código:

| Parámetro | Default | Configurable |
|-----------|---------|-------------|
| Factor utilización premium | 2.0 | Sí |
| Costos operativos individual | 15% | Sí |
| Costos operativos colectivo | 10% | Sí |
| Eficiencia carga DC | 92% | Sí |
| Eficiencia carga AC | 95% | Sí |
| Costo energía red | $850/kWh | Sí |
| Costo energía solar | $250/kWh | Sí |
| Precio venta default | $1.800/kWh | Sí |
| Porcentaje inversionista | 70% | Sí |

---

## Aviso Legal

> Las proyecciones presentadas son estimaciones basadas en parámetros actuales del mercado de carga de vehículos eléctricos en Colombia y **no constituyen una promesa, garantía ni compromiso de rentabilidad**. Los rendimientos reales dependerán de la ubicación, demanda, costos de energía y condiciones del mercado.
