-- ============================================================
-- RLS para Campus UCO
-- Requisito: el usuario admin debe existir ANTES en Supabase Auth
-- (Authentication → Users → Add user), porque estas políticas
-- distinguen "anon" (estudiantes/participantes, sin login) de
-- "authenticated" (cualquier sesión real de Supabase Auth = admin).
-- ============================================================

alter table sesiones         enable row level security;
alter table participantes    enable row level security;
alter table escaneos         enable row level security;
alter table preguntas        enable row level security;
alter table edificios_sesion enable row level security;

-- ── SESIONES ──
-- Lectura pública (nombre/código/estado no son sensibles: se
-- necesitan para que un participante se una y para que el mapa
-- sepa si la sesión sigue activa). Escritura solo admin.
create policy "sesiones_select_publico" on sesiones
  for select using (true);
create policy "sesiones_insert_admin" on sesiones
  for insert to authenticated with check (true);
create policy "sesiones_update_admin" on sesiones
  for update to authenticated using (true);
create policy "sesiones_delete_admin" on sesiones
  for delete to authenticated using (true);

-- ── PARTICIPANTES ──
-- Cualquiera puede unirse (insert) y ver el ranking (select).
-- UPDATE cerrado a admin desde 2026-09-10 (ver
-- "Claude outputs/2026-09-10_seguridad_puntajes.sql"): antes el
-- propio cliente (sin login) calculaba y guardaba con un UPDATE
-- público completado/tiempo_total/puntos_total/posicion al terminar
-- la carrera, lo que permitía que cualquiera forzara un UPDATE sobre
-- la fila de otro participante desde la consola. Ese cálculo ahora
-- vive en la función de servidor `finalizar_participante`
-- (SECURITY DEFINER), que sigue pudiendo escribir aunque este UPDATE
-- público ya no exista.
create policy "participantes_select_publico" on participantes
  for select using (true);
create policy "participantes_insert_publico" on participantes
  for insert with check (true);
create policy "participantes_update_admin" on participantes
  for update to authenticated using (true);
create policy "participantes_delete_admin" on participantes
  for delete to authenticated using (true);

-- ── ESCANEOS ──
-- Se insertan y leen sin login (el propio flujo de juego). Nada de
-- update; delete solo admin (por si se necesita limpiar datos).
-- Restricción única (participante_id, edificio_id) agregada en
-- "Claude outputs/2026-09-10_seguridad_puntajes.sql" contra
-- duplicados por doble tap o reintento de red.
create policy "escaneos_select_publico" on escaneos
  for select using (true);
create policy "escaneos_insert_publico" on escaneos
  for insert with check (true);
create policy "escaneos_delete_admin" on escaneos
  for delete to authenticated using (true);

-- ── PREGUNTAS ──
-- Lectura pública (se necesitan para jugar). Crear/editar/eliminar
-- SOLO admin autenticado — esto es lo que cierra el hueco de
-- borrarPregunta()/guardarPregunta() que hoy corre con la misma
-- clave anon que usa cualquier visitante.
create policy "preguntas_select_publico" on preguntas
  for select using (true);
create policy "preguntas_insert_admin" on preguntas
  for insert to authenticated with check (true);
create policy "preguntas_update_admin" on preguntas
  for update to authenticated using (true);
create policy "preguntas_delete_admin" on preguntas
  for delete to authenticated using (true);

-- ── EDIFICIOS_SESION ──
-- Lectura pública (mapa y carrera necesitan saber qué edificios
-- tiene la sesión). Escritura solo admin (se crea junto a la
-- sesión en crearSesion()).
create policy "edificios_sesion_select_publico" on edificios_sesion
  for select using (true);
create policy "edificios_sesion_insert_admin" on edificios_sesion
  for insert to authenticated with check (true);
create policy "edificios_sesion_update_admin" on edificios_sesion
  for update to authenticated using (true);
create policy "edificios_sesion_delete_admin" on edificios_sesion
  for delete to authenticated using (true);
