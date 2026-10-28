# Informe de mejoras v20 — Rincón Studio

## Implementado
1. Tres filtros de contenido en el panel principal:
   - Diferencias que pocos conocen.
   - Curiosidades sorprendentes.
   - Misterios, historia y secretos.
2. Cada filtro actualiza el prompt real que recibe la IA y especifica el enfoque editorial que debe seguir.
3. Se añadió estado visual seleccionado, `aria-pressed` y una etiqueta que explica qué formato se utilizará.
4. Se actualizó el texto del panel para describir los tres formatos en lugar de sugerir que el generador solo se centra en psicología.
5. Se mantuvieron los pasos existentes de investigación, generación de seis escenas, fotografías, voz y exportación.

## Comprobaciones
- `node --check app.js`: correcto.
- Revisión estática de que las tres categorías del HTML corresponden a las claves de `CONTENT_CATEGORIES` en JavaScript.
- No se hizo una generación real con Gemini/Groq porque depende de las claves configuradas en el navegador y de la disponibilidad del proveedor.

## Uso
Entra al Panel principal, selecciona una tarjeta y pulsa **Generar y descargar Short**. El filtro elegido aplica a la generación iniciada desde el botón superior o el botón principal.
