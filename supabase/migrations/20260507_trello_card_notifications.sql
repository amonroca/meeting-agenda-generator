-- Registra cada notificação Telegram enviada para o responsável de uma tarefa Trello
create table if not exists public.trello_card_notifications (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    card_id text not null,
    minute_id uuid not null references public.meeting_minutes(id) on delete cascade,
    sent_by uuid references auth.users(id) on delete
    set null,
        sent_at timestamptz not null default now()
);
create index if not exists idx_trello_card_notif_card on public.trello_card_notifications (card_id);
create index if not exists idx_trello_card_notif_org on public.trello_card_notifications (organization_id);
alter table public.trello_card_notifications enable row level security;
create policy "Membros visualizam notificações de tarefas" on public.trello_card_notifications for
select using (
        organization_id = (
            select organization_id
            from public.user_profiles
            where id = auth.uid()
        )
    );
create policy "Membros inserem notificações de tarefas" on public.trello_card_notifications for
insert with check (
        organization_id = (
            select organization_id
            from public.user_profiles
            where id = auth.uid()
        )
    );