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
import { obtenerPreguntas, crearPregunta, actualizarPregunta, eliminarPregunta } from '../models/PreguntaModel.js';
import { formatearTiempo } from '../utils/formatters.js';
import { obtenerSesionAdmin, cerrarSesionAdmin } from '../models/AuthModel.js';
import { mostrarAviso, confirmar } from '../views/components/Avisos.js';

export class AdminController {
  constructor() {
    this.sesionActual = null;
    this.suscripcion = null;
    this.edificioSeleccionado = null;
    this.preguntasCargadas = new Map();   // id → pregunta (para editar)
    this.preguntaEditando = null;         // id de la pregunta en edición
  }

  destruir() {
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

  // ── Tab preguntas: selector de edificio ──
  _initTabPreguntas() {
    const selector = document.getElementById('preg-edificio-selector');
    if (!selector) return;
    selector.innerHTML = '';
    EDIFICIOS.forEach(e => {
      const btn = document.createElement('button');
      btn.className = 'preg-edificio-btn';
      btn.textContent = e.icono + ' ' + e.nombre;
      btn.onclick = () => this._seleccionarEdificioPreguntas(e, btn);
      selector.appendChild(btn);
    });
    document.getElementById('seccion-preguntas-edificio').style.display = 'none';
  }

  async _seleccionarEdificioPreguntas(edificio, btnEl) {
    document.querySelectorAll('.preg-edificio-btn').forEach(b => b.classList.remove('activo'));
    btnEl.classList.add('activo');
    this._salirDeEdicion();
    this.edificioSeleccionado = edificio;
    document.getElementById('seccion-preguntas-edificio').style.display = 'block';
    await this._cargarPreguntasEdificio(edificio.id);
  }

  async _cargarPreguntasEdificio(edificioId) {
    const lista = document.getElementById('lista-preguntas-edificio');
    lista.innerHTML = '<p style="color:#888;font-size:14px;">Cargando...</p>';

    const preguntas = await obtenerPreguntas(edificioId);
    this.preguntasCargadas = new Map(preguntas.map(p => [String(p.id), p]));

    if (preguntas.length === 0) {
      lista.innerHTML = '<p style="color:#888;font-size:14px;text-align:center;padding:16px;">No hay preguntas para este edificio</p>';
      return;
    }

    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    lista.innerHTML = preguntas.map(p => `
      <div class="pregunta-item${String(p.id) === this.preguntaEditando ? ' editando' : ''}" data-id="${esc(p.id)}">
        <div class="pregunta-item-header">
          <div class="preg-texto">${esc(p.pregunta)}</div>
          <div class="preg-acciones">
            <button class="btn-editar" onclick="editarPregunta('${esc(p.id)}')"><i data-lucide="pencil" aria-hidden="true"></i>Editar</button>
            <button class="btn-peligro" onclick="borrarPregunta('${esc(p.id)}')"><i data-lucide="trash-2" aria-hidden="true"></i>Eliminar</button>
          </div>
        </div>
        <div class="preg-opciones">
          <span class="${p.respuesta_correcta === 'a' ? 'correcta' : ''}">A) ${esc(p.opcion_a)}</span><br>
          <span class="${p.respuesta_correcta === 'b' ? 'correcta' : ''}">B) ${esc(p.opcion_b)}</span><br>
          <span class="${p.respuesta_correcta === 'c' ? 'correcta' : ''}">C) ${esc(p.opcion_c)}</span><br>
          <span class="${p.respuesta_correcta === 'd' ? 'correcta' : ''}">D) ${esc(p.opcion_d)}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Edición de preguntas ──
  _limpiarFormularioPregunta() {
    ['nueva-pregunta', 'nueva-opcion-a', 'nueva-opcion-b', 'nueva-opcion-c', 'nueva-opcion-d']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('nueva-respuesta-correcta').value = 'a';
  }

  /** Pone el formulario en modo "Nueva pregunta". */
  _salirDeEdicion() {
    this.preguntaEditando = null;
    document.getElementById('titulo-form-pregunta').textContent = 'Nueva pregunta';
    document.getElementById('bloque-form-pregunta').classList.remove('modo-edicion');
    document.getElementById('btn-guardar-pregunta').innerHTML = '<i data-lucide="save" aria-hidden="true"></i>Guardar pregunta';
    document.getElementById('btn-cancelar-edicion').hidden = true;
    document.getElementById('aviso-edicion-activa').hidden = true;
    document.querySelectorAll('.pregunta-item.editando').forEach(el => el.classList.remove('editando'));
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
      } catch (e) { mostrarAviso({ tipo: 'error', titulo: 'No se pudo activar la sesión', texto: 'Revisa tu conexión e intenta de nuevo.' }); }
    };

    window.cerrarSesion = async () => {
      if (!this.sesionActual) return;
      const ok = await confirmar({ titulo: '¿Cerrar la sesión?', texto: `Los participantes de "${this.sesionActual.nombre}" verán que la carrera terminó.`, aceptar: 'Cerrar sesión', peligro: true });
      if (!ok) return;
      try {
        await cerrarSesionDB(this.sesionActual.id);
        this.sesionActual.estado = 'cerrada';
        this._actualizarBadge('cerrada');
        document.getElementById('btn-cerrar').disabled = true;

        setTimeout(() => this._reiniciarPanelControl(), 1500);
      } catch (e) { mostrarAviso({ tipo: 'error', titulo: 'No se pudo cerrar la sesión', texto: 'Revisa tu conexión e intenta de nuevo.' }); }
    };

    window.guardarPregunta = async () => {
      if (!this.edificioSeleccionado) { mostrarAviso({ tipo: 'aviso', titulo: 'Elige un edificio', texto: 'Selecciona el edificio al que pertenece la pregunta.' }); return; }

      const pregunta = document.getElementById('nueva-pregunta').value.trim();
      const opA = document.getElementById('nueva-opcion-a').value.trim();
      const opB = document.getElementById('nueva-opcion-b').value.trim();
      const opC = document.getElementById('nueva-opcion-c').value.trim();
      const opD = document.getElementById('nueva-opcion-d').value.trim();
      const correcta = document.getElementById('nueva-respuesta-correcta').value;

      if (!pregunta || !opA || !opB || !opC || !opD) {
        mostrarAviso({ tipo: 'aviso', titulo: 'Faltan datos', texto: 'Completa la pregunta, las cuatro opciones y la respuesta correcta.' });
        return;
      }

      const opciones = { a: opA, b: opB, c: opC, d: opD };
      const editando = this.preguntaEditando;
      const btn = document.getElementById('btn-guardar-pregunta');
      btn.disabled = true;
      try {
        if (editando) {
          await actualizarPregunta(editando, pregunta, opciones, correcta);
        } else {
          await crearPregunta(this.edificioSeleccionado.id, pregunta, opciones, correcta);
        }
        this._limpiarFormularioPregunta();
        this._salirDeEdicion();
        await this._cargarPreguntasEdificio(this.edificioSeleccionado.id);
        mostrarAviso(editando
          ? { tipo: 'exito', titulo: 'Cambios guardados', texto: 'La pregunta se actualizó.' }
          : { tipo: 'exito', titulo: 'Pregunta guardada', texto: `Se agregó a ${this.edificioSeleccionado.nombre}.` });
      } catch (e) {
        console.error('[Admin] Error guardando pregunta:', e);
        mostrarAviso({ tipo: 'error', titulo: editando ? 'No se pudieron guardar los cambios' : 'No se pudo guardar la pregunta', texto: 'Revisa tu conexión e intenta de nuevo.' });
      } finally {
        btn.disabled = false;
      }
    };

    window.editarPregunta = async (preguntaId) => {
      const p = this.preguntasCargadas.get(String(preguntaId));
      if (!p) return;
      this.preguntaEditando = String(p.id);

      document.getElementById('nueva-pregunta').value = p.pregunta || '';
      document.getElementById('nueva-opcion-a').value = p.opcion_a || '';
      document.getElementById('nueva-opcion-b').value = p.opcion_b || '';
      document.getElementById('nueva-opcion-c').value = p.opcion_c || '';
      document.getElementById('nueva-opcion-d').value = p.opcion_d || '';
      document.getElementById('nueva-respuesta-correcta').value = p.respuesta_correcta || 'a';

      document.getElementById('titulo-form-pregunta').textContent = 'Editar pregunta';
      document.getElementById('bloque-form-pregunta').classList.add('modo-edicion');
      document.getElementById('btn-guardar-pregunta').innerHTML = '<i data-lucide="save" aria-hidden="true"></i>Guardar cambios';
      document.getElementById('btn-cancelar-edicion').hidden = false;

      document.querySelectorAll('.pregunta-item').forEach(el =>
        el.classList.toggle('editando', el.dataset.id === this.preguntaEditando));

      const bloque = document.getElementById('bloque-form-pregunta');
      bloque.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('nueva-pregunta').focus({ preventScroll: true });

      const aviso = document.getElementById('aviso-edicion-activa');
      aviso.hidden = true;
      if (await this._hayCarreraActiva() && this.preguntaEditando === String(p.id)) aviso.hidden = false;
    };

    window.cancelarEdicionPregunta = () => {
      this._limpiarFormularioPregunta();
      this._salirDeEdicion();
    };

    window.borrarPregunta = async (preguntaId) => {
      const ok = await confirmar({ titulo: '¿Eliminar esta pregunta?', texto: 'Esta acción no se puede deshacer.', aceptar: 'Eliminar', peligro: true });
      if (!ok) return;
      try {
        await eliminarPregunta(preguntaId);
        if (this.preguntaEditando === String(preguntaId)) {
          this._limpiarFormularioPregunta();
          this._salirDeEdicion();
        }
        await this._cargarPreguntasEdificio(this.edificioSeleccionado.id);
      } catch (e) {
        mostrarAviso({ tipo: 'error', titulo: 'No se pudo eliminar la pregunta', texto: 'Revisa tu conexión e intenta de nuevo.' });
      }
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
      const { data: participantes } = await supabase.from('participantes').select('*').eq('sesion_id', sesionId)
        .order('posicion', { ascending: true, nullsFirst: false });
      const { data: edificios } = await supabase.from('edificios_sesion').select('*').eq('sesion_id', sesionId).order('orden');

      const ganador = (participantes || []).filter(p => p.completado)[0];
      let html = `
        <div class="card">
          <h2>${sesion.nombre}
            <span class="estado-badge estado-${sesion.estado}">${sesion.estado}</span>
          </h2>
          <div style="color:#555; font-size:14px; margin-bottom:16px;">
            Código: <strong>${sesion.codigo}</strong> ·
            ${sesion.total_edificios} edificios ·
            ${(participantes||[]).length} participantes
          </div>
      `;

      if (ganador) {
        html += `
          <div class="ganador-card">
            <div class="trofeo">🏆</div>
            <div class="nombre">🥇 ${ganador.nombre}</div>
            <div class="stats">⭐ ${ganador.puntos_total || 0} puntos · ⏱️ ${formatearTiempo(ganador.tiempo_total || 0)}</div>
          </div>
        `;
      }

      html += '<h3 style="color:#1a2e1a; margin-bottom:12px;">Ranking final</h3>';

      if (!participantes || participantes.length === 0) {
        html += '<div class="ranking-vacio">Sin participantes</div>';
      } else {
        html += participantes.map(p => {
          const pos   = p.posicion;
          const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos ? `#${pos}` : '⏳';
          const clase = p.completado ? (pos === 1 ? 'primero' : 'completado') : '';
          return `
            <div class="participante-item ${clase}">
              <div class="pos-badge ${pos <= 3 ? 'pos-' + pos : 'pos-n'}">${emoji}</div>
              <div class="participante-info">
                <div class="participante-nombre">${p.nombre}</div>
                <div class="participante-estado">
                  ${p.completado
                    ? `✅ ⭐ ${p.puntos_total || 0} pts · ⏱️ ${formatearTiempo(p.tiempo_total || 0)}`
                    : '❌ No completó'}
                </div>
              </div>
            </div>
          `;
        }).join('');
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
        const ok = await confirmar({ titulo: '¿Cerrar la sesión?', texto: `Los participantes de "${sesion.nombre}" verán que la carrera terminó.`, aceptar: 'Cerrar sesión', peligro: true });
        if (!ok) return;
        btnCerrarHist.disabled = true;
        try {
          await cerrarSesionDB(sesionId);
          // Si es la misma sesión que está abierta en "Nueva carrera", reiniciar ese panel
          if (this.sesionActual?.id === sesionId) this._reiniciarPanelControl();
          await window.verDetalleSesion(sesionId, { forzarDetalle: true });
          this._cargarHistorialEnSegundoPlano();
        } catch (e) {
          mostrarAviso({ tipo: 'error', titulo: 'No se pudo cerrar la sesión', texto: 'Revisa tu conexión e intenta de nuevo.' });
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
    this.suscripcion = supabase
      .channel('participantes-' + this.sesionActual.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participantes',
        filter: `sesion_id=eq.${this.sesionActual.id}`
      }, () => this._cargarRanking())
      .subscribe();
    this._cargarRanking();
  }

  async _cargarRanking() {
    const participantes = await obtenerParticipantes(this.sesionActual.id);
    const completados = participantes.filter(p => p.completado).length;
    document.getElementById('cnt-unidos').textContent      = participantes.length;
    document.getElementById('cnt-completados').textContent = completados;

    const lista = document.getElementById('lista-ranking');
    if (participantes.length === 0) {
      lista.innerHTML = '<div class="ranking-vacio">Esperando participantes...</div>';
      return;
    }

    lista.innerHTML = participantes.map(p => {
      const pos    = p.posicion;
      const emoji  = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos || '⏳';
      const clase  = p.completado ? (pos === 1 ? 'primero' : 'completado') : '';
      const tiempo = p.tiempo_total ? formatearTiempo(p.tiempo_total) : 'En carrera...';
      const puntos = p.puntos_total ? `⭐ ${p.puntos_total} pts` : '';

      return `
        <div class="participante-item ${clase}">
          <div class="pos-badge ${pos <= 3 ? 'pos-' + pos : 'pos-n'}">${emoji}</div>
          <div class="participante-info">
            <div class="participante-nombre">${p.nombre}</div>
            <div class="participante-estado">
              ${p.completado ? '✅ Completó · ' + puntos : '🏃 En carrera'}
            </div>
          </div>
          <div class="participante-tiempo">${tiempo}</div>
        </div>
      `;
    }).join('');
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