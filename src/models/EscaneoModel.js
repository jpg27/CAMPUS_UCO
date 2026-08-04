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

  if (error) throw error;

  if (esUltimo) {
    await calcularTiempoYPosicion(participanteId, sesionId);
  }

  return { data, esPrimero, esUltimo, duplicado: false };
}

async function calcularTiempoYPosicion(participanteId, sesionId) {
  const { data: escaneos } = await supabase
    .from('escaneos')
    .select('escaneado_en, es_primero, es_ultimo, puntos')
    .eq('participante_id', participanteId)
    .order('escaneado_en', { ascending: true });

  const primero = escaneos.find(e => e.es_primero);
  const ultimo  = escaneos.find(e => e.es_ultimo);

  if (!primero || !ultimo) return;

  const tiempoTotal   = Math.floor((new Date(ultimo.escaneado_en) - new Date(primero.escaneado_en)) / 1000);
  const puntosTotal   = (escaneos || []).reduce((sum, e) => sum + (e.puntos || 0), 0);

  await supabase
    .from('participantes')
    .update({ completado: true, tiempo_total: tiempoTotal, puntos_total: puntosTotal })
    .eq('id', participanteId);

  const { data: completados } = await supabase
    .from('participantes')
    .select('id, puntos_total')
    .eq('sesion_id', sesionId)
    .eq('completado', true)
    .order('puntos_total', { ascending: false });

  for (let i = 0; i < completados.length; i++) {
    await supabase
      .from('participantes')
      .update({ posicion: i + 1 })
      .eq('id', completados[i].id);
  }
}
