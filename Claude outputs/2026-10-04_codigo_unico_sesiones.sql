-- ═══════════════════════════════════════════════════════════════════
-- 2026-10-04 · Arreglo: el cierre automático falla por "sesiones_codigo_unique"
--
-- Problema:
--   La restricción única era (codigo, estado). Eso impide que existan
--   dos sesiones CERRADAS con el mismo código. Como ya hay una sesión
--   "HOLA" cerrada, al intentar cerrar otra "HOLA" el UPDATE falla, y
--   como el UPDATE del job es uno solo, no se cierra NINGUNA sesión.
--   (Lo mismo pasaría al cerrarla a mano desde el admin.)
--
-- Arreglo:
--   El código solo debe ser único entre las sesiones ABIERTAS
--   (borrador o activa). Las cerradas pueden repetir código.
--
-- Ejecuta este archivo completo en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- 0) (Opcional) Ver si hay códigos repetidos entre sesiones abiertas.
--    Si esta consulta devuelve filas, el paso 2 fallará: cierra o
--    cambia el código de una de las repetidas y vuelve a ejecutar.
select upper(codigo) as codigo, count(*) as abiertas
  from public.sesiones
 where estado in ('borrador', 'activa')
 group by upper(codigo)
having count(*) > 1;

-- 1) Quitar la restricción vieja (puede existir como constraint o como índice)
alter table public.sesiones drop constraint if exists sesiones_codigo_unique;
drop index if exists public.sesiones_codigo_unique;

-- 2) Código único solo entre sesiones abiertas
create unique index if not exists sesiones_codigo_abierta_unique
  on public.sesiones (upper(codigo))
  where estado in ('borrador', 'activa');

-- 3) Cerrar ya las que están vencidas (sin esperar los 10 minutos del job)
update public.sesiones
   set estado = 'cerrada',
       cerrada_en = now()
 where (estado = 'activa'   and coalesce(activada_en, creada_en) < now() - interval '3 hours')
    or (estado = 'borrador' and creada_en < now() - interval '3 hours');

-- 4) Comprobar: las próximas ejecuciones del job deben salir "succeeded"
-- select status, return_message, start_time
--   from cron.job_run_details
--  order by start_time desc
--  limit 5;
