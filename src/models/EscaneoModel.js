/**
 * Modelo para la gestión de Escaneos.
 */
import { supabase } from '../config.js';

export async function registrarEscaneo(participanteId, sesionId, edificioId, totalEdificios, puntos = 0, preguntaId = null, respondioCorrectamente = null) {
  const { data: yaEscaneado } = await supabase
    .from('escaneos')
    .select('id')
    .eq('participante_id', participanteId)
    .eq('edificio_id', edificioId)
    .maybeSingle();

  if (yaEscaneado) return { duplicado: true };

  const { count } = await supabase
    .from('escaneos')
    .select('*', { count: 'exact' })
    .eq('participante_id', participanteId);

  const esPrimero = count === 0;
  const esUltimo  = count + 1 === totalEdificios;

  const { data, error } = await supabase
    .from('escaneos')
    .insert({
      participante_id: participanteId,
      sesion_id: sesionId,
      edificio_id: edificioId,
      es_primero: esPrimero,
      es_ultimo: esUltimo,
      puntos,
      pregunta_id: preguntaId,
      respondio_correctamente: respondioCorrectamente
    })
    .select()
    .single();

  if (error) {
    // 23505 = violación de la restricción única (participante_id, edificio_id)
    // agregada en "Claude outputs/2026-09-10_seguridad_puntajes.sql". Puede
    // pasar por un doble tap o un reintento de red llegando casi al mismo
    // tiempo que el insert anterior; el chequeo de arriba ya cubre el caso
    // normal, esto cubre la condición de carrera que ese chequeo no podía cerrar.
    if (error.code === '23505') return { duplicado: true };
    throw error;
  }

  if (esUltimo) {
    await finalizarParticipante(participanteId);
  }

  return { data, esPrimero, esUltimo, duplicado: false };
}

// El cálculo de tiempo_total/puntos_total/posicion ya NO corre en el
// navegador del participante: corre en la función de servidor
// `finalizar_participante` (SECURITY DEFINER, ver
// "Claude outputs/2026-09-10_seguridad_puntajes.sql"). Antes este cliente
// hacía el cálculo aquí mismo y lo guardaba con un UPDATE público sobre
// `participantes`, lo que permitía que cualquiera alterara su propio
// resultado desde la consola del navegador — ese UPDATE público ya no
// existe (ver rls_policies.sql, policy "participantes_update_admin").
async function finalizarParticipante(participanteId) {
  const { error } = await supabase.rpc('finalizar_participante', {
    p_participante_id: participanteId
  });
  if (error) console.error('[finalizarParticipante] Error en RPC:', error);
}
