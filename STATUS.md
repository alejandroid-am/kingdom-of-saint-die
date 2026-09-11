# Estado del trabajo — Kingdom of Saint-Dié

_Sesión nocturna delegada. Nada publicado ni desplegado. Todo en local._

## Consignas seguidas
- Diseño UX/UI limpio, "como si lo hiciera Apple".
- Ecoconcepción: sin frameworks ni build, canvas que se dibuja bajo demanda
  (no hay bucle permanente), el mapa se pausa al salir de su pestaña,
  service worker con caché ligera, `prefers-reduced-motion` respetado en toda
  la app, sin analytics ni terceros.
- Accesibilidad: foco visible global, roles ARIA en diálogos y navegación,
  `aria-live` en las notificaciones, teclas de flecha para mover el mapa,
  Esc cierra hojas, áreas táctiles ≥40px, textos alternativos en botones-icono.
- Terminar en local. Validar mañana.

## Fases

- [x] **Mapa (`village-demo.html` + `map-engine.js`)** — mundo continuo toroidal,
  Tiny Swords, la prosperidad revela/apaga el pueblo, día/noche, ~18 easter eggs,
  etiquetas de zona. Pulido: sin costuras de textura (colores sólidos + mundo
  múltiplo de 64 + río periódico), **sin líneas rectas cruzadas** (campos = una
  mancha suave por zona, caminos = curvas Chaikin que salen curvando), antorchas
  solo en tierra junto al pueblo.
- [x] **Fusión en la app** — la pantalla 🏰 Reino usa el canvas del mapa; fuera
  el SVG, las clases `.bld`/`rise`/`twinkle`.
- [x] **Andamiaje fuera** — selector de idioma y selector "¿quién?" arriba,
  eliminados. El pie de "prototipo" ya no se usa. El recuadro "ESTO ESTÁ A
  MEDIAS" sale una vez y se descarta para siempre (`localStorage`).
- [x] **Pantalla de Ajustes** (⚙️) — idioma, ver-como, Foco (2 atributos),
  puntos por tarea (0 = ocultar), recompensas del cofre, reset. Persiste en local.
- [x] **Supabase** — `supabase-client.js` completo (auth, CRUD, Realtime,
  vista de prosperidad) + capa `Backend` en la app con degradado a modo local.
  Sign-in mínimo. **Falta**: crear el proyecto, ejecutar `schema.sql`, meter
  credenciales y probar entre dos móviles (ver README).
- [x] **PWA** — `manifest.webmanifest`, `sw.js`, iconos índigo+ámbar. Sin desplegar.
- [x] **Pasada de accesibilidad + UX** — ver "Consignas".
- [x] **README** — cómo probar, cómo conectar Supabase, qué queda por decidir.
- [ ] **Push notifications** — última prioridad, no hecho (a propósito). El
  Realtime en pantalla cubre la experiencia. Ver README.

## Verificación hecha
- Sintaxis de todos los `.js` y del HTML: OK.
- Prueba con jsdom (DOM real headless): la app arranca, el motor del mapa
  se inicializa y hornea, y funcionan navegación, hoja de ajustes con sus
  ediciones, registrar tarea, mensajes, cofre y día/noche **sin errores**.
- Render fiel del layout del mapa (PIL) a varias prosperidades: `village-demo.html`
  abierto en navegador es la validación que falta por tu parte.

## Decisiones tomadas (revisar)
- Assets del mapa: **solo Tiny Swords**. Kenney y Sprout Lands retirados.
- Sin recolorear tejados (paja tal cual).
- Campos = manchas de color suaves (sin surcos ni setos con línea): era lo que
  generaba el efecto rejilla / líneas cruzadas.
- `state.prosperity` deja de recortarse a la meta: es la suma real de hazañas y
  el mapa crece con ella. La barra llega al 100% en la meta y el cofre salta igual.
- Bug del prototipo corregido: `state.board`/`nextBoardId`/`unseenBoard`/`pickedStat`
  no estaban inicializados (la pantalla Tablón petaba). Ahora sí.
- `kingdom-of-saint-die.html` renombrado a **`index.html`** (GitHub Pages + PWA).
- `schema.sql`: añadido `security_invoker` + `grant` a la vista `prosperity`,
  y un comentario sobre temporada semanal vs. ventana de 7 días.
