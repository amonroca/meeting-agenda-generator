-- Migration: 20260509_scheduled_reminders_cron.sql
--
-- Configura um job pg_cron que dispara a Edge Function send-scheduled-reminders
-- todos os dias às 14h (horário de Brasília = 17h UTC).
--
-- Pré-requisitos:
--   1. Extensão pg_cron habilitada:  Dashboard → Database → Extensions → pg_cron
--   2. Extensão pg_net  habilitada:  Dashboard → Database → Extensions → pg_net
--
-- ANTES DE APLICAR: substitua os dois placeholders abaixo pelos valores reais do seu projeto:
--   <PROJECT_REF>       → ID do projeto (ex: abcxyzproject123)
--   <SERVICE_ROLE_KEY>  → Chave service_role (Dashboard → Settings → API)
-- Garante que as extensões existem
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Remove job anterior caso exista (idempotência)
do $$ begin if exists (
    select 1
    from cron.job
    where jobname = 'send-scheduled-reminders'
) then perform cron.unschedule('send-scheduled-reminders');
end if;
end $$;
-- Agenda o job: todo dia às 17:00 UTC (= 14:00 America/Sao_Paulo)
select cron.schedule(
        'send-scheduled-reminders',
        '0 17 * * *',
        $$
        select net.http_post(
                url := 'https://bevvknmdvjhhisnyfcyk.supabase.co/functions/v1/send-scheduled-reminders',
                headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJldnZrbm1kdmpoaGlzbnlmY3lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgyMDE5MywiZXhwIjoyMDkwMzk2MTkzfQ.11zkK7TMnzoWOBwolU4a1A41D2uHyyxwr-Pb_dkgU_M","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJldnZrbm1kdmpoaGlzbnlmY3lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgyMDE5MywiZXhwIjoyMDkwMzk2MTkzfQ.11zkK7TMnzoWOBwolU4a1A41D2uHyyxwr-Pb_dkgU_M"}'::jsonb,
                body := '{}'::jsonb
            ) $$
    );