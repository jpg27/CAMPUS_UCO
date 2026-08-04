/**
 * ModoLibre.js
 * Estrategia para el modo de exploración libre.
 */
import { GameStrategy } from './GameStrategy.js';
import { EDIFICIOS } from '../config.js';
import { guardarProgresoLibre, obtenerProgresoLibre } from '../utils/storage.js';

export class ModoLibre extends GameStrategy {
  constructor() {
    super();
  }

  async registrarEscaneo(edificioId, puntos, preguntaId, respondioCorrectamente) {
    const progreso = obtenerProgresoLibre() || {};
    const esPrimero = Object.keys(progreso).length === 0;
    const duplicado = !!progreso[edificioId];
    
    if (!duplicado) {
      const datos = {
        edificioId,
        escaneadoEn: new Date().toISOString(),
        puntos,
        preguntaId,
        respondioCorrectamente
      };
      guardarProgresoLibre(edificioId, datos);
      progreso[edificioId] = datos;
    }
    
    return {
      duplicado,
      esPrimero,
      esUltimo: false,
      data: progreso[edificioId]
    };
  }

  async obtenerProgreso() {
    return obtenerProgresoLibre() || {};
  }

  estaActivo() {
    return true;
  }

  obtenerTotalEdificios() {
    return EDIFICIOS.length;
  }
}
