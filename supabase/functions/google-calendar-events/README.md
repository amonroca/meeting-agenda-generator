# Google Calendar via Edge Function

Esta função evita expor `client_id`, `client_secret`, usuário, senha ou refresh token no frontend.

## Secrets necessárias no Supabase

Defina no projeto Supabase:

- GOOGLE_CALENDAR_ID
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_OAUTH_TOKEN_URL ou GOOGLE_TOKEN_URI

E uma das opções abaixo:

### Opção 1: refresh token

- GOOGLE_REFRESH_TOKEN

### Opção 2: fluxo OAuth com usuário e senha

- GOOGLE_OAUTH_USERNAME
- GOOGLE_OAUTH_PASSWORD
- GOOGLE_OAUTH_GRANT_TYPE
- GOOGLE_OAUTH_SCOPE

## Exemplo de deploy

1. configurar as secrets no projeto
2. fazer deploy da função `google-calendar-events`
3. manter no frontend apenas as chaves públicas do Supabase

## Observação

Depois do deploy, o frontend chama a função do Supabase e a função consulta o Google Calendar usando bearer token no backend.
