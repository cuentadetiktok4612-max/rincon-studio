# Rincón Studio v19 — exportación MP4 real (corrige "0:00" y "No se pudo decodificar")

## Causa raíz (confirmada leyendo el código y las capturas)
Las dos versiones anteriores grababan el canvas **en tiempo real con MediaRecorder**:
- v17 (MP4 primero): el teléfono no mantenía 30 FPS a 1080×1920, así que el vídeo quedaba más corto que el audio (informe v18: audio 61,6 s vs vídeo 35,7 s).
- v18 (WebM primero): MediaRecorder de Chrome/Android escribe el WebM "en directo" **sin el elemento Duration**. La Galería muestra 0:00 y se queda en el primer fotograma (papel arrugado con tarjetas blancas); TikTok/Instagram responden "No se pudo decodificar".

## Cambios
1. **Exportador MP4 nuevo (`exportMp4WebCodecs` en app.js + `mp4mux.js`)**
   - Renderiza fotograma a fotograma con marcas de tiempo exactas (30 FPS constantes, sin depender de la velocidad del teléfono).
   - Audio (voz + música + efectos) mezclado fuera de línea con `OfflineAudioContext`, usando el mismo `buildSoundtrack` de siempre.
   - Codifica H.264 (1080×1920; si no hay soporte, 720×1280) + AAC (o Opus si AAC no existe) con WebCodecs.
   - Muxer MP4 propio, no fragmentado, con `moov` al inicio, duración exacta y tabla de keyframes (1 por segundo).
   - **Verificación automática**: tras generar el MP4 se abre en un `<video>` oculto; si el navegador no lo lee o la duración no coincide, no se descarga y se usa el método alternativo.
2. **Método alternativo (si WebCodecs no existe o falla)**: se mantiene MediaRecorder/WebM, pero ahora se inserta el elemento `Duration` y se corrigen las posiciones del SeekHead (`webmfix.js`). Aplica también a "Video largo → Shorts".
3. `index.html` carga `mp4mux.js` y `webmfix.js` antes de `app.js` (compatibles con la CSP `script-src 'self'`).

## Verificación realizada
- Muxer probado con flujos H.264 (1080×1920, 180 fotogramas) y AAC reales: `ffprobe` → duración 6,000 s, 180 fotogramas, 30 fps constantes, audio 6,12 s; `ffmpeg` decodifica sin errores ni avisos; seek correcto; 6 keyframes; orden de átomos `ftyp, moov, mdat`.
- Reparador WebM probado con un WebM "en directo" (sin duración): antes `N/A`, después 5,000 s, 150 fotogramas de vídeo, decodificación limpia.
- `node --check app.js` correcto.

## Pendiente de confirmar en el dispositivo
No se puede ejecutar WebCodecs fuera de un navegador real. Tras desplegar: exportar un Short, abrir el archivo en la Galería (debe mostrar la duración real, p. ej. 0:48) y subirlo a TikTok/YouTube. La ruta Opus-en-MP4 (solo si el teléfono no ofrece AAC) no se probó con herramientas externas.
