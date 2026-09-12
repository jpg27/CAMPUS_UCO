-- ============================================================
-- Seguridad de puntajes — Campus UCO
-- Fecha: 2026-09-10
--
-- Contexto: hasta ahora el cliente (el navegador del propio
-- participante) calculaba tiempo_total/puntos_total/posicion al
-- terminar la carrera y los guardaba con un UPDATE público sobre
-- `participantes` (ver la nota que tenía rls_policies.sql en la
-- policy "participantes_update_publico"). Esto permitía en teoría
-- que un participante alterara su propio resultado desde la consola
-- del navegador.
--
-- Este script:
--   1. Agrega una restricción única a `escaneos` contra duplicados
--      (doble tap / reintento de red).
--   2. Crea una función de servidor (SECURITY DEFINER) que hace el
--      cálculo de tiempo/puntos/posición en vez del cliente.
--   3. Cierra el UPDATE público sobre `participantes` (ver también
--      el archivo actualizado rls_policies.sql).
--
-- Cómo aplicar: pega este archivo completo en el SQL Editor de
-- Supabase (Database → SQL Editor) y ejecútalo una sola vez. Debe
-- aplicarse ANTES de desplegar el EscaneoModel.js actualizado, o
-- durante una ventana sin carreras activas, porque el cliente nuevo
-- llama a finalizar_participante() y esa función debe existir ya.
-- ============================================================

-- ── 1. Restricción única contra duplicados en escaneos ──
-- Antes el único chequeo de duplicado era un select-then-insert en
-- el cliente (EscaneoModel.js), lo que deja una ventana de condición
-- de carrera ante doble tap o reintento de red. Esta restricción
-- hace que la base de datos rechace el segundo insert aunque ambos
-- lleguen casi al mismo tiempo. El cliente ya está preparado para
-- tratar el error 23505 (violación de unicidad) como duplicado.
alter table escaneos
  add constraint escaneos_participante_edificio_unique
  unique (participante_id, edificio_id);

-- ── 2. Función de servidor para finalizar un participante ──
-- Reemplaza la lógica que antes vivía en
-- EscaneoModel.calcularTiempoYPosicion (cliente). SECURITY DEFINER
-- hace que esta función corra con los privilegios de quien la creó,
-- no los del usuario anónimo que la invoca — así puede seguir
-- escribiendo en `participantes` aunque la política RLS ya no
-- permita el UPDATE público directo sobre esa tabla.
create or replace function finalizar_participante(p_participante_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesion_id     uuid;
  v_tiempo_total  integer;
  v_puntos_total  integer;
  v_primero_en    timestamptz;
  v_ultimo_en     timestamptz;
begin
  select sesion_id into v_sesion_id
  from participantes
  where id = p_participante_id;

  if v_sesion_id is null then
    raise exception 'Participante % no encontrado', p_participante_id;
  end if;

  select min(escaneado_en) filter (where es_primero),
         max(escaneado_en) filter (where es_ultimo),
         coalesce(sum(puntos), 0)
    into v_primero_en, v_ultimo_en, v_puntos_total
  from escaneos
  where participante_id = p_participante_id;

  -- Todavía no completó todos los edificios (no hay es_primero/es_ultimo).
  if v_primero_en is null or v_ultimo_en is null then
    return;
  end if;

  v_tiempo_total := floor(extract(epoch from (v_ultimo_en - v_primero_en)));

  update participantes
     set completado   = true,
         tiempo_total  = v_tiempo_total,
         puntos_total  = v_puntos_total
   where id = p_participante_id;

  -- Recalcular la posición de TODOS los completados de la sesión en
  -- un solo UPDATE atómico (antes era un loop de updates uno por uno
  -- corriendo en el navegador, vulnerable a pisarse entre llamadas
  -- concurrentes cuando varios participantes terminan casi a la vez).
  update participantes p
     set posicion = ranked.posicion
    from (
      select id, row_number() over (order by puntos_total desc) as posicion
      from participantes
      where sesion_id = v_sesion_id and completado = true
    ) ranked
   where p.id = ranked.id;
end;
$$;

-- El participante (anon) y el admin (authenticated) necesitan poder
-- invocar esta función; SECURITY DEFINER es lo que le da permiso de
-- escritura real sobre `participantes` aunque el UPDATE público esté
-- cerrado (paso 3).
grant execute on function finalizar_participante(uuid) to anon, authenticated;

-- ── 3. Cerrar el UPDATE público sobre participantes ──
-- A partir de ahora la única forma de que se escriban
-- completado/tiempo_total/puntos_total/posicion es a través de la
-- función de arriba. El UPDATE directo desde el cliente queda
-- restringido a admin autenticado (mismo cambio reflejado en
-- rls_policies.sql).
drop policy if exists "participantes_update_publico" on participantes;

create policy "participantes_update_admin" on participantes
  for update to authenticated using (true);
