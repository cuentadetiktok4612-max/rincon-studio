# El Rincón de lo Desconocido — FocoShorts Studio

Editor web estático para crear Shorts verticales con narración IA, imágenes, subtítulos sincronizados, avatar expresivo y exportación desde Canvas.


## v27 — Publicación automática en YouTube

- Nuevo flujo sin supervisión: GitHub Actions ejecuta la app en un Chrome sin pantalla cada 8 horas, genera un Short, lo verifica con ffmpeg y lo sube a tu canal por la API de YouTube. La app no cambia.
- Guía de configuración, límites de YouTube (los vídeos subidos por API quedan privados hasta pasar la auditoría de Google) y riesgos en `AUTOMATIZACION.md`.


## v25 — Voz nivelada, subtítulos mejor sincronizados y SFX audibles

- La voz se masteriza tras generarse: control suave de volumen por ventanas, normalización de pico y limitación suave para reducir bajadas perceptibles sin elevar los silencios.
- La detección de silencios usa un umbral más conservador para no recortar partes habladas de bajo volumen.
- Los tiempos de palabras/cláusulas ahora se ajustan a pausas detectadas en la forma de onda, incluso cuando la cantidad de pausas no coincide exactamente con los signos de puntuación del guion.
- La voz, la música y los efectos comparten una etapa final de mezcla/control de picos. El bus de efectos queda separado del fundido de la música, para que el sonido inicial y los acentos finales no desaparezcan con ese fundido.
- Los efectos locales se normalizan a un nivel de pico coherente y reciben una ganancia de mezcla moderada. Hay acentos sutiles adicionales en algunas transiciones, manteniendo prioridad para la narración.
- Consulta `INFORME_MEJORA_AUDIO_SUBTITULOS_v25.md` para ver las verificaciones y limitaciones.

## v24 — Voz única en toda la narración

- La narración de todas las escenas se genera en una única petición TTS para mantener el mismo timbre, acento e interpretación durante el Short.
- La pista de voz se reproduce/exporta de forma continua; los límites de las escenas y los subtítulos se sincronizan con esa pista.
- La interfaz indica que genera una voz única y evita continuar si una escena no tiene texto que narrar.
- Consulta `INFORME_CORRECCION_VOZ_UNICA_v24.md` para ver el cambio y las comprobaciones realizadas.

## v16 — robustez y control de calidad antes de publicar
- La recuperación de proyectos ya no descarta todos los proyectos si uno de los registros guardados está dañado: intenta cargar cada proyecto por separado y conserva los válidos.
- Si el JSON guardado está corrupto, la app intenta guardar una copia de recuperación antes de iniciar un proyecto nuevo.
- La normalización tolera registros nulos/malformados y campos de descripción, estilo, gancho o comparación con tipos inesperados.
- El control previo a exportación detecta escenas sin imagen, escenas sin narración, ritmos de voz potencialmente demasiado rápidos, afirmaciones pendientes y ausencia de fuentes enlazadas. En la exportación manual muestra un resumen y permite cancelar o continuar conscientemente.
- Se mantiene la exportación no destructiva y la compatibilidad con las claves de almacenamiento anteriores.

## Edición audiovisual de esta versión v16

- **Efectos de sonido selectivos:** incorpora seis grabaciones recortadas del ZIP de transiciones que aportaste. No se disparan todas en cada escena; el motor elige efectos según el tipo de transición y palabras de la narración.
- **Mezcla menos artificial:** se eliminó la melodía sintética repetitiva tipo tono de móvil. La cama tonal queda muy baja y la voz mantiene prioridad.
- **Transiciones visuales:** entrada lateral de imágenes, wipe coral breve, acento de zoom y fade sutil en las escenas que lo piden.
- **CTA final sincronizado:** el cursor pulsa Like y la campana con dos clics de ratón recortados del audio aportado.
- **Avatar sin respiración ni rebote gelatinoso:** permanece quieto; las expresiones cambian en comienzos de frases cuando la narración lo permite.
- **Expresiones semánticas:** la generación de guion ahora pide tono, una selección de emociones permitidas y expresiones por escena; el código conserva esos campos en lugar de descartarlos. Las emociones deben acompañar la frase y el tema, no aparecer todas por obligación.
- **Exportación vertical:** 1080×1920 a 30 FPS.

## Uso

1. Descomprime el ZIP o publica el contenido raíz en Netlify.
2. Abre `index.html` desde un servidor web/Netlify (preferible a `file://` por restricciones del navegador).
3. Configura las API keys en Ajustes.
4. Genera el Short, revisa fotos y fuentes, y pulsa «Regenerar voz IA» antes de exportar si necesitas narración dentro del vídeo.
5. Mantén la pestaña en primer plano durante la exportación y reproduce el archivo antes de publicarlo.

## Licencias y límites de verificación

Los seis nuevos clips proceden del ZIP que aportaste. Se recortaron y normalizaron, pero el ZIP original no incluye datos de licencia verificables; consulta `assets/sfx/PROVENANCE.txt` y confirma los permisos antes de monetizar. La etiqueta “No Copyright” en un nombre de archivo no prueba por sí sola que el uso sea libre.

Se comprobó la sintaxis JavaScript y la presencia de recursos locales. No se pudo verificar aquí una exportación real con una clave Gemini ni la reproducción final en Android. Conservé las claves existentes de `localStorage` para no borrar proyectos ni ajustes.

## v14 — edición manual de montaje
- Añadida una línea de tiempo de vídeo y audio por escena, adaptada a pantallas móviles. Cada bloque permite seleccionar la escena y saltar a ella en la previsualización.
- En cada escena se puede elegir transición de salida (corte, fundido, barrido o zoom), seleccionar SFX manual o automático, desactivarlo y ajustar su volumen.
- En modo automático, los efectos narrativos se limitan a acentos semánticos moderados; la selección manual prevalece. Se conservan campos por escena en el estado local.
- Se mantiene la compatibilidad con proyectos anteriores: escenas sin los nuevos campos usan `auto` y volumen moderado por defecto. No se cambiaron las claves `localStorage`.
- Limitación: este es un primer montaje multipista por escenas, no una réplica completa de CapCut. No incluye todavía arrastre libre de clips, waveform de voz, keyframes ni edición de cada palabra en una pista dedicada.


## v15 — Identidad visual y revisión de producto
- Nueva identidad visual oscura carbón con acento lima y superficies verde pizarra; reemplaza la estética violeta genérica sin alterar los identificadores de almacenamiento.
- Marca visible actualizada a Rincón Studio / Shorts Workspace.
- Mejoras de contraste en campos, estados, timeline, preview, diálogos y avisos; estilos específicos para móvil y áreas seguras.
- La línea de tiempo conserva los controles existentes y en móvil puede desplazarse horizontalmente para revisar las pistas.
- No se afirma que el render real esté validado en Android; es necesario comprobar la exportación en el dispositivo de destino.


## v17 — corrección de exportación e identidad fucsia
- Corregido el error de exportación Web Audio: las rampas y los cambios de ganancia ahora se llaman sobre `voiceGain.gain` (AudioParam), no sobre el nodo `GainNode`.
- Actualizada la identidad visual oscura a fucsia eléctrico, con fondos y estados de acento coordinados.
- Recomendación: validar una exportación real en el navegador/dispositivo de destino con un proyecto con voz y otro sin voz.


## Exportación audiovisual (v18)

La grabación en navegador prioriza WebM (VP9/Opus, con alternativas VP8/WebM) antes de MP4. Esto evita elegir primero el muxer MP4 del navegador en dispositivos donde puede producir archivos con duraciones inconsistentes entre audio y vídeo. La extensión descargada se determina a partir del MIME real del grabador. Si el navegador no soporta WebM, se conserva MP4 como alternativa.

Importante: la exportación depende de MediaRecorder y del navegador/dispositivo; tras desplegar, comprueba el vídeo descargado y confirma que la duración de ambas pistas coincide.


## Exportación MP4 real (v19)
La exportación principal ya no graba en tiempo real: renderiza cada fotograma con su marca de tiempo exacta, mezcla el audio fuera de línea y genera un MP4 H.264 + AAC (módulo `mp4mux.js`, WebCodecs). El resultado se verifica en un `<video>` antes de descargarse. Si el navegador no soporta WebCodecs, se usa MediaRecorder/WebM con la duración corregida (`webmfix.js`). Mantén la pestaña visible durante la exportación.

## Actualización v20 — formatos editoriales

- Se añadieron tres filtros en el panel principal: **Diferencias que pocos conocen**, **Curiosidades sorprendentes** y **Misterios, historia y secretos**.
- El filtro elegido modifica la instrucción temática enviada al proveedor de IA; no es solo un cambio visual.
- La generación conserva la investigación web, el control de temas recientes, las seis escenas, las búsquedas de imágenes y el flujo de voz/exportación existentes.
- Los misterios deben distinguir hechos verificados de hipótesis; el prompt pide evitar conspiraciones y leyendas inventadas como hechos.
- La selección es de la sesión actual del navegador; al recargar vuelve al formato de diferencias por defecto.
