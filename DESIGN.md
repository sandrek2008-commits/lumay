---
version: alpha
name: "Lumay"
description: "Editor fotográfico de cristal ahumado y reflejos plateados."
colors:
  primary: "#D6D9DE"
  background: "#0D0E0F"
  panel: "#202124"
  surface: "#2D2F33"
  foreground: "#F4F5F7"
  muted: "#ABAFB5"
  focus: "#EEF0F4"
typography:
  sans:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
  display:
    fontFamily: "Avenir Next, Century Gothic, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "10px"
  panel: "22px"
  pill: "999px"
spacing:
  tool-gap: "6px"
  editing-gap: "8px"
components:
  button: {}
  dialog: {}
  dock: {}
  inspector: {}
---

# Sistema visual de Lumay

## Overview

### Creative North Star

Cristal ahumado sobre una mesa negra, con una línea de luz plateada en los cantos. La referencia del usuario dicta el acabado de los controles. La foto ocupa el centro y aporta su propio color.

### Product context and register

- Editor local de herramientas manuales para escritorio y móvil, con interfaz en español.
- La cabecera sirve para abrir, comparar y exportar. El dock conserva la secuencia de herramientas y el inspector contextual usa el espacio inferior.
- Los reflejos lineales y el brillo diagonal distinguen las superficies de control. El lienzo mate mantiene la separación visual alrededor de la imagen.
- Los valores normativos se corresponden con las variables de `dist/style.css`. El favicon y el color del navegador reflejan los tonos básicos del mismo sistema.

## Colors

Cristal es el tema inicial. Aurora, Medianoche, Orquídea, Atardecer y Lima reutilizan la escala de cristal oscuro con acentos propios. Ajustes permite personalizar fondo, panel y acento. La interfaz adapta los colores personalizados al rango de contraste del cristal oscuro. El lienzo y la exportación mantienen el color de la imagen. El fondo inicial usa carbón. Paneles y controles usan gris humo y capas de luz neutra. La plata identifica la acción principal y los controles activos. Los números y las guías usan plata o blanco. El histograma por canales, los filtros y las muestras de pincel conservan su significado cromático.

## Typography

La marca une una L dibujada y una flecha de luz diagonal en un cuadrado de cristal ahumado. El mismo símbolo vive en inicio, cabecera y favicon. El nombre usa Avenir Next o Century Gothic cuando están disponibles. Los controles heredan el tipo de interfaz y las mediciones usan monoespaciada. Las familias locales evitan solicitudes externas.

## Layout

El inicio combina una acción principal para abrir archivos y una foto que permite probar el editor. En móvil, los controles se apilan sobre la muestra. En el editor, la foto domina la zona central y el zoom y Capas flotan en las esquinas inferiores. La cabecera reubica las acciones rápidas en una segunda fila en móvil y el dock conserva desplazamiento horizontal. El inspector tiene su propia zona desplazable.

## Elevation & Depth

Los paneles comparten un brillo diagonal tenue y un destello horizontal en el canto. La sombra separa las superficies flotantes. Los diálogos usan la misma familia de materiales que el dock.

## Shapes

Los paneles tienen 22 píxeles de radio. Los botones pequeños son circulares o en píldora. Las opciones del dock conservan etiquetas bajo iconos circulares. Los campos y las miniaturas tienen esquinas más discretas.

## Components

### Buttons and actions

Exportar y Aplicar usan plata sólida con texto oscuro. Los controles secundarios son de cristal oscuro. La selección combina borde visible y cambio de densidad con el estado accesible del botón. El enfoque de teclado usa un contorno propio de dos píxeles.

### Forms and overlays

El inspector permite editar y comparar en el mismo espacio. Los diálogos nativos se usan para acciones que requieren foco y los selectores conservan el menú del sistema. Los tiradores claros y las etiquetas muestran el valor del deslizador.

### Motion

El brillo y el desplazamiento físico distinguen hover y pulsación. Inicio, paneles y diálogos usan una entrada breve. La preferencia de movimiento reducido desactiva las transiciones y omite las entradas animadas.

### Content and data visualization

Las etiquetas describen acciones en español. El objetivo de los indicadores vivos es comunicar el estado de la edición, el zoom o la exportación.
