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
  }

  init() {
    // Conectar botones de opciones
    ['a', 'b', 'c', 'd'].forEach(letra => {
      const btn = document.getElementById('opcion-' + letra);
      if (btn) {
        btn.addEventListener('click', () => {
          if (this._responderCallback) this._responderCallback(letra);
        });
      }
    });

    // Conectar botón continuar
    const btnContinuar = document.getElementById('btn-continuar');
    if (btnContinuar) {
      btnContinuar.addEventListener('click', () => {
        if (this._continuarCallback) this._continuarCallback();
      });
    }
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

  mostrarModalPregunta(edificio, pregunta) {
    document.getElementById('preg-edificio').textContent = edificio.icono + ' ' + edificio.nombre;
    document.getElementById('preg-texto').textContent    = pregunta.pregunta;
    document.getElementById('texto-a').textContent       = pregunta.opcion_a;
    document.getElementById('texto-b').textContent       = pregunta.opcion_b;
    document.getElementById('texto-c').textContent       = pregunta.opcion_c;
    document.getElementById('texto-d').textContent       = pregunta.opcion_d;

    // Reset botones
    ['a', 'b', 'c', 'd'].forEach(l => {
      const btn = document.getElementById('opcion-' + l);
      btn.className = 'opcion-btn';
      btn.disabled  = false;
    });

    document.getElementById('resultado-pregunta').className   = 'resultado-pregunta';
    document.getElementById('resultado-pregunta').textContent = '';
    document.getElementById('btn-continuar').classList.remove('visible');
    document.getElementById('modal-pregunta').classList.add('visible');
  }

  marcarRespuesta(letraSeleccionada, letraCorrecta) {
    const esCorrecta = letraSeleccionada === letraCorrecta;

    ['a', 'b', 'c', 'd'].forEach(l => {
      const btn = document.getElementById('opcion-' + l);
      if (l === letraCorrecta) {
        btn.classList.add('correcta');
      } else if (l === letraSeleccionada && !esCorrecta) {
        btn.classList.add('incorrecta');
      } else {
        btn.classList.add('deshabilitada');
      }
    });

    const resultado = document.getElementById('resultado-pregunta');
    if (esCorrecta) {
      resultado.className   = 'resultado-pregunta correcto';
      resultado.textContent = '🎉 ¡Correcto! No pierdes puntos';
    } else {
      resultado.className   = 'resultado-pregunta incorrecto';
      resultado.textContent = '❌ Incorrecto. -100 puntos';
    }

    document.getElementById('btn-continuar').classList.add('visible');
    return esCorrecta;
  }

  ocultarModalPregunta() {
    document.getElementById('modal-pregunta').classList.remove('visible');
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
