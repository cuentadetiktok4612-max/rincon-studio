# Rincón Studio v18 — ajuste de exportación

## Hallazgo confirmado en el archivo de muestra
- Contenedor MP4, 8,103,924 bytes.
- Audio AAC: 61.634 s.
- Vídeo H.264: 35.734 s, 707 fotogramas.
- Las duraciones de las pistas no coinciden; esto explica la reproducción anómala.

## Cambio aplicado
En los dos flujos de exportación de `app.js`, el orden de formatos ahora prioriza `video/webm;codecs=vp9,opus`, después VP8/WebM y WebM genérico, y deja MP4 como alternativa. Así se evita seleccionar primero la ruta de grabación MP4 en navegadores/dispositivos donde el muxer genera metadatos/duraciones inconsistentes. La extensión descargada continúa derivándose del MIME real de MediaRecorder.

## Alcance y verificación pendiente
- Comprobación estática de que ambos exportadores usan el nuevo orden de MIME.
- No se puede certificar una exportación de extremo a extremo sin ejecutar la página en el mismo navegador/dispositivo del usuario.
- Tras desplegar, exportar un clip de prueba y verificar con reproductor/propiedades que audio y vídeo tengan duraciones coincidentes y que la imagen avance.
