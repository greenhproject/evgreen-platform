# Proyección comercial de ingresos en la ficha del aliado — 2026-10-12

## Objetivo
Agregar a la ficha PDF del aliado una sección clara de demanda e ingresos preliminares, sin exponer CAPEX, ROI, payback, waterfall, porcentajes del inversionista ni porcentajes de EVGreen.

## Criterio aprobado para implementación
La sección mostrará tres escenarios derivados del porcentaje EV realista registrado: pesimista (50% del supuesto base), realista (100%) y optimista (150%). Cuando el espacio tenga 10% EV, esto produce 5%, 10% y 15%, como en el ejemplo solicitado.

La proyección calculará vehículos EV potenciales por día, sesiones modeladas, mangueras/conectores teóricos, cargadores duales equivalentes, energía mensual, ingreso bruto mensual, margen bruto mensual y el supuesto preliminar del aliado sobre el margen bruto. La capacidad efectiva será el menor límite entre demanda, mangueras y potencia disponible.

## Límites de comunicación
- No incluir información de inversionistas, EVGreen, CAPEX, ROI, payback o waterfall.
- La participación del aliado se mostrará como supuesto preliminar configurable y sujeto al contrato, no como derecho adquirido.
- Usar precio de venta, costo de energía y eficiencia vigentes en parámetros de plataforma; si no existen, aplicar defaults existentes de EVGreen: 1.800 COP/kWh, 850 COP/kWh y 92%.
- Mantener 30 días por mes, 40 kWh por sesión y 20,1 sesiones por manguera/día como benchmarks explícitos.
- No presentar los ingresos como garantía ni incluir gastos fijos no informados.

## Validación completada
- [x] Implementar modelo compartido y render de página en PDF.
- [x] Extender pruebas del contenido y de escenarios: 11 pruebas focales exitosas.
- [x] Generar PDF real de SPE-2026-0005: 7 páginas, con página final de galería no vacía, y escaneo sin términos reservados.
- [x] Ejecutar `pnpm check` exitoso y `pnpm build` exitoso.
- [x] Guardar checkpoint WebDev y hacer push obligatorio a GitHub.
