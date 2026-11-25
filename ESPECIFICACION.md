# Especificación técnica de Lumay

## Producto y experiencia

Editor web adaptable a escritorio y móvil. El área de trabajo incluye una cabecera con historial y exportación, un lienzo con controles flotantes y un dock con 13 categorías en la parte inferior. Los paneles se abren por herramienta, con controles agrupados y acciones para cancelar, aplicar o restablecer. El catálogo contiene 19 filtros, la vista Original y 12 efectos combinables.

El navegador procesa las imágenes localmente mediante herramientas manuales. La versión modular se sirve desde el directorio dist y la autónoma contiene todos sus recursos.

## Organización del código

| Archivo | Responsabilidad |
| --- | --- |
| `dist/index.html`, `style.css` | Estructura, tokens visuales, layout, accesibilidad y reglas responsivas |
| `dist/app.mjs` | Controlador de sesión, interacción del lienzo, vistas, guías, histograma y carga de activos |
| `dist/ui.mjs`, `inspector.mjs` | Componentes DOM, controles numéricos, editor de curvas, formularios y herramientas |
| `dist/model.mjs` | Estado del proyecto, historial, snapshots, esquemas y utilidades de color y geometría |
| `dist/color.mjs` | Gradación WebGL 2 y alternativa Canvas 2D |
| `dist/render.mjs` | Pinceles, malla, perspectiva, capas, efectos, collage y marco |
| `dist/files.mjs` | Decodificación, codificación, EXIF, CRC-32 y ZIP |
| `dist/presets.mjs`, `dialogs.mjs` | IndexedDB, normalización de presets y flujos de exportación individual y en lote |
| `scripts/standalone.mjs`, `test/` | Empaquetado autónomo y pruebas de regresión |

## Estado y transacciones

Un proyecto identifica la fuente mediante una clave de una tabla de activos. Los archivos y mapas de bits decodificados quedan fuera de las revisiones. Cada revisión contiene color, geometría, capa y orden de composición, trazos normalizados, malla, efectos, collage y marco. Los controladores reutilizan referencias cuando no cambian. Por ejemplo, mover un punto de curva crea una matriz nueva para ese canal y comparte los ajustes, las imágenes y las demás curvas.

Un arrastre de deslizador, nodo o pincel forma una transacción. Al soltar se añade el estado anterior a la pila de deshacer. Los cambios nuevos invalidan la rama de rehacer. Los snapshots apuntan a revisiones completas y se pueden usar como referencia del divisor o restaurar. El zoom, paneo, guías y herramienta en uso son estado de la vista. La apertura de otra imagen libera los mapas de bits anteriores. Una carga más antigua que termine tarde se descarta.

Los presets v1 incluyen `name`, `tags`, `color` y `frame`. El validador acepta únicamente parámetros conocidos, verifica dominios LUT, comprueba el orden y separación de los nodos y limita valores a los intervalos de cada control. Los presets se guardan en IndexedDB y pueden importarse o exportarse como JSON. El almacenamiento disponible depende de la cuota del navegador.

## Pipeline de imagen

1. Decodificar en orientación de visualización con `createImageBitmap`, con decodificación HTML como alternativa. La vista prepara un raster de hasta 1536 píxeles en el lado mayor con WebGL 2 o 960 con Canvas 2D. El original queda disponible para exportación. El collage coloca cada imagen con recorte de cobertura y radio configurable.
2. Aplicar las operaciones de píxeles sobre la fuente. El clonador toma una referencia de la imagen al inicio del trazo y conserva un desplazamiento entre origen y destino. El corrector mezcla detalle de alta frecuencia del origen con un promedio local del destino. Licuado y restauración operan por huellas de pincel ponderadas por distancia y presión. La malla fija sus bordes y remapea triángulos con interpolación bilineal.
3. Aplicar luz, contraste y detalle, temperatura y matiz, saturación e intensidad, HSL, curvas RGB, gradación tonal, LUT, viñeta y grano. WebGL 2 usa una textura de fuente, una tabla de curvas de 256 muestras por canal y una textura 3D con interpolación lineal para archivos `.cube`. El almacenamiento de esas texturas es de 8 bits. Los tonos HSL se ponderan según distancia circular. Las curvas usan interpolación cúbica monotónica por tramos. La alternativa de CPU mantiene la familia de controles con aproximaciones propias para detalle, grano y desenfoque.
4. Recortar, voltear, proyectar perspectiva mediante una malla de triángulos y rotar. Combinar superposiciones y capas. Las capas de pintura tienen su propio raster y máscara de ocultar/revelar. Los trazos que leen o deforman la foto se evalúan sobre la base antes de color, en el orden de sus capas. Las capas visuales se mezclan después con las operaciones de Canvas 2D.
5. Componer el marco y ajustar el resultado al tamaño solicitado. El archivo se codifica mediante Canvas. La vista conserva la última fuente de textura, las tablas de curvas/LUT y el raster base mientras sus referencias sean válidas. Las invalidaciones de pantalla se agrupan mediante `requestAnimationFrame`.

La comparación con el original conserva la misma geometría del proyecto para alinear detalles. Los snapshots también pueden servir como referencia. El zoom abarca de 10 % a 800 % en relación al encaje automático. El zoom, las guías y el divisor son ayudas de pantalla. La edición de recorte libre y malla se realiza con la geometría en su postura inicial para que la selección coincida con el sistema de coordenadas de la fuente.

## Herramientas y alcance

| Área | Disponible en el código base |
| --- | --- |
| Retoque | Empujar, expandir, contraer, girar en dos sentidos, restaurar, malla de puntos, clonación, corrección de textura, suavizado, iluminación y ajuste manual de tono. La forma se controla con pincel o malla, sin puntos anatómicos predeterminados. |
| Pintura y maquillaje | Pintura, borrador, paleta, cuentagotas, presión del lápiz, dureza, tamaño, flujo, estabilización, máscaras de pintura y pinceles de color para maquillaje manual. |
| Luz y color | 19 controles numéricos, histograma, RGB y tres curvas por canal, ocho rangos HSL con muestreo y gradación de tres zonas. Desenfoques gaussiano, de lente y radial aproximados. |
| Filtros y efectos | 19 filtros en ocho familias, más la vista Original, LUT 3D `.cube` con intensidad, destellos, gobo, polvo/rayones, halo, papel, glitch, aberraciones lateral y radial, prisma, niebla, líneas CRT y bokeh. |
| Geometría | Recorte libre o centrado por proporción, rotación continua, giros de 90°, volteos, corrección de perspectiva horizontal y vertical y guías manuales. |
| Composición | Capas de texto, forma, imagen y pintura. Visibilidad, bloqueo, duplicación, eliminación, orden por arrastre y 12 fusiones. Cuadrícula de collage por número de columnas, color/patrón, espacio y radio. El collage libre se compone con capas de imagen. |
| Texto y marcos | Texto multilínea, negrita, cursiva, seis familias de sistema, interlineado, espaciado, alineación, arco, contorno, sombra, degradado y fondo. Figuras y dos stickers vectoriales editables. Marcos de color, Polaroid y desenfoque exterior con bordes independientes. |
| Sesión y lotes | Deshacer/rehacer multinivel, snapshots comparables, presets IndexedDB con etiquetas, búsqueda, JSON e importación. Lotes secuenciales con recorte centrado, preset, firma, marco, progreso y ZIP. |

## Exportación y metadatos

El usuario elige PNG, JPG o WebP. Para JPG y WebP, el motor usa la calidad solicitada en la API del navegador. La escala puede ser 0.5×, 1×, 2×, 3×, 4× o un par exacto de dimensiones. Cuando se solicita una proporción exacta distinta a la del documento, la salida se estira. El escalado aumenta las dimensiones de salida mediante remuestreo.

La exportación predeterminada descarta los metadatos de origen. Al elegir conservar EXIF, el motor lee segmentos JPEG APP1, PNG eXIf o WebP EXIF, normaliza la orientación, actualiza dimensiones cuando los campos son compatibles y desvincula el directorio de miniatura anterior. El contenedor de salida recibe su segmento EXIF correspondiente. Si el original contiene GPS, el usuario recibe una indicación antes de exportar con EXIF activo. Los metadatos XMP e ICC externos al bloque EXIF no se copian. La conservación depende de que el origen tenga EXIF legible y de los límites del contenedor.

Batch Studio procesa un archivo cada vez y libera el mapa de bits al terminar. El progreso y los errores se registran por imagen. Los resultados exitosos entran en un ZIP sin compresión adicional. El límite del contenedor es ZIP clásico de 4 GiB y hasta 65 535 entradas. El navegador puede imponer límites menores de memoria o lienzo. No hay un máximo comercial de archivos o resolución ni un contador diario en la aplicación.

## Escalado para producción

La implementación de referencia usa Canvas 2D para pinceles, composición y perspectiva, y WebGL 2 para color. La interacción aún comparte el hilo principal con esos pasos. Los siguientes cambios definen una ruta de implementación medible:

- Introducir un backend `RasterEngine` con mensajes `open`, `preview`, `cancel` y `export`. Cada mensaje de render incluye revisión, tamaño y número de secuencia. En navegadores compatibles, un Worker posee `OffscreenCanvas`, devuelve `ImageBitmap` transferibles y cancela trabajos obsoletos por sesión.
- Cachear por teselas con claves de activo, revisión, escala y capa. Propagar rectángulos sucios de pincel más un margen de desenfoque. Cuando el render final exceda el tamaño de textura o lienzo, procesar bloques y escribirlos a un codificador incremental. Usar ZIP64 para lotes mayores y la File System Access API como destino opcional.
- Usar WebAssembly SIMD para deformación y filtros espaciales en CPU cuando las mediciones lo justifiquen. Para imágenes HDR o procesos de impresión, introducir superficies flotantes lineales, conversiones ICC explícitas, un encoder de alta profundidad y comparación de color en ambos backends.
- Añadir un formato de proyecto con versión de esquema, blobs originales referenciados por hash y bitácora de comandos. Guardar de forma transaccional en IndexedDB u OPFS y ejecutar migraciones con rollback. El código entregado conserva los proyectos y snapshots en la sesión actual.
- Ampliar las pruebas con resultados de referencia para pinceles, perspectiva y modos de fusión, más perfiles de latencia para 12, 24 y 48 megapíxeles. Objetivos iniciales de producto: respuesta de previsualización por debajo de 50 ms en el percentil 95 del dispositivo de referencia y exportaciones de lotes interrumpibles.

## Pruebas y criterios de aceptación

Las pruebas incluidas cubren valores neutros, curvas, historial, recorte, validación de presets y LUT, cabeceras EXIF y ZIP. En navegador, la revisión debe verificar el recorrido abrir → editar → comparar → deshacer → exportar, EXIF activado/desactivado, lectura de un `.cube`, restauración de snapshot, entrada por teclado y tacto, reordenamiento de capas, generación de ZIP y ruta de CPU en ausencia de WebGL 2. Las pruebas sintéticas de formatos verifican estructura. Conviene contrastar la interoperabilidad de EXIF con lectores externos antes de una distribución amplia.
