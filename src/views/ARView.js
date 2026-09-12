// ═══════════════════════════════════════════
// ARView.js — Vista de Realidad Aumentada
// Extraído fielmente de ar.html original
// ═══════════════════════════════════════════
import { obtenerEdificioInfo } from '../config.js';
import { formatearHora } from '../utils/formatters.js';

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
// Estilo "tarjeta" del panel 3D de pregunta (Modo Carrera)
// ═══════════════════════════════════════════
// El panel se dibuja como textura de canvas (no como a-plane de color
// plano + a-text) para poder tener esquinas redondeadas, degradados y
// texto multilínea de verdad, como una tarjeta de UI normal. Las 4
// opciones NO se hornean en esa textura: son planos aparte, calculados
// para calzar exactamente en el espacio que la tarjeta deja para ellas,
// porque necesitan seguir siendo entidades individuales que el
// raycaster del <a-camera> pueda detectar por separado (ver ar.html).
const PIXEL_SCALE = 3; // sobremuestreo para que no se vea borroso de cerca

const TARJETA = {
  anchoPx: 420,
  padX: 22,
  headerAlto: 52,
  headerAncho: 232,
  headerSolape: 22,
  radioTarjeta: 26,
  preguntaFuente: 22,
  preguntaAltoLinea: 27,
  preguntaGapArriba: 20,
  infoFuente: 13,
  infoGapArriba: 10,
  infoGapAbajo: 18,
  botonAlto: 58,
  botonGap: 12,
  paddingAbajo: 22,
  anchoMetros: 0.60
};

const COLOR_OPCION     = ['#1f8066', '#145341'];
const COLOR_CORRECTA   = ['#3fa142', '#256b28'];
const COLOR_INCORRECTA = ['#d9453f', '#9c2622'];
const COLOR_INACTIVA   = ['#5c6560', '#3d4440'];
const COLOR_CONTINUAR  = ['#1c2430', '#0c1015'];

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
  const palabras = texto.split(' ');
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

// Textura de la tarjeta: píldora de título + cuerpo con la pregunta.
// Calcula su propia altura según cuántas líneas necesita la pregunta, y
// devuelve dónde debe empezar el bloque de 4 opciones (en px del
// canvas) para que quien las dibuje aparte pueda alinearlas exactas.
function crearTarjetaPreguntaCanvas(edificio, pregunta) {
  const t = TARJETA;
  const medibujo = document.createElement('canvas').getContext('2d');
  medibujo.font = `bold ${t.preguntaFuente}px Arial`;
  const lineasPregunta = partirEnLineas(medibujo, pregunta.pregunta, t.anchoPx - t.padX * 2);

  const cardFillTop        = t.headerAlto - t.headerSolape;
  const contentTop         = cardFillTop + t.preguntaGapArriba;
  const preguntaAltoBloque = lineasPregunta.length * t.preguntaAltoLinea;
  const infoTop            = contentTop + preguntaAltoBloque + t.infoGapArriba;
  const botonesTop         = infoTop + t.infoFuente + t.infoGapAbajo;
  const botonesAltoBloque  = 4 * t.botonAlto + 3 * t.botonGap;
  const altoPx             = botonesTop + botonesAltoBloque + t.paddingAbajo;

  const canvas = document.createElement('canvas');
  canvas.width  = t.anchoPx * PIXEL_SCALE;
  canvas.height = altoPx    * PIXEL_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(PIXEL_SCALE, PIXEL_SCALE);

  // Cuerpo blanco/crema con esquinas redondeadas
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur    = 16;
  ctx.shadowOffsetY = 8;
  trazarRectRedondeado(ctx, 6, cardFillTop, t.anchoPx - 12, altoPx - cardFillTop - 6, t.radioTarjeta);
  ctx.fillStyle = '#f4efe4';
  ctx.fill();
  ctx.restore();

  // Píldora del título, flotando sobre el borde superior de la tarjeta
  const headerX = (t.anchoPx - t.headerAncho) / 2;
  trazarRectRedondeado(ctx, headerX, 0, t.headerAncho, t.headerAlto, t.headerAlto / 2);
  const gradHeader = ctx.createLinearGradient(0, 0, 0, t.headerAlto);
  gradHeader.addColorStop(0, '#1c2430');
  gradHeader.addColorStop(1, '#0c1015');
  ctx.fillStyle = gradHeader;
  ctx.fill();

  // Título en dos tonos: primera palabra en blanco, el resto en verde
  // (p.ej. "Bloque" blanco + "INNOVA" verde). Si el nombre es una sola
  // palabra, queda toda en blanco.
  ctx.font = `bold ${Math.round(t.headerAlto * 0.36)}px Arial`;
  ctx.textBaseline = 'middle';
  const partes  = edificio.nombre.split(' ');
  const primera = partes[0];
  const resto   = partes.slice(1).join(' ');
  const anchoPrimera = ctx.measureText(primera).width;
  const anchoResto   = resto ? ctx.measureText(' ' + resto).width : 0;
  const x0 = t.anchoPx / 2 - (anchoPrimera + anchoResto) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(primera, x0, t.headerAlto / 2 + 1);
  if (resto) {
    ctx.fillStyle = '#4ade80';
    ctx.fillText(' ' + resto, x0 + anchoPrimera, t.headerAlto / 2 + 1);
  }

  // Pregunta
  ctx.font = `bold ${t.preguntaFuente}px Arial`;
  ctx.fillStyle = '#182238';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  lineasPregunta.forEach((linea, i) => {
    ctx.fillText(linea, t.anchoPx / 2, contentTop + (i + 1) * t.preguntaAltoLinea - 6, t.anchoPx - t.padX * 2);
  });

  // Info de puntos (igual a la que tenía el modal 2D)
  ctx.font = `${t.infoFuente}px Arial`;
  ctx.fillStyle = '#8a8a86';
  ctx.fillText(
    '✅ +0 pts si aciertas · ❌ -100 pts si fallas',
    t.anchoPx / 2, infoTop + t.infoFuente, t.anchoPx - t.padX * 2
  );

  return { canvas, anchoPx: t.anchoPx, altoPx, botonesTop, botonAlto: t.botonAlto, botonGap: t.botonGap, padX: t.padX };
}

// Textura de una píldora clicable (una opción, o el botón "Continuar").
function crearPildoraCanvas({ anchoPx, altoPx, texto, colorTop, colorBottom, align = 'left' }) {
  const canvas = document.createElement('canvas');
  canvas.width  = anchoPx * PIXEL_SCALE;
  canvas.height = altoPx  * PIXEL_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(PIXEL_SCALE, PIXEL_SCALE);

  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur    = 5;
  ctx.shadowOffsetY = 3;
  trazarRectRedondeado(ctx, 0, 0, anchoPx, altoPx, altoPx / 2);
  const grad = ctx.createLinearGradient(0, 0, 0, altoPx);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Brillo superior sutil, efecto de bisel
  trazarRectRedondeado(ctx, 3, 3, anchoPx - 6, altoPx * 0.4, altoPx / 2 - 3);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();

  ctx.font = `bold ${Math.round(altoPx * 0.32)}px Arial`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const tx = align === 'center' ? anchoPx / 2 : altoPx * 0.42;
  ctx.fillText(texto, tx, altoPx / 2 + 1, anchoPx - (align === 'center' ? 32 : altoPx * 0.6));

  return canvas;
}

export class ARView {
  constructor() {
    this._responderCallback = null;
    this._continuarCallback = null;
    this._panelesInteres = [];
    this._panelPregunta = null;
    this._opcionesAR = null;
    this._opcionesTextoAR = null;
    this._panelAltoMetros = 0;
    this._pxToM = 0;
  }

  init() {
    // La pregunta de trivia (Modo Carrera) se muestra en un panel 3D
    // anclado al marcador (ver mostrarPreguntaAR más abajo), no en botones
    // HTML fijos — por eso aquí no hay nada que conectar de entrada. Los
    // listeners de cada opción y del botón "Continuar" se agregan cuando
    // se crea el panel, sobre las entidades 3D correspondientes.
  }

  mostrarSinSesion() {
    document.getElementById('sin-sesion').style.display = 'flex';
  }

  mostrarSesionCerrada() {
    const modal = document.querySelector('.sin-sesion-modal');
    modal.querySelector('h2').textContent = '⏹️ Carrera finalizada';
    modal.querySelector('p').textContent  = 'El administrador cerró la carrera.';
    modal.querySelector('a').textContent  = '🏠 Ir al inicio';
    modal.querySelector('a').href         = 'index.html';
    document.getElementById('sin-sesion').style.display = 'flex';
  }

  // ── Paneles 3D de puntos de interés (Modo Libre, Cambio 1) ──
  mostrarPuntosInteres(edificio, targetEntity) {
    this.ocultarPuntosInteres();

    const puntos = edificio.puntosDeInteres || [];
    this._panelesInteres = puntos.map(punto => {
      const offset = DIRECCIONES_PUNTOS_INTERES[punto.direccion] || DIRECCIONES_PUNTOS_INTERES.centro;

      const panel = document.createElement('a-entity');
      panel.setAttribute('position', `${offset.x} ${offset.y} ${offset.z}`);

      const fondo = document.createElement('a-plane');
      fondo.setAttribute('width', '0.34');
      fondo.setAttribute('height', '0.16');
      fondo.setAttribute('color', '#1a2e1a');
      fondo.setAttribute('opacity', '0.85');
      panel.appendChild(fondo);

      const texto = document.createElement('a-text');
      texto.setAttribute('value', punto.texto);
      texto.setAttribute('align', 'center');
      texto.setAttribute('color', '#FFFFFF');
      texto.setAttribute('width', '0.62');
      texto.setAttribute('position', '0 0 0.01');
      panel.appendChild(texto);

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

    const tarjeta = crearTarjetaPreguntaCanvas(edificio, pregunta);
    const pxToM = TARJETA.anchoMetros / tarjeta.anchoPx;
    const altoMetros = tarjeta.altoPx * pxToM;

    const panel = document.createElement('a-entity');
    panel.setAttribute('position', `0 ${(altoMetros / 2 + 0.06).toFixed(4)} 0.05`);

    const fondo = document.createElement('a-plane');
    fondo.setAttribute('width', TARJETA.anchoMetros.toFixed(4));
    fondo.setAttribute('height', altoMetros.toFixed(4));
    fondo.setAttribute('position', '0 0 0');
    fondo.setAttribute('material', { shader: 'flat', src: tarjeta.canvas, transparent: true, alphaTest: 0.05 });
    panel.appendChild(fondo);

    const opcionesTexto = {
      a: pregunta.opcion_a, b: pregunta.opcion_b,
      c: pregunta.opcion_c, d: pregunta.opcion_d
    };
    this._opcionesAR = {};
    this._opcionesTextoAR = opcionesTexto;

    const btnAnchoPx = tarjeta.anchoPx - tarjeta.padX * 2;
    ['a', 'b', 'c', 'd'].forEach((letra, i) => {
      const centroPx = tarjeta.botonesTop + i * (tarjeta.botonAlto + tarjeta.botonGap) + tarjeta.botonAlto / 2;
      const y = altoMetros / 2 - centroPx * pxToM;

      const opcion = document.createElement('a-plane');
      opcion.setAttribute('class', 'clickable-opcion');
      opcion.setAttribute('width', (btnAnchoPx * pxToM).toFixed(4));
      opcion.setAttribute('height', (tarjeta.botonAlto * pxToM).toFixed(4));
      opcion.setAttribute('position', `0 ${y.toFixed(4)} 0.01`);
      opcion.setAttribute('material', {
        shader: 'flat', transparent: true, alphaTest: 0.05,
        src: crearPildoraCanvas({
          anchoPx: btnAnchoPx, altoPx: tarjeta.botonAlto,
          texto: `${letra.toUpperCase()})  ${opcionesTexto[letra]}`,
          colorTop: COLOR_OPCION[0], colorBottom: COLOR_OPCION[1]
        })
      });

      opcion.addEventListener('click', () => {
        if (this._responderCallback) this._responderCallback(letra);
      });

      panel.appendChild(opcion);
      this._opcionesAR[letra] = { entidad: opcion, anchoPx: btnAnchoPx, altoPx: tarjeta.botonAlto };
    });

    targetEntity.appendChild(panel);
    this._panelPregunta = panel;
    this._panelAltoMetros = altoMetros;
    this._pxToM = pxToM;
  }

  marcarRespuestaAR(letraSeleccionada, letraCorrecta) {
    const esCorrecta = letraSeleccionada === letraCorrecta;

    Object.entries(this._opcionesAR || {}).forEach(([letra, info]) => {
      let colores = COLOR_INACTIVA;
      if (letra === letraCorrecta) colores = COLOR_CORRECTA;
      else if (letra === letraSeleccionada) colores = COLOR_INCORRECTA;

      info.entidad.setAttribute('material', {
        shader: 'flat', transparent: true, alphaTest: 0.05,
        src: crearPildoraCanvas({
          anchoPx: info.anchoPx, altoPx: info.altoPx,
          texto: `${letra.toUpperCase()})  ${this._opcionesTextoAR[letra]}`,
          colorTop: colores[0], colorBottom: colores[1]
        })
      });
    });

    if (this._panelPregunta) this._agregarBotonContinuarAR(this._panelPregunta);
    return esCorrecta;
  }

  ocultarPreguntaAR() {
    if (this._panelPregunta) {
      this._panelPregunta.remove();
      this._panelPregunta = null;
    }
    this._opcionesAR = null;
    this._opcionesTextoAR = null;
  }

  _agregarBotonContinuarAR(panel) {
    const anchoPx = 260, altoPx = 54;
    const y = -this._panelAltoMetros / 2 - 0.05 - (altoPx * this._pxToM) / 2;

    const continuar = document.createElement('a-plane');
    continuar.setAttribute('class', 'clickable-continuar');
    continuar.setAttribute('width', (anchoPx * this._pxToM).toFixed(4));
    continuar.setAttribute('height', (altoPx * this._pxToM).toFixed(4));
    continuar.setAttribute('position', `0 ${y.toFixed(4)} 0.02`);
    continuar.setAttribute('material', {
      shader: 'flat', transparent: true, alphaTest: 0.05,
      src: crearPildoraCanvas({
        anchoPx, altoPx, texto: 'Continuar →', align: 'center',
        colorTop: COLOR_CONTINUAR[0], colorBottom: COLOR_CONTINUAR[1]
      })
    });

    continuar.addEventListener('click', () => {
      if (this._continuarCallback) this._continuarCallback();
    });

    panel.appendChild(continuar);
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
      lista.innerHTML = '<p style="text-align:center;color:#888;">No hay edificios</p>';
      return;
    }

    lista.innerHTML = edificiosSesion.map(ed => {
      const escaneado = escaneadosIds.includes(ed.edificio_id);
      const info      = obtenerEdificioInfo(ed.edificio_id);
      const escaneo   = (escaneos || []).find(e => e.edificio_id === ed.edificio_id);
      const hora      = escaneo ? formatearHora(escaneo.escaneado_en) : null;
      const pts       = escaneo?.puntos || 0;
      const acierto   = escaneo?.respondio_correctamente;

      return `
        <div class="edificio-logro ${escaneado ? 'done' : ''}">
          <div class="icono">${info.icono}</div>
          <div class="info">
            <div class="nombre">${info.nombre}</div>
            <div class="sub">
              ${escaneado
                ? `✅ ${hora} · ⭐ ${pts} pts ${acierto === true ? '· 🎯 Correcto' : acierto === false ? '· ❌ Incorrecto' : ''}`
                : '⏳ Pendiente'}
            </div>
          </div>
          <div class="trofeo">${escaneado ? '🏆' : '🔒'}</div>
        </div>
      `;
    }).join('');
  }

  mostrarLogros() {
    document.getElementById('panel-logros').classList.add('visible');
  }

  ocultarLogros() {
    document.getElementById('panel-logros').classList.remove('visible');
  }

  mostrarPantallaFinalizacion(nombre, puntos, tiempo) {
    document.getElementById('fin-nombre').textContent = nombre;
    document.getElementById('fin-puntos').textContent = puntos;
    document.getElementById('fin-tiempo').textContent = tiempo;
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
