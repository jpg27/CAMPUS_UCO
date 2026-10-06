-- ============================================================
-- Cierre automático de sesiones — Campus UCO
-- Fecha: 2026-10-03
--
-- Problema: el cierre por tiempo (3 horas) vivía solo en el navegador
-- del admin (AdminController → cerrarSesionesCaducadas, cada 5 min).
-- Si nadie tenía el panel admin abierto, la sesión seguía "activa"
-- indefinidamente, con participantes conectados por Realtime.
-- El intento de cerrarla desde el participante (SesionModel.
-- obtenerSesionPorCodigo) tampoco funcionaba: la política RLS
-- "sesiones_update_admin" no deja que el usuario anónimo haga UPDATE.
--
-- Solución: un job de pg_cron dentro de la base de datos, que corre
-- cada 10 minutos aunque no haya ningún navegador abierto. Corre como
-- el dueño de la base de datos, así que no lo bloquea RLS. Como hace
-- un UPDATE normal sobre `sesiones`, los participantes conectados
-- reciben el cambio por Realtime y ven "Carrera finalizada" igual que
-- cuando el admin cierra a mano.
--
-- Cómo aplicar (una sola vez):
--   1. Supabase → Database → Extensions → busca "pg_cron" → Enable.
--      (o deja que la primera línea de abajo lo haga)
--   2. Supabase → SQL Editor → pega este archivo completo → Run.
--   3. Verifica con:  select * from cron.job;
--      y, después de un rato:  select * from cron.job_run_details order by start_time desc limit 5;
--
-- Para cambiar las horas: edita los dos "interval '3 hours'" y vuelve
-- a ejecutar el archivo (cron.schedule con el mismo nombre reemplaza
-- el job anterior).
-- Para desactivarlo:  select cron.unschedule('cerrar-sesiones-caducadas');
-- ============================================================

create extension if not exists pg_cron;

select cron.schedule(
  'cerrar-sesiones-caducadas',
  '*/10 * * * *',   -- cada 10 minutos
  $$
    update public.sesiones
       set estado = 'cerrada',
           cerrada_en = now()
     where (
             -- Carreras activas: 3 horas después de activarlas
             estado = 'activa'
             and coalesce(activada_en, creada_en) < now() - interval '3 hours'
           )
        or (
             -- Borradores que nunca se activaron: 3 horas después de crearlos
             -- (los participantes en la sala de espera también mantienen
             -- una conexión Realtime abierta). Borra este bloque si
             -- prefieres que los borradores no se cierren solos.
             estado = 'borrador'
             and creada_en < now() - interval '3 hours'
           );
  $$
);
