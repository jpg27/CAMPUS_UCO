/**
 * Modelo para la gestión de Sesiones.
 */
import { supabase } from '../config.js';

const HORAS_CADUCIDAD = 3;

export async function cerrarSesionesCaducadas() {
  // Buscar sesiones activas hace más de 3 horas
  const hace3Horas = new Date(Date.now() - HORAS_CADUCIDAD * 60 * 60 * 1000).toISOString();
  
  const { data: caducadas } = await supabase
    .from('sesiones')
    .select('id')
    .eq('estado', 'activa')
    .lt('activada_en', hace3Horas);
    
  if (caducadas && caducadas.length > 0) {
    const ids = caducadas.map(s => s.id);
    await supabase
      .from('sesiones')
      .update({ estado: 'cerrada', cerrada_en: new Date().toISOString() })
      .in('id', ids);
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
  
  // Verificación reactiva: si está activa pero ya pasaron 3 horas, cerrarla.
  if (data.estado === 'activa' && data.activada_en) {
    const activada = new Date(data.activada_en).getTime();
    const ahora = Date.now();
    if ((ahora - activada) > HORAS_CADUCIDAD * 60 * 60 * 1000) {
      await cerrarSesion(data.id);
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
