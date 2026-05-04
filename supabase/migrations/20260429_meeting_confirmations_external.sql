-- Permite que meeting_confirmations registre tanto usuários internos quanto contatos externos
-- user_id passa a ser nullable; telegram_contact_id é adicionado como FK para telegram_contacts
alter table public.meeting_confirmations
    alter column user_id drop not null;

alter table public.meeting_confirmations
    add column if not exists telegram_contact_id uuid references public.telegram_contacts(id) on delete cascade;

-- Garante que ao menos um dos dois identificadores esteja preenchido
alter table public.meeting_confirmations
    drop constraint if exists meeting_confirmations_owner_check;

alter table public.meeting_confirmations
    add constraint meeting_confirmations_owner_check
    check (
        (user_id is not null and telegram_contact_id is null)
        or
        (user_id is null and telegram_contact_id is not null)
    );

-- Atualiza a unique constraint para cobrir ambos os casos
alter table public.meeting_confirmations
    drop constraint if exists meeting_confirmations_google_event_id_user_id_key;

create unique index if not exists idx_meeting_confirmations_user
    on public.meeting_confirmations (google_event_id, user_id)
    where user_id is not null;

create unique index if not exists idx_meeting_confirmations_contact
    on public.meeting_confirmations (google_event_id, telegram_contact_id)
    where telegram_contact_id is not null;

-- Atualiza políticas RLS para incluir acesso a confirmações de contatos externos
-- (a política de visualização já cobre por organization_id, que continua not null)
