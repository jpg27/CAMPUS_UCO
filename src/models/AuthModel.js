/**
 * AuthModel.js
 * Autenticación real de administrador vía Supabase Auth.
 * Capa de modelo: solo toca Supabase, no toca el DOM.
 */
import { supabase } from '../config.js';

export async function iniciarSesionAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function obtenerSesionAdmin() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function cerrarSesionAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
