/**
 * Modelo para la gestión de Participantes.
 */
import { supabase } from '../config.js';

export async function unirseASesion(sesionId, nombre) {
  const { data, error } = await supabase
    .from('participantes')
    .insert({ sesion_id: sesionId, nombre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerParticipantes(sesionId) {
  const { data, error } = await supabase
    .from('participantes')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('posicion', { ascending: true, nullsFirst: false });
  if (error) return [];
  return data;
}
