// ═══════════════════════════════════════════
// CarreraView.js — Vista de unirse a carrera
// Extraído fielmente de carrera.html original
// ═══════════════════════════════════════════
import { mostrarAviso, ocultarAviso } from './components/Avisos.js';

export class CarreraView {
  obtenerDatosFormulario() {
    return {
      // Quita espacios repetidos: "Juan   Pérez" → "Juan Pérez"
      nombre: document.getElementById('input-nombre').value.trim().replace(/\s+/g, ' '),
      codigo: document.getElementById('input-codigo').value.trim()
    };
  }

  /** Muestra el error como notificación de la app y marca el campo con problema. */
  mostrarError(texto, { titulo = 'Revisa tus datos', tipo = 'aviso', campo = null } = {}) {
    mostrarAviso({ tipo, titulo, texto });
    if (campo) {
      const input = document.getElementById(campo);
      input?.setAttribute('aria-invalid', 'true');
      input?.focus();
    }
  }

  ocultarError() {
    ocultarAviso();
    document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  }

  deshabilitarBoton(texto) {
    const btn = document.getElementById('btn-unirse');
    // Guarda el contenido original (ícono ▶ + texto) para restaurarlo después
    this._htmlBoton ??= btn.innerHTML;
    btn.disabled = true;
    btn.textContent = texto;
  }

  habilitarBoton() {
    const btn = document.getElementById('btn-unirse');
    btn.disabled = false;
    if (this._htmlBoton) btn.innerHTML = this._htmlBoton;
    else btn.textContent = 'Unirse a la carrera';
  }

  mostrarEspera(nombre, sesion, { reconectado = false } = {}) {
    document.getElementById('pantalla-form').classList.add('oculto');
    document.getElementById('pantalla-espera').classList.add('visible');
    document.getElementById('espera-nombre').textContent = (reconectado ? '👋 De nuevo, ' : '👋 Hola, ') + nombre;
    document.getElementById('espera-sesion').textContent = 'Sesión: ' + sesion.nombre + ' · ' + sesion.codigo;
    if (reconectado) {
      const titulo = document.querySelector('.espera-titulo');
      if (titulo) titulo.textContent = '¡Te reconectamos!';
      const sub = document.querySelector('.espera-subtitulo');
      if (sub) sub.textContent = sesion.estado === 'activa'
        ? 'Sigues en la carrera con tu progreso. Abriendo la cámara...'
        : 'Sigues en la carrera. Esperando que el administrador la inicie...';
    }
  }

  // ── Reconexión ("Continuar como …") ──
  mostrarReconexion(nombre, sesion, { completado = false } = {}) {
    const caja = document.getElementById('reconexion');
    if (!caja) return;
    document.getElementById('reconexion-titulo').textContent =
      completado ? 'Ya terminaste esta carrera' : 'Tienes una carrera en curso';
    document.getElementById('reconexion-nombre').textContent = nombre;
    document.getElementById('reconexion-sesion').textContent =
      `${sesion.nombre} · ${sesion.codigo}` + (sesion.estado === 'activa' ? ' · en curso' : ' · por iniciar');
    const primerNombre = String(nombre || '').split(' ')[0];
    document.getElementById('btn-reconectar-texto').textContent =
      completado ? 'Ver mi resultado' : `Continuar como ${primerNombre}`;
    caja.hidden = false;
    document.getElementById('pantalla-form').classList.add('modo-reconexion');
    document.getElementById('btn-reconectar')?.focus();
  }

  ocultarReconexion() {
    const caja = document.getElementById('reconexion');
    if (caja) caja.hidden = true;
    document.getElementById('pantalla-form').classList.remove('modo-reconexion');
    document.getElementById('input-nombre')?.focus();
  }

  deshabilitarBotonReconectar(texto) {
    const btn = document.getElementById('btn-reconectar');
    if (!btn) return;
    btn.disabled = true;
    document.getElementById('btn-reconectar-texto').textContent = texto;
  }

  habilitarBotonReconectar() {
    const btn = document.getElementById('btn-reconectar');
    if (btn) btn.disabled = false;
  }

  onReconectar(callback) {
    document.getElementById('btn-reconectar')?.addEventListener('click', callback);
  }

  onNoSoyYo(callback) {
    document.getElementById('btn-no-soy-yo')?.addEventListener('click', callback);
  }

  mostrarSesionActivada() {
    document.querySelector('.espera-estado').innerHTML =
      '<span style="color: var(--color-primary); font-weight: 700;">¡Iniciando carrera!</span>';
  }

  mostrarSesionCerrada() {
    document.querySelector('.espera-estado').innerHTML =
      '<span style="color: var(--color-error, #B42318); font-weight: 600;">La sesión fue cerrada</span>';
  }

  onUnirse(callback) {
    document.getElementById('btn-unirse')?.addEventListener('click', callback);
  }

  onEnterCodigo(callback) {
    document.getElementById('input-codigo')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') callback();
    });
  }

  onEnterNombre() {
    document.getElementById('input-nombre')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') document.getElementById('input-codigo').focus();
    });
  }
}
