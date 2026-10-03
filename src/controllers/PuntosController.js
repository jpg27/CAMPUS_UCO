// ═══════════════════════════════════════════
// PuntosController.js — Cronómetro descendente de la carrera
//
// Los puntos NO se guardan como un número que se va restando: se calculan
// siempre a partir de la hora en que empezó el tramo actual (desde la
// activación de la carrera o desde el último edificio registrado):
//
//   puntos = INICIO - (segundos transcurridos / segundos por tick) - penalización
//
// Ese "tramo" se guarda en localStorage (ver storage.js), así que AR y mapa
// leen el mismo dato: cambiar de vista, recargar o volver atrás no reinicia
// el contador, porque el tiempo sigue corriendo aunque ninguna página esté
// abierta.
// ═══════════════════════════════════════════
import { PUNTOS } from '../config.js';
import { obtenerTramo, crearTramo, guardarTramo } from '../utils/storage.js';

const MS_REFRESCO = 500; // cada cuánto se repinta el display

export class PuntosController {
  constructor(display, msPorTick) {
    this.display = display;
    this.msPorTick = msPorTick;
    this.puntosActuales = PUNTOS.INICIO;
    this.intervalo = null;
    this.iniciado = false;
    this.sesionId = null;
    this.tramo = null;
  }

  iniciar(sesionId) {
    if (this.iniciado) return;
    this.iniciado = true;
    this.sesionId = sesionId;
    // Si ya hay un tramo en curso para esta sesión se continúa; solo se crea
    // uno nuevo si no existe (p. ej. primera vez que se abre la carrera).
    this.tramo = obtenerTramo(sesionId) || crearTramo(sesionId);

    this._refrescar();
    this.display.mostrar?.();
    clearInterval(this.intervalo);
    this.intervalo = setInterval(() => this._refrescar(), MS_REFRESCO);
  }

  /** Puntos según el reloj real (no depende de que la página haya estado abierta). */
  calcular() {
    if (!this.tramo) return PUNTOS.INICIO;
    const ticks = Math.floor((Date.now() - this.tramo.inicio) / this.msPorTick);
    const puntos = PUNTOS.INICIO - ticks * PUNTOS.POR_TICK - (this.tramo.penalizacion || 0);
    return Math.max(0, Math.min(PUNTOS.INICIO, puntos));
  }

  _refrescar() {
    this.puntosActuales = this.calcular();
    this.display.actualizar(this.puntosActuales);
  }

  /**
   * Congela el display (p. ej. mientras se responde una pregunta). Solo afecta
   * a esta página: el tramo guardado sigue corriendo, así que salir a otra
   * vista y volver no deja los puntos congelados para siempre.
   */
  detener() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  // Se mantiene por compatibilidad con ModoCarrera.alIrAlMapa(): ya no hace
  // falta guardar nada, el tramo vive en localStorage desde que se crea.
  guardar() {
    this.detener();
  }

  aplicarBonus() {
    if (!this.tramo || !PUNTOS.BONUS_CORRECTO) return;
    this.tramo.penalizacion = (this.tramo.penalizacion || 0) - PUNTOS.BONUS_CORRECTO;
    guardarTramo(this.tramo);
    this.puntosActuales = Math.min(PUNTOS.INICIO, this.puntosActuales + PUNTOS.BONUS_CORRECTO);
    this.display.actualizar(this.puntosActuales);
  }

  aplicarPenalizacion() {
    if (!this.tramo) return;
    this.tramo.penalizacion = (this.tramo.penalizacion || 0) + PUNTOS.PENALIZACION;
    guardarTramo(this.tramo);
    this.puntosActuales = Math.max(0, this.puntosActuales - PUNTOS.PENALIZACION);
    this.display.actualizar(this.puntosActuales);
  }

  /** Empieza un tramo nuevo desde INICIO (después de registrar un edificio). */
  resetear(sesionId) {
    this.detener();
    this.tramo = crearTramo(sesionId);
    this.iniciado = false;
    this.iniciar(sesionId);
  }

  obtenerPuntos() {
    return this.puntosActuales;
  }

  destruir() {
    this.detener();
  }
}
