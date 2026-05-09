-- Adiciona coluna notification_meeting_types em user_profiles
-- Array vazio = recebe notificações de todos os tipos (retrocompatível)
alter table public.user_profiles
add column if not exists notification_meeting_types text [] not null default '{}';