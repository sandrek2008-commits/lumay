# Lumay

Editor de imágenes manual para escritorio y móviles. El navegador procesa los archivos localmente. La aplicación no pide una cuenta, no añade marcas de agua y no tiene cuotas de uso ni funciones de pago.

## Ejecutar

Para abrir el código modular, sirve `dist/` desde la carpeta del proyecto con Python 3 y abre `http://localhost:8000`.

```sh
python3 -m http.server 8000 --directory dist
```

La versión autónoma es un solo archivo HTML. Para regenerarla con Node.js 22 o posterior y abrirla directamente en el navegador:

```sh
node scripts/standalone.mjs
```

Los presets residen en IndexedDB. La disponibilidad y persistencia del almacén para páginas abiertas mediante `file:` dependen del navegador. Servir `dist/` por HTTP local mantiene el origen estable. Los presets se pueden exportar individualmente a JSON.

## Verificar

```sh
node test/editor.test.mjs
```

Desde el inicio, usa **Abrir foto**, arrastra un archivo o elige **Probar edición** para abrir la muestra. La flecha del editor vuelve al inicio y **Continuar edición** recupera la foto abierta durante la sesión. Usa **Exportar** para guardar el resultado o **Presets** para conservar ajustes reutilizables.

La [especificación técnica](ESPECIFICACION.md) describe el pipeline, los formatos y las diferencias entre el código base y una versión de producción.

**Temas** permite elegir un estilo o ajustar los colores del fondo, el cristal y el acento. La selección se guarda en el navegador cuando el almacenamiento local está disponible.
