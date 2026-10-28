# Rincón Studio v17 — corrección puntual

## Problema confirmado
La exportación fallaba con `voiceGain.linearRampToValueAtTime is not a function`. `voiceGain` es un `GainNode`; los métodos `setValueAtTime` y `linearRampToValueAtTime` pertenecen a su propiedad `gain` (`AudioParam`).

## Corrección aplicada
Se reemplazaron las llamadas incorrectas por:
- `voiceGain.gain.linearRampToValueAtTime(...)`
- `voiceGain.gain.setValueAtTime(...)`
- La inicialización ya correcta `voiceGain.gain.setValueAtTime(...)` se conserva.

## Interfaz
Se cambió el acento lima/verde de la interfaz oscura por fucsia eléctrico (`#ff2bd6`) y tonos fucsia oscuros/claros complementarios. Se conserva la estructura y la identidad oscura.

## Verificación realizada
- Sintaxis JavaScript: pendiente de ejecutar en el entorno de empaquetado.
- Comprobación textual: no deben quedar llamadas `voiceGain.setValueAtTime` ni `voiceGain.linearRampToValueAtTime`.
- Prueba funcional de exportación con audio real: requiere abrir el sitio en navegador compatible y exportar un proyecto con voz y otro sin voz; no se puede declarar validada solo con análisis estático.
