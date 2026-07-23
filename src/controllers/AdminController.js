// ═══════════════════════════════════════════
// AdminController.js — Orquestador del panel admin
// Extraído fielmente de admin.html original
// ═══════════════════════════════════════════
import { EDIFICIOS, obtenerEdificioInfo } from '../config.js';
import { supabase } from '../config.js';
import { 
  crearSesion as crearSesionDB, 
  activarSesion as activarSesionDB, 
  cerrarSesion as cerrarSesionDB,
  cerrarSesionesCaducadas,
  eliminarSesion
} from '../models/SesionModel.js';
import { obtenerParticipantes } from '../models/ParticipanteModel.js';
import { obtenerPreguntas, crearPregunta, eliminarPregunta } from '../models/PreguntaModel.js';
import { formatearTiempo } from '../utils/formatters.js';

export class AdminController {
  constructor() {
    if (sessionStorage.getItem('admin_autenticado') !== 'true') {
      window.location.href = 'login-admin.html';
      return;
    }
    this.sesionActual = null;
    this.suscripcion = null;
    this.edificioSeleccionado = null;
  }

  async init() {
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
      const div = document.createElement('div');
      div.className = 'edificio-check seleccionado';
      div.innerHTML = `<input type="checkbox" id="ed-${e.id}" value="${e.id}" checked><span>${e.icono} ${e.nombre}</span>`;
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
    this.edificioSeleccionado = edificio;
    document.getElementById('seccion-preguntas-edificio').style.display = 'block';
    await this._cargarPreguntasEdificio(edificio.id);
  }

  async _cargarPreguntasEdificio(edificioId) {
    const lista = document.getElementById('lista-preguntas-edificio');
    lista.innerHTML = '<p style="color:#888;font-size:14px;">Cargando...</p>';

    const preguntas = await obtenerPreguntas(edificioId);

    if (preguntas.length === 0) {
      lista.innerHTML = '<p style="color:#888;font-size:14px;text-align:center;padding:16px;">No hay preguntas para este edificio</p>';
      return;
    }

    lista.innerHTML = preguntas.map(p => `
      <div class="pregunta-item">
        <div class="pregunta-item-header">
          <div class="preg-texto">${p.pregunta}</div>
          <button class="btn-peligro" onclick="borrarPregunta('${p.id}')">🗑️ Eliminar</button>
        </div>
        <div class="preg-opciones">
          <span class="${p.respuesta_correcta === 'a' ? 'correcta' : ''}">A) ${p.opcion_a}</span><br>
          <span class="${p.respuesta_correcta === 'b' ? 'correcta' : ''}">B) ${p.opcion_b}</span><br>
          <span class="${p.respuesta_correcta === 'c' ? 'correcta' : ''}">C) ${p.opcion_c}</span><br>
          <span class="${p.respuesta_correcta === 'd' ? 'correcta' : ''}">D) ${p.opcion_d}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Exponer funciones al window ──
  _exposeWindowFunctions() {
    window.cerrarAdmin = () => {
      sessionStorage.removeItem('admin_autenticado');
      window.location.href = 'login-admin.html';
    };

    window.cambiarTab = (tab) => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
      document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('visible'));
      document.getElementById('tab-' + tab).classList.add('activo');
      document.getElementById('pantalla-' + tab).classList.add('visible');
      if (tab === 'historial') this._cargarHistorial();
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
      if (!nombre || !codigo) { alert('Completa nombre y código'); return; }

      const edificiosSeleccionados = EDIFICIOS.filter(e =>
        document.getElementById('ed-' + e.id)?.checked
      );
      if (edificiosSeleccionados.length === 0) { alert('Selecciona al menos un edificio'); return; }

      try {
        this.sesionActual = await crearSesionDB(nombre, codigo, edificiosSeleccionados);
        this._mostrarControlSesion();
        this._iniciarRanking();
      } catch (e) {
        alert('Error al crear la sesión. El código puede estar en uso.');
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
      } catch (e) { alert('Error al activar la sesión'); }
    };

    window.cerrarSesion = async () => {
      if (!this.sesionActual) return;
      if (!confirm('¿Cerrar la sesión?')) return;
      try {
        await cerrarSesionDB(this.sesionActual.id);
        this.sesionActual.estado = 'cerrada';
        this._actualizarBadge('cerrada');
        document.getElementById('btn-cerrar').disabled = true;

        setTimeout(() => {
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
        }, 1500);
      } catch (e) { alert('Error al cerrar la sesión'); }
    };

    window.guardarPregunta = async () => {
      if (!this.edificioSeleccionado) { alert('Selecciona un edificio primero'); return; }

      const pregunta = document.getElementById('nueva-pregunta').value.trim();
      const opA = document.getElementById('nueva-opcion-a').value.trim();
      const opB = document.getElementById('nueva-opcion-b').value.trim();
      const opC = document.getElementById('nueva-opcion-c').value.trim();
      const opD = document.getElementById('nueva-opcion-d').value.trim();
      const correcta = document.getElementById('nueva-respuesta-correcta').value;

      if (!pregunta || !opA || !opB || !opC || !opD) {
        alert('Completa todos los campos');
        return;
      }

      try {
        await crearPregunta(this.edificioSeleccionado.id, pregunta, { a: opA, b: opB, c: opC, d: opD }, correcta);
        document.getElementById('nueva-pregunta').value = '';
        document.getElementById('nueva-opcion-a').value = '';
        document.getElementById('nueva-opcion-b').value = '';
        document.getElementById('nueva-opcion-c').value = '';
        document.getElementById('nueva-opcion-d').value = '';
        document.getElementById('nueva-respuesta-correcta').value = 'a';
        await this._cargarPreguntasEdificio(this.edificioSeleccionado.id);
        alert('✅ Pregunta guardada correctamente');
      } catch (e) {
        alert('Error al guardar la pregunta');
      }
    };

    window.borrarPregunta = async (preguntaId) => {
      if (!confirm('¿Eliminar esta pregunta?')) return;
      try {
        await eliminarPregunta(preguntaId);
        await this._cargarPreguntasEdificio(this.edificioSeleccionado.id);
      } catch (e) {
        alert('Error al eliminar la pregunta');
      }
    };

    window.verDetalleSesion = async (sesionId) => {
      document.getElementById('lista-sesiones').style.display = 'none';
      document.getElementById('detalle-sesion').classList.add('visible');

      const { data: sesion } = await supabase.from('sesiones').select('*').eq('id', sesionId).single();
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
      
      const btnEliminar = document.getElementById('btn-eliminar-sesion');
      btnEliminar.style.display = 'block';
      btnEliminar.onclick = async () => {
        if (confirm('¿Estás seguro de eliminar esta sesión y todos sus datos? Esta acción no se puede deshacer.')) {
          btnEliminar.disabled = true;
          btnEliminar.textContent = 'Eliminando...';
          try {
            await eliminarSesion(sesionId);
            alert('Sesión eliminada correctamente');
            window.volverHistorial();
            this._cargarHistorial();
          } catch(e) {
            alert('Error al eliminar la sesión');
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
    };
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
