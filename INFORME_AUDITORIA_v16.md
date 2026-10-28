# Informe de auditoría — Rincón Studio v16

## Resumen
Se revisaron los archivos estáticos, el flujo de estado/proyectos, validaciones, exportación audiovisual, configuración de hosting y recursos locales. Se incorporaron correcciones de resiliencia y una revisión previa de calidad de exportación. El proyecto continúa siendo una aplicación web estática: las claves de IA se utilizan desde el navegador y no hay backend que las proteja.

## Cambios incorporados

### 1. Recuperación de proyectos
- Antes, un solo proyecto malformado podía hacer fallar la normalización de todo el estado y provocar que se iniciara con un proyecto vacío.
- Ahora cada proyecto se normaliza individualmente; los que están dañados se omiten y los demás se conservan.
- Los arrays con registros nulos se filtran durante la normalización.
- Si el JSON de almacenamiento no se puede parsear, la app intenta crear una copia local de recuperación antes de seguir con un proyecto nuevo.
- La normalización de `description`, `style`, `hook` y `comparison` comprueba tipos para evitar fallos al asignar campos.

### 2. Preflight de Shorts antes de exportar
La validación para exportación ahora advierte sobre:
- Escenas sin imágenes.
- Escenas sin narración.
- Narración que puede ser demasiado rápida para el tiempo disponible.
- Afirmaciones pendientes de verificar.
- Falta de fuentes enlazadas.
- Ausencia de narración completa.

La exportación manual muestra los avisos en una confirmación antes de continuar, de modo que se puede volver al editor en vez de generar un vídeo incompleto por accidente. Los errores estructurales existentes siguen bloqueando la exportación.

### 3. Verificaciones técnicas realizadas
- `node --check app.js`: correcto, sin errores de sintaxis.
- Recursos locales referenciados desde HTML/CSS/JS: 4 rutas explícitas revisadas, ninguna ausente.
- Identificadores HTML: 178 identificadores examinados, sin duplicados.
- Configuración de Netlify y cabeceras de seguridad inspeccionadas.
- Se intentó una prueba de ejecución en Chromium, pero el entorno de ejecución bloqueó la navegación local y localhost con `ERR_BLOCKED_BY_ADMINISTRATOR`; por eso no se declara una prueba funcional completa de interfaz ni una exportación real.

## Riesgos y limitaciones que siguen abiertos

1. **Claves API en el navegador.** Guardarlas en `localStorage` es aceptable para uso personal local, pero no para publicar una instancia compartida. Para una web pública/monetizada con usuarios, mover las llamadas de IA a un backend con autenticación, límites de uso y secretos en variables de entorno.
2. **La exportación depende del navegador.** `MediaRecorder`, `captureStream`, códecs disponibles y políticas de audio cambian entre Chrome/Android/desktop. Hay que probar el archivo exportado en el dispositivo final; MP4 no está garantizado en todos los navegadores.
3. **CORS y fotos externas.** Aunque el cargador intenta proxies CORS, algunos hosts bloquean la lectura de píxeles o cambian sus políticas. Mantener la opción de subir fotos propias es importante.
4. **Licencias de imágenes y SFX.** Las atribuciones ayudan, pero no garantizan derechos de uso comercial. Confirmar licencia y condiciones de cada archivo antes de monetizar.
5. **Veracidad editorial.** La IA puede equivocarse incluso con una fuente enlazada. Verificar cada afirmación primaria, que la cita respalde exactamente el texto y que la descripción incluya fuentes consultables.
6. **Calidad creativa.** El preflight comprueba estructura y señales básicas; no reemplaza la revisión humana de ritmo, legibilidad en móvil, mezcla de audio, safe areas, subtítulos, miniatura/primer fotograma y llamada a la acción.

## Prueba manual recomendada antes de publicar
1. Abrir la app desde Netlify o un servidor HTTP, no desde `file://`.
2. Cargar un proyecto existente y comprobar que las escenas, imágenes y ajustes se conservan.
3. Generar un Short con una clave válida y verificar manualmente las fuentes.
4. Regenerar voz IA y comprobar sincronización de subtítulos.
5. Intentar exportar deliberadamente con una escena sin imagen/narración y confirmar que aparece el preflight.
6. Exportar un Short completo, reproducirlo de principio a fin y revisar audio, cortes, último fotograma, subtítulos y créditos.
7. Repetir en el dispositivo y navegador que se usarán para producción.

## Evaluación final
La base tiene funciones útiles para un flujo de producción (guion, escenas, imágenes, evidencias, subtítulos, sonido, línea de tiempo y exportación), pero no se debe considerar una estación de edición profesional completamente validada hasta probar exportaciones reales en los dispositivos objetivo. La mejora más importante para distribuirla a terceros es trasladar las claves/API a un backend; la más importante para publicar cada Short es hacer la revisión editorial y de derechos descrita arriba.
