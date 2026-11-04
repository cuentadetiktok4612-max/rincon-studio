# Informe de mejora v28 — Edición carismática

## Cambios aplicados

1. **TTS principal:** `gemini-3.8-flash-tts`.
2. **Alternativas automáticas:** `gemini-3.8-flash-lite-tts`, `gemini-2.5-pro-preview-tts` y `gemini-2.5-flash-preview-tts`.
3. **Voz:** prebuilt voice `Algenib` para Gemini 3.8; la alternativa 2.5 conserva `Charon`.
4. **Dirección interpretativa:** narrador adulto masculino de registro medio-grave, español latino con base mexicana y giros colombianos puntuales, sarcasmo amable, asombro, suspenso, respiración y variación de ritmo.
5. **Guiones:** humor conversacional y expresiones regionales moderadas; máximo orientativo de 2–4 expresiones por Short. En temas sensibles, el prompt exige respeto y elimina el humor.
6. **Actuación de voz:** se insertan indicaciones `<laughs>` y `<short pause>` únicamente en la petición TTS. El guion visible y la sincronización de subtítulos permanecen limpios.
7. **Diseño sonoro:** el detector automático de efectos reconoce expresiones regionales y activa un acento cómico selectivo, conservando el límite de efectos existente.
8. **Automatización:** no se modificaron los identificadores de localStorage, el generador de GitHub Actions, la subida a YouTube, la privacidad por defecto ni el intervalo de ocho horas.

## Verificaciones realizadas

- `node --check app.js`: correcto.
- `node --check automation/generate-short.mjs`: correcto.
- `node automation/test/selftest.mjs`: 6 bloques correctos, incluyendo servidor, FFmpeg, validación de audio/vídeo, metadatos y subida reanudable simulada.
- Prueba de API TTS real: **pendiente**, requiere la clave Gemini del propietario y cuotas habilitadas.
- Render completo en Android/Termux: **pendiente**. El flujo programado de GitHub Actions no fue modificado.

## Importante

El modelo 3.8 es la primera opción configurada. Si no está disponible por cuota, región o permisos de la API, el código prueba los modelos de respaldo. Revisa el coste/cuota de tu proyecto Google antes de dejarlo funcionando en producción y escucha el primer artefacto `dry_run` completo antes de permitir subidas.
