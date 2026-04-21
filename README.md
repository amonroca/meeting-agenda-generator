# Meeting Agenda Generator

Boilerplate frontend moderno em React + Vite com autenticação, rotas protegidas e menu lateral responsivo.

## Stack

- React + Vite
- React Router
- Context API para autenticação
- Material UI para interface

## Páginas

- Login
- Dashboard
- Reuniões
- Tarefas
- Configurações

## Estrutura

```bash
src/
  components/
  context/
  hooks/
  layouts/
  pages/
  routes/
```

## Como rodar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy da função do Google Calendar

1. faça login no Supabase CLI
2. conecte o projeto ao seu projeto Supabase
3. cadastre as secrets da função
4. publique a função

Comandos:

```bash
npx supabase login
npx supabase link --project-ref bevvknmdvjhhisnyfcyk
npx supabase secrets set GOOGLE_CALENDAR_ID=seu_calendar_id GOOGLE_CLIENT_ID=seu_client_id GOOGLE_CLIENT_SECRET=seu_client_secret GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token GOOGLE_REFRESH_TOKEN=seu_refresh_token
npx supabase functions deploy google-calendar-events
```

Também há atalhos no projeto:

```bash
npm run supabase:function:serve
npm run supabase:function:deploy
```

## Login demo

A autenticação atual usa Supabase Auth com verificação por email.
