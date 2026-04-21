-- Recria a view meeting_minutes_list para incluir google_event_id e attendees
-- É necessário DROP + CREATE pois não é possível reordenar colunas com CREATE OR REPLACE
drop view if exists public.meeting_minutes_list;
create view public.meeting_minutes_list as
select id,
    organization_id,
    google_event_id,
    title,
    case
        meeting_type
        when 'conselho_estaca' then 'Reunião de Conselho da Estaca'
        when 'coordenacao_missionaria_estaca' then 'Reunião de Coordenação Missionária da Estaca'
        when 'presidencia_estaca' then 'Reunião de Presidência da Estaca'
        when 'sumo_conselho_estaca' then 'Reunião do Sumo Conselho da Estaca'
        else 'Outras Reuniões'
    end as meeting_type_label,
    meeting_type,
    meeting_at,
    drive_file_url,
    attendees,
    generation_status,
    created_at
from public.meeting_minutes;