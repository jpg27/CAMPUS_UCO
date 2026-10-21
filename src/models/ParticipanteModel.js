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

/** Participante por id dentro de una sesión (para reconectar). */
export async function obtenerParticipanteDeSesion(participanteId, sesionId) {
  const { data, error } = await supabase
    .from('participantes')
    .select('*')
    .eq('id', participanteId)
    .eq('sesion_id', sesionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Hora (ms) del último edificio que registró, o null si no tiene. */
export async function horaUltimoEscaneo(participanteId) {
  const { data } = await supabase
    .from('escaneos')
    .select('escaneado_en')
    .eq('participante_id', participanteId);
  const horas = (data || []).map(e => new Date(e.escaneado_en).getTime()).filter(Number.isFinite);
  return horas.length ? Math.max(...horas) : null;
}
