/**
 * Modelo para la gestión de Sesiones.
 */
import { supabase } from '../config.js';

// El cierre automático real lo hace un job de pg_cron en Supabase
// (ver "Claude outputs/2026-10-03_cierre_automatico_sesiones.sql").
// Lo de este archivo queda como respaldo: el admin cierra las caducadas
// al abrir su panel, y un participante no puede unirse a una caducada.
const HORAS_CADUCIDAD = 3;

/** true si la sesión figura como activa pero ya pasó el tiempo máximo. */
export function estaCaducada(sesion) {
  if (!sesion || sesion.estado !== 'activa') return false;
  const referencia = sesion.activada_en || sesion.creada_en;
  if (!referencia) return false;
  return (Date.now() - new Date(referencia).getTime()) > HORAS_CADUCIDAD * 60 * 60 * 1000;
}

/** Devuelve la sesión con estado 'cerrada' si ya caducó (solo para mostrarla). */
export function conEstadoReal(sesion) {
  return estaCaducada(sesion) ? { ...sesion, estado: 'cerrada' } : sesion;
}

/**
 * Cierra las sesiones activas con más de 3 horas (desde que se activaron).
 * Devuelve la lista de ids que cerró (vacía si no cerró ninguna).
 */
export async function cerrarSesionesCaducadas() {
  try {
    // Buscar sesiones activas
    const { data: activas, error } = await supabase
      .from('sesiones')
      .select('id, estado, creada_en, activada_en')
      .eq('estado', 'activa');
      
    if (error) { console.warn('[AutoCierre] No se pudieron leer las sesiones activas:', error); return []; }
    if (!activas || activas.length === 0) return [];
    
    // Filtrar las que tienen más de 3 horas (usando activada_en si existe, sino creada_en)
    const caducadas = activas.filter(estaCaducada);
    
    if (caducadas.length > 0) {
      const ids = caducadas.map(s => s.id);
      const { data: actualizadas, error: errorUpdate } = await supabase
        .from('sesiones')
        .update({ estado: 'cerrada', cerrada_en: new Date().toISOString() })
        .in('id', ids)
        .select('id');
      // Antes no se revisaba este error: si el UPDATE fallaba, igual se
      // registraba como cerrada y la sesión seguía "activa" en la base.
      if (errorUpdate) {
        console.error('[AutoCierre] No se pudieron cerrar las sesiones caducadas:', errorUpdate);
        return [];
      }
      // Con RLS, un UPDATE sin permiso no da error: simplemente no cambia
      // ninguna fila. Por eso se pide de vuelta qué filas se actualizaron.
      const cerradas = (actualizadas || []).map(s => s.id);
      if (cerradas.length < ids.length) {
        console.warn(`[AutoCierre] Solo se cerraron ${cerradas.length} de ${ids.length} sesiones caducadas (revisa las políticas RLS de "sesiones").`);
      } else {
        console.log(`[AutoCierre] ${cerradas.length} sesión(es) cerrada(s) automáticamente.`);
      }
      return cerradas;
    }
    return [];
  } catch (e) {
    console.warn('[AutoCierre] Error al verificar sesiones caducadas:', e);
    return [];
  }
}

export async function obtenerSesionPorCodigo(codigo) {
  const { data, error } = await supabase
    .from('sesiones')
    .select('*')
    .eq('codigo', codigo.toUpperCase())
    .in('estado', ['borrador', 'activa'])
    .maybeSingle();
    
  if (error || !data) return null;
  
  // Si está activa pero ya pasaron 3 horas, no dejar entrar. (No se intenta
  // cerrarla desde aquí: el participante es anónimo y RLS no le permite
  // hacer UPDATE sobre sesiones; de eso se encarga el job de pg_cron.)
  if (data.estado === 'activa' && data.activada_en) {
    const activada = new Date(data.activada_en).getTime();
    if ((Date.now() - activada) > HORAS_CADUCIDAD * 60 * 60 * 1000) {
      return null; // Ya no está disponible
    }
  }
  
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

export async function eliminarSesion(sesionId) {
  // Borrado en cascada manual
  await supabase.from('escaneos').delete().eq('sesion_id', sesionId);
  await supabase.from('participantes').delete().eq('sesion_id', sesionId);
  await supabase.from('edificios_sesion').delete().eq('sesion_id', sesionId);
  
  // Finalmente borrar la sesión
  const { error } = await supabase.from('sesiones').delete().eq('id', sesionId);
  if (error) throw error;
}
