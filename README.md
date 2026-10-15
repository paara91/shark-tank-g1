# Shark Tank G1 — Comité de Innovación (Postobón)

Herramienta web para que los miembros del Comité de Innovación voten, desde su
celular y justo después de cada pitch, qué hacer con cada iniciativa
(**Priorizar / Resolver barreras / Descartar**), mientras una pantalla
proyectada muestra el avance y, al final, los resultados.

> **Estado: demostración** con iniciativas simuladas, hecha para justificar una
> versión formal. Ver [Pendientes de seguridad](#pendientes-de-seguridad-dejados-a-propósito)
> **antes** de usarla con información real o de exponerla fuera de un grupo
> reducido y de confianza.

## Cómo funciona

1. El **facilitador** entra con su clave, carga la lista de iniciativas y da
   "Iniciar sesión".
2. Cada participante entra al enlace, elige su rol (Presidente, VPs, COE,
   Gestión de Riesgos, Invitado) y ve **una iniciativa a la vez**, con los 4
   criterios de referencia (Impacto potencial, Relación beneficio–recursos,
   Contribución estratégica, Viabilidad). Vota una de las 3 opciones.
3. Nadie ve resultados hasta el final. El facilitador avanza de iniciativa y,
   al terminar, abre el **reveal**: conteo y porcentaje de votos por opción,
   decisión final y notas de la discusión por iniciativa.
4. Se descarga un **Excel** (hoja "Resumen por iniciativa" y hoja "Detalle por
   VP", incluidas las notas).
5. "Nueva ronda" borra iniciativas, votos y decisiones **y desconecta a los VPs
   e invitados** (cada ronda es una sesión distinta). "Vaciar sala" solo
   desconecta participantes.

Los cambios llegan a todos los celulares en tiempo real (websocket de Supabase),
sin recargar.

## Direcciones de la aplicación

| Dirección | Para qué |
|---|---|
| `/` | Entrada general: "Selecciona tu rol". |
| `/?vp=<id>` | Enlace personal de un rol (ej. `?vp=presidente`, `?vp=ventas`). Entra directo. |
| `/?modo=proyeccion` | Pantalla del salón (solo lectura, letra grande): código QR de espera → avance de la votación → resultados. |

Los `id` válidos están en la tabla `vp_directorio`.

## Estructura del proyecto

```
index.html          Página única (carga todo lo demás)
css/styles.css      Estilos
js/app.js           Toda la lógica (roles, votación, facilitador, proyección, Excel)
js/config.js        URL y clave pública ("anon key") de Supabase
js/vendor/          Librerías incluidas en el repositorio (sin CDN):
                    supabase.js, xlsx.js (SheetJS), qrcode.js
fonts/              Tipografía Montserrat (incluida, sin Google Fonts)
schema.sql          Script para crear la base de datos en un proyecto Supabase nuevo
seed-vps.example.sql  Plantilla para cambiar/cargar los roles
```

No hay paso de compilación ni dependencias de npm: son archivos estáticos.

## Despliegue (para TI)

**Qué se despliega:** la carpeta del repositorio completa, servida como sitio
estático (cualquier servidor web: IIS, nginx, Apache, GitHub Pages, etc.). No
es un único HTML: `index.html` necesita `css/`, `js/` y `fonts/` al lado.

**Requisitos de red:**
- Los celulares y la pantalla del salón deben poder llegar al sitio por **HTTPS**.
- Desde esos mismos dispositivos debe estar permitida la salida a
  **`https://*.supabase.co`** y **`wss://*.supabase.co`** (WebSocket). Sin
  WebSocket la votación funciona pero los celulares no se actualizan solos.
- Si se aplica una política CSP estricta: `connect-src https://*.supabase.co
  wss://*.supabase.co`, `img-src data:` (el logo va incrustado) y
  `style-src 'unsafe-inline'`.
- El código QR se genera con la dirección real desde la que se abre la
  pantalla de proyección; abrirla siempre desde la URL pública definitiva.

**Base de datos (Supabase):**
1. Crear un proyecto en Supabase (idealmente en una **cuenta corporativa**).
2. Ejecutar `schema.sql` en el *SQL Editor*.
3. Editar `js/config.js` con la *Project URL* y la *anon public key* del nuevo
   proyecto. **No** poner nunca en el código la clave `service_role` ni la
   contraseña de la base de datos.

**Mantenimiento:** el plan gratuito de Supabase **pausa el proyecto tras ~1
semana sin actividad** (el sitio mostrará "No se pudo cargar el directorio de
VPs · Failed to fetch"). Se reactiva con "Restore project" en el panel de
Supabase. Antes de cada Comité: abrir la app unos días antes, o usar un plan de
pago.

## Uso el día del Comité (guía corta)

1. **Antes:** abre la app para confirmar que carga (si está pausada, reactívala
   en Supabase). Entra como facilitador y, si hay datos de pruebas, usa
   "Vaciar sala" / "Nueva ronda".
2. **Pantalla del salón:** en el computador conectado al proyector abre
   `…/?modo=proyeccion`. Muestra el QR y quiénes se van conectando.
3. **Participantes:** escanean el QR (o abren su enlace personal) y eligen su rol.
4. **Facilitador:** carga las iniciativas, revisa que estén conectados, "Iniciar
   sesión". Tras cada pitch, espera a que respondan y pasa a "Siguiente
   iniciativa". La pantalla del salón muestra quién ya respondió.
5. **Al final:** "Ver reveal". Marca la decisión final de cada iniciativa y
   escribe las notas de la discusión (se guardan al salir del cuadro de texto).
6. **Descargar Excel** antes de "Nueva ronda" — esa acción borra los datos de
   la ronda y no se puede deshacer.

## Pendientes de seguridad (dejados a propósito)

Por decisión del área, esto es una demostración y **no se invirtió tiempo en
asegurarla**. Lo siguiente queda sin resolver y debe atenderse en la versión
formal:

1. **Sin autenticación.** Cualquiera que tenga el enlace entra y puede elegir
   cualquier rol, incluido el de otro VP o el Presidente. Un rol ya ocupado
   comparte la misma identidad: quien lo elija después puede votar en su lugar.
   No se verifica quién es la persona.
2. **Base de datos abierta.** La seguridad por filas (RLS) de Supabase está
   **desactivada** en todas las tablas y la *anon key* está en el código
   público. Cualquiera puede leer, modificar o borrar todos los datos
   llamando directamente a la API de Supabase, sin pasar por la aplicación.
3. **La clave del facilitador (`IDEAR`) está escrita en `js/app.js`.** Es solo
   un freno contra clics accidentales; el código corre en el navegador y
   cualquiera puede leerla. No es un control de seguridad.
4. **Los resultados no están realmente ocultos antes del reveal.** Que nadie
   los vea durante la votación es solo una decisión de interfaz; los votos ya
   están en la base y se pueden consultar por la API.
5. **Votos sin trazabilidad.** No hay registro de auditoría ni protección
   contra manipulación; el facilitador (y cualquiera con acceso a la API) ve
   quién votó qué, y los votos se pueden editar o borrar.
6. **Borrados sin protección real.** "Nueva ronda" y "Vaciar sala" solo piden
   una confirmación del navegador; no hay respaldo ni forma de deshacer.
7. **Sin validación del lado del servidor** (longitud y contenido de nombres de
   iniciativas, nombres de invitados y notas). El texto se escapa al mostrarlo,
   pero la base acepta cualquier valor.
8. **Infraestructura de demostración:** proyecto Supabase en una cuenta
   personal y plan gratuito (se pausa por inactividad), sin copias de
   seguridad, sin monitoreo, sin límites de uso, sin pruebas automatizadas.
9. **Tablas con columnas heredadas** (en el proyecto de demostración original:
   `votos.i1–i4` y `estado_sesion.horizon_*`, de versiones anteriores del
   modelo). La app no las usa; `schema.sql` ya no las incluye.

## Historial del modelo de calificación

La primera versión pedía calificar 4 criterios de 1 a 5 y ubicaba cada
iniciativa en un plano Atractivo/Viabilidad (con cuadrantes sugeridos). Por
decisión del Comité se reemplazó por la votación directa de 3 opciones, y el
mix de horizonte (meta 70/20/10) se retiró "por ahora". El código anterior
sigue en el historial de git por si se retoma.
