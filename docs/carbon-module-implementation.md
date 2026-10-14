# Impacto ambiental y preauditoría de carbono — EVGreen

## Propósito y alcance

El módulo **Impacto y Bonos** conserva datos para el seguimiento ambiental, el análisis de viabilidad económica y la preparación de un expediente de preauditoría. No emite, lista, vende, transfiere ni retira créditos de carbono automáticamente.

> Un valor de tCO₂e en EVGreen es una **estimación interna** hasta que un programa certificador y un tercero independiente validen y verifiquen el proyecto. No debe presentarse como bono emitido, vendido o retirado.

## Libros de datos separados

| Libro | Fuente aceptada | Uso | Exclusión deliberada |
|---|---|---|---|
| Energía de carga | Sesiones OCPP con estado `COMPLETED` y kWh positivos | Base de consumo de la red | Sesiones activas, fallidas o canceladas |
| Generación solar | Lectura del inversor, medidor, factura u otra evidencia | Cálculo de energía solar asignable | Proyecciones de diseño y datos de simulación no medidos |
| Costos | Registro administrativo por concepto y periodicidad | Punto de equilibrio y proyección de neto | Pagos, facturas o ventas reales de créditos |
| Lotes | Período, evidencia y referencia externa | Expediente de revisión/certificación | No representa seriales ni créditos emitidos hasta capturarlos después de la verificación |

La energía solar asignable se calcula con la siguiente regla:

```text
kWh solares asignables = min(kWh de cargas completadas, kWh solares medidos y verificados)
tCO₂e estimadas = kWh solares asignables ÷ 1.000 × factor de acreditación solar vigente
```

Para impedir duplicidad, una lectura **verificada** exige referencia de evidencia y no puede solaparse con otra lectura verificada de la misma estación. El sistema no adjudica automáticamente proyecciones de OpenSolar ni permite que más generación solar se asigne que la energía efectivamente cargada.

## Factores y afirmaciones

Los factores se guardan con año, unidad, propósito y URL de la fuente. La configuración inicial conserva los valores de la Resolución UPME 000085 de 2026 para datos 2024:

| Propósito | Factor inicial | Uso en la plataforma |
|---|---:|---|
| Inventario GEI | 0,220 tCO₂e/MWh | Referencia de inventario, no se mezcla con créditos |
| Acreditación solar/eólica | 0,660 tCO₂e/MWh | Estimación solar de preauditoría |

La atribución de movilidad eléctrica frente a línea base fósil permanece **apagada**. Solo podrá activarse luego de documentar metodología aplicable, adicionalidad, elegibilidad, línea base, fuente del factor y el plan de monitoreo correspondiente.

## Señal económica de revisión

El panel anualiza costos fijos por su periodicidad y calcula:

```text
contribución neta/tCO₂e = precio estimado − comisión del registro − costo variable/tCO₂e
punto de equilibrio = costos fijos anualizados ÷ contribución neta/tCO₂e
neto proyectado = ingreso bruto − comisión − costos variables − costos fijos
```

La alerta **“Listo para revisión comercial”** solo se activa internamente cuando el expediente está configurado como `VERIFIED`, cubre el punto de equilibrio y alcanza el mínimo de tCO₂e definido. Aun así, requiere confirmar elegibilidad, registro y cualquier autorización comercial externa antes de listar o negociar un activo ambiental.

## Ruta de auditoría recomendada

1. Definir metodología aplicable con Cercarbono y confirmar la elegibilidad de agregación de estaciones EV.
2. Registrar el proyecto/iniciativa y su documentación de factibilidad/formulación según RENARE cuando aplique.
3. Cargar evidencia de medidores solares, período y responsable; verificar cada lectura en el panel.
4. Asegurar derecho de uso, no doble reclamación con REC u otros instrumentos y trazabilidad de cada estación.
5. Consolidar lotes por período, someterlos a validación/verificación independiente y registrar luego los IDs y seriales reales de la plataforma registral.
6. Solo después de emisión y transferencia confirmadas, registrar cantidades verificadas/emitidas/vendidas y documentación de soporte.

## Fuentes de referencia

- [UPME — Resolución 000085 de 2026](https://docs.upme.gov.co/Normatividad/085_2026.pdf)
- [Cercarbono — Metodologías](https://cercarbono.com/es/metodologias/)
- [Cercarbono — Protocolo de Certificación Voluntaria de Carbono v4.4](https://cercarbono.com/wp-content/uploads/Protocolo-de-Cercarbono-V-4.4.pdf)
- [Ministerio de Ambiente — RENARE](https://www.minambiente.gov.co/cambio-climatico-y-gestion-del-riesgo/renare/)
- [EcoRegistry](https://www.ecoregistry.io/)
- [Verra VM0038 — Electric Vehicle Charging Systems](https://verra.org/methodologies/vm0038-electric-vehicle-charging-systems-v1-1/)
- [GHG Protocol — Scope 2 Guidance](https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf)
