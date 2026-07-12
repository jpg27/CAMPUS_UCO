import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cycuqoogdmxrywxutjbg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nVkVjEh2OOeYLDVb6LyJCg_IRmm5T0s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mantener Supabase activo
const ultimoPing = localStorage.getItem('supabase_ping');
const ahora = Date.now();
if (!ultimoPing || ahora - parseInt(ultimoPing) > 259200000) {
  supabase.from('sesiones').select('id').limit(1);
  localStorage.setItem('supabase_ping', ahora);
}

// ═══════════════════════════════════════════
// FUNCIONES DE SESIONES
// ═══════════════════════════════════════════
export async function obtenerSesionPorCodigo(codigo) {
  const { data, error } = await supabase
    .from('sesiones')
    .select('*')
    .eq('codigo', codigo.toUpperCase())
    .in('estado', ['borrador', 'activa'])
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function crearSesion(nombre, codigo, edificios) {
  const { data, error } = await supabase
    .from('sesiones')
    .insert({
      nombre,
      codigo: codigo.toUpperCase(),
      estado: 'borrador',
      total_edificios: edificios.length
    })
    .select()
    .single();
  if (error) throw error;

  const edificiosData = edificios.map((e, i) => ({
    sesion_id: data.id,
    edificio_id: e.id,
    nombre: e.nombre,
    orden: i + 1
  }));

  await supabase.from('edificios_sesion').insert(edificiosData);
  return data;
}

export async function activarSesion(sesionId) {
  const { error } = await supabase
    .from('sesiones')
    .update({ estado: 'activa', activada_en: new Date().toISOString() })
    .eq('id', sesionId);
  if (error) throw error;
}

export async function cerrarSesion(sesionId) {
  const { error } = await supabase
    .from('sesiones')
    .update({ estado: 'cerrada', cerrada_en: new Date().toISOString() })
    .eq('id', sesionId);
  if (error) throw error;
}

// ═══════════════════════════════════════════
// FUNCIONES DE PARTICIPANTES
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// FUNCIONES DE PREGUNTAS
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// FUNCIONES DE ESCANEOS
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// REALTIME
// ═══════════════════════════════════════════
export function escucharParticipantes(sesionId, callback) {
  return supabase
    .channel('participantes-' + sesionId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'participantes',
      filter: `sesion_id=eq.${sesionId}`
    }, callback)
    .subscribe();
}

export function escucharEscaneos(sesionId, callback) {
  return supabase
    .channel('escaneos-' + sesionId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'escaneos',
      filter: `sesion_id=eq.${sesionId}`
    }, callback)
    .subscribe();
}