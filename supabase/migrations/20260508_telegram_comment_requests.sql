-- Tabela para armazenar solicitações de comentário pendentes via Telegram
-- Quando um usuário clica em "💬 Comentar", registra aqui qual card ele quer comentar.
-- O próximo texto enviado pelo usuário ao bot será tratado como o comentário.
create table if not exists public.telegram_comment_requests (
    id uuid primary key default gen_random_uuid(),
    telegram_chat_id bigint not null unique,
    -- unique: apenas um pedido ativo por usuário
    card_id text not null,
    card_name text,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    created_at timestamptz not null default now()
);
create index if not exists idx_tcr_chat_id on public.telegram_comment_requests (telegram_chat_id);
-- RLS habilitado; apenas service role acessa esta tabela (via edge functions)
alter table public.telegram_comment_requests enable row level security;