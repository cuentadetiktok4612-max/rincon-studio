# Rincón Studio v22 — Corrección de generación de voz IA

## Causa identificada
La aplicación enviaba las solicitudes de texto a voz al endpoint `/v1beta/interactions` usando anotaciones `speech_metadata`. La respuesta de Gemini indicaba que ese tipo de metadatos no era compatible con el modelo utilizado, por lo que la generación de audio fallaba y algunas rutas iniciaban una vista previa con la voz del navegador. Esa voz del navegador no produce una pista de audio exportable.

## Correcciones
- Migrada la generación TTS a `models/{model}:generateContent`, con `responseModalities: ["AUDIO"]` y `speechConfig.voiceConfig.prebuiltVoiceConfig`.
- Se usan los modelos `gemini-2.5-flash-preview-tts` y `gemini-2.5-pro-preview-tts` como intentos alternativos.
- Las indicaciones de estilo se envían como texto normal de la petición; ya no se adjunta la anotación incompatible `speech_metadata`.
- Se leen los datos de audio de `candidates[].content.parts[].inlineData`.
- Si la respuesta es PCM `audio/L16`, se encapsula en WAV antes de decodificarla como `AudioBuffer`.
- Se elimina el cambio automático a voz de navegador cuando falla la regeneración manual o la creación automática de un Short. El error de IA se muestra sin fingir que hay una pista exportable.
- La función de voz para video largo utiliza la misma lista de modelos TTS corregida.

## Validación y límites
- `node --check app.js` pasa.
- La integración no se pudo probar contra la API real desde este entorno: requiere que el usuario configure una clave Gemini válida y permite cuotas/modelos habilitados en su cuenta. Debe probarse una regeneración y exportación real después de desplegar.
