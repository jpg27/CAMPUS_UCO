/**
 * GameStrategy.js
 * Interfaz base para las estrategias de juego (Modo Libre vs Modo Carrera).
 */

export class GameStrategy {
  async registrarEscaneo(edificioId, puntos, preguntaId, respondioCorrectamente) {
    throw new Error('No implementado');
  }

  async obtenerProgreso() {
    throw new Error('No implementado');
  }

  estaActivo() {
    throw new Error('No implementado');
  }

  obtenerTotalEdificios() {
    throw new Error('No implementado');
  }
}
