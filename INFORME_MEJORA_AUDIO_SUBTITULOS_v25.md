# Rincón Studio v25 — Corrección de voz, subtítulos y efectos de sonido

## Problemas encontrados

1. La salida TTS se utilizaba casi sin igualar el nivel entre partes habladas; un compresor suave después no corregía del todo algunas bajadas internas de la grabación.
2. Los tiempos de palabras se estimaban sobre la duración total y solo usaban las pausas detectadas si su número coincidía exactamente con las frases del guion. Si la voz introducía otras pausas, los subtítulos podían adelantarse o acumular desfase.
3. Los efectos dependían de una ganancia de metadatos bastante conservadora y estaban conectados al mismo bus que se desvanece al final. El whoosh inicial y los clics finales podían quedar especialmente atenuados.

## Cambios aplicados

- Añadido un master de narración con control de nivel por ventanas de 40 ms, suavizado de ganancia, normalización de pico y limitación suave contra clipping.
- Reducido el umbral usado para detectar el inicio/final de voz; la intención es conservar fragmentos pronunciados suavemente.
- Reescrito el cálculo de tiempos: se parte de una estimación por peso de palabra y se anclan límites de cláusula a pausas acústicas cercanas. Esta alineación mejora el ajuste, pero sigue siendo una estimación local y no un alineador fonético de laboratorio.
- Separado el bus de SFX del fundido de la música y añadido un compresor final para controlar la suma de voz, música y efectos.
- Normalizados los recursos SFX locales y ajustada su ganancia de mezcla. El motor conserva una selección moderada de acentos para no saturar cada corte.
- Se mantienen la narración completa en una única pista, los proyectos locales, la estructura de escenas, las imágenes, los flujos de exportación y las funciones de publicación existentes.

## Verificaciones realizadas

- `node --check app.js`: correcto.
- Prueba sintética del temporizador: 19 palabras; todos los intervalos son válidos, positivos y ordenados.
- Prueba sintética del master de voz: salida finita, duración conservada y pico bajo 1.0.
- Recursos de sonido: 22 de 22 entradas del manifiesto tienen archivo WAV existente y legible.
- El paquete se vuelve a crear con los archivos de la raíz conservados y se revisa con `unzip -t`.

## Verificación que requiere el entorno del usuario

No se ha ejecutado una llamada real a Gemini ni una exportación audiovisual completa dentro de un navegador con las claves del usuario. Después de reemplazar/desplegar el proyecto, pulsa **Regenerar voz IA** en los Shorts existentes antes de exportarlos: así se crea la pista con el nuevo master y se recalculan los subtítulos usando las pausas del audio nuevo. Reproduce el MP4/WebM final una vez antes de publicarlo, porque el resultado exacto también depende del navegador y del codificador del dispositivo.
