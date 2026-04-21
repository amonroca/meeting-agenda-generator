-- ============================================================
-- Corrige RLS de organization_settings:
--   • Qualquer usuário autenticado da mesma org pode
--     ler e gravar configurações (INSERT + UPDATE).
--   • DELETE continua restrito a admin.
-- ============================================================
-- Remove a política "para tudo" que bloqueava não-admins
drop policy if exists "settings_admin_manage" on public.organization_settings;
-- Leitura: qualquer usuário autenticado da mesma org (já existia, recria por garantia)
drop policy if exists "settings_select_same_org" on public.organization_settings;
create policy "settings_select_same_org" on public.organization_settings for
select to authenticated using (
        organization_id = public.current_organization_id()
    );
-- Escrita (INSERT + UPDATE): qualquer usuário autenticado da mesma org
create policy "settings_upsert_same_org" on public.organization_settings for
insert to authenticated with check (
        organization_id = public.current_organization_id()
    );
create policy "settings_update_same_org" on public.organization_settings for
update to authenticated using (
        organization_id = public.current_organization_id()
    ) with check (
        organization_id = public.current_organization_id()
    );
-- Exclusão: apenas admin
create policy "settings_delete_admin" on public.organization_settings for delete to authenticated using (
    organization_id = public.current_organization_id()
    and public.current_user_role() = 'admin'
);
-- ============================================================
-- Corrige RLS de meeting_minutes:
--   • Permite INSERT para qualquer usuário autenticado da
--     mesma org (a Edge Function já bypassa via service_role,
--     mas garante que chamadas diretas também funcionem).
--   • Permite UPDATE para qualquer usuário da mesma org
--     (Edge Function grava o resultado da geração).
-- ============================================================
drop policy if exists "minutes_insert_same_org" on public.meeting_minutes;
create policy "minutes_insert_same_org" on public.meeting_minutes for
insert to authenticated with check (
        organization_id = public.current_organization_id()
    );
drop policy if exists "minutes_update_admin_or_owner" on public.meeting_minutes;
create policy "minutes_update_same_org" on public.meeting_minutes for
update to authenticated using (
        organization_id = public.current_organization_id()
    ) with check (
        organization_id = public.current_organization_id()
    );
-- ============================================================
-- Corrige a view meeting_minutes_list:
--   • Adiciona sumo_conselho_estaca e presidencia_estaca
--     (que estava sem label dedicado)
-- ============================================================
create or replace view public.meeting_minutes_list as
select id,
    organization_id,
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
    generation_status,
    created_at
from public.meeting_minutes;