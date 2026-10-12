# Ficha del aliado: mostrar únicamente su estimación mensual — 2026-10-12

## Objetivo
Ajustar la página de proyección comercial del PDF del aliado para que no muestre ingreso bruto, margen bruto, precio de venta, costo energético ni el porcentaje interno usado para obtener la estimación. El aliado verá directamente la estimación mensual que le corresponde en cada escenario, junto con los indicadores operativos que explican la demanda.

## Criterio de presentación
El modelo interno conservará los cálculos necesarios para producir la cifra del aliado, pero el PDF presentará únicamente: adopción EV, vehículos EV por día, sesiones atendidas, mangueras, cargadores duales, energía mensual y estimación mensual para el aliado. La nota metodológica se reemplazará por una explicación neutral de demanda, capacidad y validación contractual, sin mencionar ingreso bruto ni margen bruto.

## Validación completada
La tabla del PDF ahora conserva únicamente indicadores de demanda/capacidad y `Valor estimado para el aliado/mes`. Se retiraron del contenido visible el ingreso bruto, el margen bruto, el precio de venta, el costo energético y el porcentaje interno utilizado por el modelo. El cálculo interno permanece intacto para conservar consistencia matemática.

Se agregaron pruebas de regresión para bloquear esos textos en la divulgación de la proyección. El PDF de control generado tuvo 6 páginas, terminó con una página de galería con contenido, mostró los tres escenarios y pasó el escaneo sin valores upstream visibles. También pasaron `pnpm check`, 12 pruebas focales y `pnpm build`.

Checkpoint WebDev y push obligatorio a GitHub quedan realizados al cierre de esta tarea.
