# Mejora: programa solar 0 inversión para aliados

Fecha: 2026-10-12
Estado: Completado

## Objetivo

Incorporar al módulo de espacios un programa solar opcional que permita registrar un ahorro estimado sobre la factura energética del aliado, modelar el acuerdo temporal de sustitución de gasto y mostrar el beneficio combinado con la estación de carga en la ficha PDF del aliado.

## Alcance

- [x] Persistir activación y supuestos del programa solar en base de datos productiva.
- [x] Añadir los campos al formulario de creación y edición administrativa en Spaces.tsx.
- [x] Permitir cargar una oferta solar PDF opcional y conservarla en almacenamiento S3.
- [x] Anexar la oferta solar al PDF de la ficha del aliado cuando exista (validado con 23 páginas).
- [x] Calcular ahorro mensual, ahorro anual, escalamiento por IPC durante el acuerdo y beneficio combinado con carga.
- [x] Mostrar resumen ejecutivo, escenarios y advertencias contractuales en la ficha del aliado.
- [x] Crear pruebas de modelo, PDF, persistencia y anexos.
- [x] Ejecutar check, pruebas, build, checkpoint y push obligatorio.

## Criterios financieros y editoriales

- El ahorro solar se presenta como estimación preliminar de reducción de gasto, no como ingreso garantizado.
- La cuota de sustitución de gasto se modela con IPC anual configurable y plazo inicial de 6 años.
- La cesión de equipos y la energía posterior al acuerdo se presentan como intención/beneficio sujeto a contrato, ingeniería, generación y consumo reales.
- El PDF del aliado no muestra CAPEX, ROI, payback, waterfall, ingreso bruto, margen bruto ni porcentajes internos de distribución.
- El consumo cruzado en comercios cercanos permanece como oportunidad potencial, no como ingreso garantizado.

## QA ejecutado

- `pnpm check`: sin errores de TypeScript.
- Pruebas unitarias focales: 10/10 pruebas pasadas en `server/ally-solar-program.test.ts`, `server/spaces/ally-space-pdf-service.test.ts` y `server/ally-space-income-projection.test.ts`.
- `pnpm build`: exitoso en 47.50s.
- Auditoría visual de PDF real: página 7 con tarjetas de ahorro, detalle del acuerdo y beneficio combinado referencial de año 1 ($17.751.264 mensual / $213.015.168 anual). Concatenación con la oferta PDF de ejemplo de EDS Campín completada (23 páginas totales).
