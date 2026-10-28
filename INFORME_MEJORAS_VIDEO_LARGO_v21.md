# Rincón Studio v21 — Mejora del video largo

## Cambios realizados
- Exportación vertical a 1080 × 1920 (Full HD) manteniendo las proporciones del diseño de subtítulos y rótulos.
- Aumento del bitrate objetivo de video de 5.2 Mbps a 10 Mbps y del audio de 160 kbps a 192 kbps para reducir artefactos de compresión.
- Segmentación de subtítulos más legible: normalmente 5–8 palabras por bloque, con cortes adicionales en pausas de puntuación. Se aplica tanto a los subtítulos incrustados como a los SRT.
- Se conserva la exportación WebM/MP4 según lo que admita MediaRecorder en el navegador.

## Límites conocidos
- Los tiempos de subtítulos siguen siendo estimaciones basadas en la distribución del texto durante la duración de la voz, no alineación fonética palabra por palabra. El archivo SRT es editable y debe revisarse para sincronía exacta.
- La calidad final sigue limitada por la resolución y calidad del video original. Exportar a Full HD no recupera detalle que no exista en la fuente.
- 1080p requiere más memoria y potencia del dispositivo que 720p; conviene mantener la pestaña en primer plano durante la exportación, especialmente en móviles.

## Validación
- `node --check app.js`: correcto.
- Cambios revisados estáticamente; no se pudo verificar una exportación real porque requiere un video de prueba y las claves Gemini configuradas por el usuario.
