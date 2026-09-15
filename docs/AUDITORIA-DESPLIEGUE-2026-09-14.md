# Auditoría del despliegue — JCAR Labs

Fecha: 14 de septiembre de 2026 (America/Lima). Sitio revisado: https://jcarlabs-inc.vercel.app/

## Resultado

Se reprodujo la pantalla negra al navegar de Inicio a Servicios en el sitio publicado. El navegador mostró `TypeError: Failed to fetch` en el módulo del CMS `Ejo4jvBE8.C8-ozr_f.mjs`, seguido de `Fatal error` de Framer y una página sin contenido visible. Las rutas y los documentos estáticos sí existen.

La corrección está aplicada en el proyecto local y compilada en `dist`. **No se ha publicado un nuevo despliegue.** La comprobación visual posterior al cambio queda pendiente: el navegador integrado agotó el tiempo al abrir la vista local. Esto no se cuenta como una prueba visual aprobada.

## Hallazgos y correcciones

### P1 — El transporte del CMS se activaba solo en localhost

Los HTML internos contenían `data-local-cms-fetch`, con una salida inmediata si el hostname no era `localhost` o `127.0.0.1`. Los módulos conservan URLs del CMS original en `framerusercontent.com`. En Vercel se intentaba cargar ese origen externo en lugar de las copias incluidas en el proyecto. La política CSP configurada tampoco autoriza ese hostname exacto en `connect-src` (el comodín de subdominios no incluye el dominio raíz).

Se añadió `src/lib/cms-fetch.mjs`, inyectado durante el build antes de Framer en todas las páginas. Redirige únicamente los cuatro archivos CMS conocidos, conserva los rangos solicitados y las opciones de la petición, y funciona en cualquier dominio. Se eliminaron los adaptadores antiguos de los HTML y del sanitizador. Se mantienen los diseños, estilos y animaciones existentes.

### P1 — La regla de reescritura no procesaba los rangos en Vercel

Mediciones sobre el despliegue público:

| Petición | HTTP | Bytes recibidos |
|---|---|---:|
| `/assets/cms/Ejo4jvBE8-indexes-default-0.framercms?range=0-144` | 200 | 28.057 |
| `/api/framercms?file=Ejo4jvBE8-indexes-default-0.framercms&range=0-144` | 200 | 145 |

Vercel prioriza los archivos existentes sobre `rewrites`; por eso la ruta estática devolvía el archivo completo. Este comportamiento está documentado en [la configuración oficial de Vercel](https://vercel.com/docs/project-configuration/vercel-json#rewrites).

El navegador ahora llama directamente a `/api/framercms?file=...&range=...`. Se retiró la regla inefectiva y se incorporó la misma URL al servidor local y al middleware de desarrollo. La función y sus controles de rangos permanecen activos.

### P2 — Diferencias entre el HTML inicial y la hidratación de Framer

La portada publicada registró avisos recuperables de React (`418`, `422`). También apareció `405` durante la navegación; el bundle contiene un intento de hidratar `__framer-badge-container`, cuyo contenedor puede estar ausente. Son incidencias adicionales del runtime exportado; el fallo fatal identificado en Servicios fue la carga del CMS.

Queda como mejora posterior al incidente sincronizar el HTML corporativo con los componentes que hidrata Framer y retirar de forma controlada el arranque del badge. No se modificó el bundle del proveedor ni se alteró la apariencia para abordar estos avisos.

## Verificación realizada

- `pnpm.cmd run test`: **35 pruebas aprobadas**, incluidas las pruebas previas.
- `pnpm.cmd run build:vercel`: **15 páginas**, sin errores, advertencias ni sugerencias del chequeo de Astro.
- Pruebas de ambos transportes HTTP: rangos únicos y múltiples, igualdad exacta de bytes, `HEAD`, rangos inválidos y rechazo de nombres con traversal.
- Pruebas del adaptador: hostname de Vercel, dominio propio y dos direcciones locales; entrada `Request`, encabezados, señal de cancelación y conservación de peticiones ajenas al CMS.
- Se ejecutó el script realmente emitido en cada uno de los **15 HTML de dist** en un contexto con origen de producción; todos dirigieron la petición al endpoint correcto.
- Se comprobaron las referencias `src`/`href` a recursos locales de `assets` en los HTML generados.
- `node scripts/verify-dist.mjs`: aprobada la comprobación de marca disponible en el proyecto.
- Alcance: diagnóstico del incidente, rutas, build, transporte de datos y comprobaciones automatizadas. No constituye una auditoría exhaustiva de accesibilidad, rendimiento o seguridad.

## Publicación y aceptación pendientes

1. Incluir los cambios y los archivos nuevos en el repositorio conectado a Vercel; ejecutar un nuevo despliegue con `pnpm run build:vercel`, salida `dist` y la función `api/framercms.js`.
2. Abrir Inicio, Servicios, los cinco detalles de servicio, Proyectos, los tres detalles de proyecto, Contacto y las dos páginas legales. Probar acceso directo, recarga y navegación por enlaces, tanto en escritorio como en móvil.
3. En Network, verificar que el CMS solicita `/api/framercms`, devuelve HTTP 200 y no consulta el CMS externo. El rango `0-144` del índice debe devolver exactamente 145 bytes.
4. Confirmar que ninguna página queda vacía y que no aparece el error fatal de carga del CMS. Separar los avisos recuperables de hidratación descritos arriba de este criterio.

Publicar únicamente `dist` en un alojamiento estático sin la función de CMS no reproduce la arquitectura de este proyecto. Los rangos de Framer necesitan el endpoint HTTP correspondiente.
