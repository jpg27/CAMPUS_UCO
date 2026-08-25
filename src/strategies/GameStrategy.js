/**
 * GameStrategy.js
 * Interfaz base abstracta para las estrategias de juego (Modo Libre vs Modo Carrera).
 * Cada modo implementa aquí su flujo completo de principio a fin: ScanController
 * solo instancia la estrategia correcta y le delega el control, sin conocer los
 * detalles internos de cada modo.
 */

export class GameStrategy {
  constructor() {
    if (new.target === GameStrategy) {
      throw new Error('GameStrategy es abstracta y no debe instanciarse directamente');
    }
  }

  /** Configuración inicial del modo (carga de datos, observers, controlador de puntos, etc). */
  async init(contexto) {
    throw new Error(`${this.constructor.name}.init() no implementado`);
  }

  /** Se ejecuta cuando MindAR detecta un marcador. Dueño de todo el flujo de ese modo. */
  async manejarDeteccion(edificio, targetEntity, contexto) {
    throw new Error(`${this.constructor.name}.manejarDeteccion() no implementado`);
  }

  /** Se ejecuta cuando la escena de A-Frame terminó de cargar. */
  alCargarEscena(contexto) {}

  /** Se ejecuta al navegar hacia el mapa (para persistir estado si aplica). */
  alIrAlMapa(contexto) {}

  /** Indica si este modo tiene panel de logros/ranking. */
  tieneLogros() {
    return false;
  }

  /** Renderiza el panel de logros. Solo se invoca si tieneLogros() === true. */
  async mostrarLogros(contexto) {}

  estaActivo() {
    throw new Error(`${this.constructor.name}.estaActivo() no implementado`);
  }

  obtenerTotalEdificios() {
    throw new Error(`${this.constructor.name}.obtenerTotalEdificios() no implementado`);
  }

  /** Limpieza al salir de la vista (observers, intervalos, etc). */
  destruir() {}
}
