// ═══════════════════════════════════════════
// PuntosController.js — Cronómetro descendente centralizado
// Extraído de ar.html y mapa.html (lógica duplicada unificada)
// ═══════════════════════════════════════════
import { PUNTOS } from '../config.js';
import { guardarPuntos, obtenerPuntos, limpiarPuntos } from '../utils/storage.js';

export class PuntosController {
  constructor(display, msPorTick) {
    this.display = display;
    this.msPorTick = msPorTick;
    this.puntosActuales = PUNTOS.INICIO;
    this.intervalo = null;
    this.iniciado = false;
  }

  iniciar(sesionId) {
    if (this.iniciado) return;
    this.iniciado = true;

    // Restaurar puntos guardados
    const guardados = obtenerPuntos(sesionId);
    if (guardados.valido) {
      const segundosTranscurridos = Math.floor((Date.now() - guardados.timestamp) / 1000);
      const ticksTranscurridos = Math.floor(segundosTranscurridos / (this.msPorTick / 1000));
      this.puntosActuales = Math.max(0, guardados.puntos - (ticksTranscurridos * PUNTOS.POR_TICK));
    } else {
      this.puntosActuales = PUNTOS.INICIO;
    }

    this.display.actualizar(this.puntosActuales);
    this.display.mostrar();

    this.intervalo = setInterval(() => {
      this.puntosActuales = Math.max(0, this.puntosActuales - PUNTOS.POR_TICK);
      this.display.actualizar(this.puntosActuales);
      guardarPuntos(this.puntosActuales, sesionId);
    }, this.msPorTick);
  }

  detener() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  guardar(sesionId) {
    guardarPuntos(this.puntosActuales, sesionId);
    this.detener();
  }

  aplicarBonus() {
    this.puntosActuales = Math.min(1000, this.puntosActuales + PUNTOS.BONUS_CORRECTO);
    this.display.actualizar(this.puntosActuales);
  }

  aplicarPenalizacion() {
    this.puntosActuales = Math.max(0, this.puntosActuales - PUNTOS.PENALIZACION);
    this.display.actualizar(this.puntosActuales);
  }

  resetear(sesionId) {
    this.detener();
    limpiarPuntos();
    this.puntosActuales = PUNTOS.INICIO;
    this.display.actualizar(this.puntosActuales);
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
