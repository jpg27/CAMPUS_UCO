// ═══════════════════════════════════════════
// AdminController.js — Orquestador del panel admin
// Extraído fielmente de admin.html original
// ═══════════════════════════════════════════
import { EDIFICIOS, FOTOS_EDIFICIOS, obtenerEdificioInfo } from '../config.js';
import { supabase } from '../config.js';
import { 
  crearSesion as crearSesionDB, 
  activarSesion as activarSesionDB, 
  cerrarSesion as cerrarSesionDB,
  cerrarSesionesCaducadas,
  eliminarSesion
} from '../models/SesionModel.js';
import { obtenerParticipantes } from '../models/ParticipanteModel.js';
import { obtenerTodasLasPreguntas, crearPregunta, actualizarPregunta, eliminarPregunta } from '../models/PreguntaModel.js';
import { formatearTiempo } from '../utils/formatters.js';
import { clasificarParticipantes, formatearPuntos } from '../utils/clasificacion.js';
import { obtenerSesionAdmin, cerrarSesionAdmin } from '../models/AuthModel.js';
import { mostrarAviso, confirmar } from '../views/components/Avisos.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export class AdminController {
  constructor() {
    this.sesionActual = null;
    this.suscripcion = null;
    this.preguntasCargadas = new Map();   // id → pregunta (para editar)
    this.preguntasPorEdificio = null;     // edificio_id → [preguntas]
    this.edificioAbierto = null;          // edificio desplegado en el acordeón
    this.formModo = null;                 // 'nueva' | 'editar' | null
    this.preguntaEditando = null;         // id de la pregunta en edición
  }

  destruir() {
    clearInterval(this._timerRanking);
    if (this.suscripcion) {
      supabase.removeChannel(this.suscripcion);
      this.suscripcion = null;
    }
  }

  async init() {
    let sesion = null;
    try {
      sesion = await obtenerSesionAdmin();
    } catch (e) { /* sin sesión */ }
    if (!sesion) {
      window.location.href = 'login-admin.html';
      return;
    }

    this._initEdificiosGrid();
    this._initTabPreguntas();
    this._exposeWindowFunctions();
    
    // Autocierre de sesiones activas (inicial y cada 5 minutos)
    await cerrarSesionesCaducadas();
    setInterval(cerrarSesionesCaducadas, 5 * 60 * 1000);
  }

  // ── Grid de edificios (nueva carrera) ──
  _initEdificiosGrid() {
    const grid = document.getElementById('edificios-grid');
    EDIFICIOS.forEach(e => {
      const foto = FOTOS_EDIFICIOS[e.id];
      const div = document.createElement('div');
      div.className = 'edificio-check seleccionado';
      div.innerHTML = `
        ${foto ? `<img class="edificio-foto" src="${foto}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <input type="checkbox" id="ed-${e.id}" value="${e.id}" checked>
        <span>${e.nombre}</span>
      `;
      div.addEventListener('click', () => {
        const cb = div.querySelector('input');
        cb.checked = !cb.checked;
        div.classList.toggle('seleccionado', cb.checked);
      });
      grid.appendChild(div);
    });
  }

  // ═══════════════════════════════════════════
  // Tab Preguntas: acordeón por edificio
  // ═══════════════════════════════════════════
  // Cada edificio es una tarjeta plegable con su número de preguntas.
  // El formulario (#form-pregunta) es uno solo y se mueve dentro del
  // edificio abierto: al final de la lista para crear, o en el lugar de la
  // pregunta para editarla.

  async _initTabPreguntas() {
    const acordeon = document.getElementById('preg-acordeon');
    if (!acordeon) return;
    if (!this._preguntasListo) {
      this._preguntasListo = true;
      this._conectarAcordeon(acordeon);
      this._conectarFormularioPregunta();
    }
    await this._recargarPreguntas();
  }

  async _recargarPreguntas() {
    const acordeon = document.getElementById('preg-acordeon');
    if (!this.preguntasPorEdificio) {
      acordeon.innerHTML = '<p class="preg-cargando">Cargando preguntas...</p>';
    }
    let preguntas = [];
    try {
      preguntas = await obtenerTodasLasPreguntas();
    } catch (e) {
      acordeon.innerHTML = '<p class="preg-cargando">No se pudieron cargar las preguntas. Revisa tu conexión.</p>';
      return;
    }
    this.preguntasCargadas = new Map(preguntas.map(p => [String(p.id), p]));
    this.preguntasPorEdificio = {};
    preguntas.forEach(p => {
      (this.preguntasPorEdificio[p.edificio_id] ||= []).push(p);
    });
    this._renderAcordeon();
  }

  _renderAcordeon() {
    const acordeon = document.getElementById('preg-acordeon');
    const form = document.getElementById('form-pregunta');
    // El formulario vuelve a su "estacionamiento" antes de redibujar
    document.getElementById('form-pregunta-estacion').appendChild(form);

    acordeon.innerHTML = EDIFICIOS.map(e => {
      const lista = this.preguntasPorEdificio[e.id] || [];
      const abierto = this.edificioAbierto === e.id;
      const n = lista.length;
      const badge = n === 0
        ? '<span class="acc-badge vacio"><i data-lucide="triangle-alert" aria-hidden="true"></i>Sin preguntas</span>'
        : `<span class="acc-badge">${n} ${n === 1 ? 'pregunta' : 'preguntas'}</span>`;
      return `
        <section class="acc-item${abierto ? ' abierto' : ''}" data-ed="${esc(e.id)}">
          <button type="button" class="acc-header" aria-expanded="${abierto}" aria-controls="acc-panel-${esc(e.id)}">
            <span class="acc-icono" aria-hidden="true">${e.icono || ''}</span>
            <span class="acc-nombre">${esc(e.nombre)}</span>
            ${badge}
            <i data-lucide="chevron-down" class="acc-chevron" aria-hidden="true"></i>
          </button>
          <div class="acc-panel" id="acc-panel-${esc(e.id)}" ${abierto ? '' : 'hidden'}>
            <div class="acc-lista">
              ${n === 0
                ? '<p class="acc-vacio">Este edificio no tiene preguntas: en la carrera se registrará sin trivia.</p>'
                : lista.map(p => this._htmlPregunta(p)).join('')}
            </div>
            <button type="button" class="btn-nueva-pregunta" data-accion="nueva">
              <i data-lucide="plus" aria-hidden="true"></i>Nueva pregunta
            </button>
          </div>
        </section>`;
    }).join('');

    // Si había un formulario abierto, volver a colocarlo donde estaba
    if (this.formModo && this.edificioAbierto) this._colocarFormulario();
  }

  _htmlPregunta(p) {
    const op = (letra, texto) => `
      <li class="${p.respuesta_correcta === letra ? 'correcta' : ''}">
        <span class="op-letra">${letra.toUpperCase()}</span>${esc(texto)}
        ${p.respuesta_correcta === letra ? '<i data-lucide="check" class="op-check" aria-label="Respuesta correcta"></i>' : ''}
      </li>`;
    return `
      <article class="pregunta-item" data-id="${esc(p.id)}">
        <div class="pregunta-item-header">
          <div class="preg-texto">${esc(p.pregunta)}</div>
          <div class="preg-acciones">
            <button type="button" class="btn-editar" data-accion="editar" data-id="${esc(p.id)}"><i data-lucide="pencil" aria-hidden="true"></i>Editar</button>
            <button type="button" class="btn-peligro" data-accion="eliminar" data-id="${esc(p.id)}"><i data-lucide="trash-2" aria-hidden="true"></i>Eliminar</button>
          </div>
        </div>
        <ul class="preg-opciones">
          ${op('a', p.opcion_a)}${op('b', p.opcion_b)}${op('c', p.opcion_c)}${op('d', p.opcion_d)}
        </ul>
      </article>`;
  }

  _conectarAcordeon(acordeon) {
    acordeon.addEventListener('click', async (ev) => {
      const header = ev.target.closest('.acc-header');
      if (header) {
        const id = header.closest('.acc-item').dataset.ed;
        await this._alternarEdificio(id);
        return;
      }
      const btn = ev.target.closest('[data-accion]');
      if (!btn || btn.closest('#form-pregunta')) return;
      const accion = btn.dataset.accion;
      if (accion === 'nueva') await this._abrirFormulario('nueva');
      else if (accion === 'editar') await this._abrirFormulario('editar', btn.dataset.id);
      else if (accion === 'eliminar') await this._eliminarPregunta(btn.dataset.id);
    });
  }

  async _alternarEdificio(id) {
    const abrir = this.edificioAbierto !== id;
    if (this.formModo && !(await this._confirmarDescartar())) return;
    this._cerrarFormulario({ redibujar: false });
    this.edificioAbierto = abrir ? id : null;
    document.querySelectorAll('#preg-acordeon .acc-item').forEach(item => {
      const esEste = abrir && item.dataset.ed === id;
      item.classList.toggle('abierto', esEste);
      item.querySelector('.acc-header').setAttribute('aria-expanded', String(esEste));
      item.querySelector('.acc-panel').hidden = !esEste;
    });
    if (abrir) {
      const item = document.querySelector(`#preg-acordeon .acc-item[data-ed="${CSS.escape(id)}"]`);
      item?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /** true si se puede descartar lo escrito en el formulario. */
  async _confirmarDescartar() {
    const f = this._leerFormulario();
    const original = this.formModo === 'editar' ? this.preguntasCargadas.get(this.preguntaEditando) : null;
    const vacio = !f.pregunta && !f.opciones.a && !f.opciones.b && !f.opciones.c && !f.opciones.d;
    const sinCambios = original
      ? f.pregunta === original.pregunta && f.correcta === original.respuesta_correcta &&
        ['a', 'b', 'c', 'd'].every(l => f.opciones[l] === original['opcion_' + l])
      : vacio;
    if (sinCambios) return true;
    return confirmar({ titulo: '¿Descartar los cambios?', texto: 'Tienes cambios sin guardar en la pregunta.', aceptar: 'Descartar', peligro: true });
  }

  // ── Formulario ──
  _conectarFormularioPregunta() {
    const form = document.getElementById('form-pregunta');
    form.addEventListener('submit', (ev) => { ev.preventDefault(); this._guardarFormulario(); });
    form.querySelector('[data-accion="cancelar"]').addEventListener('click', () => {
      this._cerrarFormulario();
    });
    // Resaltar la fila de la opción marcada como correcta
    form.addEventListener('change', (ev) => {
      if (ev.target.name === 'preg-correcta') this._marcarFilaCorrecta();
    });
    form.addEventListener('input', () => this._mostrarErrorFormulario(''));
  }

  async _abrirFormulario(modo, preguntaId = null) {
    if (this.formModo && !(await this._confirmarDescartar())) return;
    this.formModo = modo;
    this.preguntaEditando = modo === 'editar' ? String(preguntaId) : null;

    const form = document.getElementById('form-pregunta');
    const p = modo === 'editar' ? this.preguntasCargadas.get(this.preguntaEditando) : null;
    form.querySelector('#preg-texto').value = p?.pregunta || '';
    ['a', 'b', 'c', 'd'].forEach(l => {
      form.querySelector('#preg-op-' + l).value = p ? (p['opcion_' + l] || '') : '';
    });
    form.querySelectorAll('input[name="preg-correcta"]').forEach(r => {
      r.checked = !!p && r.value === p.respuesta_correcta;
    });
    form.querySelector('.form-pregunta-titulo').textContent = modo === 'editar' ? 'Editar pregunta' : 'Nueva pregunta';
    form.querySelector('.btn-guardar-texto').textContent = modo === 'editar' ? 'Guardar cambios' : 'Guardar pregunta';
    this._mostrarErrorFormulario('');
    this._marcarFilaCorrecta();

    const aviso = form.querySelector('.aviso-edicion');
    aviso.hidden = true;
    if (modo === 'editar') {
      this._hayCarreraActiva().then(activa => {
        if (activa && this.formModo === 'editar' && this.preguntaEditando === String(preguntaId)) aviso.hidden = false;
      });
    }

    this._colocarFormulario();
    form.querySelector('#preg-texto').focus({ preventScroll: true });
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Coloca el formulario dentro del edificio abierto según el modo. */
  _colocarFormulario() {
    const form = document.getElementById('form-pregunta');
    const item = document.querySelector(`#preg-acordeon .acc-item[data-ed="${CSS.escape(this.edificioAbierto || '')}"]`);
    if (!item) return;
    item.querySelectorAll('.pregunta-item.oculta-por-edicion').forEach(el => el.classList.remove('oculta-por-edicion'));
    const btnNueva = item.querySelector('.btn-nueva-pregunta');
    if (this.formModo === 'editar') {
      const art = item.querySelector(`.pregunta-item[data-id="${CSS.escape(this.preguntaEditando)}"]`);
      if (!art) return;
      art.classList.add('oculta-por-edicion');
      art.after(form);
      btnNueva.hidden = false;
    } else {
      btnNueva.before(form);
      btnNueva.hidden = true;
    }
    form.hidden = false;
  }

  _cerrarFormulario({ redibujar = true } = {}) {
    const form = document.getElementById('form-pregunta');
    this.formModo = null;
    this.preguntaEditando = null;
    form.hidden = true;
    document.querySelectorAll('.pregunta-item.oculta-por-edicion').forEach(el => el.classList.remove('oculta-por-edicion'));
    document.querySelectorAll('#preg-acordeon .btn-nueva-pregunta').forEach(b => { b.hidden = false; });
    document.getElementById('form-pregunta-estacion').appendChild(form);
    if (redibujar) { /* nada más: la lista ya está al día */ }
  }

  _leerFormulario() {
    const form = document.getElementById('form-pregunta');
    const val = (sel) => form.querySelector(sel).value.trim();
    return {
      pregunta: val('#preg-texto'),
      opciones: { a: val('#preg-op-a'), b: val('#preg-op-b'), c: val('#preg-op-c'), d: val('#preg-op-d') },
      correcta: form.querySelector('input[name="preg-correcta"]:checked')?.value || null
    };
  }

  _marcarFilaCorrecta() {
    document.querySelectorAll('#form-pregunta .opcion-fila').forEach(fila => {
      fila.classList.toggle('es-correcta', fila.querySelector('input[type="radio"]').checked);
    });
  }

  _mostrarErrorFormulario(texto) {
    const el = document.querySelector('#form-pregunta .form-error');
    el.textContent = texto;
    el.hidden = !texto;
  }

  /** Devuelve el mensaje de error o null si el formulario es válido. */
  _validarFormulario(f) {
    if (!f.pregunta) return 'Escribe la pregunta.';
    const vacias = ['a', 'b', 'c', 'd'].filter(l => !f.opciones[l]);
    if (vacias.length) return `Completa la opción ${vacias.map(l => l.toUpperCase()).join(', ')}.`;
    const normal = (t) => t.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
    const vistos = {};
    for (const l of ['a', 'b', 'c', 'd']) {
      const k = normal(f.opciones[l]);
      if (vistos[k]) return `Las opciones ${vistos[k].toUpperCase()} y ${l.toUpperCase()} son iguales.`;
      vistos[k] = l;
    }
    if (!f.correcta) return 'Marca cuál opción es la respuesta correcta.';
    return null;
  }

  async _guardarFormulario() {
    const f = this._leerFormulario();
    const error = this._validarFormulario(f);
    if (error) { this._mostrarErrorFormulario(error); return; }

    const btn = document.querySelector('#form-pregunta .btn-guardar');
    const editando = this.formModo === 'editar' ? this.preguntaEditando : null;
    const edificio = EDIFICIOS.find(e => e.id === this.edificioAbierto);
    btn.disabled = true;
    try {
      if (editando) await actualizarPregunta(editando, f.pregunta, f.opciones, f.correcta);
      else await crearPregunta(this.edificioAbierto, f.pregunta, f.opciones, f.correcta);
      this._cerrarFormulario();
      await this._recargarPreguntas();
      mostrarAviso(editando
        ? { tipo: 'exito', titulo: 'Cambios guardados', texto: 'La pregunta se actualizó.' }
        : { tipo: 'exito', titulo: 'Pregunta guardada', texto: `Se agregó a ${edificio?.nombre || 'el edificio'}.` });
    } catch (e) {
      console.error('[Admin] Error guardando pregunta:', e);
      this._mostrarErrorFormulario(editando
        ? 'No se pudieron guardar los cambios. Revisa tu conexión e intenta de nuevo.'
        : 'No se pudo guardar la pregunta. Revisa tu conexión e intenta de nuevo.');
    } finally {
      btn.disabled = false;
    }
  }

  async _eliminarPregunta(preguntaId) {
    const ok = await confirmar({ titulo: '¿Eliminar esta pregunta?', texto: 'Esta acción no se puede deshacer.', aceptar: 'Eliminar', peligro: true });
    if (!ok) return;
    try {
      await eliminarPregunta(preguntaId);
      if (this.preguntaEditando === String(preguntaId)) this._cerrarFormulario();
      await this._recargarPreguntas();
    } catch (e) {
      mostrarAviso({ tipo: 'error', titulo: 'No se pudo eliminar la pregunta', texto: 'Revisa tu conexión e intenta de nuevo.' });
    }
  }

  async _hayCarreraActiva() {
    try {
      const { count } = await supabase.from('sesiones')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'activa');
      return (count || 0) > 0;
    } catch (e) {
      return false;
    }
  }

  // ── Exponer funciones al window ──
  _exposeWindowFunctions() {
    window.cerrarAdmin = async () => {
      try { await cerrarSesionAdmin(); } catch (e) { /* seguimos igual al login */ }
      window.location.href = 'login-admin.html';
    };

    window.cambiarTab = (tab) => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('visible'));
      document.getElementById('tab-' + tab).classList.add('activo');
      document.getElementById('pantalla-' + tab).classList.add('visible');
      if (tab === 'historial') {
        document.getElementById('lista-sesiones').style.display = 'block';
        document.getElementById('detalle-sesion').classList.remove('visible');
        this._cargarHistorial();
      }
      if (tab === 'preguntas') this._initTabPreguntas();
    };

    window.filtrarHistorial = () => {
      const inicio = document.getElementById('filtro-fecha-inicio').value;
      const fin = document.getElementById('filtro-fecha-fin').value;
      this._cargarHistorial(inicio, fin);
    };

    window.limpiarFiltroHistorial = () => {
      document.getElementById('filtro-fecha-inicio').value = '';
      document.getElementById('filtro-fecha-fin').value = '';
      this._cargarHistorial();
    };

    window.crearSesion = async () => {
      const nombre = document.getElementById('nombre-sesion').value.trim();
      const codigo = document.getElementById('codigo-sesion').value.trim();
      if (!nombre || !codigo) { mostrarAviso({ tipo: 'aviso', titulo: 'Faltan datos', texto: 'Escribe el nombre y el código de la sesión.' }); return; }

      const edificiosSeleccionados = EDIFICIOS.filter(e =>
        document.getElementById('ed-' + e.id)?.checked
      );
      if (edificiosSeleccionados.length === 0) { mostrarAviso({ tipo: 'aviso', titulo: 'Sin edificios', texto: 'Selecciona al menos un edificio para la carrera.' }); return; }

      try {
        this.sesionActual = await crearSesionDB(nombre, codigo, edificiosSeleccionados);
        this._mostrarControlSesion();
        this._iniciarRanking();
      } catch (e) {
        mostrarAviso({ tipo: 'error', titulo: 'No se pudo crear la sesión', texto: 'Puede que ese código ya esté en uso. Prueba con otro.' });
      }
    };

    window.activarSesion = async () => {
      if (!this.sesionActual) return;
      try {
        await activarSesionDB(this.sesionActual.id);
        this.sesionActual.estado = 'activa';
        this._actualizarBadge('activa');
        document.getElementById('btn-activar').disabled = true;
        document.getElementById('btn-cerrar').disabled  = false;
      } catch (e) { mostrarAviso({ tipo: 'error', titulo: 'No se pudo iniciar la carrera', texto: 'Revisa tu conexión e intenta de nuevo.' }); }
    };

    window.cerrarSesion = async () => {
      if (!this.sesionActual) return;
      const ok = await confirmar({ titulo: '¿Finalizar la carrera?', texto: `Los participantes de "${this.sesionActual.nombre}" verán que la carrera terminó.`, aceptar: 'Finalizar carrera', peligro: true });
      if (!ok) return;
      try {
        await cerrarSesionDB(this.sesionActual.id);
        this.sesionActual.estado = 'cerrada';
        this._actualizarBadge('cerrada');
        this._cargarRanking();   // muestra los incompletos con sus puntos parciales
        document.getElementById('btn-cerrar').disabled = true;

        setTimeout(() => this._reiniciarPanelControl(), 1500);
      } catch (e) { mostrarAviso({ tipo: 'error', titulo: 'No se pudo finalizar la carrera', texto: 'Revisa tu conexión e intenta de nuevo.' }); }
    };

    window.verDetalleSesion = async (sesionId, { forzarDetalle = false } = {}) => {
      const { data: sesion } = await supabase.from('sesiones').select('*').eq('id', sesionId).single();

      // Una sesión activa o en borrador se abre en el panel de control
      // ("Nueva carrera"), con el ranking en tiempo real y los botones
      // Activar/Cerrar, como cuando se acaba de crear.
      if (!forzarDetalle && sesion && (sesion.estado === 'activa' || sesion.estado === 'borrador')) {
        this._abrirEnPanelControl(sesion);
        return;
      }

      document.getElementById('lista-sesiones').style.display = 'none';
      document.getElementById('detalle-sesion').classList.add('visible');
      const [{ data: participantesDB }, { data: escaneosDB }, { data: edificios }] = await Promise.all([
        supabase.from('participantes').select('*').eq('sesion_id', sesionId),
        supabase.from('escaneos').select('participante_id, puntos, respondio_correctamente').eq('sesion_id', sesionId),
        supabase.from('edificios_sesion').select('*').eq('sesion_id', sesionId).order('orden')
      ]);
      const participantes = clasificarParticipantes(participantesDB || [], escaneosDB || []);
      const incompletos = participantes.filter(p => !p.completado).length;

      const ganador = participantes.filter(p => p.completado)[0];
      let html = `
        <div class="card">
          <h2>${esc(sesion.nombre)}
            <span class="estado-badge estado-${sesion.estado}">${sesion.estado}</span>
          </h2>
          <div style="color:#555; font-size:14px; margin-bottom:16px;">
            Código: <strong>${esc(sesion.codigo)}</strong> ·
            ${sesion.total_edificios} edificios ·
            ${participantes.length} participantes
          </div>
      `;

      if (ganador) {
        html += `
          <div class="ganador-card">
            <div class="trofeo">🏆</div>
            <div class="nombre">🥇 ${esc(ganador.nombre)}</div>
            <div class="stats">⭐ ${formatearPuntos(ganador.puntos)} puntos · ⏱️ ${formatearTiempo(ganador.tiempo_total || 0)}</div>
          </div>
        `;
      }

      html += '<h3 style="color:#1a2e1a; margin-bottom:6px;">Ranking final</h3>';
      if (incompletos > 0) {
        html += `<p class="ranking-nota">Primero quienes completaron la carrera, por puntos. Después ${incompletos === 1 ? 'quien no terminó' : `los ${incompletos} que no terminaron`}, por edificios y puntos.</p>`;
      }

      if (participantes.length === 0) {
        html += '<div class="ranking-vacio">Sin participantes</div>';
      } else {
        html += participantes.map(p => this._htmlParticipante(p, sesion.total_edificios || 0, { cerrada: true })).join('');
      }

      html += '</div>';

      if (edificios && edificios.length > 0) {
        html += `
          <div class="card">
            <h2>🏛️ Edificios de la sesión</h2>
            ${edificios.map(e => `
              <div style="padding:10px; border-bottom:1px solid #f0f0f0; font-size:14px; color:#333;">
                ${e.orden}. ${e.nombre}
              </div>
            `).join('')}
          </div>
        `;
      }

      document.getElementById('detalle-contenido').innerHTML = html;
      
      // Cerrar desde el historial (sirve si se salió del panel con la sesión abierta)
      const btnCerrarHist = document.getElementById('btn-cerrar-sesion-historial');
      const sePuedeCerrar = sesion.estado === 'activa' || sesion.estado === 'borrador';
      btnCerrarHist.style.display = sePuedeCerrar ? 'inline-flex' : 'none';
      btnCerrarHist.disabled = false;
      btnCerrarHist.onclick = async () => {
        const ok = await confirmar({ titulo: '¿Finalizar la carrera?', texto: `Los participantes de "${sesion.nombre}" verán que la carrera terminó.`, aceptar: 'Finalizar carrera', peligro: true });
        if (!ok) return;
        btnCerrarHist.disabled = true;
        try {
          await cerrarSesionDB(sesionId);
          // Si es la misma sesión que está abierta en "Nueva carrera", reiniciar ese panel
          if (this.sesionActual?.id === sesionId) this._reiniciarPanelControl();
          await window.verDetalleSesion(sesionId, { forzarDetalle: true });
          this._cargarHistorialEnSegundoPlano();
        } catch (e) {
          mostrarAviso({ tipo: 'error', titulo: 'No se pudo finalizar la carrera', texto: 'Revisa tu conexión e intenta de nuevo.' });
          btnCerrarHist.disabled = false;
        }
      };

      const btnEliminar = document.getElementById('btn-eliminar-sesion');
      btnEliminar.style.display = 'block';
      btnEliminar.onclick = async () => {
        const ok = await confirmar({ titulo: '¿Eliminar esta sesión?', texto: `Se borrarán "${sesion.nombre}", sus participantes y sus escaneos. Esta acción no se puede deshacer.`, aceptar: 'Eliminar', peligro: true });
        if (ok) {
          btnEliminar.disabled = true;
          btnEliminar.textContent = 'Eliminando...';
          try {
            await eliminarSesion(sesionId);
            mostrarAviso({ tipo: 'exito', titulo: 'Sesión eliminada', texto: `"${sesion.nombre}" y sus datos se borraron.` });
            window.volverHistorial();
            this._cargarHistorial();
          } catch(e) {
            mostrarAviso({ tipo: 'error', titulo: 'No se pudo eliminar la sesión', texto: 'Revisa tu conexión e intenta de nuevo.' });
          }
          btnEliminar.disabled = false;
          btnEliminar.textContent = '🗑️ Eliminar sesión';
        }
      };
    };

    window.volverHistorial = () => {
      document.getElementById('lista-sesiones').style.display = 'block';
      document.getElementById('detalle-sesion').classList.remove('visible');
      document.getElementById('btn-eliminar-sesion').style.display = 'none';
      document.getElementById('btn-cerrar-sesion-historial').style.display = 'none';
      this._cargarHistorial();
    };
  }

  /** Retoma una sesión del historial en el panel de control con ranking en vivo. */
  _abrirEnPanelControl(sesion) {
    if (this.suscripcion) {
      try { supabase.removeChannel(this.suscripcion); } catch (e) { /* ya estaba cerrado */ }
      this.suscripcion = null;
    }
    this.sesionActual = sesion;
    this._mostrarControlSesion();
    this._actualizarBadge(sesion.estado);
    document.getElementById('btn-activar').disabled = sesion.estado !== 'borrador';
    document.getElementById('btn-cerrar').disabled  = sesion.estado !== 'activa';
    this._iniciarRanking();
    window.cambiarTab('nueva');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Vuelve "Nueva carrera" al formulario de crear sesión. */
  _reiniciarPanelControl() {
    this.sesionActual = null;
    clearInterval(this._timerRanking);
    if (this.suscripcion) { this.suscripcion.unsubscribe(); this.suscripcion = null; }
    document.getElementById('card-control').classList.add('seccion-oculta');
    document.getElementById('card-ranking').classList.add('seccion-oculta');
    document.getElementById('card-crear').style.display = 'block';
    document.getElementById('nombre-sesion').value = '';
    document.getElementById('codigo-sesion').value = '';
    document.getElementById('btn-activar').disabled = false;
    document.getElementById('btn-cerrar').disabled  = true;
    document.getElementById('lista-ranking').innerHTML =
      '<div class="ranking-vacio">Esperando participantes...</div>';
    document.getElementById('cnt-unidos').textContent      = '0';
    document.getElementById('cnt-completados').textContent = '0';
    document.getElementById('cnt-edificios').textContent   = '0';
    document.getElementById('badge-estado').textContent    = 'Borrador';
    document.getElementById('badge-estado').className      = 'estado-badge estado-borrador';
  }

  /** Recarga la lista del historial sin salir del detalle que se está viendo. */
  async _cargarHistorialEnSegundoPlano() {
    const detalleVisible = document.getElementById('detalle-sesion').classList.contains('visible');
    await this._cargarHistorial();
    if (detalleVisible) {
      document.getElementById('detalle-sesion').classList.add('visible');
      document.getElementById('lista-sesiones').style.display = 'none';
    }
  }

  _mostrarControlSesion() {
    document.getElementById('card-crear').style.display = 'none';
    document.getElementById('card-control').classList.remove('seccion-oculta');
    document.getElementById('card-ranking').classList.remove('seccion-oculta');
    document.getElementById('display-codigo').textContent = this.sesionActual.codigo;
    document.getElementById('display-nombre').textContent = this.sesionActual.nombre;
    document.getElementById('cnt-edificios').textContent  = this.sesionActual.total_edificios;
  }

  _actualizarBadge(estado) {
    const badge = document.getElementById('badge-estado');
    badge.textContent = estado.charAt(0).toUpperCase() + estado.slice(1);
    badge.className = 'estado-badge estado-' + estado;
  }

  _iniciarRanking() {
    const sesionId = this.sesionActual.id;
    const recargar = () => this._programarRanking();
    this.suscripcion = supabase
      .channel('ranking-' + sesionId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participantes',
        filter: `sesion_id=eq.${sesionId}`
      }, recargar)
      // Cada escaneo cambia los puntos parciales (requiere la tabla
      // escaneos en la publicación supabase_realtime; ver el SQL del 21 oct)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'escaneos',
        filter: `sesion_id=eq.${sesionId}`
      }, recargar)
      .subscribe();
    // Respaldo por si Realtime no envía los escaneos: refresco cada 20 s
    clearInterval(this._timerRanking);
    this._timerRanking = setInterval(() => {
      if (this.sesionActual?.estado === 'activa') this._cargarRanking();
    }, 20000);
    this._cargarRanking();
  }

  /** Agrupa varios eventos seguidos en una sola recarga del ranking. */
  _programarRanking() {
    clearTimeout(this._debounceRanking);
    this._debounceRanking = setTimeout(() => this._cargarRanking(), 400);
  }

  async _cargarRanking() {
    if (!this.sesionActual) return;
    const sesionId = this.sesionActual.id;
    const total = this.sesionActual.total_edificios || 0;
    const [participantes, { data: escaneos }] = await Promise.all([
      obtenerParticipantes(sesionId),
      supabase.from('escaneos')
        .select('participante_id, puntos, respondio_correctamente')
        .eq('sesion_id', sesionId)
    ]);
    if (this.sesionActual?.id !== sesionId) return;   // cambió de sesión mientras cargaba

    const lista = clasificarParticipantes(participantes, escaneos || []);
    const completados = lista.filter(p => p.completado).length;
    document.getElementById('cnt-unidos').textContent      = lista.length;
    document.getElementById('cnt-completados').textContent = completados;

    const contenedor = document.getElementById('lista-ranking');
    if (lista.length === 0) {
      contenedor.innerHTML = '<div class="ranking-vacio">Esperando participantes...</div>';
      return;
    }

    const cerrada = this.sesionActual.estado === 'cerrada';
    contenedor.innerHTML = lista.map(p => this._htmlParticipante(p, total, { cerrada })).join('');
  }

  /**
   * Fila del ranking (panel en vivo e historial).
   * Completados: medalla/posición, puntos y tiempo.
   * Sin terminar: edificios y puntos parciales.
   */
  _htmlParticipante(p, total, { cerrada = false } = {}) {
    const pos = p.completado ? p.posicion : null;
    const badge = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos ? `#${pos}` : (cerrada ? '—' : '⏳');
    const clase = p.completado ? (pos === 1 ? 'primero' : 'completado') : (cerrada ? 'incompleto' : '');
    const progreso = `${p.edificios}/${total} edificios`;
    const pts = `${formatearPuntos(p.puntos)} pts`;

    let estado, derecha;
    if (p.completado) {
      estado  = `✅ Completó · ⭐ ${pts}`;
      derecha = formatearTiempo(p.tiempo_total || 0);
    } else if (cerrada) {
      estado  = `Incompleta · ${progreso}`;
      derecha = pts;
    } else {
      estado  = `🏃 En carrera · ${progreso}`;
      derecha = pts;
    }

    return `
      <div class="participante-item ${clase}">
        <div class="pos-badge ${pos && pos <= 3 ? 'pos-' + pos : 'pos-n'}">${badge}</div>
        <div class="participante-info">
          <div class="participante-nombre">${esc(p.nombre)}</div>
          <div class="participante-estado">${estado}</div>
        </div>
        <div class="participante-tiempo">${derecha}</div>
      </div>
    `;
  }

  async _cargarHistorial(fechaInicio = null, fechaFin = null) {
    let query = supabase
      .from('sesiones')
      .select('*')
      .order('creada_en', { ascending: false });

    if (fechaInicio) {
      query = query.gte('creada_en', fechaInicio + 'T00:00:00Z');
    }
    if (fechaFin) {
      query = query.lte('creada_en', fechaFin + 'T23:59:59Z');
    }

    const { data: sesiones } = await query;

    const contenedor = document.getElementById('contenedor-lista-sesiones');
    document.getElementById('detalle-sesion').classList.remove('visible');

    if (!sesiones || sesiones.length === 0) {
      contenedor.innerHTML = '<div class="ranking-vacio">No hay sesiones registradas' + (fechaInicio ? ' en estas fechas' : '') + '</div>';
      return;
    }

    contenedor.innerHTML = sesiones.map(s => `
      <div class="sesion-card ${s.estado === 'cerrada' ? 'cerrada' : ''}"
           onclick="verDetalleSesion('${s.id}')">
        <div class="sesion-card-header">
          <div>
            <div class="sesion-nombre">${s.nombre}</div>
            <div class="sesion-codigo">Código: ${s.codigo}</div>
          </div>
          <span class="estado-badge estado-${s.estado}">${s.estado}</span>
        </div>
        <div class="sesion-stats">
          <span>🏛️ ${s.total_edificios} edificios</span>
          <span>📅 ${new Date(s.creada_en).toLocaleDateString('es-CO')}</span>
        </div>
      </div>
    `).join('');
  }
}