alter type public.meeting_type
add value if not exists 'sumo_conselho_estaca';
-- Expõe os valores do enum meeting_type via função RPC para o frontend consumir
create or replace function public.get_meeting_type_options() returns table(value text, label text) language sql stable security definer as $$
select e.enumlabel::text as value,
    case
        e.enumlabel::text
        when 'conselho_estaca' then 'Reunião de Conselho da Estaca'
        when 'coordenacao_missionaria_estaca' then 'Reunião de Coordenação Missionária da Estaca'
        when 'presidencia_estaca' then 'Reunião de Presidência da Estaca'
        when 'sumo_conselho_estaca' then 'Reunião do Sumo Conselho da Estaca'
        when 'outras' then 'Outras Reuniões'
        else initcap(replace(e.enumlabel::text, '_', ' '))
    end as label
from pg_enum e
    join pg_type t on e.enumtypid = t.oid
where t.typname = 'meeting_type'
order by e.enumsortorder;
$$;