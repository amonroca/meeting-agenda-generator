-- Adiciona campos de integração Telegram em user_profiles
alter table public.user_profiles
add column if not exists telegram_chat_id bigint unique,
    add column if not exists telegram_link_token text unique;
-- Tabela de confirmações de presença em reuniões via Telegram
create table if not exists public.meeting_confirmations (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    google_event_id text not null,
    user_id uuid not null references public.user_profiles(id) on delete cascade,
    status text not null check (status in ('confirmed', 'declined')),
    responded_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (google_event_id, user_id)
);
create index if not exists idx_meeting_confirmations_event on public.meeting_confirmations (organization_id, google_event_id);
-- RLS
alter table public.meeting_confirmations enable row level security;
create policy "Membros da org visualizam confirmações" on public.meeting_confirmations for
select using (
        organization_id = (
            select organization_id
            from public.user_profiles
            where id = auth.uid()
        )
    );
create policy "Usuário registra própria confirmação" on public.meeting_confirmations for
insert with check (user_id = auth.uid());
create policy "Usuário atualiza própria confirmação" on public.meeting_confirmations for
update using (user_id = auth.uid());