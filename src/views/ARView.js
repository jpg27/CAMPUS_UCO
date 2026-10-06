// ═══════════════════════════════════════════
// ARView.js — Vista de Realidad Aumentada
// Extraído fielmente de ar.html original
// ═══════════════════════════════════════════
import { obtenerEdificioInfo, PUNTOS } from '../config.js';
import { formatearHora } from '../utils/formatters.js';
import { icono } from './mapa/iconos.js';

// Desplazamiento (en metros, espacio local del marcador) de cada panel de
// punto de interés según hacia dónde queda ese punto en el mundo real
// respecto a donde se escanea el marcador. x: derecha(+)/izquierda(-),
// y: arriba(+)/abajo(-), z: hacia la cámara para que no quede tapado por el marcador.
const OFFSET_PUNTOS_INTERES = 0.28;
const DIRECCIONES_PUNTOS_INTERES = {
  'arriba':            { x:  0,                        y:  OFFSET_PUNTOS_INTERES,       z: 0.05 },
  'abajo':             { x:  0,                        y: -OFFSET_PUNTOS_INTERES,       z: 0.05 },
  'izquierda':         { x: -OFFSET_PUNTOS_INTERES,    y:  0,                            z: 0.05 },
  'derecha':           { x:  OFFSET_PUNTOS_INTERES,    y:  0,                            z: 0.05 },
  'arriba-izquierda':  { x: -OFFSET_PUNTOS_INTERES * 0.7, y:  OFFSET_PUNTOS_INTERES * 0.7, z: 0.05 },
  'arriba-derecha':    { x:  OFFSET_PUNTOS_INTERES * 0.7, y:  OFFSET_PUNTOS_INTERES * 0.7, z: 0.05 },
  'abajo-izquierda':   { x: -OFFSET_PUNTOS_INTERES * 0.7, y: -OFFSET_PUNTOS_INTERES * 0.7, z: 0.05 },
  'abajo-derecha':     { x:  OFFSET_PUNTOS_INTERES * 0.7, y: -OFFSET_PUNTOS_INTERES * 0.7, z: 0.05 },
  'centro':            { x:  0,                        y:  0,                            z: 0.05 }
};

// ═══════════════════════════════════════════
// Panel 3D de pregunta (Modo Carrera)
// ═══════════════════════════════════════════
// El panel se dibuja como textura de canvas para tener esquinas
// redondeadas y texto multilínea, con el mismo lenguaje visual del resto
// de la app (tarjeta blanca, borde suave, Inter, verde UCO). Las 4
// opciones y el mensaje de resultado NO se hornean en esa textura: son
// planos aparte, calculados para calzar exactamente en los huecos que la
// tarjeta deja para ellos, porque deben ser entidades individuales que el
// raycaster pueda detectar por separado.
//
// Abajo de la tarjeta hay un hueco reservado: antes de responder dice
// "Toca una opción para responder" y al responder muestra el resultado.
// Ya no hay botón "Continuar": el panel se cierra solo (ver ModoCarrera).
const PIXEL_SCALE = 3; // sobremuestreo para que no se vea borroso de cerca

const TARJETA = {
  anchoPx: 420,
  margen: 10,          // espacio alrededor para la sombra
  padX: 20,
  padArriba: 20,
  chipAlto: 30,
  chipGap: 14,
  preguntaFuente: 21,
  preguntaAltoLinea: 27,
  infoFuente: 13,
  infoGapArriba: 8,
  infoGapAbajo: 18,
  botonAlto: 58,
  botonGap: 10,
  continuarGap: 14,
  continuarAlto: 52,
  padAbajo: 20,
  radio: 24,
  anchoMetros: 0.60
};

const COLORES = {
  fondo:        '#FFFFFF',
  borde:        '#E2E9E5',
  texto:        '#123D2A',
  secundario:   '#71817A',
  verde:        '#087A45',
  tinte:        '#EAF5EE',
  tinteBorde:   '#C2DDCC',
  rojo:         '#B3261E',
  rojoTinte:    '#FDF0EF',
  grisTinte:    '#F1F4F2',
  sombra:       'rgba(18, 61, 42, 0.18)'
};

function fuenteApp(peso, px) {
  return `${peso} ${px}px Inter, 'Segoe UI', Arial, sans-serif`;
}

function trazarRectRedondeado(ctx, x, y, w, h, r) {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y,     x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x,     y + h, radio);
  ctx.arcTo(x,     y + h, x,     y,     radio);
  ctx.arcTo(x,     y,     x + w, y,     radio);
  ctx.closePath();
}

function partirEnLineas(ctx, texto, anchoMax) {
  const palabras = String(texto ?? '').split(' ');
  const lineas = [];
  let actual = '';
  palabras.forEach(palabra => {
    const prueba = actual ? actual + ' ' + palabra : palabra;
    if (ctx.measureText(prueba).width > anchoMax && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  });
  if (actual) lineas.push(actual);
  return lineas;
}

function nuevoCanvas(anchoPx, altoPx) {
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(anchoPx * PIXEL_SCALE);
  canvas.height = Math.round(altoPx  * PIXEL_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(PIXEL_SCALE, PIXEL_SCALE);
  return { canvas, ctx };
}

// Textura de la tarjeta: chip con el edificio, la pregunta, una línea de
// ayuda y los huecos de las opciones y del resultado. Calcula su altura
// según las líneas de la pregunta y devuelve dónde van las opciones y el
// botón (en px del canvas) para alinearlos exactos.
function crearTarjetaPreguntaCanvas(edificio, pregunta, penalizacion) {
  const t = TARJETA;
  const anchoInterno = t.anchoPx - (t.margen + t.padX) * 2;

  const medir = document.createElement('canvas').getContext('2d');
  medir.font = fuenteApp(700, t.preguntaFuente);
  const lineasPregunta = partirEnLineas(medir, pregunta.pregunta, anchoInterno);

  const cardTop       = t.margen;
  const chipTop       = cardTop + t.padArriba;
  const preguntaTop   = chipTop + t.chipAlto + t.chipGap;
  const infoTop       = preguntaTop + lineasPregunta.length * t.preguntaAltoLinea + t.infoGapArriba;
  const botonesTop    = infoTop + t.infoFuente + t.infoGapAbajo;
  const continuarTop  = botonesTop + 4 * t.botonAlto + 3 * t.botonGap + t.continuarGap;
  const cardBottom    = continuarTop + t.continuarAlto + t.padAbajo;
  const altoPx        = cardBottom + t.margen;

  const { canvas, ctx } = nuevoCanvas(t.anchoPx, altoPx);
  const cardX = t.margen, cardW = t.anchoPx - t.margen * 2, cardH = cardBottom - cardTop;

  // Tarjeta blanca con sombra suave y borde
  ctx.save();
  ctx.shadowColor = COLORES.sombra;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  trazarRectRedondeado(ctx, cardX, cardTop, cardW, cardH, t.radio);
  ctx.fillStyle = COLORES.fondo;
  ctx.fill();
  ctx.restore();
  trazarRectRedondeado(ctx, cardX + 0.75, cardTop + 0.75, cardW - 1.5, cardH - 1.5, t.radio);
  ctx.strokeStyle = COLORES.borde;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Chip con el nombre del edificio
  ctx.font = fuenteApp(600, 14);
  const nombre = edificio.nombre || '';
  const chipAncho = Math.min(anchoInterno, ctx.measureText(nombre).width + 32);
  const chipX = (t.anchoPx - chipAncho) / 2;
  trazarRectRedondeado(ctx, chipX, chipTop, chipAncho, t.chipAlto, t.chipAlto / 2);
  ctx.fillStyle = COLORES.tinte;
  ctx.fill();
  ctx.strokeStyle = COLORES.tinteBorde;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORES.verde;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nombre, t.anchoPx / 2, chipTop + t.chipAlto / 2 + 1, chipAncho - 20);

  // Pregunta
  ctx.font = fuenteApp(700, t.preguntaFuente);
  ctx.fillStyle = COLORES.texto;
  ctx.textBaseline = 'alphabetic';
  lineasPregunta.forEach((linea, i) => {
    ctx.fillText(linea, t.anchoPx / 2, preguntaTop + (i + 1) * t.preguntaAltoLinea - 6, anchoInterno);
  });

  // Línea de ayuda
  ctx.font = fuenteApp(500, t.infoFuente);
  ctx.fillStyle = COLORES.secundario;
  ctx.fillText(`Una respuesta incorrecta resta ${penalizacion} puntos`, t.anchoPx / 2, infoTop + t.infoFuente, anchoInterno);

  // Hueco del resultado: mientras no se responde, muestra una indicación
  ctx.font = fuenteApp(500, t.infoFuente);
  ctx.textBaseline = 'middle';
  ctx.fillText('Toca una opción para responder', t.anchoPx / 2, continuarTop + t.continuarAlto / 2, anchoInterno);

  return {
    canvas, altoPx,
    anchoPx: t.anchoPx,
    botonX: t.margen + t.padX,
    botonAncho: anchoInterno,
    botonesTop, botonAlto: t.botonAlto, botonGap: t.botonGap,
    continuarTop, continuarAlto: t.continuarAlto
  };
}

function dibujarCheck(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 6, cy + 0.5); ctx.lineTo(cx - 1.5, cy + 5); ctx.lineTo(cx + 6.5, cy - 4.5); ctx.stroke();
  ctx.restore();
}

function dibujarX(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();
  ctx.restore();
}

// Textura de una opción. estado: 'normal' | 'correcta' | 'incorrecta' | 'inactiva'
function crearOpcionCanvas({ anchoPx, altoPx, letra, texto, estado = 'normal' }) {
  const { canvas, ctx } = nuevoCanvas(anchoPx, altoPx);
  const estilos = {
    normal:     { fondo: COLORES.fondo,     borde: COLORES.borde, grosor: 1.5, circulo: COLORES.tinte,     letra: COLORES.verde,      texto: COLORES.texto },
    correcta:   { fondo: COLORES.tinte,     borde: COLORES.verde, grosor: 2,   circulo: COLORES.verde,     letra: '#FFFFFF',          texto: COLORES.texto },
    incorrecta: { fondo: COLORES.rojoTinte, borde: COLORES.rojo,  grosor: 2,   circulo: COLORES.rojo,      letra: '#FFFFFF',          texto: COLORES.texto },
    inactiva:   { fondo: COLORES.fondo,     borde: COLORES.borde, grosor: 1.5, circulo: COLORES.grisTinte, letra: COLORES.secundario, texto: COLORES.secundario }
  };
  const e = estilos[estado] || estilos.normal;
  const radio = 16;

  trazarRectRedondeado(ctx, e.grosor / 2, e.grosor / 2, anchoPx - e.grosor, altoPx - e.grosor, radio);
  ctx.fillStyle = e.fondo;
  ctx.fill();
  ctx.strokeStyle = e.borde;
  ctx.lineWidth = e.grosor;
  ctx.stroke();

  // Círculo con la letra (o ✓ / ✕ cuando ya se respondió)
  const d = 34, cx = 12 + d / 2, cy = altoPx / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.fillStyle = e.circulo;
  ctx.fill();
  if (estado === 'correcta') dibujarCheck(ctx, cx, cy, e.letra);
  else if (estado === 'incorrecta') dibujarX(ctx, cx, cy, e.letra);
  else {
    ctx.font = fuenteApp(700, 15);
    ctx.fillStyle = e.letra;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letra.toUpperCase(), cx, cy + 1);
  }

  // Texto: una línea a 17px; si no cabe, hasta dos líneas a 15px
  const xTexto = 12 + d + 12;
  const anchoTexto = anchoPx - xTexto - 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = e.texto;
  ctx.font = fuenteApp(600, 17);
  const textoStr = String(texto ?? '');
  if (ctx.measureText(textoStr).width <= anchoTexto) {
    ctx.fillText(textoStr, xTexto, altoPx / 2 + 1);
  } else {
    ctx.font = fuenteApp(600, 15);
    let lineas = partirEnLineas(ctx, textoStr, anchoTexto);
    if (lineas.length > 2) {
      lineas = [lineas[0], lineas.slice(1).join(' ')];
      let ultima = lineas[1];
      while (ultima && ctx.measureText(ultima + '…').width > anchoTexto) ultima = ultima.slice(0, -1);
      lineas[1] = ultima.trimEnd() + '…';
    }
    const altoLinea = 19;
    const y0 = altoPx / 2 - ((lineas.length - 1) * altoLinea) / 2 + 1;
    lineas.forEach((l, i) => ctx.fillText(l, xTexto, y0 + i * altoLinea, anchoTexto));
  }
  return canvas;
}

// Textura del mensaje de resultado (va en el hueco de abajo de la tarjeta
// cuando se responde; no es un botón: el panel se cierra solo).
function crearResultadoCanvas({ anchoPx, altoPx, acerto, penalizacion }) {
  const { canvas, ctx } = nuevoCanvas(anchoPx, altoPx);
  const fondo = acerto ? COLORES.tinte : COLORES.rojoTinte;
  const borde = acerto ? COLORES.tinteBorde : '#F3CFCC';
  const color = acerto ? COLORES.verde : COLORES.rojo;

  trazarRectRedondeado(ctx, 0.75, 0.75, anchoPx - 1.5, altoPx - 1.5, 14);
  ctx.fillStyle = fondo;
  ctx.fill();
  ctx.strokeStyle = borde;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const texto = acerto ? '¡Correcto! Edificio registrado' : `Incorrecto · −${penalizacion} puntos · Edificio registrado`;
  ctx.font = fuenteApp(700, 15);
  const anchoTexto = Math.min(ctx.measureText(texto).width, anchoPx - 70);
  const d = 22, gap = 10;
  const x0 = (anchoPx - (d + gap + anchoTexto)) / 2;
  const cy = altoPx / 2;

  ctx.beginPath();
  ctx.arc(x0 + d / 2, cy, d / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.translate(x0 + d / 2, cy);
  ctx.scale(0.7, 0.7);
  if (acerto) dibujarCheck(ctx, 0, 0, '#FFFFFF'); else dibujarX(ctx, 0, 0, '#FFFFFF');
  ctx.restore();

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x0 + d + gap, cy + 1, anchoTexto);
  return canvas;
}

// ═══════════════════════════════════════════
// Panel de punto de interés (Modo Libre)
// ═══════════════════════════════════════════
// Píldora blanca con borde suave, círculo verde muy claro con una flecha
// que apunta hacia donde queda el lugar, y el texto en Inter (la fuente
// que ar.html ya carga). El ancho se ajusta al texto; si es largo, pasa a
// varias líneas (máx. 3, luego corta con "…"). Mismo lenguaje visual que los pines y fichas del mapa.
const PANEL_INTERES = {
  margen: 14,          // espacio para la sombra alrededor de la píldora
  padIzq: 10,
  padDer: 22,
  circulo: 44,
  gap: 12,
  fuente: 22,
  altoLinea: 27,
  anchoTextoMax: 250,
  maxLineas: 3,
  altoMin: 64,
  metrosPorPx: 0.0011, // 250 px de texto ≈ 0.28 m en el marcador
  colores: {
    fondo:  '#FFFFFF',
    borde:  '#E2E9E5',
    texto:  '#123D2A',
    circulo:'#EAF5EE',
    icono:  '#087A45',
    sombra: 'rgba(18, 61, 42, 0.16)'
  }
};

// Grados de giro de la flecha (0 = hacia arriba) según la dirección del punto
const ANGULO_DIRECCION = {
  'arriba': 0, 'arriba-derecha': 45, 'derecha': 90, 'abajo-derecha': 135,
  'abajo': 180, 'abajo-izquierda': 225, 'izquierda': 270, 'arriba-izquierda': 315
};

function fuentePanel(peso, px) {
  return `${peso} ${px}px Inter, 'Segoe UI', Arial, sans-serif`;
}

function dibujarIconoDireccion(ctx, cx, cy, direccion, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const angulo = ANGULO_DIRECCION[direccion];
  if (angulo === undefined) {
    // 'centro' u otra: pin de ubicación
    ctx.beginPath();
    ctx.arc(0, -3, 7.5, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(0, 11);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(angulo * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(0, 10);  ctx.lineTo(0, -9);   // cuerpo
    ctx.moveTo(-7, -2); ctx.lineTo(0, -9); ctx.lineTo(7, -2); // punta
    ctx.stroke();
  }
  ctx.restore();
}

function crearPanelInteresCanvas(punto) {
  const t = PANEL_INTERES;
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = fuentePanel(600, t.fuente);
  let lineas = partirEnLineas(medir, punto.texto, t.anchoTextoMax);
  if (lineas.length > t.maxLineas) {
    // Texto demasiado largo: corta en la última línea visible con "…"
    lineas = lineas.slice(0, t.maxLineas);
    let ultima = lineas[t.maxLineas - 1];
    while (ultima && medir.measureText(ultima + '…').width > t.anchoTextoMax) ultima = ultima.slice(0, -1);
    lineas[t.maxLineas - 1] = ultima.trimEnd() + '…';
  }
  const anchoTexto = Math.min(t.anchoTextoMax, Math.max(...lineas.map(l => medir.measureText(l).width)));

  const altoPildora  = Math.max(t.altoMin, lineas.length * t.altoLinea + 26);
  const anchoPildora = t.padIzq + t.circulo + t.gap + anchoTexto + t.padDer;
  const anchoPx = anchoPildora + t.margen * 2;
  const altoPx  = altoPildora  + t.margen * 2;

  const canvas = document.createElement('canvas');
  canvas.width  = anchoPx * PIXEL_SCALE;
  canvas.height = altoPx  * PIXEL_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(PIXEL_SCALE, PIXEL_SCALE);

  const x = t.margen, y = t.margen;
  const radio = lineas.length > 1 ? 22 : altoPildora / 2;

  // Píldora con sombra suave
  ctx.save();
  ctx.shadowColor = t.colores.sombra;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  trazarRectRedondeado(ctx, x, y, anchoPildora, altoPildora, radio);
  ctx.fillStyle = t.colores.fondo;
  ctx.fill();
  ctx.restore();
  trazarRectRedondeado(ctx, x + 0.75, y + 0.75, anchoPildora - 1.5, altoPildora - 1.5, radio);
  ctx.strokeStyle = t.colores.borde;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Círculo con la flecha
  const cx = x + t.padIzq + t.circulo / 2;
  const cy = y + altoPildora / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, t.circulo / 2, 0, Math.PI * 2);
  ctx.fillStyle = t.colores.circulo;
  ctx.fill();
  dibujarIconoDireccion(ctx, cx, cy, punto.direccion, t.colores.icono);

  // Texto
  ctx.font = fuentePanel(600, t.fuente);
  ctx.fillStyle = t.colores.texto;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const xTexto = x + t.padIzq + t.circulo + t.gap;
  const yInicio = cy - ((lineas.length - 1) * t.altoLinea) / 2;
  lineas.forEach((linea, i) => ctx.fillText(linea, xTexto, yInicio + i * t.altoLinea + 1, anchoTexto));

  return { canvas, anchoM: anchoPx * t.metrosPorPx, altoM: altoPx * t.metrosPorPx };
}

export class ARView {
  constructor() {
    this._responderCallback = null;
    this._continuarCallback = null;
    this._panelesInteres = [];
    document.fonts?.load(fuentePanel(600, PANEL_INTERES.fuente)).catch(() => {});
    this._panelPregunta = null;
    this._opcionesAR = null;
    this._opcionesTextoAR = null;
    this._continuarEntidad = null;
    this._continuarLayout = null;
    this._pxToM = 0;
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
  }

  init() {
    // Detección de tap sobre las opciones de la pregunta 3D (Modo
    // Carrera). No usa el cursor/raycaster integrado de A-Frame —igual
    // que mostrarPuntosInteres, el panel se crea dinámicamente y en la
    // práctica ese mecanismo no respondía de forma confiable con MindAR
    // ni en PC ni en celular. En vez de eso, se escucha 'click' (mouse)
    // y 'touchend' (táctil) directamente sobre window y se hace
    // raycasting manual con Three.js: el mismo patrón que ya usa
    // MapaView/MapaController para los bloques del mapa, que sí funciona
    // en ambos dispositivos.
    // En celular, después de cada 'touchend' el navegador dispara un 'click'
    // sintético en el mismo punto: se ignora para no procesar el toque dos veces.
    let ultimoToque = 0;
    window.addEventListener('click', (e) => {
      if (Date.now() - ultimoToque < 700) return;
      this._manejarTap(e.clientX, e.clientY);
    });
    window.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      ultimoToque = Date.now();
      this._manejarTap(t.clientX, t.clientY);
    });
  }

  // Busca si el punto de pantalla (clientX, clientY) cae sobre alguna de
  // las opciones o el botón "Continuar" del panel de pregunta activo, y
  // dispara el callback correspondiente. No hace nada si no hay pregunta
  // visible en ese momento (this._panelPregunta === null) — eso además
  // evita que un 'click' sintético que el navegador dispara ~300ms
  // después de un 'touchend' vuelva a procesar el mismo tap dos veces,
  // porque para entonces el panel ya se ocultó (ver ocultarPreguntaAR).
  _manejarTap(clientX, clientY) {
    if (!this._panelPregunta) return;

    const escena = document.querySelector('a-scene');
    const camara = escena && escena.camera;
    if (!camara) return;

    // MindAR agranda el canvas para cubrir la pantalla con el video (puede
    // quedar más grande que la ventana y desplazado). Las coordenadas se
    // calculan respecto al canvas real, no a la ventana; si no, los toques
    // caen corridos y a veces no aciertan la opción o "Continuar".
    const lienzo = escena.renderer?.domElement || escena.canvas;
    const r = lienzo ? lienzo.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    this._mouse.x =  ((clientX - r.left) / r.width)  * 2 - 1;
    this._mouse.y = -((clientY - r.top)  / r.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, camara);

    const objetos = [];
    Object.values(this._opcionesAR || {}).forEach(info => {
      if (info.entidad.object3D) objetos.push(info.entidad.object3D);
    });
    if (this._continuarEntidad && this._continuarEntidad.object3D) {
      objetos.push(this._continuarEntidad.object3D);
    }
    if (objetos.length === 0) return;

    const hits = this._raycaster.intersectObjects(objetos, true);
    if (hits.length === 0) return;

    // intersectObjects con recursive:true puede devolver un hijo interno
    // (la malla del a-plane) en vez de la entidad raíz — subimos hasta
    // encontrar el object3D que A-Frame sí conecta de vuelta al elemento.
    let objetoTocado = hits[0].object;
    while (objetoTocado && !objetoTocado.el) objetoTocado = objetoTocado.parent;
    const entidadTocada = objetoTocado && objetoTocado.el;
    if (!entidadTocada) return;

    if (entidadTocada.classList.contains('clickable-opcion')) {
      const par = Object.entries(this._opcionesAR).find(([, info]) => info.entidad === entidadTocada);
      if (par && this._responderCallback) this._responderCallback(par[0]);
    } else if (entidadTocada.classList.contains('clickable-continuar')) {
      if (this._continuarCallback) this._continuarCallback();
    }
  }

  mostrarSinSesion() {
    document.getElementById('sin-sesion').style.display = 'flex';
  }

  mostrarSesionCerrada() {
    // Usa la estructura del modal de ar.html: cambia el estado a "finalizada"
    // (icono de bandera en verde) y actualiza solo los textos, sin tocar los iconos.
    document.getElementById('sin-sesion-modal').classList.add('finalizada');
    document.getElementById('sin-sesion-titulo').textContent       = 'Carrera finalizada';
    document.getElementById('sin-sesion-texto').textContent        = 'El administrador cerró la carrera.';
    document.getElementById('sin-sesion-enlace-texto').textContent = 'Ir al inicio';
    document.getElementById('sin-sesion-enlace').href              = 'index.html';
    document.getElementById('sin-sesion').style.display = 'flex';
  }

  // ── Paneles 3D de puntos de interés (Modo Libre, Cambio 1) ──
  mostrarPuntosInteres(edificio, targetEntity) {
    this.ocultarPuntosInteres();

    const puntos = edificio.puntosDeInteres || [];
    this._panelesInteres = puntos.map(punto => {
      const offset = DIRECCIONES_PUNTOS_INTERES[punto.direccion] || DIRECCIONES_PUNTOS_INTERES.centro;
      const { canvas, anchoM, altoM } = crearPanelInteresCanvas(punto);

      const panel = document.createElement('a-plane');
      panel.setAttribute('class', 'panel-interes');
      panel.setAttribute('position', `${offset.x} ${offset.y} ${offset.z}`);
      panel.setAttribute('width',  anchoM.toFixed(4));
      panel.setAttribute('height', altoM.toFixed(4));
      panel.setAttribute('material', { shader: 'flat', src: canvas, transparent: true, alphaTest: 0.02 });

      targetEntity.appendChild(panel);
      return panel;
    });
  }

  ocultarPuntosInteres() {
    this._panelesInteres.forEach(panel => panel.remove());
    this._panelesInteres = [];
  }

  ocultarPuntos() {
    const el = document.getElementById('display-puntos');
    if (el) el.style.display = 'none';
  }

  ocultarBotonLogros() {
    const btn = document.getElementById('btn-logros');
    if (btn) btn.style.display = 'none';
  }

  // ── Panel 3D de pregunta (Modo Carrera) ──
  // Reemplaza el antiguo modal HTML 2D: la pregunta y sus opciones ahora
  // son entidades A-Frame ancladas al propio marcador (targetEntity), en el
  // mismo espíritu que mostrarPuntosInteres() para Modo Libre, pero con
  // estilo de tarjeta (esquinas redondeadas, píldoras, degradados) en vez
  // de rectángulos de color plano — ver los helpers de canvas arriba. El
  // tap sobre cada opción se resuelve con el cursor+raycaster del
  // <a-camera> (ver ar.html), que dispara un evento 'click' sobre la
  // entidad tocada.
  mostrarPreguntaAR(edificio, pregunta, targetEntity) {
    this.ocultarPreguntaAR();
    document.fonts?.load(fuenteApp(700, 21)).catch(() => {});

    const tarjeta = crearTarjetaPreguntaCanvas(edificio, pregunta, PUNTOS.PENALIZACION);
    const pxToM = TARJETA.anchoMetros / tarjeta.anchoPx;
    const altoMetros = tarjeta.altoPx * pxToM;
    // Convierte una coordenada vertical del canvas (px) a metros del panel
    const yPanel = (px) => altoMetros / 2 - px * pxToM;

    const panel = document.createElement('a-entity');
    panel.setAttribute('position', `0 ${(altoMetros / 2 + 0.06).toFixed(4)} 0.05`);

    const fondo = document.createElement('a-plane');
    fondo.setAttribute('width', TARJETA.anchoMetros.toFixed(4));
    fondo.setAttribute('height', altoMetros.toFixed(4));
    fondo.setAttribute('position', '0 0 0');
    fondo.setAttribute('material', { shader: 'flat', src: tarjeta.canvas, transparent: true, alphaTest: 0.02 });
    panel.appendChild(fondo);

    const opcionesTexto = {
      a: pregunta.opcion_a, b: pregunta.opcion_b,
      c: pregunta.opcion_c, d: pregunta.opcion_d
    };
    this._opcionesAR = {};
    this._opcionesTextoAR = opcionesTexto;

    // Centro horizontal de los botones respecto al centro del panel
    const xBoton = ((tarjeta.botonX + tarjeta.botonAncho / 2) - tarjeta.anchoPx / 2) * pxToM;

    ['a', 'b', 'c', 'd'].forEach((letra, i) => {
      const centroPx = tarjeta.botonesTop + i * (tarjeta.botonAlto + tarjeta.botonGap) + tarjeta.botonAlto / 2;

      const opcion = document.createElement('a-plane');
      opcion.setAttribute('class', 'clickable-opcion');
      opcion.setAttribute('width', (tarjeta.botonAncho * pxToM).toFixed(4));
      opcion.setAttribute('height', (tarjeta.botonAlto * pxToM).toFixed(4));
      opcion.setAttribute('position', `${xBoton.toFixed(4)} ${yPanel(centroPx).toFixed(4)} 0.01`);
      opcion.setAttribute('material', {
        shader: 'flat', transparent: true, alphaTest: 0.02,
        src: crearOpcionCanvas({ anchoPx: tarjeta.botonAncho, altoPx: tarjeta.botonAlto, letra, texto: opcionesTexto[letra] })
      });

      panel.appendChild(opcion);
      this._opcionesAR[letra] = { entidad: opcion, anchoPx: tarjeta.botonAncho, altoPx: tarjeta.botonAlto };
    });

    targetEntity.appendChild(panel);
    this._panelPregunta = panel;
    this._pxToM = pxToM;
    // Dónde va el mensaje de resultado (hueco reservado dentro de la tarjeta)
    this._continuarLayout = {
      x: xBoton,
      y: yPanel(tarjeta.continuarTop + tarjeta.continuarAlto / 2),
      anchoPx: tarjeta.botonAncho,
      altoPx: tarjeta.continuarAlto
    };
  }

  marcarRespuestaAR(letraSeleccionada, letraCorrecta) {
    const esCorrecta = letraSeleccionada === letraCorrecta;

    Object.entries(this._opcionesAR || {}).forEach(([letra, info]) => {
      let estado = 'inactiva';
      if (letra === letraCorrecta) estado = 'correcta';
      else if (letra === letraSeleccionada) estado = 'incorrecta';

      info.entidad.setAttribute('material', {
        shader: 'flat', transparent: true, alphaTest: 0.02,
        src: crearOpcionCanvas({ anchoPx: info.anchoPx, altoPx: info.altoPx, letra, texto: this._opcionesTextoAR[letra], estado })
      });
    });

    if (this._panelPregunta) this._mostrarResultadoAR(this._panelPregunta, esCorrecta);
    return esCorrecta;
  }

  ocultarPreguntaAR() {
    if (this._panelPregunta) {
      this._panelPregunta.remove();
      this._panelPregunta = null;
    }
    this._opcionesAR = null;
    this._opcionesTextoAR = null;
    this._continuarEntidad = null;
    this._resultadoEntidad = null;
    this._continuarLayout = null;
  }

  _mostrarResultadoAR(panel, acerto) {
    const l = this._continuarLayout;
    if (!l || this._resultadoEntidad) return;

    const resultado = document.createElement('a-plane');
    resultado.setAttribute('width', (l.anchoPx * this._pxToM).toFixed(4));
    resultado.setAttribute('height', (l.altoPx * this._pxToM).toFixed(4));
    resultado.setAttribute('position', `${l.x.toFixed(4)} ${l.y.toFixed(4)} 0.02`);
    resultado.setAttribute('material', {
      shader: 'flat', transparent: true, alphaTest: 0.02,
      src: crearResultadoCanvas({ anchoPx: l.anchoPx, altoPx: l.altoPx, acerto, penalizacion: PUNTOS.PENALIZACION })
    });

    panel.appendChild(resultado);
    this._resultadoEntidad = resultado;
  }

  onResponder(callback) {
    this._responderCallback = callback;
  }

  onContinuar(callback) {
    this._continuarCallback = callback;
  }

  // ── Panel de logros ──
  renderizarLogros(edificiosSesion, escaneos, puntosTotal) {
    const escaneadosIds = (escaneos || []).map(e => e.edificio_id);
    const total         = edificiosSesion ? edificiosSesion.length : 0;
    const completados   = Math.min(escaneadosIds.length, total);
    const porcentaje    = total > 0 ? (completados / total) * 100 : 0;

    document.getElementById('logros-puntos').textContent         = puntosTotal;
    document.getElementById('logros-texto-progreso').textContent = `${completados} / ${total} edificios`;
    document.getElementById('logros-barra').style.width          = porcentaje + '%';

    const lista = document.getElementById('logros-lista');
    if (!edificiosSesion || edificiosSesion.length === 0) {
      lista.innerHTML = '<li class="ar-logros-vacio">Esta carrera todavía no tiene edificios.</li>';
      return;
    }

    lista.innerHTML = edificiosSesion.map(ed => {
      const escaneado = escaneadosIds.includes(ed.edificio_id);
      const info      = obtenerEdificioInfo(ed.edificio_id);
      const escaneo   = (escaneos || []).find(e => e.edificio_id === ed.edificio_id);
      const hora      = escaneo ? formatearHora(escaneo.escaneado_en) : null;
      const pts       = escaneo?.puntos || 0;
      const acierto   = escaneo?.respondio_correctamente;
      const resultado = acierto === true ? ', <span class="ok">respuesta correcta</span>'
                      : acierto === false ? ', <span class="mal">respuesta incorrecta</span>' : '';

      return `
        <li class="ar-logro ${escaneado ? 'hecho' : ''}">
          <span class="ar-logro-icono">${icono(escaneado ? 'check' : 'candado')}</span>
          <div class="ar-logro-info">
            <div class="ar-logro-nombre">${info.nombre}</div>
            <div class="ar-logro-estado">${escaneado ? `Escaneado a las ${hora}${resultado}` : 'Pendiente'}</div>
          </div>
          ${escaneado ? `<span class="ar-logro-pts">${pts} pts</span>` : ''}
        </li>
      `;
    }).join('');
  }

  mostrarLogros() {
    document.getElementById('panel-logros').classList.add('visible');
  }

  ocultarLogros() {
    document.getElementById('panel-logros').classList.remove('visible');
  }

  mostrarPantallaFinalizacion(nombre, puntos, tiempo, { sesion = null, fecha = new Date() } = {}) {
    document.getElementById('fin-nombre').textContent = nombre;
    document.getElementById('fin-puntos').textContent = puntos;
    document.getElementById('fin-tiempo').textContent = tiempo;
    // Sesión y fecha/hora en la captura de pantalla, para que el organizador
    // pueda comprobar que es de esta carrera.
    const cuando = fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const meta = document.getElementById('fin-meta');
    if (meta) meta.textContent = sesion ? `${sesion.nombre || 'Carrera'} (${sesion.codigo || ''}), ${cuando}` : cuando;
    document.getElementById('panel-finalizacion').classList.add('visible');
  }

  detenerAR() {
    const escena = document.querySelector('a-scene');
    if (escena && escena.systems['mindar-image-system']) {
      escena.systems['mindar-image-system'].stop();
    }
    const video = document.querySelector('video');
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }
}