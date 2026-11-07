# Rincón Studio v27 — Publicación automática en YouTube

Cada 8 horas, GitHub Actions abre **esta misma app** en un Chrome sin pantalla, pulsa «Generar y descargar Short»,
verifica el vídeo con ffmpeg y lo sube a tu canal. No hace falta tener el móvil ni la página abierta.

```
cron (cada 8 h) → Chrome sin pantalla ejecuta la app → vídeo 1080×1920 → control de calidad (ffprobe)
→ MP4 H.264/AAC → YouTube Data API → memoria de temas guardada en el repo (no repite ideas)
```

La app (`app.js`) contiene las mejoras creativas y TTS de v28. El flujo de automatización y subida sigue en `automation/` y `.github/workflows/auto-short.yml`; se conservaron sus identificadores y horario.

## ⚠️ Antes de empezar: el límite de YouTube

Los vídeos subidos por API desde un proyecto de Google Cloud **sin auditar** quedan bloqueados como **privados**,
aunque pidas `public` (así lo indica la documentación de `videos.insert`). Para que salgan públicos hay que pasar la
auditoría «YouTube API Services – Audit and Quota Extension Form» (requiere describir la app y tener términos/política
de privacidad; tarda semanas y no está garantizada). No asumas que podrás cambiarlos a públicos a mano en Studio:
YouTube indica que esos bloqueos no se pueden apelar. Mientras tanto el sistema funciona, pero los vídeos serán privados.

## Configuración (una sola vez)

### 1. Subir el proyecto a GitHub
Crea un repositorio y sube **todo el contenido del ZIP** (incluida la carpeta oculta `.github`). Desde el móvil lo más
fiable es Termux o Codespaces, no la subida por web (suele omitir carpetas ocultas):

```
git init && git add . && git commit -m "Rincón Studio v27"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```
Repo público = minutos de Actions gratis e ilimitados. Repo privado = 2000 min/mes gratis; a 3 ejecuciones al día
podrías pasarte (no he medido cuánto tarda un render real en los servidores de GitHub).

### 2. Proyecto de Google Cloud y credenciales de YouTube
1. En console.cloud.google.com crea un proyecto y activa **YouTube Data API v3**.
2. Pantalla de consentimiento OAuth → tipo **Externo** → **Publicar la app («En producción»)**.
   Si la dejas en «Pruebas», el refresh token caduca a los 7 días y la automatización se detiene.
3. Credenciales → crear **ID de cliente OAuth** → tipo **Aplicación de escritorio**. Copia Client ID y Client Secret.

### 3. Obtener el refresh token (en Termux, una vez)
```
python automation/get-refresh-token.py TU_CLIENT_ID TU_CLIENT_SECRET
```
Abre el enlace que imprime en Chrome (en el mismo móvil), elige la cuenta/canal, pulsa «Avanzado → Continuar» en el aviso
de app no verificada y acepta. El script imprime el token.

### 4. Secrets del repositorio
GitHub → Settings → Secrets and variables → Actions → **Secrets**:

| Secret | ¿Obligatorio? | Para qué |
|---|---|---|
| `GEMINI_API_KEY` | Sí | investigación, guion y voz Gemini 3.8 Flash TTS (con alternativas automáticas) |
| `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` | Sí | subir a tu canal |
| `GROQ_API_KEY` | No | pulido del guion |
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | No | más fuentes de imágenes |

### 5. Variables (pestaña **Variables**, opcionales)
- `YT_PRIVACY`: `private` (por defecto), `unlisted` o `public`.
- `YT_CATEGORY_ID` (27 = Educación), `YT_SYNTHETIC` (`true` por defecto; marca «contenido sintético», `false` o `omit`), `YT_DISCLOSURE` (línea extra para la descripción).

## Voz y estilo editorial (v28)\n\nLa aplicación usa `gemini-3.8-flash-tts` como primera opción de voz y `gemini-3.8-flash-lite-tts` / Gemini 2.5 TTS como respaldo. Se conserva la misma `GEMINI_API_KEY`; no hace falta configurar otra credencial. La voz se dirige como narrador latino carismático, con base mexicana y expresiones colombianas puntuales. El guion puede incluir humor y groserías coloquiales moderadas, pero evita bromas en temas sensibles. La voz generada se mantiene en una sola pista continua para conservar timbre y sincronización.\n\nLa API puede aplicar cuotas, restricciones regionales o cobros según el proyecto de Google; revisa AI Studio/Google AI antes de activar producción continua. La primera ejecución debe hacerse en `dry_run` y escucharse completa.\n\n## Puesta en marcha recomendada
1. **Actions → Short automático → Run workflow** con *Prueba* activada: genera el vídeo y NO sube nada. Descarga el artefacto `short-N` (vídeo, `youtube-request.json`, `activity.json`) y reprodúcelo.
2. Ejecuta de nuevo sin «Prueba». Con `YT_PRIVACY=private` revisa 2–3 vídeos en Studio.
3. Cuando confíes en la calidad (y el proyecto esté auditado), pon `YT_PRIVACY=public`.

## Qué hace el sistema si algo falla
- Sin clave de Gemini, sin vídeo descargado, vídeo sin audio/silencioso/horizontal/con duración incoherente → **no sube nada** y el job falla (GitHub te envía un correo). El artefacto incluye captura y registro.
- La memoria de temas (`automation/state/`) solo se guarda si la subida salió bien, así un fallo no «quema» un tema.
- Subida interrumpida (red/5xx) → se reanuda desde el último byte recibido.

## v29 — Análisis de tendencias y elección de nicho

Antes de generar cada Short, `automation/pick-topic.mjs` decide **qué** vídeo hacer:

1. **Señales de tendencia** (cada fuente falla por separado sin romper nada): lo más leído ayer en Wikipedia ES/EN, Google Trends (RSS, sin garantía de que responda desde GitHub) y, si añades `YT_API_KEY`, los vídeos más populares de YouTube y los **Shorts de la última semana con más vistas** en los nichos mejor posicionados.
2. **Prioridad de nichos** = peso en `automation/config/channel.json` × rendimiento de tus propios vídeos × penalización por repetir nicho en los últimos 5. El rendimiento solo se calcula con vídeos **públicos** de más de un día (la clave de API no ve los privados) y se limita a ×0.6–×1.8.
3. **Candidatos**: Gemini propone 6 ideas y las puntúa (tendencia, retención, facilidad de ilustrar con fotos reales, vigencia, seguridad). Debe citar ids de señales reales; si no cita ninguna, su nota de tendencia se limita a 3. **La decisión final la calcula el código**: descarta categorías inventadas, temas poco seguros o repetidos y los que no se pueden ilustrar con fotos con licencia.
4. **Exploración**: el 20 % de las veces ignora la prioridad de nichos para probar otros.
5. Si algo falla (sin clave, Gemini saturado), elige un nicho por prioridad y la app propone el tema. Nunca detiene la publicación.

El plan elegido y los 6 candidatos con sus notas quedan en `out/topic-plan.json` (dentro del artefacto de cada ejecución) y en el resumen del job.

### Categorías (10)
Las 3 de siempre más **Ciencia de los superhéroes**, **¿Y si…?**, **Espacio**, **Animales extremos**, **Tecnología**, **Récords y rankings** y **Cultura pop: la parte real**. También aparecen como botones en la app. Las de superhéroes y cultura pop prohíben pedir imágenes con derechos de autor: el vídeo trata de ciencia e historia reales y se ilustra con fotografías reales.

### Qué puedes ajustar sin tocar código
`automation/config/channel.json`: pesos por nicho (sube uno para publicar más de ese tema), palabras semilla para buscar Shorts, regiones, tasa de exploración y la lista de temas a evitar.

### Clave opcional `YT_API_KEY`
Google Cloud → Credenciales → Crear credenciales → **Clave de API** (restríngela a YouTube Data API v3) y guárdala como secret `YT_API_KEY`. Sin ella el análisis usa solo Wikipedia y Google Trends, y no puede aprender de tus resultados. Consume unos 400 unidades de cuota por ejecución (la subida gasta bastante más).

### Límites honestos
- Ningún análisis garantiza vistas ni suscriptores. Lo que más pesa en un canal nuevo (identidad clara, gancho de los primeros segundos, constancia) lo puede mejorar el sistema, pero no asegurarlo.
- Las notas de tendencia las pone el modelo; el código solo comprueba que cite señales reales. Revisa `topic-plan.json` las primeras veces.
- Un canal que salta entre 10 nichos puede costarle más que uno enfocado. Si ves que uno funciona, sube su peso o baja el de los demás en `channel.json`.
- Los suscriptores ganados por vídeo requieren permisos de YouTube Analytics que este sistema no pide; el aprendizaje usa vistas.

## Qué no está verificado
Las piezas se probaron aisladas (`npm test`: servidor, control de vídeo, metadatos y subida reanudable contra un YouTube simulado,
y el script del token). **No se ha probado una ejecución completa** con Chrome real, tus claves y YouTube. La primera
ejecución de prueba sirve para eso. Puntos a vigilar: que Chrome sin pantalla en Linux exporte el vídeo con WebCodecs
(si no, la app usa su alternativa WebM y ffmpeg lo convierte), el tiempo de render y las cuotas gratuitas de Gemini.

## Riesgos de publicar sin revisión humana
- La app marca los datos como «pendientes de revisión»; en modo automático se publican con fuentes enlazadas, **sin que nadie los verifique**. Un dato inventado por la IA saldrá en tu canal.
- Las fotos vienen de Wikimedia, Openverse, Pexels o Pixabay; la descripción incluye autor y licencia, pero conviene auditar de vez en cuando.
- YouTube puede limitar la monetización de contenido masivo o repetitivo; varía el formato en Ajustes.

## Archivos
`automation/generate-short.mjs` (genera) · `automation/upload-youtube.mjs` (sube) · `automation/lib/` (ffmpeg, YouTube, servidor) ·
`automation/get-refresh-token.py` · `automation/test/selftest.mjs` · `automation/state/` (temas y vídeos publicados) · `.github/workflows/auto-short.yml` (horario).
