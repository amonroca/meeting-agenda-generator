-- Permite status 'pending' para confirmações criadas antes da resposta do usuário
alter table public.meeting_confirmations drop constraint if exists meeting_confirmations_status_check;
alter table public.meeting_confirmations
add constraint meeting_confirmations_status_check check (status in ('pending', 'confirmed', 'declined'));
alter table public.meeting_confirmations
alter column status
set default 'pending';