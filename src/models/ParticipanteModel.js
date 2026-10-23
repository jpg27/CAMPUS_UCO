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

/**
 * Elimina a un participante de su carrera (solo admin autenticado; ver
 * rls_policies.sql: participantes_delete_admin y escaneos_delete_admin).
 * Borra primero sus escaneos y luego al participante. Si quedan
 * participantes que completaron la carrera, se recalculan sus posiciones.
 */
export async function eliminarParticipante(participanteId, sesionId) {
  const { error: errEsc } = await supabase
    .from('escaneos')
    .delete()
    .eq('participante_id', participanteId);
  if (errEsc) throw errEsc;

  const { data, error } = await supabase
    .from('participantes')
    .delete()
    .eq('id', participanteId)
    .select('id');
  if (error) throw error;
  // Con RLS, un borrado sin permiso no da error: simplemente no borra nada
  if (!data || data.length === 0) {
    throw new Error('No se eliminó el participante (¿sesión de administrador vencida?)');
  }

  // Recalcular posiciones: finalizar_participante reordena a todos los
  // completados de la sesión, así que basta con llamarla para uno de ellos.
  const { data: completado } = await supabase
    .from('participantes')
    .select('id')
    .eq('sesion_id', sesionId)
    .eq('completado', true)
    .limit(1)
    .maybeSingle();
  if (completado) {
    await supabase.rpc('finalizar_participante', { p_participante_id: completado.id });
  }
}
