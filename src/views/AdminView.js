/**
 * AdminView.js
 * Vista principal para el panel de administración.
 */

import { EDIFICIOS, obtenerEdificioInfo } from '../config.js';
import { formatearTiempo, formatearFecha } from '../utils/formatters.js';

export class AdminView {
    init() {
        const grid = document.getElementById('edificios-grid');
        if (grid) {
            grid.innerHTML = Object.entries(EDIFICIOS).map(([id, info]) => `
                <label class="edificio-cb">
                    <input type="checkbox" name="edificios" value="${id}">
                    <span class="cb-texto">${info.icono || '🏢'} ${info.nombre || id}</span>
                </label>
            `).join('');
        }
    }

    cambiarTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tabId}`);
        });
    }

    onCambiarTab(callback) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.cambiarTab(tabId);
                callback(tabId);
            });
        });
    }

    obtenerDatosSesion() {
        const checkboxes = document.querySelectorAll('input[name="edificios"]:checked');
        return {
            nombre: document.getElementById('sesion-nombre').value.trim(),
            codigo: document.getElementById('sesion-codigo').value.trim().toUpperCase(),
            edificios: Array.from(checkboxes).map(cb => cb.value)
        };
    }

    mostrarControlSesion(sesion) {
        document.getElementById('crear-card').style.display = 'none';
        document.getElementById('control-card').style.display = 'block';
        document.getElementById('control-codigo').textContent = sesion.codigo;
        document.getElementById('control-nombre').textContent = sesion.nombre;
    }

    actualizarBadge(estado) {
        const badge = document.getElementById('control-estado');
        if (badge) {
            badge.textContent = estado === 'activa' ? 'Activa' : (estado === 'espera' ? 'En espera' : 'Cerrada');
            badge.className = `badge ${estado}`;
        }
    }

    habilitarActivar(enabled) {
        const btn = document.getElementById('btn-activar');
        if (btn) btn.disabled = !enabled;
    }

    habilitarCerrar(enabled) {
        const btn = document.getElementById('btn-cerrar');
        if (btn) btn.disabled = !enabled;
    }

    resetearFormulario() {
        document.getElementById('crear-card').style.display = 'block';
        document.getElementById('control-card').style.display = 'none';
        document.getElementById('sesion-nombre').value = '';
        document.getElementById('sesion-codigo').value = '';
        document.querySelectorAll('input[name="edificios"]').forEach(cb => cb.checked = false);
    }

    actualizarContadores(unidos, completados, edificios) {
        const elUnidos = document.getElementById('cont-unidos');
        const elCompletados = document.getElementById('cont-completados');
        const elEdificios = document.getElementById('cont-edificios');
        if (elUnidos) elUnidos.textContent = unidos;
        if (elCompletados) elCompletados.textContent = completados;
        if (elEdificios) elEdificios.textContent = edificios;
    }

    renderizarRanking(participantes) {
        const container = document.getElementById('ranking-lista');
        if (!container) return;
        if (!participantes || participantes.length === 0) {
            container.innerHTML = '<div class="ranking-item">No hay participantes aún.</div>';
            return;
        }

        container.innerHTML = participantes.map((p, index) => {
            let badge = (index + 1).toString();
            if (index === 0) badge = '🥇';
            else if (index === 1) badge = '🥈';
            else if (index === 2) badge = '🥉';

            const tiempo = p.tiempo_fin ? formatearTiempo(new Date(p.tiempo_inicio), new Date(p.tiempo_fin)) : '--:--';
            
            return `
                <div class="ranking-item">
                    <div class="rank-pos">${badge}</div>
                    <div class="rank-info">
                        <div class="rank-nombre">${p.nombre}</div>
                        <div class="rank-estado ${p.estado === 'completado' ? 'estado-completado' : 'estado-carrera'}">
                            ${p.estado === 'completado' ? 'Completado' : 'En carrera'}
                        </div>
                    </div>
                    <div class="rank-stats">
                        <div class="rank-tiempo">⏱️ ${tiempo}</div>
                        <div class="rank-puntos">⭐ ${p.puntos}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderizarHistorial(sesiones) {
        const container = document.getElementById('lista-sesiones');
        if (!container) return;
        
        container.innerHTML = sesiones.map(s => {
            const fecha = formatearFecha(new Date(s.created_at));
            return `
                <div class="historial-card" data-id="${s.id}">
                    <div class="h-header">
                        <h3>${s.nombre}</h3>
                        <span class="badge ${s.estado}">${s.estado}</span>
                    </div>
                    <div class="h-body">
                        <p>Código: <strong>${s.codigo}</strong></p>
                        <p>Fecha: ${fecha}</p>
                    </div>
                    <button class="btn btn-ver-detalle">Ver Detalle</button>
                </div>
            `;
        }).join('');
    }

    mostrarDetalleSesion(sesion, participantes, edificios) {
        document.getElementById('vista-lista').style.display = 'none';
        document.getElementById('vista-detalle').style.display = 'block';
        
        document.getElementById('det-nombre').textContent = sesion.nombre;
        document.getElementById('det-fecha').textContent = formatearFecha(new Date(sesion.created_at));
        document.getElementById('det-codigo').textContent = sesion.codigo;
        document.getElementById('det-estado').textContent = sesion.estado;
        document.getElementById('det-estado').className = `badge ${sesion.estado}`;

        this.renderizarRankingEnDetalle(participantes);
    }
    
    renderizarRankingEnDetalle(participantes) {
        const container = document.getElementById('det-ranking');
        if (!container) return;
        if (!participantes || participantes.length === 0) {
            container.innerHTML = '<p>No hubo participantes.</p>';
            return;
        }
        
        container.innerHTML = participantes.map((p, index) => {
            const tiempo = p.tiempo_fin ? formatearTiempo(new Date(p.tiempo_inicio), new Date(p.tiempo_fin)) : '--:--';
            return `
                <div class="ranking-item">
                    <div class="rank-pos">${index + 1}</div>
                    <div class="rank-info">
                        <div class="rank-nombre">${p.nombre}</div>
                    </div>
                    <div class="rank-stats">
                        <div class="rank-tiempo">⏱️ ${tiempo}</div>
                        <div class="rank-puntos">⭐ ${p.puntos}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    volverHistorial() {
        document.getElementById('vista-lista').style.display = 'block';
        document.getElementById('vista-detalle').style.display = 'none';
    }

    renderizarEdificiosPreguntas() {
        const select = document.getElementById('preg-edificio-select');
        if (select) {
            select.innerHTML = '<option value="">Seleccione un edificio...</option>' + 
                Object.entries(EDIFICIOS).map(([id, info]) => `
                    <option value="${id}">${info.nombre || id}</option>
                `).join('');
        }
    }

    renderizarPreguntas(preguntas) {
        const container = document.getElementById('lista-preguntas');
        if (!container) return;
        if (!preguntas || preguntas.length === 0) {
            container.innerHTML = '<p>No hay preguntas configuradas para este edificio.</p>';
            return;
        }

        container.innerHTML = preguntas.map(p => `
            <div class="pregunta-item">
                <h4>${p.texto}</h4>
                <ul>
                    <li class="${p.respuesta_correcta === 'a' ? 'correcta' : ''}">a) ${p.opcion_a}</li>
                    <li class="${p.respuesta_correcta === 'b' ? 'correcta' : ''}">b) ${p.opcion_b}</li>
                    <li class="${p.respuesta_correcta === 'c' ? 'correcta' : ''}">c) ${p.opcion_c}</li>
                    <li class="${p.respuesta_correcta === 'd' ? 'correcta' : ''}">d) ${p.opcion_d}</li>
                </ul>
                <button class="btn btn-eliminar-preg" data-id="${p.id}">Eliminar</button>
            </div>
        `).join('');
    }

    obtenerDatosPregunta() {
        return {
            texto: document.getElementById('preg-texto').value.trim(),
            opciones: {
                a: document.getElementById('preg-opcion-a').value.trim(),
                b: document.getElementById('preg-opcion-b').value.trim(),
                c: document.getElementById('preg-opcion-c').value.trim(),
                d: document.getElementById('preg-opcion-d').value.trim()
            },
            respuestaCorrecta: document.getElementById('preg-correcta').value
        };
    }

    limpiarFormularioPregunta() {
        document.getElementById('form-pregunta').reset();
    }

    onCrearSesion(callback) {
        document.getElementById('btn-crear-sesion')?.addEventListener('click', callback);
    }
    onActivarSesion(callback) {
        document.getElementById('btn-activar')?.addEventListener('click', callback);
    }
    onCerrarSesion(callback) {
        document.getElementById('btn-cerrar')?.addEventListener('click', callback);
    }
    onVolverHistorial(callback) {
        document.getElementById('btn-volver-historial')?.addEventListener('click', callback);
    }
    onVerDetalleHistorial(callback) {
        document.getElementById('lista-sesiones')?.addEventListener('click', e => {
            const btn = e.target.closest('.btn-ver-detalle');
            if (btn) {
                const id = btn.closest('.historial-card').dataset.id;
                callback(id);
            }
        });
    }
    onSeleccionarEdificioPregunta(callback) {
        document.getElementById('preg-edificio-select')?.addEventListener('change', e => {
            callback(e.target.value);
        });
    }
    onGuardarPregunta(callback) {
        document.getElementById('btn-guardar-pregunta')?.addEventListener('click', callback);
    }
    onEliminarPregunta(callback) {
        document.getElementById('lista-preguntas')?.addEventListener('click', e => {
            if (e.target.classList.contains('btn-eliminar-preg')) {
                callback(e.target.dataset.id);
            }
        });
    }
}
