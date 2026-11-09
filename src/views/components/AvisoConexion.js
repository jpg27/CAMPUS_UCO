// ═══════════════════════════════════════════
// AvisoConexion.js — Aviso de "sin conexión a internet"
// ═══════════════════════════════════════════
// Una franja pequeña que aparece cuando el celular pierde la conexión y se
// quita sola cuando vuelve ("Conexión restablecida"). Sirve para que una
// falla de red nunca se confunda con que la carrera terminó.
//
// Uso:
//   import { avisoConexion, esErrorDeRed } from './AvisoConexion.js';
//   avisoConexion.activar({ abajo: 84 });      // escucha online/offline
//   avisoConexion.alReconectar(() => ...);      // qué hacer cuando vuelve
//   if (esErrorDeRed(error)) avisoConexion.mostrar();

/** ¿El error viene de no tener internet (y no de la base de datos)? */
export function esErrorDeRed(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error) return false;
  const texto = `${error.name || ''} ${error.message || ''} ${error.details || ''}`;
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_internet|ERR_NETWORK|AuthRetryableFetchError/i.test(texto)
    || error.status === 0;
}

const TEXTO_SIN_RED = 'Sin conexión a internet. Intentando reconectar…';
const TEXTO_VOLVIO  = 'Conexión restablecida';

class AvisoConexionImpl {
  constructor() {
    this.el = null;
    this.visible = false;
    this.activo = false;
    this.callbacks = new Set();
    this._timer = null;
    this._sondeo = null;
  }

  /** Empieza a escuchar los eventos online/offline del navegador. */
  activar({ abajo = 24 } = {}) {
    this.abajo = abajo;
    if (this.activo) return this;
    this.activo = true;
    window.addEventListener('offline', () => this.mostrar());
    window.addEventListener('online', () => this._volvio());
    if (navigator.onLine === false) this.mostrar();
    return this;
  }

  /** Registra qué hacer cuando vuelve la conexión (p. ej. reintentar). */
  alReconectar(fn) {
    this.callbacks.add(fn);
    return () => this.callbacks.delete(fn);
  }

  mostrar(texto = TEXTO_SIN_RED) {
    this._crear();
    clearTimeout(this._timer);
    this.el.dataset.estado = 'sin-red';
    this.el.querySelector('span').textContent = texto;
    this.el.hidden = false;
    this.visible = true;
    // Algunos celulares no avisan "online" al volver: se revisa cada 15 s
    clearInterval(this._sondeo);
    this._sondeo = setInterval(() => { if (navigator.onLine !== false) this._volvio(); }, 15000);
  }

  ocultar() {
    clearTimeout(this._timer);
    clearInterval(this._sondeo);
    this.visible = false;
    if (this.el) this.el.hidden = true;
  }

  _volvio() {
    clearInterval(this._sondeo);
    if (this.visible) {
      this.el.dataset.estado = 'ok';
      this.el.querySelector('span').textContent = TEXTO_VOLVIO;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.ocultar(), 2500);
    }
    this.callbacks.forEach(fn => { try { fn(); } catch (e) { /* cada pantalla maneja su reintento */ } });
  }

  _crear() {
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'aviso-conexion';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/><path d="M19 12.86a10 10 0 0 0-2-1.43"/><path d="M2 8.82a15 15 0 0 1 4.18-2.65"/><path d="M22 8.82a15 15 0 0 0-11.29-3.76"/><path d="m2 2 20 20"/></svg><span></span>';
    const estilo = document.createElement('style');
    estilo.textContent = `
      #aviso-conexion { position: fixed; left: 0; right: 0; margin: 0 auto; width: max-content; bottom: calc(${this.abajo ?? 24}px + env(safe-area-inset-bottom, 0px));
        z-index: 2600; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 32px); padding: 10px 16px;
        background: #3A1D1B; color: #FFFFFF; border-radius: 999px; box-shadow: 0 8px 24px rgba(0,0,0,.28);
        font: 600 13.5px/1.3 'Inter', Arial, sans-serif; }
      #aviso-conexion[hidden] { display: none; }
      #aviso-conexion svg { width: 18px; height: 18px; flex-shrink: 0; }
      #aviso-conexion[data-estado="ok"] { background: #087A45; }
      #aviso-conexion[data-estado="ok"] svg { display: none; }`;
    document.head.appendChild(estilo);
    el.hidden = true;
    document.body.appendChild(el);
    this.el = el;
  }
}

export const avisoConexion = new AvisoConexionImpl();
