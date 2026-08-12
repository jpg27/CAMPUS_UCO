/**
 * GameStrategy.js
 * Interfaz base abstracta para las estrategias de juego (Modo Libre vs Modo Carrera).
 */

export class GameStrategy {
  constructor() {
    if (new.target === GameStrategy) {
      throw new Error('GameStrategy es abstracta y no debe instanciarse directamente');
    }
  }

  async registrarEscaneo(edificioId, puntos, preguntaId, respondioCorrectamente) {
    throw new Error(`${this.constructor.name}.registrarEscaneo() no implementado`);
  }

  async obtenerProgreso() {
    throw new Error(`${this.constructor.name}.obtenerProgreso() no implementado`);
  }

  estaActivo() {
    throw new Error(`${this.constructor.name}.estaActivo() no implementado`);
  }

  obtenerTotalEdificios() {
    throw new Error(`${this.constructor.name}.obtenerTotalEdificios() no implementado`);
  }
}
