/**
 * ModoCarrera.js
 * Estrategia para el modo carrera (competitivo).
 */
import { GameStrategy } from './GameStrategy.js';
import { registrarEscaneo } from '../models/EscaneoModel.js';
import { supabase } from '../config.js';

export class ModoCarrera extends GameStrategy {
  constructor(participante, sesion) {
    super();
    this.participante = participante;
    this.sesion = sesion;
  }

  async registrarEscaneo(edificioId, puntos, preguntaId, respondioCorrectamente) {
    return await registrarEscaneo(
      this.participante.id,
      this.sesion.id,
      edificioId,
      this.sesion.total_edificios,
      puntos,
      preguntaId,
      respondioCorrectamente
    );
  }

  async obtenerProgreso() {
    const { data, error } = await supabase
      .from('escaneos')
      .select('edificio_id, escaneado_en, puntos, respondio_correctamente')
      .eq('participante_id', this.participante.id)
      .eq('sesion_id', this.sesion.id);

    if (error) throw error;
    return data || [];
  }

  estaActivo() {
    return !!(this.participante && this.sesion);
  }

  obtenerTotalEdificios() {
    return this.sesion.total_edificios;
  }
}
