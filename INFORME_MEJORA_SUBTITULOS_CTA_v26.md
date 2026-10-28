# Rincón Studio v26 — Subtítulos sincronizados + animación de Like y Campana

## Subtítulos
- Nuevo alineador (`alignWordsToVoice`): reparte las palabras sobre el tiempo realmente hablado, saltándose cualquier pausa de la voz, y ancla las fronteras de frase a las pausas reales con programación dinámica. Si falla, usa la estimación anterior.
- Detección de pausas más fina (110 ms en vez de 140 ms).
- Los grupos de subtítulo que durarían menos de ~0,36 s se unen al siguiente (sin cruzar puntuación), para que no «vuelen».
- Eliminado el retraso fijo de 30 ms.
- Prueba sintética (40 guiones simulados con pausas irregulares): error mediano de inicio de palabra 36 ms (antes 49) y percentil 95 de 167 ms (antes 376 ms).

## Like y campana (final del Short)
- Pastilla «DALE LIKE | CAMPANA» con entrada con rebote, bajo los subtítulos (ya no tapa a la mascota).
- Cursor que entra, va al pulgar, hace clic (ondas + pulgar que rebota, se rellena y lanza destellos; el texto pasa a «¡GRACIAS!»), después va a la campana, hace clic (la campana se rellena, suena con balanceo amortiguado y ondas; el texto pasa a «¡ACTIVADA!»).
- Los dos clics y un «ding» están sincronizados con la animación.
- La cola de silencio final pasa de 0,7 s a 2,0 s para que la animación respire después de la última palabra.

## Importante
Los Shorts ya creados conservan los tiempos antiguos: pulsa **Regenerar voz IA** en cada uno antes de exportarlo. Los nuevos ya salen con el alineador.
No se ha probado una exportación real en navegador con tus claves: reproduce el vídeo una vez antes de publicar.
