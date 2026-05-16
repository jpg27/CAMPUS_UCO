// ═══════════════════════════════════════════
// CONEXIÓN CON SUPABASE
// ═══════════════════════════════════════════
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cycuqoogdmxrywxutjbg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nVkVjEh2OOeYLDVb6LyJCg_IRmm5T0s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════
// FUNCIONES DE SESIONES
// ═══════════════════════════════════════════
export async function obtenerSesionPorCodigo(codigo) {
  const { data, error } = await supabase
    .from('sesiones')
    .select('*')
    .eq('codigo', codigo.toUpperCase())
    .in('estado', ['borrador', 'activa'])
    .single();
  if (error) return null;
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

  // Insertar edificios de la sesión
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
// FUNCIONES DE ESCANEOS
// ═══════════════════════════════════════════
export async function registrarEscaneo(participanteId, sesionId, edificioId, totalEdificios, puntos = 0) {
  // Verificar si ya escaneó este edificio
  const { data: yaEscaneado } = await supabase
    .from('escaneos')
    .select('id')
    .eq('participante_id', participanteId)
    .eq('edificio_id', edificioId)
    .single();

  if (yaEscaneado) return { duplicado: true };

  // Contar escaneos anteriores
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
      puntos: puntos
    })
    .select()
    .single();

  if (error) throw error;

  // Si completó todos los edificios, calcular tiempo y posición
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

  const tiempoTotal = Math.floor(
    (new Date(ultimo.escaneado_en) - new Date(primero.escaneado_en)) / 1000
  );

  // Sumar puntos de todos los escaneos
  const puntosTotal = (escaneos || []).reduce((sum, e) => sum + (e.puntos || 0), 0);

  // Actualizar participante con tiempo y puntos
  await supabase
    .from('participantes')
    .update({ completado: true, tiempo_total: tiempoTotal, puntos_total: puntosTotal })
    .eq('id', participanteId);

  // Recalcular posiciones por puntos (más puntos = mejor posición)
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
// REALTIME — escuchar cambios en tiempo real
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