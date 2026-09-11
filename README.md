# Kingdom of Saint-Dié

App privada para dos: Alejandro (ES) y Aline (FR). Un reino cooperativo que
crece cuando registráis cosas de la vida real. Un solo fichero estático + un
par de scripts. Sin build, sin framework, sin analytics.

## Ficheros

| Fichero | Qué es |
|---|---|
| `index.html` | La app entera (lógica de juego, textos es/fr/en, 4 pantallas, ajustes). |
| `map-engine.js` | Motor del mapa del reino: mundo continuo toroidal, se hornea a un canvas. |
| `supabase-client.js` | Cliente de Supabase. Dormido hasta que pongas credenciales. |
| `sw.js` + `manifest.webmanifest` + `icons/` | PWA (instalable, funciona offline). |
| `schema.sql` | Esquema de Supabase con RLS, borrado a 7 días y vista de prosperidad. |
| `village-demo.html` | Demo suelto del mapa con barra de prosperidad y botón día/noche. |
| `assets/Tiny Swords/…` | Arte del mapa (CC-BY, Pixel Frog). Los packs Kenney y Sprout Lands ya no se usan. |
| `STATUS.md` | Estado del trabajo y decisiones tomadas. |

## Probar en local

```
cd "Kingdom of Saint-Dié"
python3 -m http.server 8000
```

- App: <http://localhost:8000/>
- Demo del mapa: <http://localhost:8000/village-demo.html>

(Ábrelo por `http://`, no por `file://`: el mapa carga PNGs y el service
worker necesita un origen.)

Sin credenciales de Supabase la app corre en **modo local**: todo funciona
en este dispositivo con estado en memoria, para validar el diseño. El
recuadro "ESTO ESTÁ A MEDIAS" sale una vez y se descarta para siempre.

## Conectar Supabase (cuando queráis que sea de verdad)

1. Crea el proyecto en supabase.com.
2. Database → Extensions → activa **pg_cron**.
3. SQL Editor → pega y ejecuta `schema.sql` entero.
4. Authentication → Users → crea **dos** usuarios (email + contraseña).
5. SQL Editor → inserta las dos filas de perfil (usa los `id` de esos usuarios):

   ```sql
   insert into profiles (id, name, lang, avatar) values
     ('<uuid-de-alejandro>', 'Alejandro', 'es', '🤴'),
     ('<uuid-de-aline>',     'Aline',     'fr', '👸');
   ```

6. Settings → API → copia **Project URL** y **anon public key**.
7. En `index.html`, arriba del todo:

   ```js
   window.SUPABASE_URL = 'https://xxxx.supabase.co';
   window.SUPABASE_ANON_KEY = 'eyJhbGc...';
   ```

   La clave anon es pública por diseño: lo que protege los datos son las
   políticas RLS de `schema.sql`, no esconder la clave.

8. Recarga. Saldrá una pantalla de entrada; cada uno entra con su email.
   A partir de ahí: idioma y "quién eres" vienen del perfil, las hazañas /
   mensajes / encargos se guardan en Supabase y aparecen en el otro móvil
   por Realtime.

### Nota sobre la prosperidad

La vista `prosperity` suma los puntos **desde el lunes** (temporada semanal:
cada lunes el reino "renace"). Si preferís una ventana móvil de 7 días
(el reino se apaga poco a poco), cambiad una línea — está comentado en
`schema.sql`.

## Ajustes (⚙️ arriba a la derecha)

Editable sin tocar código, persiste en este dispositivo (`localStorage`):

- **Idioma** y **ver la app como** (en modo Supabase esto lo fija el perfil).
- **Foco de la temporada**: los dos atributos que valen ×1,5.
- **Tareas y puntos**: el valor de cada tarea. 0 = ocultarla.
- **El cofre**: las recompensas posibles, una por línea.
- Botón para restablecer valores de fábrica.

## PWA

Manifest + service worker + iconos (corona ámbar sobre índigo) listos.
Se instala desde el navegador ("Añadir a pantalla de inicio"). Offline
funciona con lo cacheado. **No desplegado**: súbelo a GitHub Pages (u otro
estático) cuando quieras.

## Pendiente / a validar por vosotros

- Revisar el mapa a fondo en el navegador (arrastre con inercia, brillo de
  ventanas de noche, que el borde envuelva sin corte).
- Ajustar tareas, puntos, Foco y cofre a lo que de verdad hacéis.
- Conectar Supabase y probar el Realtime entre dos móviles.
- Decidir temporada semanal vs. ventana móvil de 7 días.
- **Push notifications**: dejadas para el final. Requieren iOS 16.4+ y la
  PWA en pantalla de inicio. El Realtime en pantalla ya cubre la experiencia.

## Créditos de arte

- Mapa: **Tiny Swords** de Pixel Frog — CC-BY 4.0.
- (Packs Kenney y Sprout Lands quedaron sin usar; se pueden borrar de `assets/`.)
