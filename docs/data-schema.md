# Data schema do projeto

## O que ficará no Supabase

O Supabase será responsável por armazenar apenas os dados persistentes da aplicação:

- usuários autenticados e seus perfis
- papéis de acesso, com administrador e usuário comum
- configuração das integrações
- metadados das atas geradas
- status de sincronização das integrações

## O que não precisa ficar no Supabase

Esses dados podem ser consumidos sob demanda pelas integrações:

- reuniões vindas do Google Calendar
- tarefas vindas do Trello
- arquivos completos das atas, que ficarão no Google Drive

## Tabelas criadas

### organizations

Representa a unidade da aplicação, como uma estaca, workspace ou organização.

Campos principais:

- id
- name
- slug
- timezone

### user_profiles

Complementa a tabela nativa de autenticação do Supabase.

Campos principais:

- id vinculado ao auth.users
- organization_id
- full_name
- email
- role com admin ou user
- is_active

### organization_settings

Guarda os identificadores e preferências necessários para as integrações.

Campos principais:

- default_calendar_id
- trello_board_id
- drive_root_folder_id
- type_folder_map
- allowed_email_domains

### integration_connections

Registra o estado das integrações externas.

Campos principais:

- provider
- status
- external_account_email
- external_resource_id
- credentials_ref
- scopes
- last_sync_at

### meeting_minutes

Armazena somente os metadados das atas geradas.

Campos principais:

- google_event_id
- title
- meeting_type
- meeting_at
- drive_file_id
- drive_file_url
- summary
- attendees
- generation_status

## Coisas importantes que estavam faltando e eu incluí

Além da tabela de usuários, existem três pontos importantes para o sistema funcionar bem:

1. organização ou estaca
   - para separar dados por unidade e controlar permissões

2. configurações das integrações
   - para salvar calendar id, board id do Trello e pasta do Google Drive por tipo de reunião

3. metadados das atas
   - como o arquivo fica no Google Drive, o Supabase precisa guardar o vínculo com o evento do Google Calendar e os filtros da listagem

## Filtros suportados

A tabela de atas foi preparada para filtrar por:

- data da reunião
- tipo de reunião
- status de geração

Tipos cadastrados:

- Reunião de Conselho da Estaca
- Reunião de Coordenação Missionária da Estaca
- Reunião de Presidência da Estaca
- Outras Reuniões

## Arquivo SQL

O schema completo está em:

- supabase/migrations/20260418_initial_schema.sql
