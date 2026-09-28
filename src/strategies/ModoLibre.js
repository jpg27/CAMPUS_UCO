/**
 * ModoLibre.js
 * Estrategia para el modo de exploración libre.
 * Es puramente informativo: no registra progreso, no tiene logros ni ranking,
 * y el mismo marcador puede reescanearse tantas veces como se quiera.
 */
import { GameStrategy } from './GameStrategy.js';
import { EDIFICIOS } from '../config.js';

export class ModoLibre extends GameStrategy {
  constructor() {
    super();
  }

  async init(contexto) {
    // Sin sesión ni ranking: el display de puntos y el botón de logros no aplican.
    contexto.view.ocultarPuntos();
    contexto.view.ocultarBotonLogros();
  }

  async manejarDeteccion(edificio, targetEntity, contexto) {
    // Modo Libre: sin preguntas, sin control de duplicados, sin persistencia.
    // Panel 3D anclado al marcador con los puntos de interés del edificio (Cambio 1).
    contexto.view.mostrarPuntosInteres(edificio, targetEntity);
  }

  manejarPerdida(edificio, targetEntity, contexto) {
    contexto.view.ocultarPuntosInteres();
  }

  tieneLogros() {
    return false;
  }

  estaActivo() {
    return true;
  }

  obtenerTotalEdificios() {
    return EDIFICIOS.length;
  }
}
