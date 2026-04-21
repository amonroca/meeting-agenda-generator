# generate-meeting-minutes

Edge Function que recebe a transcrição de uma reunião, gera a ata via Azure OpenAI e salva o documento no Google Docs/Drive, registrando o resultado no Supabase.

## Fluxo

```
Frontend → Edge Function
  1. Upsert em meeting_minutes com status "processing"
  2. Busca configurações da organização (pastas do Drive)
  3. Obtém token OAuth do Google (refresh_token)
  4. Chama Azure OpenAI (GPT-4o) para gerar a ata
  5. Cria documento no Google Docs
  6. Move para a pasta correta no Google Drive
  7. Atualiza meeting_minutes com status "ready", drive_file_id e drive_file_url
```

Em caso de erro, o registro é atualizado para status `"failed"`.

## Payload (POST)

```json
{
  "googleEventId": "string (obrigatório)",
  "title": "string (obrigatório)",
  "meetingType": "conselho_estaca | presidencia_estaca | ... (obrigatório)",
  "meetingAt": "ISO 8601 (obrigatório)",
  "transcript": "string com a transcrição (obrigatório)",
  "organizationId": "uuid (obrigatório)",
  "attendees": ["Nome 1", "Nome 2"]
}
```

## Resposta de sucesso

```json
{
  "success": true,
  "documentId": "google-docs-file-id",
  "webViewLink": "https://docs.google.com/document/d/..."
}
```

## Secrets necessárias

| Secret                      | Descrição                                                                 |
| --------------------------- | ------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`          | ID do cliente OAuth                                                       |
| `GOOGLE_CLIENT_SECRET`      | Secret do cliente OAuth                                                   |
| `GOOGLE_REFRESH_TOKEN`      | Refresh token com escopo `drive` e `docs`                                 |
| `AZURE_OPENAI_ENDPOINT`     | URL do endpoint Azure OpenAI (ex: `https://seu-recurso.openai.azure.com`) |
| `AZURE_OPENAI_API_KEY`      | Chave de API do Azure OpenAI                                              |
| `AZURE_OPENAI_DEPLOYMENT`   | Nome do deployment (padrão: `gpt-4o`)                                     |
| `AZURE_OPENAI_API_VERSION`  | Versão da API (padrão: `2024-02-01`)                                      |
| `SUPABASE_URL`              | URL do projeto Supabase (injetada automaticamente)                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (injetada automaticamente)                               |

## Escopos OAuth necessários

O refresh token deve incluir os escopos:

- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/drive`

## Pastas por tipo de reunião

Configure em `organization_settings.type_folder_map` (JSONB) o mapeamento entre `meeting_type` e o ID da pasta no Google Drive:

```json
{
  "conselho_estaca": "folder-id-1",
  "presidencia_estaca": "folder-id-2",
  "sumo_conselho_estaca": "folder-id-3"
}
```

Se não houver mapeamento para o tipo, usa `drive_root_folder_id`. Se nenhum estiver configurado, o documento fica na raiz do Drive.
