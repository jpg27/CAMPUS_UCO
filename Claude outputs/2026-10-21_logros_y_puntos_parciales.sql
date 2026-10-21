-- ═══════════════════════════════════════════════════════════════════
-- 2026-10-21 · Panel de logros con respuesta elegida + ranking en vivo
--
-- Ejecuta este archivo completo en el SQL Editor de Supabase.
-- Se puede ejecutar más de una vez sin problema.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Guardar la letra que eligió el participante (a, b, c o d).
--    El panel "Mis logros" la usa para mostrar "Tu respuesta" junto a la
--    correcta. Los escaneos anteriores quedan con NULL (el panel muestra
--    solo la respuesta correcta en ese caso).
alter table public.escaneos
  add column if not exists respuesta_elegida char(1);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'escaneos_respuesta_elegida_check'
  ) then
    alter table public.escaneos
      add constraint escaneos_respuesta_elegida_check
      check (respuesta_elegida is null or respuesta_elegida in ('a', 'b', 'c', 'd'));
  end if;
end $$;

-- 2) Avisar en tiempo real cada escaneo nuevo, para que el ranking del
--    administrador muestre los puntos parciales al instante.
--    (Sin esto el ranking igual se actualiza, pero cada 20 segundos.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'escaneos'
  ) then
    alter publication supabase_realtime add table public.escaneos;
  end if;
end $$;

-- 3) Comprobar
-- select column_name, data_type from information_schema.columns
--  where table_name = 'escaneos' and column_name = 'respuesta_elegida';
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime';
