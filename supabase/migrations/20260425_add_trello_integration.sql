-- Adiciona campos de integração Trello em organization_settings
alter table public.organization_settings
add column if not exists trello_api_key text,
    add column if not exists trello_token text,
    add column if not exists trello_list_map jsonb not null default '{}'::jsonb;
-- Adiciona coluna para armazenar os cards Trello gerados por ata
alter table public.meeting_minutes
add column if not exists trello_cards jsonb not null default '[]'::jsonb;
-- Recria a view meeting_minutes_list para incluir trello_cards
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
    trello_cards,
    generation_status,
    created_at
from public.meeting_minutes;