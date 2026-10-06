// ═══════════════════════════════════════════
// PanZoom.js — Arrastrar y hacer zoom sobre el mapa (sin librerías)
// Mueve `lienzo` (tamaño natural ancho×alto px) dentro de `viewport`
// con transform: translate() scale(). Soporta mouse, touch y pellizco
// vía Pointer Events, y rueda del mouse.
// ═══════════════════════════════════════════

const UMBRAL_ARRASTRE = 6; // px antes de considerar que no fue un toque

export class PanZoom {
  constructor(viewport, lienzo, { ancho, alto, maxEscala = 1.6, modoInicial = () => 'cubrir', onCambio = () => {} }) {
    this.modoInicial = modoInicial;
    this.vp = viewport;
    this.lienzo = lienzo;
    this.W = ancho;
    this.H = alto;
    this.maxEscala = maxEscala;
    this.onCambio = onCambio;

    this.s = 1; this.tx = 0; this.ty = 0;
    this.punteros = new Map();
    this.gesto = null;
    this.huboArrastre = false;

    this._bind();
    new ResizeObserver(() => this._alRedimensionar()).observe(this.vp);
  }

  // ── API pública ──
  get minEscala() {
    const { width, height } = this._tamVp();
    return Math.min(width / this.W, height / this.H);
  }

  get escalaCubrir() {
    const { width, height } = this._tamVp();
    return Math.min(this.maxEscala, Math.max(width / this.W, height / this.H));
  }

  /** 'cubrir' llena el viewport (recorta), 'contener' muestra todo el campus. */
  encuadrar(modo = 'cubrir', animar = false) {
    const { width, height } = this._tamVp();
    const s = modo === 'cubrir'
      ? Math.max(width / this.W, height / this.H)
      : this.minEscala;
    this._aplicar(Math.min(s, this.maxEscala), (width - this.W * s) / 2, (height - this.H * s) / 2, animar);
  }

  /** Centra el punto (x,y) del mapa, opcionalmente con una escala mínima. */
  centrarEn(x, y, escalaMin = null, animar = true) {
    const { width, height } = this._tamVp();
    const s = escalaMin ? Math.max(this.s, Math.min(escalaMin, this.maxEscala)) : this.s;
    this._aplicar(s, width / 2 - x * s, height / 2 - y * s, animar);
  }

  /** Zoom por un factor alrededor de un punto del viewport (por defecto, el centro). */
  zoom(factor, cx = null, cy = null, animar = true) {
    const { width, height } = this._tamVp();
    cx = cx ?? width / 2;
    cy = cy ?? height / 2;
    const s = this._limitarEscala(this.s * factor);
    const px = (cx - this.tx) / this.s;
    const py = (cy - this.ty) / this.s;
    this._aplicar(s, cx - px * s, cy - py * s, animar);
  }

  // ── Internos ──
  _tamVp() { return this.vp.getBoundingClientRect(); }

  _limitarEscala(s) { return Math.min(this.maxEscala, Math.max(this.minEscala, s)); }

  _limitarTraslado(s, tx, ty) {
    const { width, height } = this._tamVp();
    const w = this.W * s, h = this.H * s;
    tx = w <= width  ? (width - w) / 2  : Math.min(0, Math.max(width - w, tx));
    ty = h <= height ? (height - h) / 2 : Math.min(0, Math.max(height - h, ty));
    return [tx, ty];
  }

  _aplicar(s, tx, ty, animar = false) {
    s = this._limitarEscala(s);
    [tx, ty] = this._limitarTraslado(s, tx, ty);
    this.s = s; this.tx = tx; this.ty = ty;
    this.lienzo.classList.toggle('animando', animar);
    this.lienzo.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    this.onCambio(s);
  }

  _alRedimensionar() {
    if (!this._listo) { this._listo = true; this.encuadrar(this.modoInicial()); return; }
    this._aplicar(this.s, this.tx, this.ty);
  }

  _puntoLocal(e) {
    const r = this._tamVp();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _bind() {
    this.vp.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (this.punteros.size === 0) this.huboArrastre = false;
      this.punteros.set(e.pointerId, this._puntoLocal(e));
      this._iniciarGesto();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.punteros.has(e.pointerId)) return;
      this.punteros.set(e.pointerId, this._puntoLocal(e));
      this._moverGesto();
    });

    const soltar = (e) => {
      if (!this.punteros.delete(e.pointerId)) return;
      this._iniciarGesto(); // re-ancla si queda un dedo
    };
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);

    // Si hubo arrastre, el "click" que lanza el navegador al soltar no selecciona nada.
    // (detail === 0 es un click de teclado: ese siempre pasa.)
    this.vp.addEventListener('click', (e) => {
      if (this.huboArrastre && e.detail !== 0) { e.stopPropagation(); e.preventDefault(); }
      this.huboArrastre = false;
    }, true);

    this.vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { x, y } = this._puntoLocal(e);
      this.zoom(Math.exp(-e.deltaY * 0.0015), x, y, false);
    }, { passive: false });
  }

  _iniciarGesto() {
    const pts = [...this.punteros.values()];
    if (pts.length === 0) { this.gesto = null; return; }
    const base = { s: this.s, tx: this.tx, ty: this.ty };
    if (pts.length === 1) {
      this.gesto = { tipo: 'pan', inicio: pts[0], ...base };
    } else {
      const [a, b] = pts;
      this.gesto = {
        tipo: 'pellizco', ...base,
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        medio: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      };
    }
  }

  _moverGesto() {
    const g = this.gesto;
    if (!g) return;
    const pts = [...this.punteros.values()];

    if (g.tipo === 'pan') {
      const dx = pts[0].x - g.inicio.x;
      const dy = pts[0].y - g.inicio.y;
      if (!this.huboArrastre && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
      this.huboArrastre = true;
      this._aplicar(g.s, g.tx + dx, g.ty + dy);
    } else if (pts.length >= 2) {
      this.huboArrastre = true;
      const [a, b] = pts;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = this._limitarEscala(g.s * dist / g.dist);
      const px = (g.medio.x - g.tx) / g.s;
      const py = (g.medio.y - g.ty) / g.s;
      this._aplicar(s, medio.x - px * s, medio.y - py * s);
    }
  }
}
