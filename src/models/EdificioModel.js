/**
 * Modelo para la gestión de Edificios.
 */
import { supabase } from '../config.js';
import { EDIFICIOS, obtenerEdificioPorId } from '../config.js';

export function obtenerTodosEdificios() {
  return EDIFICIOS;
}

export function buscarEdificio(id) {
  return obtenerEdificioPorId(id);
}

export async function obtenerEdificiosSesion(sesionId) {
  const { data, error } = await supabase
    .from('edificios_sesion')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('orden', { ascending: true });
  if (error) return [];
  return data;
}

export async function obtenerEscaneosPorParticipante(participanteId, sesionId) {
  const { data, error } = await supabase
    .from('escaneos')
    .select('*')
    .eq('participante_id', participanteId)
    .eq('sesion_id', sesionId);
  if (error) return [];
  return data;
}
