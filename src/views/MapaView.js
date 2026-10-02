// ═══════════════════════════════════════════
// MapaView.js — Vista del mapa ilustrado del campus (mapa.html)
// Imagen + capa SVG con la zona de cada edificio + pines HTML.
// Solo maneja DOM; la lógica de sesión/carrera vive en MapaController.
// ═══════════════════════════════════════════
import { EDIFICIOS, MAPA, BASE_URL } from '../config.js';
import { PanZoom } from './mapa/PanZoom.js';
import { icono } from './mapa/iconos.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ESCALA_COMPACTA = 0.75; // por debajo, los pines muestran solo el círculo

export class MapaView {
  constructor() {
    this.edificios = EDIFICIOS.filter(e => e.mapa);
    this.zonas = new Map(); // id → <polygon>
    this.pines = new Map(); // id → <button>
    this.seleccionado = null;
    this.onSeleccionar = () => {};
    this.onDeseleccionar = () => {};
    this._capaAbierta = null;
    this._focoPrevio = null;
  }

  // ── Arranque ──
  init({ onSeleccionar, onDeseleccionar } = {}) {
    if (onSeleccionar) this.onSeleccionar = onSeleccionar;
    if (onDeseleccionar) this.onDeseleccionar = onDeseleccionar;

    this.$ = (id) => document.getElementById(id);
    this.viewport = this.$('mapa-viewport');
    this.lienzo   = this.$('mapa-lienzo');

    this._pintarIconos(document);

    this.lienzo.style.width  = MAPA.ancho + 'px';
    this.lienzo.style.height = MAPA.alto + 'px';
    this.viewport.classList.toggle('pines-sobre-imagen', MAPA.imagenConEtiquetas);

    this.panZoom = new PanZoom(this.viewport, this.lienzo, {
      ancho: MAPA.ancho,
      alto: MAPA.alto,
      maxEscala: 1.6,
      // Pantallas anchas ven todo el campus; en móvil el mapa llena el espacio y se arrastra.
      modoInicial: () => (window.matchMedia('(min-width: 900px)').matches ? 'contener' : 'cubrir'),
      onCambio: (s) => {
        this.lienzo.style.setProperty('--inv', (1 / s).toFixed(4));
        this.viewport.classList.toggle('compacto', s < ESCALA_COMPACTA);
      }
    });

    // Controles de zoom
    this.$('btn-zoom-mas').addEventListener('click', () => this.panZoom.zoom(1.4));
    this.$('btn-zoom-menos').addEventListener('click', () => this.panZoom.zoom(1 / 1.4));
    this.$('btn-encuadrar').addEventListener('click', () => this.panZoom.encuadrar('contener', true));

    // Tocar un punto vacío del mapa cierra la ficha (solo dentro del mapa)
    this.viewport.addEventListener('click', (e) => {
      if (e.target.closest('.zona, .pin')) return;
      if (this.seleccionado) this.onDeseleccionar();
    });

    // Ficha: plegar/desplegar en móvil
    const resumen = this.$('ficha-resumen');
    resumen.addEventListener('click', () => {
      if (window.matchMedia('(min-width: 900px)').matches) return;
      resumen.setAttribute('aria-expanded', String(resumen.getAttribute('aria-expanded') !== 'true'));
    });
    this.$('cerrar-panel').addEventListener('click', () => this.onDeseleccionar());

    // Capas (hojas y avisos)
    document.querySelectorAll('.capa').forEach(capa => {
      capa.addEventListener('click', (e) => {
        if (e.target === capa || e.target.closest('[data-cerrar]')) this.cerrarCapa(capa.id);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this._capaAbierta && this._capaAbierta !== 'sesion-cerrada') this.cerrarCapa(this._capaAbierta);
      else if (this.seleccionado) this.onDeseleccionar();
    });

    return this;
  }

  cargarFondo() {
    const img = this.$('mapa-imagen');
    img.width  = MAPA.ancho;
    img.height = MAPA.alto;
    img.src = BASE_URL + MAPA.imagen;
  }

  cargarBloques() {
    const svg = this.$('mapa-zonas');
    svg.setAttribute('viewBox', `0 0 ${MAPA.ancho} ${MAPA.alto}`);
    const capaPines = this.$('mapa-pines');

    this.edificios.forEach((ed) => {
      const { zona, pin, nombreCorto, pinIcono } = ed.mapa;

      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', zona.map(p => p.join(',')).join(' '));
      poly.setAttribute('class', 'zona');
      poly.dataset.id = ed.id;
      poly.addEventListener('click', () => this.onSeleccionar(ed));
      svg.appendChild(poly);
      this.zonas.set(ed.id, poly);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pin';
      btn.dataset.id = ed.id;
      btn.style.left = pin[0] + 'px';
      btn.style.top  = pin[1] + 'px';
      btn.setAttribute('aria-label', ed.nombre);
      btn.innerHTML = `
        <span class="pin-circulo">${icono(pinIcono)}<span class="pin-check">${icono('check')}</span></span>
        <span class="pin-nombre">${nombreCorto}</span>`;
      btn.addEventListener('click', () => this.onSeleccionar(ed));
      capaPines.appendChild(btn);
      this.pines.set(ed.id, btn);
    });
  }

  // ── Selección ──
  seleccionarBloque(id) {
    this.deseleccionarBloque();
    this.seleccionado = id;
    this.zonas.get(id)?.classList.add('seleccionada');
    this.pines.get(id)?.classList.add('seleccionado');

    const ed = this.edificios.find(e => e.id === id);
    if (ed) {
      const [cx, cy] = this._centroZona(ed.mapa.zona);
      const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.panZoom.centrarEn(cx, cy, this.panZoom.escalaCubrir, !reducir);
    }
  }

  deseleccionarBloque() {
    if (!this.seleccionado) return;
    this.zonas.get(this.seleccionado)?.classList.remove('seleccionada');
    this.pines.get(this.seleccionado)?.classList.remove('seleccionado');
    this.seleccionado = null;
  }

  /** Estado de carrera en los pines: escaneados (Set de ids) y los que hacen parte de la carrera. */
  marcarEstados({ escaneados = new Set(), enCarrera = null } = {}) {
    this.pines.forEach((btn, id) => {
      const ed = this.edificios.find(e => e.id === id);
      const hecho = escaneados.has(id);
      const fuera = enCarrera && !enCarrera.has(id);
      btn.classList.toggle('escaneado', hecho);
      btn.classList.toggle('fuera', !!fuera);
      btn.setAttribute('aria-label', ed.nombre + (hecho ? ', escaneado' : fuera ? ', no está en esta carrera' : ''));
    });
  }

  // ── Ficha ──
  /** estado: null (sin carrera) | 'escaneado' | 'pendiente' | 'fuera' */
  mostrarPanel(datos, estado = null) {
    this.$('panel-titulo').textContent      = datos.nombre;
    this.$('panel-descripcion').textContent = datos.descripcion;
    this.$('panel-localizacion').textContent = (datos.localizacion || '').replace(/^📍\s*/, '');

    const puntos = datos.puntosDeInteres || [];
    this.$('ficha-puntos').innerHTML = puntos.map(p => `<li>${p.texto}</li>`).join('');
    this.$('ficha-puntos-bloque').hidden = puntos.length === 0;

    const est = this.$('ficha-estado');
    const textos = {
      escaneado: [icono('check') + 'Ya lo escaneaste', 'ok'],
      pendiente: ['Pendiente por escanear', ''],
      fuera:     ['No hace parte de esta carrera', '']
    };
    est.hidden = !estado;
    if (estado) {
      est.innerHTML = textos[estado][0];
      est.className = 'ficha-estado ' + textos[estado][1];
    }

    if (datos.mapa) this._pintarMiniatura(datos.mapa.zona);

    this.$('ficha-vacia').hidden = true;
    this.$('ficha-edificio').hidden = false;
  }

  ocultarPanel() {
    this.$('ficha-edificio').hidden = true;
    this.$('ficha-vacia').hidden = false;
    this.$('ficha-resumen').setAttribute('aria-expanded', 'false');
  }

  // ── Modo carrera / navegación ──
  configurarModo({ enCarrera }) {
    this.$('btn-ar').hidden = !enCarrera;
    this.$('btn-progreso').hidden = !enCarrera;
    this.$('mas-logros').hidden = !enCarrera;
    if (!enCarrera) this.$('display-puntos-mapa').style.display = 'none';

    // Durante una carrera, "Libre" se desactiva para no perder la partida en curso.
    const libre = this.$('nav-libre');
    if (enCarrera) {
      libre.setAttribute('aria-disabled', 'true');
      libre.title = 'Termina la carrera para usar el modo libre';
      libre.addEventListener('click', (e) => e.preventDefault());
    }
  }

  // ── Capas ──
  abrirCapa(id) {
    const capa = this.$(id);
    if (!capa) return;
    this._focoPrevio = document.activeElement;
    capa.hidden = false;
    this._capaAbierta = id;
    capa.querySelector('button, a')?.focus();
  }

  cerrarCapa(id) {
    const capa = this.$(id);
    if (!capa) return;
    capa.hidden = true;
    if (this._capaAbierta === id) this._capaAbierta = null;
    this._focoPrevio?.focus?.();
  }

  mostrarSesionCerrada() { this.abrirCapa('sesion-cerrada'); }

  /** progreso: { completados, total, items: [{ nombre, escaneado, hora }] } */
  renderLogros({ completados, total, items }) {
    this.$('texto-progreso').textContent = `${completados} / ${total} edificios`;
    this.$('barra-progreso').style.width = (total > 0 ? (completados / total) * 100 : 0) + '%';

    const lista = this.$('lista-logros');
    if (!items.length) {
      lista.innerHTML = '<li class="logros-vacio">Esta carrera todavía no tiene edificios.</li>';
      return;
    }
    lista.innerHTML = items.map(it => `
      <li class="logro ${it.escaneado ? 'hecho' : ''}">
        <span class="logro-icono">${icono(it.escaneado ? 'check' : 'candado')}</span>
        <div>
          <div class="logro-nombre">${it.nombre}</div>
          <div class="logro-estado">${it.escaneado ? 'Escaneado a las ' + it.hora : 'Pendiente'}</div>
        </div>
      </li>`).join('');
  }

  // ── Utilidades ──
  _pintarIconos(raiz) {
    raiz.querySelectorAll('[data-icono]').forEach(el => {
      el.insertAdjacentHTML('afterbegin', icono(el.dataset.icono));
    });
  }

  _centroZona(zona) {
    const xs = zona.map(p => p[0]), ys = zona.map(p => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }

  /** Recorta el edificio de la misma imagen del mapa (4:3) para la miniatura de la ficha. */
  _pintarMiniatura(zona) {
    const W = MAPA.ancho, H = MAPA.alto;
    const xs = zona.map(p => p[0]), ys = zona.map(p => p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let w = (x1 - x0) * 1.2, h = (y1 - y0) * 1.2;
    if (w / h > 4 / 3) h = w * 3 / 4; else w = h * 4 / 3;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = Math.max(0, Math.min(W - w, cx - w / 2));
    y0 = Math.max(0, Math.min(H - h, cy - h / 2));

    const foto = this.$('ficha-foto');
    foto.style.backgroundImage = `url("${BASE_URL + MAPA.imagen}")`;
    foto.style.backgroundSize = `${(W / w) * 100}% auto`;
    foto.style.backgroundPosition = `${(x0 / (W - w)) * 100}% ${(y0 / (H - h)) * 100}%`;
  }
}
