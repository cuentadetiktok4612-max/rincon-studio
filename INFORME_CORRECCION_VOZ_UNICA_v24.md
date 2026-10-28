# Rincón Studio v24 — Una sola voz para todo el Short

## Causa
La aplicación generaba el audio por separado para cada escena y después pegaba los seis clips. Aunque todas las solicitudes usaban el mismo nombre de voz y una indicación de estilo parecida, cada generación de TTS podía variar el timbre, el ritmo o la interpretación.

## Corrección aplicada
- La narración completa de las escenas se envía ahora en **una única solicitud de Gemini TTS**.
- El Short se mezcla con una única pista continua, en lugar de concatenar voces generadas por separado.
- Los límites de las escenas se calculan a partir de los tiempos estimados de las palabras de esa pista, y los subtítulos conservan su sincronización por escena.
- La generación manual y la automática indican que están creando una voz única.
- Si una escena no tiene texto hablado, la aplicación muestra un error específico en vez de generar un montaje mal sincronizado.
- Se conserva la pista de voz anterior si falla la generación nueva antes de completar el montaje.

## Validación
- `node --check app.js`: correcto.
- Prueba sintética de sincronización: 6 escenas, 32 palabras sincronizadas y duración de la línea de tiempo coincidente con la pista continua.
- Integración real con Gemini TTS y exportación final: no comprobadas desde este entorno, porque dependen de la clave Gemini y del navegador del usuario. Después de desplegar, regenera la voz de un Short existente para sustituir las voces antiguas por una sola pista.
