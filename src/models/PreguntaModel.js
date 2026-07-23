/**
 * Modelo para la gestión de Preguntas.
 */
import { supabase } from '../config.js';

export async function obtenerPreguntaAleatoria(edificioId, preguntasRespondidas = []) {
  const { data, error } = await supabase
    .from('preguntas')
    .select('*')
    .eq('edificio_id', edificioId);

  if (error || !data || data.length === 0) return null;

  // Filtrar preguntas ya respondidas
  const disponibles = data.filter(p => !preguntasRespondidas.includes(p.id));
  if (disponibles.length === 0) return null;

  // Retornar una al azar
  const idx = Math.floor(Math.random() * disponibles.length);
  return disponibles[idx];
}

export async function obtenerPreguntas(edificioId) {
  const { data, error } = await supabase
    .from('preguntas')
    .select('*')
    .eq('edificio_id', edificioId)
    .order('creada_en', { ascending: true });
  if (error) return [];
  return data;
}

export async function crearPregunta(edificioId, pregunta, opciones, respuestaCorrecta) {
  const { data, error } = await supabase
    .from('preguntas')
    .insert({
      edificio_id: edificioId,
      pregunta,
      opcion_a: opciones.a,
      opcion_b: opciones.b,
      opcion_c: opciones.c,
      opcion_d: opciones.d,
      respuesta_correcta: respuestaCorrecta
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarPregunta(preguntaId) {
  const { error } = await supabase
    .from('preguntas')
    .delete()
    .eq('id', preguntaId);
  if (error) throw error;
}
