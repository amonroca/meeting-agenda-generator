create extension if not exists pgcrypto;
create extension if not exists citext;
do $$ begin create type public.app_role as enum ('admin', 'user');
exception
when duplicate_object then null;
end $$;
do $$ begin create type public.meeting_type as enum (
    'conselho_estaca',
    'coordenacao_missionaria_estaca',
    'presidencia_estaca',
    'outras'
);
exception
when duplicate_object then null;
end $$;
do $$ begin create type public.integration_provider as enum ('google_calendar', 'google_drive', 'trello');
exception
when duplicate_object then null;
end $$;
do $$ begin create type public.integration_status as enum ('pending', 'connected', 'error', 'disabled');
exception
when duplicate_object then null;
end $$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now();
return new;
end;
$$;
create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    timezone text not null default 'America/Sao_Paulo',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    organization_id uuid references public.organizations(id) on delete
    set null,
        full_name text,
        email citext not null unique,
        role public.app_role not null default 'user',
        is_active boolean not null default true,
        avatar_url text,
        last_sign_in_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
);
create table if not exists public.organization_settings (
    organization_id uuid primary key references public.organizations(id) on delete cascade,
    default_calendar_id text,
    trello_board_id text,
    drive_root_folder_id text,
    type_folder_map jsonb not null default '{}'::jsonb,
    allowed_email_domains text [] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.integration_connections (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    provider public.integration_provider not null,
    status public.integration_status not null default 'pending',
    connected_by uuid references public.user_profiles(id) on delete
    set null,
        external_account_email citext,
        external_resource_id text,
        credentials_ref text,
        scopes text [] not null default '{}',
        config jsonb not null default '{}'::jsonb,
        last_sync_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, provider, external_resource_id)
);
create table if not exists public.meeting_minutes (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    google_event_id text not null,
    title text not null,
    meeting_type public.meeting_type not null default 'outras',
    meeting_at timestamptz not null,
    drive_file_id text not null unique,
    drive_file_url text not null,
    drive_folder_id text,
    summary text,
    attendees jsonb not null default '[]'::jsonb,
    tags text [] not null default '{}',
    generation_status text not null default 'ready' check (
        generation_status in ('processing', 'ready', 'failed', 'archived')
    ),
    generated_by uuid references public.user_profiles(id) on delete
    set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, google_event_id)
);
create index if not exists idx_user_profiles_organization on public.user_profiles (organization_id);
create index if not exists idx_user_profiles_role on public.user_profiles (role);
create index if not exists idx_integration_connections_org_provider on public.integration_connections (organization_id, provider);
create index if not exists idx_meeting_minutes_org_date on public.meeting_minutes (organization_id, meeting_at desc);
create index if not exists idx_meeting_minutes_type on public.meeting_minutes (meeting_type);
create index if not exists idx_meeting_minutes_status on public.meeting_minutes (generation_status);
create or replace function public.current_organization_id() returns uuid language sql stable security definer
set search_path = public as $$
select organization_id
from public.user_profiles
where id = auth.uid();
$$;
create or replace function public.current_user_role() returns public.app_role language sql stable security definer
set search_path = public as $$
select role
from public.user_profiles
where id = auth.uid();
$$;
create or replace function public.handle_user_profile_sync() returns trigger language plpgsql security definer
set search_path = public as $$
declare default_org_id uuid;
begin default_org_id := (
    select id
    from public.organizations
    order by created_at asc
    limit 1
);
insert into public.user_profiles (
        id,
        organization_id,
        full_name,
        email,
        last_sign_in_at
    )
values (
        new.id,
        default_org_id,
        coalesce(
            new.raw_user_meta_data->>'full_name',
            split_part(new.email, '@', 1)
        ),
        new.email,
        now()
    ) on conflict (id) do
update
set email = excluded.email,
    full_name = coalesce(
        excluded.full_name,
        public.user_profiles.full_name
    ),
    last_sign_in_at = now(),
    updated_at = now();
return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute function public.handle_user_profile_sync();
drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at before
update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at before
update on public.user_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_organization_settings_updated_at on public.organization_settings;
create trigger set_organization_settings_updated_at before
update on public.organization_settings for each row execute function public.set_updated_at();
drop trigger if exists set_integration_connections_updated_at on public.integration_connections;
create trigger set_integration_connections_updated_at before
update on public.integration_connections for each row execute function public.set_updated_at();
drop trigger if exists set_meeting_minutes_updated_at on public.meeting_minutes;
create trigger set_meeting_minutes_updated_at before
update on public.meeting_minutes for each row execute function public.set_updated_at();
alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.organization_settings enable row level security;
alter table public.integration_connections enable row level security;
alter table public.meeting_minutes enable row level security;
drop policy if exists "org_select_own" on public.organizations;
create policy "org_select_own" on public.organizations for
select to authenticated using (id = public.current_organization_id());
drop policy if exists "org_admin_update" on public.organizations;
create policy "org_admin_update" on public.organizations for
update to authenticated using (
        id = public.current_organization_id()
        and public.current_user_role() = 'admin'
    ) with check (
        id = public.current_organization_id()
        and public.current_user_role() = 'admin'
    );
drop policy if exists "profiles_select_same_org" on public.user_profiles;
create policy "profiles_select_same_org" on public.user_profiles for
select to authenticated using (
        organization_id = public.current_organization_id()
    );
drop policy if exists "profiles_update_self" on public.user_profiles;
create policy "profiles_update_self" on public.user_profiles for
update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_admin_manage" on public.user_profiles;
create policy "profiles_admin_manage" on public.user_profiles for all to authenticated using (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'admin'
) with check (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'admin'
);
drop policy if exists "settings_select_same_org" on public.organization_settings;
create policy "settings_select_same_org" on public.organization_settings for
select to authenticated using (
        organization_id = public.current_organization_id()
    );
drop policy if exists "settings_admin_manage" on public.organization_settings;
create policy "settings_admin_manage" on public.organization_settings for all to authenticated using (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'admin'
) with check (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'admin'
);
drop policy if exists "integrations_select_same_org" on public.integration_connections;
create policy "integrations_select_same_org" on public.integration_connections for
select to authenticated using (
        organization_id = public.current_organization_id()
    );
drop policy if exists "integrations_admin_manage" on public.integration_connections;
create policy "integrations_admin_manage" on public.integration_connections for all to authenticated using (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'admin'
) with check (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'admin'
);
drop policy if exists "minutes_select_same_org" on public.meeting_minutes;
create policy "minutes_select_same_org" on public.meeting_minutes for
select to authenticated using (
        organization_id = public.current_organization_id()
    );
drop policy if exists "minutes_insert_same_org" on public.meeting_minutes;
create policy "minutes_insert_same_org" on public.meeting_minutes for
insert to authenticated with check (
        organization_id = public.current_organization_id()
        and (
            public.current_user_role() = 'admin'
            or generated_by = auth.uid()
        )
    );
drop policy if exists "minutes_update_admin_or_owner" on public.meeting_minutes;
create policy "minutes_update_admin_or_owner" on public.meeting_minutes for
update to authenticated using (
        organization_id = public.current_organization_id()
        and (
            public.current_user_role() = 'admin'
            or generated_by = auth.uid()
        )
    ) with check (
        organization_id = public.current_organization_id()
        and (
            public.current_user_role() = 'admin'
            or generated_by = auth.uid()
        )
    );
create or replace view public.meeting_minutes_list as
select id,
    organization_id,
    title,
    case
        meeting_type
        when 'conselho_estaca' then 'Reunião de Conselho da Estaca'
        when 'coordenacao_missionaria_estaca' then 'Reunião de Coordenação Missionária da Estaca'
        when 'presidencia_estaca' then 'Reunião de Presidência da Estaca'
        else 'Outras Reuniões'
    end as meeting_type_label,
    meeting_type,
    meeting_at,
    drive_file_url,
    generation_status,
    created_at
from public.meeting_minutes;
comment on table public.user_profiles is 'Perfis dos usuários autenticados via Supabase Auth.';
comment on table public.integration_connections is 'Metadados das integrações com Google Calendar, Google Drive e Trello.';
comment on table public.meeting_minutes is 'Metadados das atas geradas e armazenadas no Google Drive.';