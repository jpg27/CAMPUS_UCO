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

export class ARView {
  constructor() {
    this._responderCallback = null;
    this._continuarCallback = null;
    this._panelesInteres = [];
    this._panelPregunta = null;
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
  // mismo espíritu que mostrarPuntosInteres() para Modo Libre. El tap sobre
  // cada opción se resuelve con el cursor+raycaster del <a-camera> (ver
  // ar.html), que dispara un evento 'click' sobre la entidad tocada.
  mostrarPreguntaAR(edificio, pregunta, targetEntity) {
    this.ocultarPreguntaAR();

    const panel = document.createElement('a-entity');
    panel.setAttribute('position', '0 0.48 0.05');

    const fondo = document.createElement('a-plane');
    fondo.setAttribute('width', '0.66');
    fondo.setAttribute('height', '0.86');
    fondo.setAttribute('color', '#1a2e1a');
    fondo.setAttribute('opacity', '0.92');
    panel.appendChild(fondo);

    const titulo = document.createElement('a-text');
    titulo.setAttribute('value', edificio.icono + ' ' + edificio.nombre);
    titulo.setAttribute('align', 'center');
    titulo.setAttribute('color', '#90EE90');
    titulo.setAttribute('width', '1.1');
    titulo.setAttribute('position', '0 0.36 0.01');
    panel.appendChild(titulo);

    const texto = document.createElement('a-text');
    texto.setAttribute('value', pregunta.pregunta);
    texto.setAttribute('align', 'center');
    texto.setAttribute('color', '#FFFFFF');
    texto.setAttribute('width', '0.95');
    texto.setAttribute('wrap-count', '28');
    texto.setAttribute('position', '0 0.24 0.01');
    panel.appendChild(texto);

    const opcionesTexto = {
      a: pregunta.opcion_a, b: pregunta.opcion_b,
      c: pregunta.opcion_c, d: pregunta.opcion_d
    };
    this._opcionesAR = {};

    ['a', 'b', 'c', 'd'].forEach((letra, i) => {
      const y = 0.10 - i * 0.12;

      const opcion = document.createElement('a-plane');
      opcion.setAttribute('class', 'clickable-opcion');
      opcion.setAttribute('width', '0.58');
      opcion.setAttribute('height', '0.095');
      opcion.setAttribute('color', '#2a4a1a');
      opcion.setAttribute('position', `0 ${y} 0.01`);

      const opcionTexto = document.createElement('a-text');
      opcionTexto.setAttribute('value', letra.toUpperCase() + ') ' + opcionesTexto[letra]);
      opcionTexto.setAttribute('align', 'center');
      opcionTexto.setAttribute('color', '#FFFFFF');
      opcionTexto.setAttribute('width', '1.0');
      opcionTexto.setAttribute('wrap-count', '32');
      opcionTexto.setAttribute('position', '0 0 0.01');
      opcion.appendChild(opcionTexto);

      opcion.addEventListener('click', () => {
        if (this._responderCallback) this._responderCallback(letra);
      });

      panel.appendChild(opcion);
      this._opcionesAR[letra] = opcion;
    });

    targetEntity.appendChild(panel);
    this._panelPregunta = panel;
  }

  marcarRespuestaAR(letraSeleccionada, letraCorrecta) {
    const esCorrecta = letraSeleccionada === letraCorrecta;

    Object.entries(this._opcionesAR || {}).forEach(([letra, entidad]) => {
      if (letra === letraCorrecta) {
        entidad.setAttribute('color', '#2e7d32');
      } else if (letra === letraSeleccionada) {
        entidad.setAttribute('color', '#c62828');
      } else {
        entidad.setAttribute('color', '#12200f');
        entidad.setAttribute('opacity', '0.5');
      }
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
  }

  _agregarBotonContinuarAR(panel) {
    const continuar = document.createElement('a-plane');
    continuar.setAttribute('class', 'clickable-continuar');
    continuar.setAttribute('width', '0.58');
    continuar.setAttribute('height', '0.09');
    continuar.setAttribute('color', '#3a7a1a');
    continuar.setAttribute('position', '0 -0.40 0.02');

    const texto = document.createElement('a-text');
    texto.setAttribute('value', 'Continuar →');
    texto.setAttribute('align', 'center');
    texto.setAttribute('color', '#FFFFFF');
    texto.setAttribute('width', '1.0');
    texto.setAttribute('position', '0 0 0.01');
    continuar.appendChild(texto);

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
