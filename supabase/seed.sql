insert into public.organizations (name, slug, timezone)
values (
        'Estaca Exemplo',
        'estaca-exemplo',
        'America/Sao_Paulo'
    ) on conflict (slug) do nothing;
insert into public.organization_settings (
        organization_id,
        default_calendar_id,
        trello_board_id,
        drive_root_folder_id,
        type_folder_map
    )
select id,
    'primary',
    null,
    null,
    jsonb_build_object(
        'conselho_estaca',
        null,
        'coordenacao_missionaria_estaca',
        null,
        'presidencia_estaca',
        null,
        'outras',
        null
    )
from public.organizations
where slug = 'estaca-exemplo' on conflict (organization_id) do nothing;
-- Ajuste o email abaixo para promover o primeiro administrador.
update public.user_profiles
set organization_id = (
        select id
        from public.organizations
        where slug = 'estaca-exemplo'
    ),
    role = 'admin'
where email = 'admin@seudominio.com';