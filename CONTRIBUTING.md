# Cómo trabajamos en este repositorio

Guía corta para mantener el repo ordenado a medida que crece — aplica tanto a
desarrollo manual como a agentes (Manus, Claude, etc.) que hagan commits aquí.
Ver también la nota de mobile al inicio de `todo.md` antes de tocar `ios/`,
`android/` o `capacitor.config.ts`.

Este documento cubre el flujo de trabajo día a día. Para roles, protección de
`main` y quién aprueba qué, ver [`GOBERNANZA.md`](GOBERNANZA.md) — es política
obligatoria, no opcional.

## Ramas

- **`main`** es la única rama de larga duración. Siempre debe compilar y
  pasar `tsc --noEmit`. Railway despliega automáticamente en cada push a
  `main` — un push roto aquí es un despliegue roto.
- Todo lo demás vive en ramas **cortas y desechables**, con este formato
  exacto: `<tipo>/<slug-en-minusculas-con-guiones>` — nunca camelCase, nunca
  `snake_case`, nunca espacios. El slug describe la tarea en 2-5 palabras.

  | Tipo | Cuándo se usa | Ejemplo |
  |---|---|---|
  | `feature/<slug>` | Funcionalidad nueva | `feature/wallet-recharge-yape` |
  | `fix/<slug>` | Corrección de bug (no crítico, no ya publicado) | `fix/login-state-mismatch-android` |
  | `hotfix/<slug>` | Bug crítico en una versión **ya enviada a una tienda** — se corta desde el tag de esa tienda, no desde `main` (ver `GOBERNANZA.md` §2 y §5) | `hotfix/wompi-double-charge` |
  | `chore/<slug>` | Versionado, dependencias, config, limpieza | `chore/bump-version-1-4-0` |
  | `docs/<slug>` | Solo documentación, sin tocar código | `docs/gobernanza-modo-incidente` |
  | `refactor/<slug>` | Reestructurar código sin cambiar comportamiento | `refactor/map-marker-cleanup` |
  | `test/<slug>` | Agregar o corregir tests, sin tocar lógica de producción | `test/auth0-callback-state` |
  | `revert/<slug>` | Deshacer un cambio previo que resultó riesgoso o incorrecto | `revert/mobile-login-state-tolerance` |

  Esta lista es completa — no se inventan tipos nuevos sobre la marcha. Si una
  tarea no encaja claramente en ninguno, es señal de que hay que partirla en
  tareas más chicas.
- Esas ramas se crean desde el último `main`, se fusionan **vía Pull Request**
  (no `git merge` + push directo, aunque todavía no esté activo el aprobador
  obligatorio de `GOBERNANZA.md` §3 — se adopta el hábito desde ya), y **se
  borran inmediatamente después de fusionar** (`git push origin --delete
  <rama>`). Una rama que sigue existiendo una semana después de fusionada es
  basura acumulándose — este repo llegó a tener 12 ramas remotas así antes de
  esta limpieza.
- **Nunca** crear ramas `backup/*` o `*-backup-*` como forma de "guardar por
  si acaso" antes de un cambio riesgoso. Para eso existen los **tags** (ver
  abajo) — no ensucian la lista de ramas y cumplen el mismo propósito de
  punto de restauración.
- No crear ramas de "integración" de larga duración (`integration/*`,
  `merge/*`) para ir acumulando trabajo de varias fuentes. Si dos líneas de
  trabajo necesitan juntarse, se hace la fusión directamente y se borran las
  ramas de origen — no se deja una tercera rama viviendo indefinidamente.

## Tags de versión

Cada vez que se sube una versión a una tienda (App Store, Play Store,
AppGallery), se etiqueta el commit exacto:

```bash
git tag v1.3.1
git push origin v1.3.1
```

Esto es lo único que responde con certeza "¿qué commit es el que está
publicado ahora mismo" — antes de esto no existía ni un solo tag en el repo,
lo que hacía imposible hacer rollback con confianza.

## Versionado

`package.json` → `"version"` es la única fuente de verdad. Antes de subir un
build a cualquier tienda, correr:

```bash
node scripts/bump-version.mjs <patch|minor|major>
```

Esto propaga la versión a Android (`versionName` + `versionCode +1`) e iOS
(`MARKETING_VERSION` + `CURRENT_PROJECT_VERSION +1`) automáticamente. No
editar esos archivos a mano.

## Cambios que tocan mobile

Cualquier cambio en `ios/`, `android/`, `capacitor.config.ts`, o ajustes de
safe-area/viewport, afecta builds ya publicados en las tiendas. Revisar con
el encargado de mobile antes de fusionar a `main`.

## Housekeeping mensual

Al cierre de cada mes de contrato (coincide con la reunión de seguimiento
mensual), revisar:
- ramas ya fusionadas a `main` que sigan sin borrar
- ramas sin actividad hace más de 2 semanas — o se retoman o se borran
- que la versión en `package.json` tenga su tag correspondiente si se publicó
