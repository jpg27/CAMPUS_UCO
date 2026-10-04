// ═══════════════════════════════════════════
// Avisos.js — Notificaciones y confirmaciones con el estilo de la app
// Reemplaza alert() y confirm() del navegador.
//
//   import { mostrarAviso, confirmar } from './src/views/components/Avisos.js';
//   mostrarAviso({ tipo: 'error', titulo: 'No se pudo guardar', texto: 'Intenta de nuevo.' });
//   if (await confirmar({ titulo: '¿Eliminar?', texto: '…', aceptar: 'Eliminar', peligro: true })) { … }
//
// Tipos: 'exito' (verde), 'aviso' (ámbar), 'error' (rojo).
// Necesita styles/avisos.css en la página.
// ═══════════════════════════════════════════

const ICONOS = {
  exito: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  aviso: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  error: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  cerrar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
};
const svg = (nombre) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre]}</svg>`;
const escapar = (t = '') => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastActual = null;
let timerToast = null;

/** Notificación arriba de la pantalla que se cierra sola. */
export function mostrarAviso({ tipo = 'exito', titulo = '', texto = '', duracion = 4500 } = {}) {
  ocultarAviso(true);

  const el = document.createElement('div');
  el.className = `aviso-toast aviso-${tipo}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', tipo === 'error' ? 'assertive' : 'polite');
  el.innerHTML = `
    <span class="aviso-icono">${svg(tipo)}</span>
    <div class="aviso-cuerpo">
      <div class="aviso-titulo">${escapar(titulo)}</div>
      ${texto ? `<div class="aviso-texto">${escapar(texto)}</div>` : ''}
    </div>
    <button type="button" class="aviso-cerrar" aria-label="Cerrar aviso">${svg('cerrar')}</button>`;
  el.querySelector('.aviso-cerrar').addEventListener('click', () => ocultarAviso());
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visible'));

  toastActual = el;
  if (duracion > 0) timerToast = setTimeout(() => ocultarAviso(), duracion);
  return el;
}

export function ocultarAviso(inmediato = false) {
  clearTimeout(timerToast);
  const el = toastActual;
  toastActual = null;
  if (!el) return;
  if (inmediato) { el.remove(); return; }
  el.classList.remove('visible');
  setTimeout(() => el.remove(), 350);
}

/**
 * Diálogo de confirmación. Devuelve una Promesa con true (aceptar) o false.
 * peligro: true pinta el botón de aceptar en rojo (eliminar, cerrar…).
 */
export function confirmar({ titulo = '¿Continuar?', texto = '', aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false, tipo = null } = {}) {
  return new Promise((resolver) => {
    const focoPrevio = document.activeElement;
    const capa = document.createElement('div');
    capa.className = `aviso-capa ${peligro ? 'aviso-peligro' : ''}`;
    const icono = tipo || (peligro ? 'error' : 'aviso');
    capa.innerHTML = `
      <div class="aviso-dialogo aviso-${icono}" role="alertdialog" aria-modal="true" aria-labelledby="aviso-dlg-titulo" ${texto ? 'aria-describedby="aviso-dlg-texto"' : ''}>
        <span class="aviso-icono">${svg(icono)}</span>
        <h2 id="aviso-dlg-titulo">${escapar(titulo)}</h2>
        ${texto ? `<p id="aviso-dlg-texto">${escapar(texto)}</p>` : ''}
        <div class="aviso-botones">
          <button type="button" class="aviso-btn aviso-btn-cancelar">${escapar(cancelar)}</button>
          <button type="button" class="aviso-btn aviso-btn-ok">${escapar(aceptar)}</button>
        </div>
      </div>`;
    document.body.appendChild(capa);
    requestAnimationFrame(() => capa.classList.add('visible'));

    const terminar = (valor) => {
      document.removeEventListener('keydown', teclas);
      capa.classList.remove('visible');
      setTimeout(() => capa.remove(), 200);
      focoPrevio?.focus?.();
      resolver(valor);
    };
    const teclas = (e) => { if (e.key === 'Escape') terminar(false); };

    capa.querySelector('.aviso-btn-cancelar').addEventListener('click', () => terminar(false));
    capa.querySelector('.aviso-btn-ok').addEventListener('click', () => terminar(true));
    capa.addEventListener('click', (e) => { if (e.target === capa) terminar(false); });
    document.addEventListener('keydown', teclas);
    // El foco va a "Cancelar": un Enter accidental no ejecuta la acción
    capa.querySelector('.aviso-btn-cancelar').focus();
  });
}
