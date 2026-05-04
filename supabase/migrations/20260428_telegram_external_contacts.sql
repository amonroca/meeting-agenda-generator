-- Códigos temporários gerados pelo bot quando alguém envia /start
-- O admin usa o código para vincular o chat_id ao contato cadastrado no app
create table if not exists public.telegram_link_codes (
    id uuid primary key default gen_random_uuid(),
    telegram_chat_id bigint not null,
    code text not null unique,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '48 hours')
);

create index if not exists idx_telegram_link_codes_code on public.telegram_link_codes (code);
create index if not exists idx_telegram_link_codes_chat_id on public.telegram_link_codes (telegram_chat_id);

-- Contatos externos (líderes sem login na aplicação) que receberão notificações via Telegram
create table if not exists public.telegram_contacts (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    full_name text not null,
    role text,
    telegram_chat_id bigint unique,
    meeting_types text[] not null default '{}',
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_telegram_contacts_org on public.telegram_contacts (organization_id);

create trigger set_telegram_contacts_updated_at
    before update on public.telegram_contacts
    for each row execute function public.set_updated_at();

-- RLS para telegram_contacts
alter table public.telegram_contacts enable row level security;

create policy "Admins gerenciam contatos externos" on public.telegram_contacts
    for all
    using (
        organization_id = (
            select organization_id from public.user_profiles where id = auth.uid()
        )
        and exists (
            select 1 from public.user_profiles
            where id = auth.uid() and role = 'admin'
        )
    );

create policy "Membros visualizam contatos externos" on public.telegram_contacts
    for select
    using (
        organization_id = (
            select organization_id from public.user_profiles where id = auth.uid()
        )
    );

-- RLS para telegram_link_codes (sem autenticação — o bot usa service role key)
-- Apenas a Edge Function com service role key acessa essa tabela
